"""
Expert Visit Committee (EVC) Inspection Module Endpoints for IntelliApprove.
Implements:
- EVC Queue (prioritising new institutions with shorter prescribed due windows)
- Calendar view (month-view scheduling and colour-coded visit statuses)
- Overdue tracking (automated escalation and SLA breach indicators)
- Scheduling (date & committee member assignment)
- Rescheduling (with mandatory speaking reason and audit trail)
- Completion (report upload, APH checklist evaluation, auto-advancing application to next stage)
- Alert engine hooks: T-7, T-3, T-1 notifications and escalation records
- Universal cryptographic audit logging
"""
import json
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc, asc

from app.core.database import get_db
from app.core.deps import get_current_user, get_client_ip, require_roles
from app.models.entities import (
    User,
    UserRole,
    Application,
    Region,
    Institution,
    EVCSchedule,
    Notification,
    Escalation,
    SystemClock
)
from app.core.scoping import (
    scope_evc_schedules_by_role,
    scope_applications_by_role,
    get_evc_assigned_app_ids
)
from app.services.audit_service import AuditService
from app.services.workflow_service import WorkflowService

router = APIRouter()

# Prescribed statutory EVC timelines in days (Configurable)
EVC_TIMELINE_DAYS_NEW = 10       # Shorter window for newly established campuses
EVC_TIMELINE_DAYS_EXISTING = 21  # Standard window for existing operating campuses


def get_system_now(db: Session) -> datetime:
    """Returns simulated time if active, else UTC now (naive)."""
    clock = db.query(SystemClock).first()
    if clock and clock.simulated_date:
        d = clock.simulated_date
        return d.replace(tzinfo=None) if d.tzinfo else d
    return datetime.utcnow()


def to_naive_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def compute_evc_status(schedule: EVCSchedule, now: datetime) -> str:
    """
    Computes real-time dynamic EVC status:
    QUEUED, SCHEDULED, DUE_SOON, OVERDUE, COMPLETED.
    """
    if schedule.completed_at is not None or schedule.status == "COMPLETED":
        return "COMPLETED"
    if schedule.due_date and schedule.due_date < now:
        return "OVERDUE"

    c_ids = []
    try:
        c_ids = json.loads(schedule.committee_ids) if isinstance(schedule.committee_ids, str) else schedule.committee_ids
    except Exception:
        pass

    has_members = bool(c_ids and len(c_ids) > 0)

    # If queued or unassigned
    if schedule.status == "QUEUED" or not has_members:
        if schedule.due_date and schedule.due_date <= now + timedelta(days=3):
            return "DUE_SOON"
        return "QUEUED"

    # Assigned and scheduled
    if schedule.due_date and schedule.due_date <= now + timedelta(days=3):
        return "DUE_SOON"
    if schedule.scheduled_date and schedule.scheduled_date <= now + timedelta(days=3):
        return "DUE_SOON"

    return "SCHEDULED"


