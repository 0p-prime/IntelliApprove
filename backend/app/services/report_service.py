"""
Report Service: Multi-Dimensional Statutory Reporting Engine for IntelliApprove.
Implements the 6 Core Statutory AICTE Reports:
1. Application Pendency (by stage, region, ageing)
2. EVC Status (queued, scheduled, overdue, completed)
3. Undertaking Compliance (by institution, region)
4. Document Validity (expiring, expired, renewed)
5. Overdue Cases & Escalations (multi-tier escalation ladder)
6. Region-wise Processing Performance (8 AICTE regions benchmarking)
"""
import io
import csv
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_, desc, asc

from app.models.entities import (
    Application,
    Institution,
    Region,
    EVCSchedule,
    Undertaking,
    Document,
    Escalation,
    User,
    StageHistory,
    SystemClock
)
from app.api.v1.evc import compute_evc_status, get_system_now


class ReportService:
    REPORT_METADATA = [
        {
            "id": "application-pendency",
            "title": "Application Pendency & Ageing Report",
            "category": "WORKFLOW",
            "description": "Comprehensive pipeline pendency breakdown by approval stage, geographic region, and ageing cohorts (<7d, 7-15d, 15-30d, >30d).",
            "chart_type": "composed"
        },
        {
            "id": "evc-status",
            "title": "Expert Visit Committee (EVC) Status Report",
            "category": "INSPECTION",
            "description": "Physical inspection status, scheduling timelines, committee appointments, and overdue inspection tracking with new-institution prioritization.",
            "chart_type": "pie"
        },
        {
            "id": "undertaking-compliance",
            "title": "Undertakings & Institutional Compliance Report",
            "category": "COMPLIANCE",
            "description": "Post-approval legal undertakings verification status, evidence submission compliance rates, and regional institutional compliance rankings.",
            "chart_type": "bar"
        },
        {
            "id": "document-validity",
            "title": "Document & Lease Validity Expiry Report",
            "category": "VIGILANCE",
            "description": "Institutional land lease deeds, building safety approvals, fire NOCs, and renewal lifecycle monitoring (30/60/90 days windows).",
            "chart_type": "bar"
        },
        {
            "id": "overdue-escalations",
            "title": "Overdue Cases & Statutory Escalations Report",
            "category": "ESCALATION",
            "description": "Multi-tier SLA breach and escalation ladder tracking (Level 1: Regional Officer → Level 2: Regional Head → Level 3: Approval Bureau).",
            "chart_type": "composed"
        },
        {
            "id": "region-performance",
            "title": "Regional Processing Performance Benchmarking",
            "category": "EXECUTIVE",
            "description": "Comparative turnaround times, approval rates, pendency density, and SLA adherence across all 8 official AICTE regions.",
            "chart_type": "bar"
        }
    ]

    @staticmethod
    def get_available_reports() -> List[Dict[str, Any]]:
        return ReportService.REPORT_METADATA

    @staticmethod
    def get_report(
        report_id: str,
        db: Session,
        region_id: Optional[int] = None,
        status_filter: Optional[str] = None,
        stage_filter: Optional[str] = None,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        search: Optional[str] = None,
        current_user: Optional[User] = None
    ) -> Dict[str, Any]:
        """Dispatches and returns the requested statutory report."""
        now = get_system_now(db)

        if report_id == "application-pendency":
            return ReportService._report_application_pendency(db, now, region_id, status_filter, stage_filter, search)
        elif report_id == "evc-status":
            return ReportService._report_evc_status(db, now, region_id, status_filter, search)
        elif report_id == "undertaking-compliance":
            return ReportService._report_undertaking_compliance(db, now, region_id, status_filter, search)
        elif report_id == "document-validity":
            return ReportService._report_document_validity(db, now, region_id, status_filter, search)
        elif report_id == "overdue-escalations":
            return ReportService._report_overdue_escalations(db, now, region_id, status_filter, search)
        elif report_id == "region-performance":
            return ReportService._report_region_performance(db, now)
        else:
            raise ValueError(f"Unknown report type: {report_id}")

    # --- 1. Application Pendency Report ---
    @staticmethod
    def _report_application_pendency(
        db: Session, now: datetime, region_id: Optional[int], status_filter: Optional[str], stage_filter: Optional[str], search: Optional[str]
    ) -> Dict[str, Any]:
        q = db.query(Application).join(Institution, Application.institution_id == Institution.id)
        if region_id:
            q = q.filter(Application.region_id == region_id)
        if status_filter:
            q = q.filter(Application.status == status_filter)
        if stage_filter:
            q = q.filter(Application.current_stage == stage_filter)
        if search:
            q = q.filter(or_(Application.ref_no.ilike(f"%{search}%"), Institution.name.ilike(f"%{search}%")))

        apps = q.all()

        total = len(apps)
        pending_apps = [a for a in apps if a.current_stage not in ["APPROVED", "REJECTED"]]
        pending_count = len(pending_apps)
        overdue_count = len([a for a in pending_apps if a.due_date and a.due_date < now])
        near_deadline = len([a for a in pending_apps if a.due_date and now <= a.due_date <= now + timedelta(days=2)])

        # Calculate ages
        dwell_days_list = [max(0, (now - a.stage_entered_at).days) if a.stage_entered_at else 0 for a in pending_apps]
        avg_dwell = round(sum(dwell_days_list) / max(len(dwell_days_list), 1), 1)

        # Ageing Buckets
        b_0_7 = len([d for d in dwell_days_list if d <= 7])
        b_8_15 = len([d for d in dwell_days_list if 7 < d <= 15])
        b_16_30 = len([d for d in dwell_days_list if 15 < d <= 30])
        b_30_plus = len([d for d in dwell_days_list if d > 30])

        chart_data = [
            {"label": "0 - 7 Days", "pending": b_0_7, "cohort": "<7d"},
            {"label": "8 - 15 Days", "pending": b_8_15, "cohort": "8-15d"},
            {"label": "16 - 30 Days", "pending": b_16_30, "cohort": "16-30d"},
            {"label": "30+ Days (Critical)", "pending": b_30_plus, "cohort": ">30d"}
        ]

        table_rows = []
        for a in apps:
            dwell = max(0, (now - a.stage_entered_at).days) if a.stage_entered_at else 0
            cohort = "< 7 Days" if dwell <= 7 else "8 - 15 Days" if dwell <= 15 else "16 - 30 Days" if dwell <= 30 else "30+ Days"
            is_ovd = bool(a.due_date and a.due_date < now and a.current_stage not in ["APPROVED", "REJECTED"])

            table_rows.append({
                "id": a.id,
                "ref_no": a.ref_no,
                "institution_name": a.institution.name if a.institution else "N/A",
                "region_name": a.region.name if a.region else "N/A",
                "application_type": a.application_type,
                "current_stage": a.current_stage,
                "status": a.status,
                "dwell_days": dwell,
                "ageing_cohort": cohort,
                "due_date": a.due_date.strftime("%Y-%m-%d") if a.due_date else "—",
                "is_overdue": is_ovd,
                "compliance_score": round(a.compliance_score, 1)
            })

        table_rows.sort(key=lambda r: (0 if r["is_overdue"] else 1, -r["dwell_days"]))

        return {
            "report_id": "application-pendency",
            "title": "Application Pendency & Ageing Report",
            "subtitle": f"Active workflow pendency across {total} technical institution applications",
            "generated_at": now.isoformat(),
            "summary_kpis": [
                {"label": "Total Applications", "value": total, "color": "blue"},
                {"label": "Pending in Pipeline", "value": pending_count, "color": "amber"},
                {"label": "SLA Overdue Breaches", "value": overdue_count, "color": "red"},
                {"label": "Near Deadline (<48h)", "value": near_deadline, "color": "purple"},
                {"label": "Avg Dwell Time (Days)", "value": avg_dwell, "color": "emerald"}
            ],
            "chart_type": "composed",
            "chart_data": chart_data,
            "chart_config": {"xKey": "label", "bars": [{"key": "pending", "label": "Pending Cases", "color": "#E05A1B"}]},
            "table_columns": [
                {"key": "ref_no", "label": "Application Ref", "type": "mono"},
                {"key": "institution_name", "label": "Institution Name", "type": "text"},
                {"key": "region_name", "label": "AICTE Region", "type": "text"},
                {"key": "current_stage", "label": "Current Stage", "type": "badge"},
                {"key": "status", "label": "Governance Status", "type": "status"},
                {"key": "dwell_days", "label": "Dwell (Days)", "type": "number"},
                {"key": "ageing_cohort", "label": "Ageing Cohort", "type": "badge"},
                {"key": "due_date", "label": "SLA Due Date", "type": "date"},
                {"key": "compliance_score", "label": "Compliance %", "type": "score"}
            ],
            "table_data": table_rows
        }

    # --- 2. EVC Status Report ---
    @staticmethod
    def _report_evc_status(
        db: Session, now: datetime, region_id: Optional[int], status_filter: Optional[str], search: Optional[str]
    ) -> Dict[str, Any]:
        q = db.query(EVCSchedule).join(Application, EVCSchedule.application_id == Application.id).join(Institution, Application.institution_id == Institution.id)
        if region_id:
            q = q.filter(Application.region_id == region_id)
        if search:
            q = q.filter(or_(Application.ref_no.ilike(f"%{search}%"), Institution.name.ilike(f"%{search}%")))

        schedules = q.all()

        formatted_items = []
        for s in schedules:
            computed_st = compute_evc_status(s, now)
            days_rem = (s.due_date - now).days if s.due_date else 0
            days_ovd = max(0, (now - s.due_date).days) if (s.due_date and s.due_date < now) else 0

            formatted_items.append({
                "id": s.id,
                "application_id": s.application_id,
                "ref_no": s.application.ref_no if s.application else f"EVC #{s.id}",
                "institution_name": s.application.institution.name if s.application and s.application.institution else "N/A",
                "region_name": s.application.region.name if s.application and s.application.region else "N/A",
                "scheduled_date": s.scheduled_date.strftime("%Y-%m-%d") if s.scheduled_date else "TBD (Queued)",
                "due_date": s.due_date.strftime("%Y-%m-%d") if s.due_date else "—",
                "completed_at": s.completed_at.strftime("%Y-%m-%d") if s.completed_at else "—",
                "status": computed_st,
                "is_new_institution": bool(s.is_new_institution),
                "days_remaining": days_rem,
                "days_overdue": days_ovd
            })

        if status_filter:
            formatted_items = [item for item in formatted_items if item["status"] == status_filter]

        total = len(formatted_items)
        queued_c = len([i for i in formatted_items if i["status"] == "QUEUED"])
        sched_c = len([i for i in formatted_items if i["status"] == "SCHEDULED"])
        due_soon_c = len([i for i in formatted_items if i["status"] == "DUE_SOON"])
        overdue_c = len([i for i in formatted_items if i["status"] == "OVERDUE"])
        completed_c = len([i for i in formatted_items if i["status"] == "COMPLETED"])

        chart_data = [
            {"name": "Queued", "value": queued_c, "color": "#3B82F6"},
            {"name": "Scheduled", "value": sched_c, "color": "#10B981"},
            {"name": "Due Soon", "value": due_soon_c, "color": "#F59E0B"},
            {"name": "Overdue", "value": overdue_c, "color": "#EF4444"},
            {"name": "Completed", "value": completed_c, "color": "#0B2240"}
        ]

        formatted_items.sort(key=lambda item: (0 if item["is_new_institution"] else 1, 0 if item["status"] == "OVERDUE" else 1))

        return {
            "report_id": "evc-status",
            "title": "Expert Visit Committee (EVC) Status Report",
            "subtitle": f"Physical and virtual campus inspection progress across {len(schedules)} schedules",
            "generated_at": now.isoformat(),
            "summary_kpis": [
                {"label": "Total Mandated EVCs", "value": total, "color": "blue"},
                {"label": "Queued (Unscheduled)", "value": queued_c, "color": "purple"},
                {"label": "Scheduled (Upcoming)", "value": sched_c, "color": "emerald"},
                {"label": "Overdue Inspections", "value": overdue_c, "color": "red"},
                {"label": "Completed Visits", "value": completed_c, "color": "blue"}
            ],
            "chart_type": "pie",
            "chart_data": chart_data,
            "table_columns": [
                {"key": "ref_no", "label": "Application Ref", "type": "mono"},
                {"key": "institution_name", "label": "Institution Name", "type": "text"},
                {"key": "region_name", "label": "Region", "type": "text"},
                {"key": "is_new_institution", "label": "New Campus", "type": "boolean"},
                {"key": "scheduled_date", "label": "Inspection Date", "type": "date"},
                {"key": "due_date", "label": "Statutory Deadline", "type": "date"},
                {"key": "status", "label": "EVC Status", "type": "status"},
                {"key": "days_overdue", "label": "Days Overdue", "type": "number"}
            ],
            "table_data": formatted_items
        }

    # --- 3. Undertaking Compliance Report ---
    @staticmethod
    def _report_undertaking_compliance(
        db: Session, now: datetime, region_id: Optional[int], status_filter: Optional[str], search: Optional[str]
    ) -> Dict[str, Any]:
        q = db.query(Undertaking).join(Institution, Undertaking.institution_id == Institution.id)
        if region_id:
            q = q.filter(Institution.region_id == region_id)
        if status_filter:
            q = q.filter(Undertaking.status == status_filter)
        if search:
            q = q.filter(or_(Institution.name.ilike(f"%{search}%"), Undertaking.condition_text.ilike(f"%{search}%")))

        undertakings = q.all()
        total = len(undertakings)
        verified_c = len([u for u in undertakings if u.status == "VERIFIED"])
        submitted_c = len([u for u in undertakings if u.status == "SUBMITTED"])
        pending_c = len([u for u in undertakings if u.status == "PENDING"])
        rejected_c = len([u for u in undertakings if u.status == "REJECTED"])
        overdue_c = len([u for u in undertakings if u.due_date and u.due_date < now and u.status != "VERIFIED"])

        compliance_rate = round((verified_c / max(total, 1)) * 100, 1)

        # Region-wise breakdown
        reg_map: Dict[str, Dict[str, int]] = {}
        for u in undertakings:
            reg_name = u.institution.region.name if u.institution and u.institution.region else "National"
            if reg_name not in reg_map:
                reg_map[reg_name] = {"total": 0, "verified": 0, "overdue": 0}
            reg_map[reg_name]["total"] += 1
            if u.status == "VERIFIED":
                reg_map[reg_name]["verified"] += 1
            if u.due_date and u.due_date < now and u.status != "VERIFIED":
                reg_map[reg_name]["overdue"] += 1

        chart_data = [
            {
                "region": r,
                "compliance_pct": round((stats["verified"] / max(stats["total"], 1)) * 100, 1),
                "total": stats["total"],
                "overdue": stats["overdue"]
            }
            for r, stats in reg_map.items()
        ]

        table_rows = []
        for u in undertakings:
            table_rows.append({
                "id": u.id,
                "institution_name": u.institution.name if u.institution else "N/A",
                "region_name": u.institution.region.name if u.institution and u.institution.region else "N/A",
                "condition_text": u.condition_text,
                "due_date": u.due_date.strftime("%Y-%m-%d") if u.due_date else "—",
                "status": u.status,
                "evidence_uploaded": bool(u.evidence_file_id),
                "verified_by": u.verifier.name if u.verifier else "—",
                "remarks": u.remarks or "—"
            })

        table_rows.sort(key=lambda r: (0 if r["status"] == "OVERDUE" else 1, r["due_date"]))

        return {
            "report_id": "undertaking-compliance",
            "title": "Undertakings & Institutional Compliance Report",
            "subtitle": f"Statutory commitments monitoring across {total} conditional approval undertakings",
            "generated_at": now.isoformat(),
            "summary_kpis": [
                {"label": "Total Undertakings", "value": total, "color": "blue"},
                {"label": "Verified Compliant", "value": verified_c, "color": "emerald"},
                {"label": "Evidence Submitted", "value": submitted_c, "color": "blue"},
                {"label": "Pending Submission", "value": pending_c, "color": "amber"},
                {"label": "Overdue Non-Compliant", "value": overdue_c, "color": "red"},
                {"label": "National Compliance Rate", "value": f"{compliance_rate}%", "color": "emerald"}
            ],
            "chart_type": "bar",
            "chart_data": chart_data,
            "chart_config": {"xKey": "region", "bars": [{"key": "compliance_pct", "label": "Compliance Rate (%)", "color": "#10B981"}]},
            "table_columns": [
                {"key": "institution_name", "label": "Institution Name", "type": "text"},
                {"key": "region_name", "label": "Region", "type": "text"},
                {"key": "condition_text", "label": "Imposed Condition", "type": "text"},
                {"key": "due_date", "label": "Compliance Due Date", "type": "date"},
                {"key": "status", "label": "Status", "type": "status"},
                {"key": "evidence_uploaded", "label": "Proof Uploaded", "type": "boolean"},
                {"key": "remarks", "label": "Officer Verification Remarks", "type": "text"}
            ],
            "table_data": table_rows
        }

    # --- 4. Document Validity Report ---
    @staticmethod
    def _report_document_validity(
        db: Session, now: datetime, region_id: Optional[int], status_filter: Optional[str], search: Optional[str]
    ) -> Dict[str, Any]:
        q = db.query(Document).join(Institution, Document.institution_id == Institution.id)
        if region_id:
            q = q.filter(Institution.region_id == region_id)
        if search:
            q = q.filter(or_(Institution.name.ilike(f"%{search}%"), Document.doc_type.ilike(f"%{search}%")))

        docs = q.all()

        formatted_items = []
        for d in docs:
            days_rem = (d.expiry_date - now).days if d.expiry_date else 999
            if days_rem < 0:
                st = "EXPIRED"
            elif days_rem <= 30:
                st = "CRITICAL"
            elif days_rem <= 90:
                st = "EXPIRING_SOON"
            else:
                st = "VALID"

            formatted_items.append({
                "id": d.id,
                "institution_name": d.institution.name if d.institution else "N/A",
                "region_name": d.institution.region.name if d.institution and d.institution.region else "N/A",
                "doc_type": d.doc_type,
                "issue_date": d.issue_date.strftime("%Y-%m-%d") if d.issue_date else "—",
                "expiry_date": d.expiry_date.strftime("%Y-%m-%d") if d.expiry_date else "Perpetual",
                "days_remaining": days_rem if d.expiry_date else 9999,
                "status": st,
                "verification_status": d.verification_status,
                "is_renewal": bool(d.renewal_of_id)
            })

        if status_filter:
            formatted_items = [i for i in formatted_items if i["status"] == status_filter]

        total = len(formatted_items)
        valid_c = len([i for i in formatted_items if i["status"] == "VALID"])
        exp_soon_c = len([i for i in formatted_items if i["status"] == "EXPIRING_SOON"])
        crit_c = len([i for i in formatted_items if i["status"] == "CRITICAL"])
        expired_c = len([i for i in formatted_items if i["status"] == "EXPIRED"])

        chart_data = [
            {"label": "Valid (>90d)", "count": valid_c, "color": "#10B981"},
            {"label": "Expiring (31-90d)", "count": exp_soon_c, "color": "#F59E0B"},
            {"label": "Critical (<30d)", "count": crit_c, "color": "#E05A1B"},
            {"label": "Expired", "count": expired_c, "color": "#EF4444"}
        ]

        formatted_items.sort(key=lambda i: i["days_remaining"])

        return {
            "report_id": "document-validity",
            "title": "Document & Lease Validity Expiry Report",
            "subtitle": f"Statutory deeds, building permits, and fire safety NOCs tracking across {len(docs)} documents",
            "generated_at": now.isoformat(),
            "summary_kpis": [
                {"label": "Total Tracked Documents", "value": total, "color": "blue"},
                {"label": "Valid (>90 Days)", "value": valid_c, "color": "emerald"},
                {"label": "Expiring Soon (31-90d)", "value": exp_soon_c, "color": "amber"},
                {"label": "Critical Warning (<30d)", "value": crit_c, "color": "orange"},
                {"label": "Expired Shortfalls", "value": expired_c, "color": "red"}
            ],
            "chart_type": "bar",
            "chart_data": chart_data,
            "chart_config": {"xKey": "label", "bars": [{"key": "count", "label": "Document Count", "color": "#0B2240"}]},
            "table_columns": [
                {"key": "institution_name", "label": "Institution Name", "type": "text"},
                {"key": "region_name", "label": "Region", "type": "text"},
                {"key": "doc_type", "label": "Document Type", "type": "badge"},
                {"key": "expiry_date", "label": "Expiry Date", "type": "date"},
                {"key": "days_remaining", "label": "Days Left", "type": "number"},
                {"key": "status", "label": "Validity Cohort", "type": "status"},
                {"key": "is_renewal", "label": "Renewal Filed", "type": "boolean"},
                {"key": "verification_status", "label": "Verification Status", "type": "badge"}
            ],
            "table_data": formatted_items
        }

    # --- 5. Overdue Cases & Escalations Report ---
    @staticmethod
    def _report_overdue_escalations(
        db: Session, now: datetime, region_id: Optional[int], status_filter: Optional[str], search: Optional[str]
    ) -> Dict[str, Any]:
        escs = db.query(Escalation).order_by(Escalation.created_at.desc()).all()

        formatted_rows = []
        for e in escs:
            dwell_days = (now - e.created_at).days if e.created_at else 0
            is_active = (e.resolved_at is None)

            # Determine institution & region
            inst_name = "AICTE Regulated Entity"
            reg_name = "National Jurisdiction"
            if e.entity_type == "APPLICATION":
                app_row = db.query(Application).filter(Application.id == e.entity_id).first()
                if app_row:
                    inst_name = app_row.institution.name if app_row.institution else "N/A"
                    reg_name = app_row.region.name if app_row.region else "N/A"
            elif e.entity_type == "EVC":
                evc_row = db.query(EVCSchedule).filter(EVCSchedule.id == e.entity_id).first()
                if evc_row and evc_row.application:
                    inst_name = evc_row.application.institution.name if evc_row.application.institution else "N/A"
                    reg_name = evc_row.application.region.name if evc_row.application.region else "N/A"
            elif e.entity_type == "UNDERTAKING":
                und_row = db.query(Undertaking).filter(Undertaking.id == e.entity_id).first()
                if und_row and und_row.institution:
                    inst_name = und_row.institution.name
                    reg_name = und_row.institution.region.name if und_row.institution.region else "N/A"

            if region_id and e.entity_type == "APPLICATION":
                if app_row and app_row.region_id != region_id:
                    continue

            if status_filter == "ACTIVE" and not is_active:
                continue
            if status_filter == "RESOLVED" and is_active:
                continue

            if search:
                s_lower = search.lower()
                if s_lower not in inst_name.lower() and s_lower not in (e.reason or "").lower():
                    continue

            formatted_rows.append({
                "id": e.id,
                "entity_type": e.entity_type,
                "entity_id": e.entity_id,
                "institution_name": inst_name,
                "region_name": reg_name,
                "level": f"Level {e.level}",
                "level_int": e.level,
                "escalated_to": e.escalated_to,
                "reason": e.reason,
                "created_at": e.created_at.strftime("%Y-%m-%d %H:%M") if e.created_at else "—",
                "resolved_at": e.resolved_at.strftime("%Y-%m-%d %H:%M") if e.resolved_at else "Active Escalation",
                "is_active": is_active,
                "dwell_days": dwell_days
            })

        total = len(formatted_rows)
        active_c = len([r for r in formatted_rows if r["is_active"]])
        resolved_c = total - active_c
        l1_c = len([r for r in formatted_rows if r["level_int"] == 1 and r["is_active"]])
        l2_c = len([r for r in formatted_rows if r["level_int"] == 2 and r["is_active"]])
        l3_c = len([r for r in formatted_rows if r["level_int"] == 3 and r["is_active"]])

        chart_data = [
            {"label": "Level 1 (Regional Officer)", "active": l1_c, "color": "#F59E0B"},
            {"label": "Level 2 (Regional Head)", "active": l2_c, "color": "#E05A1B"},
            {"label": "Level 3 (Bureau Officer)", "active": l3_c, "color": "#EF4444"},
            {"label": "Resolved Cases", "active": resolved_c, "color": "#10B981"}
        ]

        return {
            "report_id": "overdue-escalations",
            "title": "Overdue Cases & Statutory Escalations Report",
            "subtitle": f"Active SLA timeout escalation hierarchy across {total} recorded incidents",
            "generated_at": now.isoformat(),
            "summary_kpis": [
                {"label": "Total Incidents", "value": total, "color": "blue"},
                {"label": "Active Escalations", "value": active_c, "color": "red"},
                {"label": "Level 1 (RO Queue)", "value": l1_c, "color": "amber"},
                {"label": "Level 2 (Regional Head)", "value": l2_c, "color": "orange"},
                {"label": "Level 3 (Bureau Action)", "value": l3_c, "color": "red"},
                {"label": "Auto-Resolved", "value": resolved_c, "color": "emerald"}
            ],
            "chart_type": "bar",
            "chart_data": chart_data,
            "chart_config": {"xKey": "label", "bars": [{"key": "active", "label": "Incidents", "color": "#EF4444"}]},
            "table_columns": [
                {"key": "id", "label": "Incident #", "type": "mono"},
                {"key": "entity_type", "label": "Module", "type": "badge"},
                {"key": "institution_name", "label": "Institution Name", "type": "text"},
                {"key": "region_name", "label": "Region", "type": "text"},
                {"key": "level", "label": "Ladder Level", "type": "badge"},
                {"key": "escalated_to", "label": "Escalated Authority", "type": "text"},
                {"key": "reason", "label": "Statutory Reason", "type": "text"},
                {"key": "created_at", "label": "Escalated At", "type": "date"},
                {"key": "resolved_at", "label": "Resolution Status", "type": "status"}
            ],
            "table_data": formatted_rows
        }

    # --- 6. Region-wise Processing Performance Report ---
    @staticmethod
    def _report_region_performance(db: Session, now: datetime) -> Dict[str, Any]:
        regions = db.query(Region).order_by(Region.id.asc()).all()

        region_rows = []
        chart_data = []

        total_apps_national = 0
        total_approved_national = 0
        all_processing_days = []

        for r in regions:
            apps = db.query(Application).filter(Application.region_id == r.id).all()
            tot = len(apps)
            total_apps_national += tot

            appr = len([a for a in apps if a.status == "APPROVED"])
            rej = len([a for a in apps if a.status == "REJECTED"])
            pending = len([a for a in apps if a.current_stage not in ["APPROVED", "REJECTED"]])
            in_evc = len([a for a in apps if a.current_stage == "EVC"])
            overdue = len([a for a in apps if a.due_date and a.due_date < now and a.current_stage not in ["APPROVED", "REJECTED"]])

            total_approved_national += appr

            # Processing days
            dwells = [(now - a.submitted_at).days for a in apps if a.submitted_at]
            avg_days = round(sum(dwells) / max(len(dwells), 1), 1) if dwells else 0.0
            all_processing_days.extend(dwells)

            # Compliance scores
            scores = [a.compliance_score for a in apps if a.compliance_score is not None]
            avg_score = round(sum(scores) / max(len(scores), 1), 1) if scores else 0.0

            sla_rate = round(((tot - overdue) / max(tot, 1)) * 100, 1)

            region_rows.append({
                "region_id": r.id,
                "region_name": r.name,
                "total_applications": tot,
                "approved_count": appr,
                "rejected_count": rej,
                "pending_count": pending,
                "evc_count": in_evc,
                "overdue_count": overdue,
                "avg_processing_days": avg_days,
                "compliance_score_avg": avg_score,
                "sla_adherence_rate": f"{sla_rate}%",
                "sla_rate_num": sla_rate
            })

            chart_data.append({
                "region": r.name.replace(" Region", "").replace("-", " "),
                "total": tot,
                "pending": pending,
                "overdue": overdue,
                "avg_days": avg_days
            })

        nat_avg_days = round(sum(all_processing_days) / max(len(all_processing_days), 1), 1) if all_processing_days else 0.0
        nat_appr_rate = round((total_approved_national / max(total_apps_national, 1)) * 100, 1)

        # Top region by lowest overdue
        top_reg = min(region_rows, key=lambda x: (x["overdue_count"], -x["total_applications"])) if region_rows else None
        worst_reg = max(region_rows, key=lambda x: (x["pending_count"])) if region_rows else None

        return {
            "report_id": "region-performance",
            "title": "Regional Processing Performance Benchmarking",
            "subtitle": "Turnaround velocity, pendency distribution, and compliance scores across all 8 official AICTE regions",
            "generated_at": now.isoformat(),
            "summary_kpis": [
                {"label": "National Applications", "value": total_apps_national, "color": "blue"},
                {"label": "National Turnaround", "value": f"{nat_avg_days} Days", "color": "emerald"},
                {"label": "National Approval Rate", "value": f"{nat_appr_rate}%", "color": "blue"},
                {"label": "Top SLA Adherence Region", "value": top_reg["region_name"] if top_reg else "N/A", "color": "emerald"},
                {"label": "Highest Pendency Region", "value": worst_reg["region_name"] if worst_reg else "N/A", "color": "amber"}
            ],
            "chart_type": "bar",
            "chart_data": chart_data,
            "chart_config": {"xKey": "region", "bars": [{"key": "pending", "label": "Pending Cases", "color": "#E05A1B"}, {"key": "overdue", "label": "SLA Overdue", "color": "#EF4444"}]},
            "table_columns": [
                {"key": "region_name", "label": "AICTE Region", "type": "text"},
                {"key": "total_applications", "label": "Total Cases", "type": "number"},
                {"key": "pending_count", "label": "Active Pending", "type": "number"},
                {"key": "evc_count", "label": "In EVC Stage", "type": "number"},
                {"key": "overdue_count", "label": "Overdue Breaches", "type": "number"},
                {"key": "avg_processing_days", "label": "Avg Turnaround (Days)", "type": "number"},
                {"key": "compliance_score_avg", "label": "Avg APH Score %", "type": "score"},
                {"key": "sla_adherence_rate", "label": "SLA Adherence %", "type": "badge"}
            ],
            "table_data": region_rows
        }

    # --- CSV Export Utility ---
    @staticmethod
    def export_csv(report_data: Dict[str, Any]) -> str:
        """Converts report data to CSV text formatted for Excel."""
        output = io.StringIO()
        writer = csv.writer(output)

        # Official Government Header
        writer.writerow(["ALL INDIA COUNCIL FOR TECHNICAL EDUCATION (AICTE)"])
        writer.writerow(["MINISTRY OF EDUCATION, GOVERNMENT OF INDIA"])
        writer.writerow([report_data.get("title", "Statutory Report").upper()])
        writer.writerow(["Generated At", report_data.get("generated_at", "")])
        writer.writerow([])

        # Summary KPIs
        writer.writerow(["EXECUTIVE SUMMARY KPIS"])
        for kpi in report_data.get("summary_kpis", []):
            writer.writerow([kpi.get("label", ""), kpi.get("value", "")])
        writer.writerow([])

        # Table Header
        columns = report_data.get("table_columns", [])
        col_keys = [c["key"] for c in columns]
        col_labels = [c["label"] for c in columns]
        writer.writerow(col_labels)

        # Table Rows
        for row in report_data.get("table_data", []):
            writer.writerow([row.get(k, "") for k in col_keys])

        csv_str = output.getvalue()
        output.close()
        return csv_str

