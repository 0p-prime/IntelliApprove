"""
Real-Time Aggregated and Role-Scoped Dashboard Endpoints for IntelliApprove.
Implements:
- GET /dashboard/summary (total, in-progress, returned, completed, overdue, SLA breach, approaching deadline)
- GET /dashboard/stage-funnel (count per stage)
- GET /dashboard/ageing (buckets 0-7, 8-15, 16-30, 30+ days)
- GET /dashboard/region-performance (avg processing days, pendency per region)
- GET /dashboard/officer-workload (cases per officer, overdue per officer)
- GET /dashboard/bottlenecks (stages with highest average dwell time)
- GET /dashboard/upcoming-deadlines (next 14 days across all modules)
"""
import json
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.entities import (
    User,
    UserRole,
    Application,
    Region,
    Institution,
    EVCSchedule,
    Undertaking,
    Document,
    StageHistory,
    SystemClock,
    Escalation
)
from app.core.scoping import (
    scope_applications_by_role,
    scope_institutions_by_role,
    scope_evc_schedules_by_role,
    scope_undertakings_by_role,
    scope_documents_by_role,
    get_user_institution,
    get_evc_assigned_app_ids
)

router = APIRouter()


def get_system_now(db: Session) -> datetime:
    """Returns current simulated time from SystemClock if active, else UTC now (naive)."""
    clock = db.query(SystemClock).first()
    if clock and clock.simulated_date:
        d = clock.simulated_date
        return d.replace(tzinfo=None) if d.tzinfo else d
    return datetime.utcnow()


def to_naive_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """Converts a timezone-aware or naive datetime to naive UTC."""
    if dt is None:
        return None
    if dt.tzinfo:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