def check_evc_alert_hooks(db: Session, schedule: EVCSchedule, now: datetime):
    """
    Hooks into alert engine: evaluates reminders at T-7, T-3, T-1 and escalations when overdue.
    Writes records into notifications and escalations tables.
    """
    if schedule.completed_at or schedule.status == "COMPLETED":
        return

    c_ids = []
    try:
        c_ids = json.loads(schedule.committee_ids) if isinstance(schedule.committee_ids, str) else schedule.committee_ids
    except Exception:
        pass

    app = schedule.application
    inst_name = app.institution.name if app and app.institution else "Institution"
    ref_no = app.ref_no if app else f"EVC #{schedule.id}"
    days_to_due = (schedule.due_date - now).days if schedule.due_date else 99

    # Overdue Escalation
    if schedule.due_date and schedule.due_date < now:
        existing_esc = db.query(Escalation).filter(
            Escalation.entity_type == "EVC",
            Escalation.entity_id == schedule.id
        ).first()
        if not existing_esc:
            esc = Escalation(
                entity_type="EVC",
                entity_id=schedule.id,
                level=2,
                escalated_to="Regional Head",
                reason=f"EVC physical inspection for {ref_no} ({inst_name}) is overdue past statutory deadline {schedule.due_date.date()}."
            )
            db.add(esc)

            # Notify Regional Head & Admin
            reg_heads = db.query(User).filter(User.role.in_([UserRole.REGIONAL_HEAD.value, UserRole.ADMIN.value])).all()
            for rh in reg_heads:
                if rh.region_id == (app.region_id if app else None) or rh.role == UserRole.ADMIN.value:
                    db.add(Notification(
                        user_id=rh.id,
                        title=f"URGENT: Overdue EVC Inspection ({ref_no})",
                        message=f"Physical inspection for {inst_name} has breached prescribed AICTE timeline. Escalated to Regional Head for urgent intervention.",
                        category="EVC_ESCALATION",
                        severity="CRITICAL",
                        link="/evc"
                    ))

    # Reminders at T-7, T-3, T-1
    elif days_to_due in [7, 3, 1]:
        sev = "CRITICAL" if days_to_due == 1 else "WARNING" if days_to_due == 3 else "INFO"
        cat = f"EVC_REMINDER_T{days_to_due}"
        for uid in c_ids:
            notif_exists = db.query(Notification).filter(
                Notification.user_id == uid,
                Notification.category == cat,
                Notification.title.contains(ref_no)
            ).first()
            if not notif_exists:
                db.add(Notification(
                    user_id=uid,
                    title=f"EVC Inspection Reminder T-{days_to_due}: {ref_no}",
                    message=f"Physical inspection for {inst_name} is due in {days_to_due} day(s). Scheduled date: {schedule.scheduled_date.date() if schedule.scheduled_date else 'TBD'}.",
                    category=cat,
                    severity=sev,
                    link="/evc"
                ))


def format_evc_schedule(s: EVCSchedule, now: datetime, db: Session) -> Dict[str, Any]:
    """Helper to serialize an EVC schedule with computed indicators and committee details."""
    c_ids = []
    try:
        c_ids = json.loads(s.committee_ids) if isinstance(s.committee_ids, str) else s.committee_ids
    except Exception:
        pass

    members = []
    if c_ids:
        users = db.query(User).filter(User.id.in_(c_ids)).all()
        members = [
            {
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "role": u.role,
                "region_name": u.region.name if u.region else "National Expert Pool"
            }
            for u in users
        ]

    computed_st = compute_evc_status(s, now)
    days_rem = (s.due_date - now).days if s.due_date else 0
    days_ovd = max(0, (now - s.due_date).days) if (s.due_date and s.due_date < now) else 0

    app = s.application
    inst = app.institution if app else None

    # Check alert hooks
    check_evc_alert_hooks(db, s, now)

    return {
        "id": s.id,
        "application_id": s.application_id,
        "application_ref_no": app.ref_no if app else None,
        "application_status": app.status if app else None,
        "current_stage": app.current_stage if app else None,
        "institution_id": inst.id if inst else None,
        "institution_name": inst.name if inst else "Unknown Institution",
        "institution_type": inst.type if inst else "Engineering",
        "state": inst.state if inst else "Unknown",
        "region_id": app.region_id if app else None,
        "region_name": app.region.name if app and app.region else "Unknown",
        "scheduled_date": s.scheduled_date.isoformat() if s.scheduled_date else None,
        "due_date": s.due_date.isoformat() if s.due_date else None,
        "completed_at": s.completed_at.isoformat() if s.completed_at else None,
        "status": computed_st,
        "raw_status": s.status,
        "committee_ids": c_ids,
        "committee_members": members,
        "is_new_institution": bool(s.is_new_institution),
        "days_remaining": days_rem,
        "days_overdue": days_ovd,
        "is_overdue": computed_st == "OVERDUE",
        "is_due_soon": computed_st == "DUE_SOON",
        "inspection_notes": getattr(app, "evc_remarks", None),
        "recommendation": getattr(app, "evc_recommendation", None)
    }


