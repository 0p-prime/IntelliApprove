"""
Alert and Escalation Evaluation Engine.
Monitors Applications, EVC schedules, Undertakings, and Document Expiries
against database-defined AlertRules and Escalation Ladders.
Enforces Non-Negotiable Rule #1: All automated escalations write immutable audit logs.
"""
import json
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.models.entities import (
    AlertRule,
    Notification,
    Escalation,
    Application,
    EVCSchedule,
    Undertaking,
    Document,
    SystemClock,
    User,
    Institution,
    Region,
    AuditLog
)
from app.services.audit_service import AuditService


def get_simulated_or_real_now(db: Session) -> datetime:
    """
    Returns current simulated date from SystemClock if present;
    otherwise returns current UTC wall-clock time.
    """
    clock = db.query(SystemClock).first()
    if clock and clock.simulated_date:
        d = clock.simulated_date
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc)


def dispatch_notification_to_roles(
    db: Session,
    roles: List[str],
    title: str,
    message: str,
    category: str,
    severity: str,
    link: Optional[str] = None,
    region_id: Optional[int] = None,
    institution_id: Optional[int] = None
) -> int:
    """
    Dispatches notifications to users matching the given roles and geographical/institutional scope.
    Guarantees deduplication: avoids duplicate notifications with same title and link within 24 hours.
    Returns count of notifications created.
    """
    now = get_simulated_or_real_now(db)
    one_day_ago = now - timedelta(hours=24)

    # Find candidate target users
    user_query = db.query(User).filter(User.is_active == True)
    
    # We collect target user IDs
    target_user_ids = set()

    for role_name in roles:
        r_query = user_query.filter(User.role == role_name)
        if role_name in ["REGIONAL_OFFICER", "REGIONAL_HEAD"] and region_id:
            r_query = r_query.filter(User.region_id == region_id)
        elif role_name == "INSTITUTION" and institution_id:
            # Match users belonging to this institution
            # Check contact email or name match
            inst = db.query(Institution).filter(Institution.id == institution_id).first()
            if inst and inst.contact_email:
                inst_users = user_query.filter(User.email == inst.contact_email).all()
                for u in inst_users:
                    target_user_ids.add(u.id)
        
        for u in r_query.all():
            target_user_ids.add(u.id)

    # Also, if no specific user found (e.g. general role notice), create at least one system-wide record with user_id=None
    created_count = 0
    if not target_user_ids:
        # Check deduplication
        existing = db.query(Notification).filter(
            Notification.title == title,
            Notification.link == link,
            Notification.user_id.is_(None),
            Notification.created_at >= one_day_ago
        ).first()
        if not existing:
            n = Notification(
                user_id=None,
                title=title,
                message=message,
                category=category,
                severity=severity,
                link=link,
                is_read=False,
                channel="IN_APP",
                created_at=now
            )
            db.add(n)
            created_count += 1
    else:
        for uid in target_user_ids:
            existing = db.query(Notification).filter(
                Notification.title == title,
                Notification.link == link,
                Notification.user_id == uid,
                Notification.created_at >= one_day_ago
            ).first()
            if not existing:
                n = Notification(
                    user_id=uid,
                    title=title,
                    message=message,
                    category=category,
                    severity=severity,
                    link=link,
                    is_read=False,
                    channel="IN_APP",
                    created_at=now
                )
                db.add(n)
                created_count += 1

    return created_count