@router.get("/summary")
def get_dashboard_summary(
    region_id: Optional[int] = Query(None, description="Optional region filter for National view"),
    stage: Optional[str] = Query(None, description="Optional stage filter"),
    date_from: Optional[datetime] = Query(None, description="Filter submitted_at >= date_from"),
    date_to: Optional[datetime] = Query(None, description="Filter submitted_at <= date_to"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Returns aggregated real-time metrics scoped to the current user's role.
    Includes counters for: total, in-progress, returned, completed, overdue, SLA breach (red),
    and approaching deadline (amber), plus top overdue cases.
    """
    now = get_system_now(db)
    base_query = scope_applications_by_role(db.query(Application), current_user, db)

    # Optional query filters
    if region_id is not None and current_user.role in [UserRole.ADMIN.value, UserRole.BUREAU_OFFICER.value, "COMPETENT_AUTHORITY"]:
        base_query = base_query.filter(Application.region_id == region_id)
    if stage and stage != "ALL":
        base_query = base_query.filter(Application.current_stage == stage)
    if date_from:
        base_query = base_query.filter(Application.submitted_at >= to_naive_utc(date_from))
    if date_to:
        base_query = base_query.filter(Application.submitted_at <= to_naive_utc(date_to))

    total = base_query.count()
    completed = base_query.filter(Application.status.in_(["APPROVED", "REJECTED"])).count()
    approved = base_query.filter(Application.status == "APPROVED").count()
    rejected = base_query.filter(Application.status == "REJECTED").count()
    returned = base_query.filter(Application.status == "RETURNED").count()
    in_progress = base_query.filter(Application.status.notin_(["APPROVED", "REJECTED", "RETURNED"])).count()

    # Overdue active applications
    overdue_q = base_query.filter(
        Application.due_date < now,
        Application.status.notin_(["APPROVED", "REJECTED"])
    )
    overdue_count = overdue_q.count()

    # Red SLA Breach: overdue OR explicitly marked ESCALATED
    sla_breach_count = base_query.filter(
        Application.status.notin_(["APPROVED", "REJECTED"]),
        or_(Application.due_date < now, Application.status == "ESCALATED")
    ).count()

    # Amber Approaching Deadline: due within next 3 days (due_date between now and now + 3 days)
    three_days_later = now + timedelta(days=3)
    approaching_deadline_count = base_query.filter(
        Application.status.notin_(["APPROVED", "REJECTED"]),
        Application.due_date >= now,
        Application.due_date <= three_days_later
    ).count()

    # Average risk score
    avg_risk = base_query.with_entities(func.avg(Application.risk_score)).scalar()
    avg_risk_score = round(float(avg_risk), 1) if avg_risk is not None else 25.0

    # Top overdue cases list (for quick table display)
    top_overdue = overdue_q.order_by(Application.due_date.asc()).limit(5).all()
    top_overdue_list = [
        {
            "id": app.id,
            "ref_no": app.ref_no,
            "institution_name": app.institution.name if app.institution else "Unknown",
            "region_name": app.region.name if app.region else "Unknown",
            "current_stage": app.current_stage,
            "status": app.status,
            "due_date": app.due_date.isoformat() if app.due_date else None,
            "days_overdue": max(1, (now - app.due_date).days) if app.due_date else 0,
            "assigned_officer_name": app.assigned_officer.name if app.assigned_officer else "Unassigned",
            "risk_score": app.risk_score
        }
        for app in top_overdue
    ]

    # Role-specific contextual metrics
    role_metrics: Dict[str, Any] = {}
    if current_user.role == UserRole.INSTITUTION.value:
        inst = get_user_institution(current_user, db)
        if inst:
            doc_nearing_exp = db.query(Document).filter(
                Document.institution_id == inst.id,
                Document.expiry_date != None,
                Document.expiry_date >= now,
                Document.expiry_date <= now + timedelta(days=30)
            ).count()
            active_und = db.query(Undertaking).filter(
                Undertaking.institution_id == inst.id,
                Undertaking.status.in_(["PENDING", "DUE_SOON", "OVERDUE"])
            ).count()
            role_metrics = {
                "institution_id": inst.id,
                "institution_name": inst.name,
                "compliance_score": 88.5,
                "documents_nearing_expiry": doc_nearing_exp,
                "active_undertakings": active_und,
                "pending_actions": returned
            }
    elif current_user.role in [UserRole.EVC_MEMBER.value, "EVC_INSPECTOR"]:
        assigned_ids = get_evc_assigned_app_ids(current_user, db)
        schedules_q = db.query(EVCSchedule).filter(EVCSchedule.application_id.in_(assigned_ids))
        total_visits = schedules_q.count()
        upcoming_visits = schedules_q.filter(
            EVCSchedule.scheduled_date >= now - timedelta(days=1),
            EVCSchedule.scheduled_date <= now + timedelta(days=14)
        ).count()
        pending_reports = schedules_q.filter(EVCSchedule.status.in_(["SCHEDULED", "IN_PROGRESS", "OVERDUE"])).count()
        completed_visits = schedules_q.filter(EVCSchedule.status == "COMPLETED").count()
        role_metrics = {
            "assigned_visits": total_visits,
            "upcoming_visits": upcoming_visits,
            "pending_reports": pending_reports,
            "completed_visits": completed_visits
        }
    elif current_user.role in [UserRole.REGIONAL_OFFICER.value, UserRole.REGIONAL_HEAD.value, "SCRUTINY_OFFICER"]:
        reg = db.query(Region).filter(Region.id == current_user.region_id).first()
        team_count = db.query(User).filter(User.region_id == current_user.region_id).count() if current_user.region_id else 0
        role_metrics = {
            "region_id": current_user.region_id,
            "region_name": reg.name if reg else "Regional Office",
            "team_size": team_count
        }

    return {
        "summary": {
            "total": total,
            "in_progress": in_progress,
            "returned": returned,
            "completed": completed,
            "approved": approved,
            "rejected": rejected,
            "overdue": overdue_count,
            "sla_breach_count": sla_breach_count,
            "approaching_deadline_count": approaching_deadline_count,
            "average_risk_score": avg_risk_score,
            "timestamp": now.isoformat()
        },
        "top_overdue_cases": top_overdue_list,
        "role_context": role_metrics,
        "user_role": current_user.role,
        "jurisdiction": "National" if current_user.role in [UserRole.ADMIN.value, UserRole.BUREAU_OFFICER.value] else (
            current_user.region.name if getattr(current_user, "region", None) else "Regional"
        )
    }


@router.get("/stage-funnel")
def get_stage_funnel(
    region_id: Optional[int] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    """
    Returns application count per stage in the canonical workflow funnel order.
    """
    base_query = scope_applications_by_role(db.query(Application), current_user, db)

    if region_id is not None and current_user.role in [UserRole.ADMIN.value, UserRole.BUREAU_OFFICER.value, "COMPETENT_AUTHORITY"]:
        base_query = base_query.filter(Application.region_id == region_id)
    if date_from:
        base_query = base_query.filter(Application.submitted_at >= to_naive_utc(date_from))
    if date_to:
        base_query = base_query.filter(Application.submitted_at <= to_naive_utc(date_to))

    total = max(1, base_query.count())

    canonical_stages = [
        {"stage": "SUBMITTED", "stage_name": "1. Submission", "sla_hours": 48, "color": "#0B2240"},
        {"stage": "SCRUTINY", "stage_name": "2. Scrutiny", "sla_hours": 72, "color": "#1E3A8A"},
        {"stage": "EVC", "stage_name": "3. EVC Inspection", "sla_hours": 336, "color": "#0284C7"},
        {"stage": "SAC_SHC", "stage_name": "4. SAC/SHC Hearing", "sla_hours": 120, "color": "#D97706"},
        {"stage": "BUREAU_DECISION", "stage_name": "5. Bureau Decision", "sla_hours": 72, "color": "#B45309"},
        {"stage": "APPROVED", "stage_name": "Approved (EoA)", "sla_hours": 0, "color": "#15803D"},
        {"stage": "REJECTED", "stage_name": "Refused / Rejected", "sla_hours": 0, "color": "#DC2626"}
    ]

    funnel_data = []
    for s in canonical_stages:
        if s["stage"] == "SCRUTINY":
            cnt = base_query.filter(Application.current_stage.in_(["SCRUTINY", "DEFICIENT"])).count()
        else:
            cnt = base_query.filter(Application.current_stage == s["stage"]).count()

        funnel_data.append({
            "stage": s["stage"],
            "stage_name": s["stage_name"],
            "count": cnt,
            "percentage": round((cnt / total) * 100, 1),
            "sla_hours": s["sla_hours"],
            "color": s["color"]
        })

    return funnel_data


@router.get("/ageing")
def get_ageing(
    region_id: Optional[int] = Query(None),
    stage: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    """
    Returns active application ageing in standard government audit buckets:
    0-7 days, 8-15 days, 16-30 days, 30+ days.
    """
    now = get_system_now(db)
    base_query = scope_applications_by_role(db.query(Application), current_user, db)

    # Scoped to active applications
    base_query = base_query.filter(Application.status.notin_(["APPROVED", "REJECTED"]))

    if region_id is not None and current_user.role in [UserRole.ADMIN.value, UserRole.BUREAU_OFFICER.value, "COMPETENT_AUTHORITY"]:
        base_query = base_query.filter(Application.region_id == region_id)
    if stage and stage != "ALL":
        base_query = base_query.filter(Application.current_stage == stage)

    active_apps = base_query.all()
    total_active = max(1, len(active_apps))

    b_0_7 = {"bucket": "0-7 Days", "range": "0-7", "count": 0, "overdue_count": 0, "color": "#15803D"}
    b_8_15 = {"bucket": "8-15 Days", "range": "8-15", "count": 0, "overdue_count": 0, "color": "#0284C7"}
    b_16_30 = {"bucket": "16-30 Days", "range": "16-30", "count": 0, "overdue_count": 0, "color": "#D97706"}
    b_30_plus = {"bucket": "30+ Days", "range": "30+", "count": 0, "overdue_count": 0, "color": "#DC2626"}

    for app in active_apps:
        ref_time = app.submitted_at or app.stage_entered_at
        age_days = max(0, (now - ref_time).days) if ref_time else 0
        is_ovd = bool(app.due_date and app.due_date < now)

        if age_days <= 7:
            b_0_7["count"] += 1
            if is_ovd:
                b_0_7["overdue_count"] += 1
        elif age_days <= 15:
            b_8_15["count"] += 1
            if is_ovd:
                b_8_15["overdue_count"] += 1
        elif age_days <= 30:
            b_16_30["count"] += 1
            if is_ovd:
                b_16_30["overdue_count"] += 1
        else:
            b_30_plus["count"] += 1
            if is_ovd:
                b_30_plus["overdue_count"] += 1

    for b in [b_0_7, b_8_15, b_16_30, b_30_plus]:
        b["percentage"] = round((b["count"] / total_active) * 100, 1)

    return [b_0_7, b_8_15, b_16_30, b_30_plus]


@router.get("/region-performance")
def get_region_performance(
    stage: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    """
    Returns pendency, overdue counts, and average processing days across all 8 AICTE regions.
    """
    now = get_system_now(db)
    regions = db.query(Region).order_by(Region.id.asc()).all()

    result = []
    for reg in regions:
        reg_apps_q = db.query(Application).filter(Application.region_id == reg.id)
        if stage and stage != "ALL":
            reg_apps_q = reg_apps_q.filter(Application.current_stage == stage)

        all_reg_apps = reg_apps_q.all()
        total_reg = len(all_reg_apps)
        pendency = sum(1 for a in all_reg_apps if a.status not in ["APPROVED", "REJECTED"])
        overdue = sum(1 for a in all_reg_apps if a.status not in ["APPROVED", "REJECTED"] and a.due_date and a.due_date < now)
        completed = sum(1 for a in all_reg_apps if a.status in ["APPROVED", "REJECTED"])

        # Average processing dwell days
        dwells = []
        for a in all_reg_apps:
            if a.submitted_at:
                if a.status in ["APPROVED", "REJECTED"]:
                    dwells.append(max(1, (a.stage_entered_at - a.submitted_at).days))
                else:
                    dwells.append(max(1, (now - a.submitted_at).days))

        avg_days = round(sum(dwells) / max(1, len(dwells)), 1) if dwells else 12.0
        compliance_rate = round(((pendency - overdue) / max(1, pendency)) * 100, 1) if pendency > 0 else 100.0

        is_user_reg = (current_user.region_id == reg.id) if current_user.region_id else False

        result.append({
            "region_id": reg.id,
            "region_name": reg.name,
            "total_applications": total_reg,
            "pendency": pendency,
            "overdue": overdue,
            "completed": completed,
            "avg_processing_days": avg_days,
            "sla_compliance_rate": compliance_rate,
            "is_user_region": is_user_reg
        })

    # If regional officer/head, sort user's own region to the top
    if current_user.role in [UserRole.REGIONAL_OFFICER.value, UserRole.REGIONAL_HEAD.value]:
        result.sort(key=lambda r: 0 if r["is_user_region"] else 1)

    return result


@router.get("/officer-workload")
def get_officer_workload(
    region_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    """
    Returns active cases and overdue cases per officer.
    Scoped to the region for regional heads / officers.
    """
    now = get_system_now(db)
    officers_q = db.query(User).filter(
        User.role.in_([
            UserRole.REGIONAL_OFFICER.value,
            UserRole.REGIONAL_HEAD.value,
            UserRole.BUREAU_OFFICER.value,
            UserRole.ADMIN.value,
            "SCRUTINY_OFFICER",
            "COMPETENT_AUTHORITY"
        ])
    )

    if current_user.role in [UserRole.REGIONAL_OFFICER.value, UserRole.REGIONAL_HEAD.value, "SCRUTINY_OFFICER"]:
        if current_user.region_id is not None:
            officers_q = officers_q.filter(User.region_id == current_user.region_id)
    elif region_id is not None and current_user.role in [UserRole.ADMIN.value, UserRole.BUREAU_OFFICER.value]:
        officers_q = officers_q.filter(User.region_id == region_id)

    officers = officers_q.order_by(User.name.asc()).all()

    workload_data = []
    for off in officers:
        assigned_q = db.query(Application).filter(Application.assigned_officer_id == off.id)
        active_cnt = assigned_q.filter(Application.status.notin_(["APPROVED", "REJECTED"])).count()
        overdue_cnt = assigned_q.filter(
            Application.status.notin_(["APPROVED", "REJECTED"]),
            Application.due_date < now
        ).count()
        completed_cnt = assigned_q.filter(Application.status.in_(["APPROVED", "REJECTED"])).count()

        workload_data.append({
            "officer_id": off.id,
            "officer_name": off.name,
            "officer_role": off.role.replace("_", " ").title(),
            "region_name": off.region.name if off.region else "National Headquarters",
            "active_cases": active_cnt,
            "overdue_cases": overdue_cnt,
            "completed_cases": completed_cnt,
            "utilization_pct": min(100, round((active_cnt / 15.0) * 100, 1))
        })

    # Sort descending by active cases
    workload_data.sort(key=lambda o: (o["overdue_cases"], o["active_cases"]), reverse=True)
    return workload_data


@router.get("/bottlenecks")
def get_bottlenecks(
    region_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    """
    Computes average dwell times across workflow stages to identify operational bottlenecks.
    """
    now = get_system_now(db)
    stages = [
        {"stage": "SUBMITTED", "stage_name": "Initial Submission", "standard_days": 2.0},
        {"stage": "SCRUTINY", "stage_name": "Document Scrutiny", "standard_days": 3.0},
        {"stage": "EVC", "stage_name": "EVC Physical Inspection", "standard_days": 14.0},
        {"stage": "SAC_SHC", "stage_name": "SAC/SHC Hearing", "standard_days": 5.0},
        {"stage": "BUREAU_DECISION", "stage_name": "Bureau Decision", "standard_days": 3.0}
    ]

    base_app_q = scope_applications_by_role(db.query(Application), current_user, db)
    if region_id is not None and current_user.role in [UserRole.ADMIN.value, UserRole.BUREAU_OFFICER.value]:
        base_app_q = base_app_q.filter(Application.region_id == region_id)

    bottlenecks = []
    for st in stages:
        stage_key = st["stage"]

        # 1. Historical dwell time from StageHistory
        hist_records = db.query(StageHistory).filter(
            StageHistory.stage == stage_key,
            StageHistory.completed_at != None
        ).limit(100).all()

        dwell_days_list = [
            max(0.1, (h.completed_at - h.entered_at).total_seconds() / 86400.0)
            for h in hist_records
        ]

        # 2. Active cases currently at this stage
        active_at_stage = base_app_q.filter(
            Application.current_stage == stage_key,
            Application.status.notin_(["APPROVED", "REJECTED"])
        ).all()

        for a in active_at_stage:
            dwell_days_list.append(max(0.1, (now - a.stage_entered_at).total_seconds() / 86400.0))

        avg_dwell = round(sum(dwell_days_list) / max(1, len(dwell_days_list)), 1) if dwell_days_list else st["standard_days"]
        current_pending = len(active_at_stage)

        # Longest case
        longest_app = None
        max_dwell = 0.0
        for a in active_at_stage:
            d = (now - a.stage_entered_at).total_seconds() / 86400.0
            if d > max_dwell:
                max_dwell = d
                longest_app = a

        ratio = avg_dwell / st["standard_days"]
        severity = "HIGH" if ratio >= 1.3 or current_pending > 25 else "MEDIUM" if ratio >= 1.0 else "LOW"

        bottlenecks.append({
            "stage": stage_key,
            "stage_name": st["stage_name"],
            "avg_dwell_days": avg_dwell,
            "sla_standard_days": st["standard_days"],
            "current_pending_cases": current_pending,
            "bottleneck_severity": severity,
            "longest_dwell_days": round(max_dwell, 1),
            "longest_dwell_ref": longest_app.ref_no if longest_app else "None",
            "longest_dwell_inst": longest_app.institution.name if longest_app and longest_app.institution else "None"
        })

    # Sort descending by ratio of dwell / standard
    bottlenecks.sort(key=lambda b: b["avg_dwell_days"] / max(0.1, b["sla_standard_days"]), reverse=True)
    return bottlenecks


@router.get("/upcoming-deadlines")
def get_upcoming_deadlines(
    days: int = Query(14, description="Lookahead window in days (default 14)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    """
    Returns upcoming deadlines within the next 14 days aggregated across all modules:
    - Application SLA due dates
    - EVC physical inspection schedules
    - Statutory undertakings
    - Institutional document/lease expiries
    """
    now = get_system_now(db)
    window_end = now + timedelta(days=days)
    overdue_floor = now - timedelta(days=7)  # Include recent overdue items

    deadlines: List[Dict[str, Any]] = []

    # 1. Applications SLA Deadlines
    apps_q = scope_applications_by_role(db.query(Application), current_user, db)
    scoped_apps = apps_q.filter(
        Application.status.notin_(["APPROVED", "REJECTED"]),
        Application.due_date != None,
        Application.due_date >= overdue_floor,
        Application.due_date <= window_end
    ).order_by(Application.due_date.asc()).limit(20).all()

    for a in scoped_apps:
        days_rem = (a.due_date - now).days
        is_ovd = a.due_date < now
        deadlines.append({
            "id": f"APP-{a.id}",
            "module": "APPLICATION",
            "title": f"{a.current_stage} Stage SLA Deadline",
            "ref_no": a.ref_no,
            "institution_name": a.institution.name if a.institution else "Unknown",
            "region_name": a.region.name if a.region else "Unknown",
            "due_date": a.due_date.isoformat(),
            "days_remaining": days_rem,
            "is_overdue": is_ovd,
            "severity": "CRITICAL" if is_ovd or days_rem <= 1 else "WARNING" if days_rem <= 3 else "INFO",
            "link": f"/applications/{a.id}"
        })

    # 2. EVC Inspection Schedules
    evc_q = scope_evc_schedules_by_role(db.query(EVCSchedule), current_user, db)
    scoped_evcs = evc_q.filter(
        EVCSchedule.status != "COMPLETED",
        EVCSchedule.scheduled_date >= overdue_floor,
        EVCSchedule.scheduled_date <= window_end
    ).order_by(EVCSchedule.scheduled_date.asc()).limit(15).all()

    for e in scoped_evcs:
        target_date = e.due_date or e.scheduled_date
        days_rem = (target_date - now).days
        is_ovd = target_date < now
        app = e.application
        deadlines.append({
            "id": f"EVC-{e.id}",
            "module": "EVC",
            "title": f"EVC Inspection ({'New Campus' if e.is_new_institution else 'Regular Inspection'})",
            "ref_no": app.ref_no if app else f"EVC #{e.id}",
            "institution_name": app.institution.name if app and app.institution else "Unknown",
            "region_name": app.region.name if app and app.region else "Unknown",
            "due_date": target_date.isoformat(),
            "days_remaining": days_rem,
            "is_overdue": is_ovd,
            "severity": "CRITICAL" if is_ovd or days_rem <= 1 else "WARNING" if days_rem <= 3 else "INFO",
            "link": f"/applications/{app.id}" if app else "/evc"
        })

    # 3. Undertakings
    und_q = scope_undertakings_by_role(db.query(Undertaking), current_user, db)
    scoped_unds = und_q.filter(
        Undertaking.status.in_(["PENDING", "DUE_SOON", "OVERDUE"]),
        Undertaking.due_date >= overdue_floor,
        Undertaking.due_date <= window_end
    ).order_by(Undertaking.due_date.asc()).limit(15).all()

    for u in scoped_unds:
        days_rem = (u.due_date - now).days
        is_ovd = u.due_date < now
        deadlines.append({
            "id": f"UND-{u.id}",
            "module": "UNDERTAKING",
            "title": u.title,
            "ref_no": u.application.ref_no if u.application else f"Undertaking #{u.id}",
            "institution_name": u.institution.name if u.institution else "Unknown",
            "region_name": u.institution.region.name if u.institution and u.institution.region else "Unknown",
            "due_date": u.due_date.isoformat(),
            "days_remaining": days_rem,
            "is_overdue": is_ovd,
            "severity": "CRITICAL" if is_ovd or days_rem <= 1 else "WARNING" if days_rem <= 3 else "INFO",
            "link": "/undertakings"
        })

    # 4. Document / Lease Expiries
    doc_q = scope_documents_by_role(db.query(Document), current_user, db)
    scoped_docs = doc_q.filter(
        Document.expiry_date != None,
        Document.expiry_date >= overdue_floor,
        Document.expiry_date <= now + timedelta(days=30)
    ).order_by(Document.expiry_date.asc()).limit(10).all()

    for d in scoped_docs:
        days_rem = (d.expiry_date - now).days
        is_ovd = d.expiry_date < now
        deadlines.append({
            "id": f"DOC-{d.id}",
            "module": "DOCUMENT",
            "title": f"Statutory {d.doc_type} Expiry",
            "ref_no": d.file_name,
            "institution_name": d.institution.name if d.institution else "Unknown",
            "region_name": d.institution.region.name if d.institution and d.institution.region else "Unknown",
            "due_date": d.expiry_date.isoformat(),
            "days_remaining": days_rem,
            "is_overdue": is_ovd,
            "severity": "CRITICAL" if is_ovd or days_rem <= 7 else "WARNING" if days_rem <= 15 else "INFO",
            "link": f"/applications/{d.application_id}"
        })

    # Sort combined list by days_remaining ascending (most urgent first)
    deadlines.sort(key=lambda item: item["days_remaining"])
    return deadlines