# --- Request Schemas ---

class ScheduleEVCRequest(BaseModel):
    scheduled_date: datetime = Field(..., description="Date and time of physical inspection")
    committee_ids: List[int] = Field(..., min_items=1, description="List of user IDs for assigned committee members")


class RescheduleEVCRequest(BaseModel):
    scheduled_date: datetime = Field(..., description="New rescheduled inspection date")
    reason: str = Field(..., min_length=5, description="Mandatory reason for rescheduling visit")
    committee_ids: Optional[List[int]] = None


class CompleteEVCRequest(BaseModel):
    report_summary: str = Field(..., min_length=10, description="Formal inspection findings and committee remarks")
    recommendation: str = Field("RECOMMENDED", description="RECOMMENDED, DEFICIENT_HEARING, NOT_RECOMMENDED")
    infra_verified: bool = Field(True, description="Campus land and instructional area verified")
    faculty_verified: bool = Field(True, description="Faculty cadre and physical presence verified")
    labs_functional: bool = Field(True, description="Computing and laboratory equipment verified")
    file_id: Optional[int] = Field(None, description="Optional uploaded inspection report evidence file id")


# --- Endpoints ---

@router.get("/queue")
@router.get("/schedules")
def list_evc_queue(
    tab: Optional[str] = Query("queue", description="queue, overdue, calendar, all"),
    region_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List EVC schedules with role scoping.
    Prioritises New Institutions (is_new_institution = True) at the top of the queue.
    """
    now = get_system_now(db)
    base_query = scope_evc_schedules_by_role(db.query(EVCSchedule), current_user, db)

    if region_id and current_user.role in [UserRole.ADMIN.value, UserRole.BUREAU_OFFICER.value]:
        base_query = base_query.join(Application, EVCSchedule.application_id == Application.id).filter(
            Application.region_id == region_id
        )

    all_schedules = base_query.all()
    formatted = [format_evc_schedule(s, now, db) for s in all_schedules]

    # Filter based on tab
    if tab == "queue":
        formatted = [s for s in formatted if s["status"] in ["QUEUED", "SCHEDULED", "DUE_SOON"]]
    elif tab == "overdue":
        formatted = [s for s in formatted if s["status"] == "OVERDUE"]
    elif tab == "calendar":
        formatted = [s for s in formatted if s["scheduled_date"] is not None]

    # Additional user search / status filtering
    if status_filter and status_filter != "ALL":
        formatted = [s for s in formatted if s["status"] == status_filter]

    if search:
        s_lower = search.lower()
        formatted = [
            s for s in formatted
            if (s["application_ref_no"] and s_lower in s["application_ref_no"].lower()) or
               (s["institution_name"] and s_lower in s["institution_name"].lower()) or
               (s["state"] and s_lower in s["state"].lower())
        ]

    # Requirement: Prioritise new institutions (is_new_institution = True) with shorter due windows
    if tab == "queue":
        formatted.sort(key=lambda item: (0 if item["is_new_institution"] else 1, item["due_date"] or ""))
    elif tab == "overdue":
        formatted.sort(key=lambda item: item["days_overdue"], reverse=True)
    elif tab == "calendar":
        formatted.sort(key=lambda item: item["scheduled_date"] or "")

    return formatted


@router.get("/overdue")
def list_overdue_evc(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns all overdue EVC schedules requiring urgent escalation."""
    now = get_system_now(db)
    base_query = scope_evc_schedules_by_role(db.query(EVCSchedule), current_user, db)
    schedules = base_query.filter(
        EVCSchedule.due_date < now,
        EVCSchedule.completed_at == None,
        EVCSchedule.status != "COMPLETED"
    ).all()

    formatted = [format_evc_schedule(s, now, db) for s in schedules]
    formatted.sort(key=lambda item: item["days_overdue"], reverse=True)
    return formatted


@router.get("/calendar")
def get_evc_calendar(
    month: Optional[int] = Query(None, description="Month 1-12"),
    year: Optional[int] = Query(None, description="Year e.g. 2026"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns calendar-formatted inspection visits for month view.
    """
    now = get_system_now(db)
    base_query = scope_evc_schedules_by_role(db.query(EVCSchedule), current_user, db)
    schedules = base_query.all()

    formatted = [format_evc_schedule(s, now, db) for s in schedules if s.scheduled_date is not None]

    if year:
        formatted = [s for s in formatted if datetime.fromisoformat(s["scheduled_date"]).year == year]
    if month:
        formatted = [s for s in formatted if datetime.fromisoformat(s["scheduled_date"]).month == month]

    formatted.sort(key=lambda item: item["scheduled_date"] or "")
    return formatted


@router.get("/committee-members")
def get_committee_members(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns list of committee members available for EVC assignment with current workload.
    """
    users_q = db.query(User).filter(
        User.role.in_([UserRole.EVC_MEMBER.value, "EVC_INSPECTOR", UserRole.ADMIN.value]),
        User.is_active == True
    )

    if current_user.role in [UserRole.REGIONAL_OFFICER.value, UserRole.REGIONAL_HEAD.value]:
        if current_user.region_id:
            users_q = users_q.filter(or_(User.region_id == current_user.region_id, User.region_id == None))

    evc_users = users_q.all()

    # Active assignments count
    active_schedules = db.query(EVCSchedule).filter(EVCSchedule.completed_at == None).all()
    workload_counts: Dict[int, int] = {}
    for s in active_schedules:
        try:
            ids = json.loads(s.committee_ids) if isinstance(s.committee_ids, str) else s.committee_ids
            for uid in ids:
                workload_counts[uid] = workload_counts.get(uid, 0) + 1
        except Exception:
            pass

    return [
        {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "role": u.role,
            "region_id": u.region_id,
            "region_name": u.region.name if u.region else "National Expert Pool",
            "active_assignments": workload_counts.get(u.id, 0)
        }
        for u in evc_users
    ]


@router.get("/{schedule_id}")
def get_evc_schedule_detail(
    schedule_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve full details of an EVC inspection schedule."""
    now = get_system_now(db)
    schedule = db.query(EVCSchedule).filter(EVCSchedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="EVC schedule not found")

    return format_evc_schedule(schedule, now, db)


@router.post("/{schedule_id}/schedule")
def schedule_evc_visit(
    schedule_id: int,
    req: ScheduleEVCRequest,
    request: Request,
    current_user: User = Depends(require_roles([
        UserRole.REGIONAL_OFFICER.value,
        UserRole.REGIONAL_HEAD.value,
        UserRole.BUREAU_OFFICER.value,
        UserRole.ADMIN.value,
        "SCRUTINY_OFFICER"
    ])),
    db: Session = Depends(get_db)
):
    """
    Assigns scheduled date and committee members to a queued EVC inspection.
    Updates status to SCHEDULED, notifies committee, and writes cryptographic audit log.
    """
    now = get_system_now(db)
    schedule = db.query(EVCSchedule).filter(EVCSchedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="EVC schedule not found")

    if schedule.completed_at or schedule.status == "COMPLETED":
        raise HTTPException(status_code=400, detail="Cannot schedule an already completed inspection")

    # Validate committee members
    valid_members = db.query(User).filter(User.id.in_(req.committee_ids)).all()
    if len(valid_members) != len(req.committee_ids):
        raise HTTPException(status_code=400, detail="One or more specified committee member IDs do not exist")

    old_val = {
        "status": schedule.status,
        "scheduled_date": schedule.scheduled_date.isoformat() if schedule.scheduled_date else None,
        "committee_ids": schedule.committee_ids
    }

    sched_naive = to_naive_utc(req.scheduled_date)
    schedule.scheduled_date = sched_naive
    schedule.committee_ids = json.dumps(req.committee_ids)
    schedule.status = "SCHEDULED"

    # Notify committee members
    app = schedule.application
    inst_name = app.institution.name if app and app.institution else "Institution"
    ref_no = app.ref_no if app else f"EVC #{schedule.id}"
    for m in valid_members:
        db.add(Notification(
            user_id=m.id,
            title=f"Assigned to EVC Inspection: {ref_no}",
            message=f"You have been appointed to the Expert Visit Committee for {inst_name}. Inspection scheduled for {sched_naive.strftime('%d %b %Y, %I:%M %p')}.",
            category="EVC_ASSIGNMENT",
            severity="INFO",
            link="/evc"
        ))

    # Audit log
    AuditService.log(
        db=db,
        action="EVC_VISIT_SCHEDULED",
        entity_type="evc_schedule",
        entity_id=str(schedule.id),
        user=current_user,
        old_value=old_val,
        new_value={
            "status": "SCHEDULED",
            "scheduled_date": sched_naive.isoformat(),
            "committee_ids": req.committee_ids,
            "committee_names": [m.name for m in valid_members]
        },
        details=f"EVC Inspection for {ref_no} ({inst_name}) scheduled for {sched_naive.strftime('%Y-%m-%d')} with {len(valid_members)} committee experts.",
        ip_address=get_client_ip(request)
    )

    db.commit()
    db.refresh(schedule)
    return {
        "status": "success",
        "message": f"EVC inspection scheduled successfully for {sched_naive.strftime('%d %b %Y')}",
        "schedule": format_evc_schedule(schedule, now, db)
    }


@router.post("/{schedule_id}/reschedule")
def reschedule_evc_visit(
    schedule_id: int,
    req: RescheduleEVCRequest,
    request: Request,
    current_user: User = Depends(require_roles([
        UserRole.REGIONAL_OFFICER.value,
        UserRole.REGIONAL_HEAD.value,
        UserRole.BUREAU_OFFICER.value,
        UserRole.ADMIN.value,
        "SCRUTINY_OFFICER"
    ])),
    db: Session = Depends(get_db)
):
    """
    Reschedules an EVC visit. A formal speaking reason is mandatory.
    Updates schedule and logs the reason to immutable audit records.
    """
    now = get_system_now(db)
    schedule = db.query(EVCSchedule).filter(EVCSchedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="EVC schedule not found")

    if schedule.completed_at or schedule.status == "COMPLETED":
        raise HTTPException(status_code=400, detail="Cannot reschedule an already completed inspection")

    if not req.reason or not req.reason.strip():
        raise HTTPException(status_code=400, detail="A mandatory justification reason must be recorded when rescheduling an EVC visit")

    old_val = {
        "scheduled_date": schedule.scheduled_date.isoformat() if schedule.scheduled_date else None,
        "status": schedule.status,
        "committee_ids": schedule.committee_ids
    }

    sched_naive = to_naive_utc(req.scheduled_date)
    schedule.scheduled_date = sched_naive
    if req.committee_ids is not None:
        schedule.committee_ids = json.dumps(req.committee_ids)

    # Check if new date exceeds statutory due date
    if sched_naive > schedule.due_date:
        schedule.status = "OVERDUE"
    else:
        schedule.status = "SCHEDULED"

    app = schedule.application
    inst_name = app.institution.name if app and app.institution else "Institution"
    ref_no = app.ref_no if app else f"EVC #{schedule.id}"

    # Notify members
    c_ids = []
    try:
        c_ids = json.loads(schedule.committee_ids) if isinstance(schedule.committee_ids, str) else schedule.committee_ids
    except Exception:
        pass

    for uid in c_ids:
        db.add(Notification(
            user_id=uid,
            title=f"EVC Rescheduled: {ref_no}",
            message=f"EVC visit for {inst_name} has been rescheduled to {sched_naive.strftime('%d %b %Y')}. Reason: {req.reason}",
            category="EVC_RESCHEDULED",
            severity="WARNING",
            link="/evc"
        ))

    # Audit log
    AuditService.log(
        db=db,
        action="EVC_VISIT_RESCHEDULED",
        entity_type="evc_schedule",
        entity_id=str(schedule.id),
        user=current_user,
        old_value=old_val,
        new_value={
            "scheduled_date": sched_naive.isoformat(),
            "reason": req.reason,
            "status": schedule.status
        },
        details=f"EVC visit for {ref_no} rescheduled by {current_user.name} ({current_user.role}). Reason: {req.reason}",
        ip_address=get_client_ip(request)
    )

    db.commit()
    db.refresh(schedule)
    return {
        "status": "success",
        "message": f"EVC inspection rescheduled successfully. Reason recorded in audit log.",
        "schedule": format_evc_schedule(schedule, now, db)
    }


@router.post("/{schedule_id}/complete")
def complete_evc_inspection(
    schedule_id: int,
    req: CompleteEVCRequest,
    request: Request,
    current_user: User = Depends(require_roles([
        UserRole.EVC_MEMBER.value,
        UserRole.ADMIN.value,
        UserRole.REGIONAL_OFFICER.value,
        "EVC_INSPECTOR"
    ])),
    db: Session = Depends(get_db)
):
    """
    Submits physical inspection report, marks EVC schedule COMPLETED, and
    AUTOMATICALLY moves the application to the next stage in its template
    via workflow_service.
    """
    now = get_system_now(db)
    schedule = db.query(EVCSchedule).filter(EVCSchedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="EVC schedule not found")

    if schedule.completed_at or schedule.status == "COMPLETED":
        raise HTTPException(status_code=400, detail="This EVC inspection has already been marked completed")

    app = schedule.application
    if not app:
        raise HTTPException(status_code=404, detail="Associated application not found")

    old_st = schedule.status
    schedule.completed_at = now
    schedule.status = "COMPLETED"

    # Store EVC remarks and recommendation on application
    app.evc_remarks = req.report_summary
    app.evc_recommendation = req.recommendation

    # Audit log for inspection completion
    AuditService.log(
        db=db,
        action="EVC_INSPECTION_COMPLETED",
        entity_type="evc_schedule",
        entity_id=str(schedule.id),
        user=current_user,
        old_value={"status": old_st},
        new_value={
            "status": "COMPLETED",
            "completed_at": now.isoformat(),
            "recommendation": req.recommendation,
            "infra_verified": req.infra_verified,
            "faculty_verified": req.faculty_verified,
            "labs_functional": req.labs_functional,
            "report_summary": req.report_summary
        },
        details=f"EVC Chairman {current_user.name} submitted inspection report with verdict '{req.recommendation}'. Application auto-advancing to next stage.",
        ip_address=get_client_ip(request)
    )

    db.commit()

    # Requirement: On completion, the application auto-advances to the next stage via workflow_service
    advancement_remarks = f"EVC Inspection Completed. Recommendation: {req.recommendation}. Observations: {req.report_summary[:100]}"
    updated_app = WorkflowService.complete_stage(
        db=db,
        application_id=app.id,
        officer=current_user,
        remarks=advancement_remarks,
        ip_address=get_client_ip(request)
    )

    return {
        "status": "success",
        "message": f"EVC inspection completed and application auto-advanced to stage '{updated_app.current_stage}'!",
        "next_stage": updated_app.current_stage,
        "application_status": updated_app.status,
        "schedule": format_evc_schedule(schedule, now, db)
    }