def evaluate_all_alert_rules(
    db: Session,
    actor_user: Optional[User] = None,
    client_ip: str = "127.0.0.1"
) -> Dict[str, Any]:
    """
    Evaluates all active alert rules across Applications, EVCs, Undertakings, and Documents.
    Generates Notifications and Escalations.
    Writes AuditLog entries for all automated actions.
    """
    now = get_simulated_or_real_now(db)
    active_rules = db.query(AlertRule).filter(AlertRule.is_active == True).all()

    rules_by_cat: Dict[str, List[AlertRule]] = {}
    for r in active_rules:
        rules_by_cat.setdefault(r.category, []).append(r)

    notifications_created = 0
    escalations_created = 0
    updated_entities = 0

    # -------------------------------------------------------------
    # 1. Evaluate STAGE_SLA rules for Applications
    # -------------------------------------------------------------
    sla_rules = rules_by_cat.get("STAGE_SLA", [])
    active_apps = db.query(Application).filter(
        Application.status.notin_(["APPROVED", "APPROVED_WITH_CONDITIONS", "REJECTED", "WITHDRAWN", "DRAFT"]),
        Application.due_date.isnot(None)
    ).all()

    for app in active_apps:
        due = app.due_date if app.due_date.tzinfo else app.due_date.replace(tzinfo=timezone.utc)
        diff_seconds = (due - now).total_seconds()
        diff_days = diff_seconds / 86400.0

        inst_name = app.institution.name if app.institution else f"Institution #{app.institution_id}"

        for rule in sla_rules:
            try:
                roles = json.loads(rule.notify_roles_json)
            except Exception:
                roles = ["REGIONAL_OFFICER", "REGIONAL_HEAD"]

            # Reminder rules (e.g. -7, -3, -1)
            if rule.trigger_type == "REMINDER":
                target_window = abs(rule.offset_days)
                # If approaching deadline within target_window days and still in future
                if 0 <= diff_days <= target_window:
                    n_count = dispatch_notification_to_roles(
                        db=db,
                        roles=roles,
                        title=f"SLA Reminder: {app.ref_no} ({rule.severity})",
                        message=f"Application {app.ref_no} ({inst_name}) stage '{app.current_stage}' due in {max(0, int(diff_days))} day(s) on {due.strftime('%Y-%m-%d')}.",
                        category="STAGE_SLA",
                        severity=rule.severity,
                        link=f"/applications/{app.id}",
                        region_id=app.region_id,
                        institution_id=app.institution_id
                    )
                    notifications_created += n_count

            # Overdue rule (offset_days == 0)
            elif rule.trigger_type == "OVERDUE":
                if diff_days < 0:
                    days_overdue = int(abs(diff_days))
                    n_count = dispatch_notification_to_roles(
                        db=db,
                        roles=roles,
                        title=f"SLA Breach: {app.ref_no} Overdue by {days_overdue}d",
                        message=f"Application {app.ref_no} ({inst_name}) in stage '{app.current_stage}' has breached SLA by {days_overdue} day(s). Immediate action required.",
                        category="STAGE_SLA",
                        severity="CRITICAL",
                        link=f"/applications/{app.id}",
                        region_id=app.region_id,
                        institution_id=app.institution_id
                    )
                    notifications_created += n_count

            # Escalation rules (offset_days > 0, e.g. 2 days overdue -> Level 1, 5 days overdue -> Level 2)
            elif rule.trigger_type == "ESCALATION":
                if diff_days < 0 and abs(diff_days) >= rule.offset_days:
                    target_role = roles[0] if roles else "REGIONAL_HEAD"
                    level = rule.escalation_level or (1 if "HEAD" in target_role else 2)

                    # Check if escalation already created for this level
                    existing_esc = db.query(Escalation).filter(
                        Escalation.entity_type == "APPLICATION",
                        Escalation.entity_id == app.id,
                        Escalation.level == level
                    ).first()

                    if not existing_esc:
                        esc = Escalation(
                            entity_type="APPLICATION",
                            entity_id=app.id,
                            level=level,
                            escalated_to=target_role,
                            reason=f"SLA breached at stage '{app.current_stage}' by {int(abs(diff_days))} days (threshold: {rule.offset_days}d). Automated escalation to {target_role}.",
                            created_at=now
                        )
                        db.add(esc)
                        escalations_created += 1

                        # Non-Negotiable Rule #1: Immutable audit log
                        AuditService.log(
                            db=db,
                            action="APPLICATION_ESCALATED",
                            entity_type="APPLICATION",
                            entity_id=str(app.id),
                            user=actor_user,
                            details=f"Application {app.ref_no} escalated to {target_role} (Level {level}) due to SLA breach of {int(abs(diff_days))} days.",
                            ip_address=client_ip
                        )

                        # Dispatch high-priority notification
                        n_count = dispatch_notification_to_roles(
                            db=db,
                            roles=roles,
                            title=f"URGENT ESCALATION (Level {level}): {app.ref_no}",
                            message=f"Application {app.ref_no} ({inst_name}) escalated to {target_role} due to overdue stage '{app.current_stage}'.",
                            category="STAGE_SLA",
                            severity="ESCALATION",
                            link=f"/applications/{app.id}",
                            region_id=app.region_id,
                            institution_id=app.institution_id
                        )
                        notifications_created += n_count

    # -------------------------------------------------------------
    # 2. Evaluate EVC_SCHEDULE deadlines and overdues
    # -------------------------------------------------------------
    active_evcs = db.query(EVCSchedule).filter(
        EVCSchedule.status.in_(["QUEUED", "SCHEDULED"]),
        EVCSchedule.due_date.isnot(None)
    ).all()

    for evc in active_evcs:
        due = evc.due_date if evc.due_date.tzinfo else evc.due_date.replace(tzinfo=timezone.utc)
        diff_days = (due - now).total_seconds() / 86400.0

        if diff_days < 0 and evc.status != "OVERDUE":
            evc.status = "OVERDUE"
            updated_entities += 1

            # Check if escalation exists
            existing_esc = db.query(Escalation).filter(
                Escalation.entity_type == "EVC",
                Escalation.entity_id == evc.id,
                Escalation.level == 1
            ).first()

            if not existing_esc:
                esc = Escalation(
                    entity_type="EVC",
                    entity_id=evc.id,
                    level=1,
                    escalated_to="REGIONAL_HEAD",
                    reason=f"EVC Inspection deadline passed on {due.strftime('%Y-%m-%d')} without completion. Escalated to Regional Head.",
                    created_at=now
                )
                db.add(esc)
                escalations_created += 1

                AuditService.log(
                    db=db,
                    action="EVC_SCHEDULE_ESCALATED",
                    entity_type="EVC_SCHEDULE",
                    entity_id=str(evc.id),
                    user=actor_user,
                    details=f"EVC inspection for Application #{evc.application_id} marked OVERDUE and escalated to Regional Head.",
                    ip_address=client_ip
                )

            # Notify officers & committee members
            n_count = dispatch_notification_to_roles(
                db=db,
                roles=["REGIONAL_OFFICER", "REGIONAL_HEAD", "EVC_MEMBER"],
                title=f"EVC Inspection Overdue: App #{evc.application_id}",
                message=f"Mandatory EVC inspection for Application #{evc.application_id} is overdue by {int(abs(diff_days))} day(s). Immediate scheduling required.",
                category="EVC_SCHEDULE",
                severity="CRITICAL",
                link="/evc",
                region_id=evc.application.region_id if evc.application else None
            )
            notifications_created += n_count

    # -------------------------------------------------------------
    # 3. Evaluate UNDERTAKING_DEADLINE rules
    # -------------------------------------------------------------
    und_rules = rules_by_cat.get("UNDERTAKING_DEADLINE", [])
    active_unds = db.query(Undertaking).filter(
        Undertaking.status.in_(["PENDING", "DUE_SOON", "OVERDUE"]),
        Undertaking.due_date.isnot(None)
    ).all()

    for und in active_unds:
        due = und.due_date if und.due_date.tzinfo else und.due_date.replace(tzinfo=timezone.utc)
        diff_days = (due - now).total_seconds() / 86400.0

        inst_name = und.institution.name if und.institution else f"Institution #{und.institution_id}"

        # Status transition to OVERDUE
        if diff_days < 0 and und.status != "OVERDUE":
            und.status = "OVERDUE"
            updated_entities += 1

            AuditService.log(
                db=db,
                action="UNDERTAKING_STATUS_OVERDUE",
                entity_type="UNDERTAKING",
                entity_id=str(und.id),
                user=actor_user,
                details=f"Undertaking #{und.id} for {inst_name} automatically shifted to OVERDUE status as deadline {due.strftime('%Y-%m-%d')} elapsed.",
                ip_address=client_ip
            )

        # Status transition to DUE_SOON
        elif 0 <= diff_days <= 7 and und.status == "PENDING":
            und.status = "DUE_SOON"
            updated_entities += 1

        for rule in und_rules:
            try:
                roles = json.loads(rule.notify_roles_json)
            except Exception:
                roles = ["INSTITUTION", "REGIONAL_OFFICER"]

            if rule.trigger_type == "REMINDER":
                window = abs(rule.offset_days)
                if 0 <= diff_days <= window:
                    n_count = dispatch_notification_to_roles(
                        db=db,
                        roles=roles,
                        title=f"Compliance Undertaking Reminder ({inst_name})",
                        message=f"Undertaking: '{und.condition_text[:80]}...' is due in {max(0, int(diff_days))} day(s) ({due.strftime('%Y-%m-%d')}).",
                        category="UNDERTAKING_DEADLINE",
                        severity=rule.severity,
                        link="/undertakings",
                        institution_id=und.institution_id
                    )
                    notifications_created += n_count

            elif rule.trigger_type == "OVERDUE":
                if diff_days < 0:
                    n_count = dispatch_notification_to_roles(
                        db=db,
                        roles=roles,
                        title=f"Undertaking Overdue: {inst_name}",
                        message=f"Mandatory conditional undertaking '{und.condition_text[:80]}...' is overdue by {int(abs(diff_days))} day(s).",
                        category="UNDERTAKING_DEADLINE",
                        severity="CRITICAL",
                        link="/undertakings",
                        institution_id=und.institution_id
                    )
                    notifications_created += n_count

            elif rule.trigger_type == "ESCALATION":
                if diff_days < 0 and abs(diff_days) >= rule.offset_days:
                    target_role = roles[0] if roles else "REGIONAL_HEAD"
                    level = rule.escalation_level or 1

                    existing_esc = db.query(Escalation).filter(
                        Escalation.entity_type == "UNDERTAKING",
                        Escalation.entity_id == und.id,
                        Escalation.level == level
                    ).first()

                    if not existing_esc:
                        esc = Escalation(
                            entity_type="UNDERTAKING",
                            entity_id=und.id,
                            level=level,
                            escalated_to=target_role,
                            reason=f"Institutional undertaking unfulfilled for {int(abs(diff_days))} days past deadline. Escalated to {target_role}.",
                            created_at=now
                        )
                        db.add(esc)
                        escalations_created += 1

                        AuditService.log(
                            db=db,
                            action="UNDERTAKING_ESCALATED",
                            entity_type="UNDERTAKING",
                            entity_id=str(und.id),
                            user=actor_user,
                            details=f"Undertaking #{und.id} for {inst_name} escalated to {target_role} due to non-fulfillment.",
                            ip_address=client_ip
                        )

                        n_count = dispatch_notification_to_roles(
                            db=db,
                            roles=roles,
                            title=f"URGENT: Non-Compliance Escalation ({inst_name})",
                            message=f"Undertaking default escalated to {target_role}. Institution failed to submit compliance evidence by deadline.",
                            category="UNDERTAKING_DEADLINE",
                            severity="ESCALATION",
                            link="/undertakings",
                            institution_id=und.institution_id
                        )
                        notifications_created += n_count

    # -------------------------------------------------------------
    # 4. Evaluate LEASE_EXPIRY rules for Documents
    # -------------------------------------------------------------
    lease_rules = rules_by_cat.get("LEASE_EXPIRY", [])
    expiring_docs = db.query(Document).filter(
        Document.expiry_date.isnot(None),
        Document.doc_type.in_(["LEASE_DEED", "LAND_TITLE", "BUILDING_PLAN", "NOC", "LAND_USE_CERTIFICATE"])
    ).all()

    for doc in expiring_docs:
        exp = doc.expiry_date if doc.expiry_date.tzinfo else doc.expiry_date.replace(tzinfo=timezone.utc)
        diff_days = (exp - now).total_seconds() / 86400.0

        inst_name = doc.institution.name if doc.institution else f"Institution #{doc.institution_id}"

        for rule in lease_rules:
            try:
                roles = json.loads(rule.notify_roles_json)
            except Exception:
                roles = ["INSTITUTION", "REGIONAL_OFFICER"]

            # e.g. 90, 60, 30, 7 days before expiry
            if 0 <= diff_days <= rule.offset_days and diff_days > (rule.offset_days - 7):
                n_count = dispatch_notification_to_roles(
                    db=db,
                    roles=roles,
                    title=f"Statutory Document Expiry Warning ({doc.doc_type})",
                    message=f"{doc.doc_type} of {inst_name} expires in {max(0, int(diff_days))} day(s) on {exp.strftime('%Y-%m-%d')}. Renewal submission required.",
                    category="LEASE_EXPIRY",
                    severity=rule.severity,
                    link="/documents",
                    institution_id=doc.institution_id
                )
                notifications_created += n_count

            # Expired without verified renewal -> Escalate
            if diff_days < 0 and rule.offset_days == 7:
                # Check if a renewal exists in VERIFIED status
                renewal = db.query(Document).filter(
                    Document.renewal_of_id == doc.id,
                    Document.verification_status == "VERIFIED"
                ).first()

                if not renewal:
                    existing_esc = db.query(Escalation).filter(
                        Escalation.entity_type == "DOCUMENT",
                        Escalation.entity_id == doc.id,
                        Escalation.level == 1
                    ).first()

                    if not existing_esc:
                        esc = Escalation(
                            entity_type="DOCUMENT",
                            entity_id=doc.id,
                            level=1,
                            escalated_to="REGIONAL_HEAD",
                            reason=f"Statutory {doc.doc_type} expired on {exp.strftime('%Y-%m-%d')} without verified renewal. Legal compliance breached.",
                            created_at=now
                        )
                        db.add(esc)
                        escalations_created += 1

                        AuditService.log(
                            db=db,
                            action="DOCUMENT_EXPIRY_ESCALATED",
                            entity_type="DOCUMENT",
                            entity_id=str(doc.id),
                            user=actor_user,
                            details=f"Expired {doc.doc_type} for {inst_name} escalated to Regional Head for non-renewal.",
                            ip_address=client_ip
                        )

    db.commit()

    return {
        "status": "success",
        "simulated_date": now.isoformat(),
        "notifications_created": notifications_created,
        "escalations_created": escalations_created,
        "updated_entities": updated_entities
    }

