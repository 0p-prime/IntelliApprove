"""
Automated Alert, Escalation, and Rules Evaluation Engine.
Evaluates all active alert rules from alert_rules table against:
- Applications (pendency, timeline, stage SLAs)
- EVC Schedules (queued, scheduled, due dates)
- Undertakings (pending, due soon, overdue compliance commitments)
- Documents (lease deeds, NOCs, land titles expiry monitoring)

Enforces:
- Idempotency key per entity + rule + level to guarantee exactly-once delivery
- Configurable Escalation Ladder:
  Level 0: Institution / Primary Officer
  Level 1: Regional Officer
  Level 2: Regional Head
  Level 3: Bureau Officer
- Auto-resolution of active escalations when entity/case closes
- Multi-channel notification dispatching (In-App, Email via SMTP/Log, Mock SMS/WhatsApp)
- Non-Negotiable Rule #1: Universal audit logging for all automated actions
"""
import json
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional, Set
from sqlalchemy.orm import Session

from app.core.clock import get_current_date, get_current_datetime

get_simulated_or_real_now = get_current_datetime
from app.models.entities import (
    AlertRule,
    Notification,
    Escalation,
    Application,
    EVCSchedule,
    Undertaking,
    Document,
    User,
    Institution,
    Region,
    AuditLog
)
from app.services.notification_service import dispatch_notification
from app.services.audit_service import AuditService


def get_target_users_for_roles(
    db: Session,
    roles: List[str],
    region_id: Optional[int] = None,
    institution_id: Optional[int] = None
) -> List[User]:
    """
    Finds active users matching the required roles and geographical/institutional scope.
    """
    all_users = db.query(User).filter(User.is_active == True)
    matched_users: List[User] = []

    for role_name in roles:
        r_query = all_users.filter(User.role == role_name)
        if role_name in ["REGIONAL_OFFICER", "REGIONAL_HEAD"] and region_id:
            r_query = r_query.filter(User.region_id == region_id)
        elif role_name == "INSTITUTION" and institution_id:
            inst = db.query(Institution).filter(Institution.id == institution_id).first()
            if inst and inst.contact_email:
                r_query = r_query.filter(User.email == inst.contact_email)
        
        for u in r_query.all():
            if u not in matched_users:
                matched_users.append(u)

    return matched_users


def auto_resolve_escalations_for_entity(
    db: Session,
    entity_type: str,
    entity_id: int,
    resolution_reason: str,
    actor_user: Optional[User] = None,
    client_ip: str = "127.0.0.1"
) -> int:
    """
    Auto-resolves open escalations when the entity/case closes or compliance is fulfilled.
    """
    now = get_current_datetime(db)
    open_escs = db.query(Escalation).filter(
        Escalation.entity_type == entity_type,
        Escalation.entity_id == entity_id,
        Escalation.resolved_at.is_(None)
    ).all()

    resolved_count = 0
    for esc in open_escs:
        esc.resolved_at = now
        resolved_count += 1
        AuditService.log(
            db=db,
            action="ESCALATION_AUTO_RESOLVED",
            entity_type="ESCALATION",
            entity_id=str(esc.id),
            user=actor_user,
            details=f"Escalation #{esc.id} (Level {esc.level} -> {esc.escalated_to}) auto-resolved: {resolution_reason}.",
            ip_address=client_ip
        )
    return resolved_count


def evaluate_all_alert_rules(
    db: Session,
    actor_user: Optional[User] = None,
    client_ip: str = "127.0.0.1"
) -> Dict[str, Any]:
    """
    Evaluates ALL alert rules against Applications, EVCs, Undertakings, and Documents.
    Applies strict idempotency and triggers multi-channel notifications.
    """
    now = get_current_datetime(db)
    active_rules = db.query(AlertRule).filter(AlertRule.is_active == True).all()

    rules_by_cat: Dict[str, List[AlertRule]] = {}
    for r in active_rules:
        rules_by_cat.setdefault(r.category, []).append(r)

    notifications_created = 0
    escalations_created = 0
    escalations_resolved = 0
    updated_entities = 0

    # ------------------------------------------------------------------
    # 1. APPLICATIONS: Stage SLAs, Pendency, Overdue & Auto-Resolution
    # ------------------------------------------------------------------
    all_apps = db.query(Application).all()
    sla_rules = rules_by_cat.get("STAGE_SLA", [])

    for app in all_apps:
        # Check if case is closed -> Auto-resolve active escalations
        if app.status in ["APPROVED", "APPROVED_WITH_CONDITIONS", "REJECTED", "WITHDRAWN"]:
            res_count = auto_resolve_escalations_for_entity(
                db=db,
                entity_type="APPLICATION",
                entity_id=app.id,
                resolution_reason=f"Application {app.ref_no} reached final decision: {app.status}",
                actor_user=actor_user,
                client_ip=client_ip
            )
            escalations_resolved += res_count
            continue

        if not app.due_date:
            continue

        due = app.due_date if app.due_date.tzinfo else app.due_date.replace(tzinfo=timezone.utc)
        diff_days = (due - now).total_seconds() / 86400.0
        inst_name = app.institution.name if app.institution else f"Institution #{app.institution_id}"

        for rule in sla_rules:
            try:
                roles = json.loads(rule.notify_roles_json)
            except Exception:
                roles = ["REGIONAL_OFFICER", "REGIONAL_HEAD"]

            # Target recipients
            recipients = get_target_users_for_roles(
                db=db,
                roles=roles,
                region_id=app.region_id,
                institution_id=app.institution_id
            )

            # Reminder rules: e.g. -7, -3, -1
            if rule.trigger_type == "REMINDER":
                target_window = abs(rule.offset_days)
                if 0 <= diff_days <= target_window:
                    for u in (recipients or [None]):
                        uid_str = str(u.id) if u else "broadcast"
                        idem_key = f"APP:{app.id}:rule_{rule.id}:rem_{target_window}:{uid_str}"
                        notif = dispatch_notification(
                            db=db,
                            title=f"SLA Reminder: {app.ref_no} ({rule.severity})",
                            message=f"Application {app.ref_no} ({inst_name}) stage '{app.current_stage}' due in {max(0, int(diff_days))} day(s) on {due.strftime('%Y-%m-%d')}.",
                            category="STAGE_SLA",
                            severity=rule.severity,
                            user=u,
                            link=f"/applications/{app.id}",
                            idempotency_key=idem_key
                        )
                        if notif:
                            notifications_created += 1

            # Overdue rule: offset_days == 0
            elif rule.trigger_type == "OVERDUE":
                if diff_days < 0:
                    days_over = int(abs(diff_days))
                    for u in (recipients or [None]):
                        uid_str = str(u.id) if u else "broadcast"
                        idem_key = f"APP:{app.id}:rule_{rule.id}:overdue:{uid_str}"
                        notif = dispatch_notification(
                            db=db,
                            title=f"SLA Breach: {app.ref_no} Overdue by {days_over}d",
                            message=f"Application {app.ref_no} ({inst_name}) stage '{app.current_stage}' exceeded SLA deadline by {days_over} day(s). Immediate scrutiny action required.",
                            category="STAGE_SLA",
                            severity="CRITICAL",
                            user=u,
                            link=f"/applications/{app.id}",
                            idempotency_key=idem_key
                        )
                        if notif:
                            notifications_created += 1

            # Escalation Ladder:
            # Level 1: Regional Officer (+1 to +2 days)
            # Level 2: Regional Head (+3 to +4 days)
            # Level 3: Bureau Officer (+5+ days)
            elif rule.trigger_type == "ESCALATION":
                if diff_days < 0 and abs(diff_days) >= rule.offset_days:
                    target_role = roles[0] if roles else "REGIONAL_HEAD"
                    level = rule.escalation_level
                    if level == 0 and "HEAD" in target_role:
                        level = 2
                    elif level == 0 and "BUREAU" in target_role:
                        level = 3
                    elif level == 0:
                        level = 1

                    # Check if escalation already recorded for this entity + level
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
                            reason=f"SLA breached at stage '{app.current_stage}' by {int(abs(diff_days))} days (exceeds {rule.offset_days}d threshold). Automated escalation to {target_role}.",
                            created_at=now
                        )
                        db.add(esc)
                        escalations_created += 1

                        # Rule #1 Audit log
                        AuditService.log(
                            db=db,
                            action="APPLICATION_ESCALATED",
                            entity_type="APPLICATION",
                            entity_id=str(app.id),
                            user=actor_user,
                            details=f"Application {app.ref_no} escalated to {target_role} (Level {level}) after {int(abs(diff_days))}d delay.",
                            ip_address=client_ip
                        )

                        # Dispatch high-priority notification to targeted users
                        for u in (recipients or [None]):
                            uid_str = str(u.id) if u else "broadcast"
                            idem_key = f"APP:{app.id}:esc_lvl_{level}:{uid_str}"
                            notif = dispatch_notification(
                                db=db,
                                title=f"URGENT ESCALATION (Level {level}): {app.ref_no}",
                                message=f"Application {app.ref_no} ({inst_name}) escalated to {target_role} due to overdue stage '{app.current_stage}'.",
                                category="STAGE_SLA",
                                severity="ESCALATION",
                                user=u,
                                link=f"/applications/{app.id}",
                                idempotency_key=idem_key
                            )
                            if notif:
                                notifications_created += 1

    # ------------------------------------------------------------------
    # 2. EVC SCHEDULES: Reminders, Overdue Inspections & Escalations
    # ------------------------------------------------------------------
    all_evcs = db.query(EVCSchedule).all()
    for evc in all_evcs:
        # Auto-resolve if completed
        if evc.status == "COMPLETED":
            res_count = auto_resolve_escalations_for_entity(
                db=db,
                entity_type="EVC",
                entity_id=evc.id,
                resolution_reason=f"EVC inspection for App #{evc.application_id} completed successfully",
                actor_user=actor_user,
                client_ip=client_ip
            )
            escalations_resolved += res_count
            continue

        if not evc.due_date:
            continue

        due = evc.due_date if evc.due_date.tzinfo else evc.due_date.replace(tzinfo=timezone.utc)
        diff_days = (due - now).total_seconds() / 86400.0
        app_ref = evc.application.ref_no if evc.application else f"App #{evc.application_id}"
        reg_id = evc.application.region_id if evc.application else None

        # T-7, T-3, T-1 EVC Inspection Reminders
        for rem_day in [7, 3, 1]:
            if 0 <= diff_days <= rem_day:
                recipients = get_target_users_for_roles(
                    db=db,
                    roles=["EVC_MEMBER", "REGIONAL_OFFICER"],
                    region_id=reg_id
                )
                for u in (recipients or [None]):
                    uid_str = str(u.id) if u else "broadcast"
                    idem_key = f"EVC:{evc.id}:rem_{rem_day}:{uid_str}"
                    notif = dispatch_notification(
                        db=db,
                        title=f"EVC Inspection Upcoming: {app_ref} (T-{rem_day}d)",
                        message=f"Expert Visit Committee inspection for {app_ref} is scheduled for {due.strftime('%Y-%m-%d')} (due in {max(0, int(diff_days))} days).",
                        category="EVC_SCHEDULE",
                        severity="WARNING" if rem_day <= 3 else "INFO",
                        user=u,
                        link="/evc",
                        idempotency_key=idem_key
                    )
                    if notif:
                        notifications_created += 1

        # Overdue EVC Shift
        if diff_days < 0:
            if evc.status != "OVERDUE":
                evc.status = "OVERDUE"
                updated_entities += 1

            # Escalation Level 1 (Regional Head) and Level 2 (Bureau Officer)
            esc_level = 1 if abs(diff_days) < 5 else 2
            esc_target = "REGIONAL_HEAD" if esc_level == 1 else "BUREAU_OFFICER"

            existing_esc = db.query(Escalation).filter(
                Escalation.entity_type == "EVC",
                Escalation.entity_id == evc.id,
                Escalation.level == esc_level
            ).first()

            if not existing_esc:
                esc = Escalation(
                    entity_type="EVC",
                    entity_id=evc.id,
                    level=esc_level,
                    escalated_to=esc_target,
                    reason=f"EVC Inspection deadline passed on {due.strftime('%Y-%m-%d')} ({int(abs(diff_days))}d overdue). Escalated to {esc_target}.",
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
                    details=f"EVC inspection for {app_ref} escalated to {esc_target} (Level {esc_level}).",
                    ip_address=client_ip
                )

                recipients = get_target_users_for_roles(
                    db=db,
                    roles=["REGIONAL_OFFICER", "REGIONAL_HEAD", "BUREAU_OFFICER"],
                    region_id=reg_id
                )
                for u in (recipients or [None]):
                    uid_str = str(u.id) if u else "broadcast"
                    idem_key = f"EVC:{evc.id}:esc_lvl_{esc_level}:{uid_str}"
                    notif = dispatch_notification(
                        db=db,
                        title=f"EVC Inspection Overdue Escalation: {app_ref}",
                        message=f"Mandatory EVC inspection for {app_ref} is overdue by {int(abs(diff_days))} day(s). Escalated to {esc_target}.",
                        category="EVC_SCHEDULE",
                        severity="ESCALATION",
                        user=u,
                        link="/evc",
                        idempotency_key=idem_key
                    )
                    if notif:
                        notifications_created += 1

    # ------------------------------------------------------------------
    # 3. UNDERTAKINGS: Compliance Commitments, Reminders & Escalations
    # ------------------------------------------------------------------
    und_rules = rules_by_cat.get("UNDERTAKING_DEADLINE", [])
    all_unds = db.query(Undertaking).all()

    for und in all_unds:
        # Auto-resolve if verified
        if und.status in ["VERIFIED", "COMPLIANT"]:
            res_count = auto_resolve_escalations_for_entity(
                db=db,
                entity_type="UNDERTAKING",
                entity_id=und.id,
                resolution_reason=f"Undertaking #{und.id} verified with compliant evidence",
                actor_user=actor_user,
                client_ip=client_ip
            )
            escalations_resolved += res_count
            continue

        if not und.due_date:
            continue

        due = und.due_date if und.due_date.tzinfo else und.due_date.replace(tzinfo=timezone.utc)
        diff_days = (due - now).total_seconds() / 86400.0
        inst_name = und.institution.name if und.institution else f"Institution #{und.institution_id}"

        # Status transition to OVERDUE or DUE_SOON
        if diff_days < 0 and und.status != "OVERDUE":
            und.status = "OVERDUE"
            updated_entities += 1
            AuditService.log(
                db=db,
                action="UNDERTAKING_STATUS_OVERDUE",
                entity_type="UNDERTAKING",
                entity_id=str(und.id),
                user=actor_user,
                details=f"Undertaking #{und.id} ({inst_name}) automatically shifted to OVERDUE status as deadline {due.strftime('%Y-%m-%d')} elapsed.",
                ip_address=client_ip
            )
        elif 0 <= diff_days <= 7 and und.status == "PENDING":
            und.status = "DUE_SOON"
            updated_entities += 1

        for rule in und_rules:
            try:
                roles = json.loads(rule.notify_roles_json)
            except Exception:
                roles = ["INSTITUTION", "REGIONAL_OFFICER"]

            recipients = get_target_users_for_roles(
                db=db,
                roles=roles,
                institution_id=und.institution_id
            )

            # Reminder rules: e.g. -7, -3
            if rule.trigger_type == "REMINDER":
                window = abs(rule.offset_days)
                if 0 <= diff_days <= window:
                    for u in (recipients or [None]):
                        uid_str = str(u.id) if u else "broadcast"
                        idem_key = f"UND:{und.id}:rule_{rule.id}:rem_{window}:{uid_str}"
                        notif = dispatch_notification(
                            db=db,
                            title=f"Compliance Undertaking Reminder ({inst_name})",
                            message=f"Conditional undertaking '{und.condition_text[:80]}...' is due in {max(0, int(diff_days))} day(s) on {due.strftime('%Y-%m-%d')}.",
                            category="UNDERTAKING_DEADLINE",
                            severity=rule.severity,
                            user=u,
                            link="/undertakings",
                            idempotency_key=idem_key
                        )
                        if notif:
                            notifications_created += 1

            # Overdue alert
            elif rule.trigger_type == "OVERDUE":
                if diff_days < 0:
                    for u in (recipients or [None]):
                        uid_str = str(u.id) if u else "broadcast"
                        idem_key = f"UND:{und.id}:rule_{rule.id}:overdue:{uid_str}"
                        notif = dispatch_notification(
                            db=db,
                            title=f"Undertaking Overdue: {inst_name}",
                            message=f"Mandatory conditional undertaking '{und.condition_text[:80]}...' is overdue by {int(abs(diff_days))} day(s).",
                            category="UNDERTAKING_DEADLINE",
                            severity="CRITICAL",
                            user=u,
                            link="/undertakings",
                            idempotency_key=idem_key
                        )
                        if notif:
                            notifications_created += 1

            # Escalation rule (e.g. +3 days overdue -> Level 1 Regional Head, +7 days -> Level 2 Bureau Officer)
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

                        for u in (recipients or [None]):
                            uid_str = str(u.id) if u else "broadcast"
                            idem_key = f"UND:{und.id}:esc_lvl_{level}:{uid_str}"
                            notif = dispatch_notification(
                                db=db,
                                title=f"URGENT: Non-Compliance Escalation ({inst_name})",
                                message=f"Undertaking default escalated to {target_role}. Institution failed to submit compliance evidence by deadline.",
                                category="UNDERTAKING_DEADLINE",
                                severity="ESCALATION",
                                user=u,
                                link="/undertakings",
                                idempotency_key=idem_key
                            )
                            if notif:
                                notifications_created += 1

    # ------------------------------------------------------------------
    # 4. DOCUMENTS: Lease Deeds, Building Plans & NOC Validity Monitoring
    # ------------------------------------------------------------------
    lease_rules = rules_by_cat.get("LEASE_EXPIRY", [])
    all_docs = db.query(Document).filter(
        Document.expiry_date.isnot(None),
        Document.doc_type.in_(["LEASE_DEED", "LAND_TITLE", "BUILDING_PLAN", "NOC", "LAND_USE_CERTIFICATE"])
    ).all()

    for doc in all_docs:
        # Auto-resolve if verified renewal exists
        if doc.verification_status == "VERIFIED" and doc.renewal_of_id:
            res_count = auto_resolve_escalations_for_entity(
                db=db,
                entity_type="DOCUMENT",
                entity_id=doc.renewal_of_id,
                resolution_reason=f"Renewal document #{doc.id} verified and approved",
                actor_user=actor_user,
                client_ip=client_ip
            )
            escalations_resolved += res_count

        exp = doc.expiry_date if doc.expiry_date.tzinfo else doc.expiry_date.replace(tzinfo=timezone.utc)
        diff_days = (exp - now).total_seconds() / 86400.0
        inst_name = doc.institution.name if doc.institution else f"Institution #{doc.institution_id}"

        for rule in lease_rules:
            try:
                roles = json.loads(rule.notify_roles_json)
            except Exception:
                roles = ["INSTITUTION", "REGIONAL_OFFICER"]

            recipients = get_target_users_for_roles(
                db=db,
                roles=roles,
                institution_id=doc.institution_id
            )

            # Warning thresholds: 90, 60, 30, 7 days
            if 0 <= diff_days <= rule.offset_days and diff_days > (rule.offset_days - 7):
                for u in (recipients or [None]):
                    uid_str = str(u.id) if u else "broadcast"
                    idem_key = f"DOC:{doc.id}:rule_{rule.id}:offset_{rule.offset_days}:{uid_str}"
                    notif = dispatch_notification(
                        db=db,
                        title=f"Statutory Document Expiry Warning ({doc.doc_type})",
                        message=f"{doc.doc_type} of {inst_name} expires in {max(0, int(diff_days))} day(s) on {exp.strftime('%Y-%m-%d')}. Renewal deed submission required.",
                        category="LEASE_EXPIRY",
                        severity=rule.severity,
                        user=u,
                        link="/documents",
                        idempotency_key=idem_key
                    )
                    if notif:
                        notifications_created += 1

            # Expired without verified renewal -> Escalate to Regional Head (Level 1) or Bureau Officer (Level 2)
            if diff_days < 0 and rule.offset_days == 7:
                renewal = db.query(Document).filter(
                    Document.renewal_of_id == doc.id,
                    Document.verification_status == "VERIFIED"
                ).first()

                if not renewal:
                    level = 1 if abs(diff_days) < 30 else 2
                    target_role = "REGIONAL_HEAD" if level == 1 else "BUREAU_OFFICER"

                    existing_esc = db.query(Escalation).filter(
                        Escalation.entity_type == "DOCUMENT",
                        Escalation.entity_id == doc.id,
                        Escalation.level == level
                    ).first()

                    if not existing_esc:
                        esc = Escalation(
                            entity_type="DOCUMENT",
                            entity_id=doc.id,
                            level=level,
                            escalated_to=target_role,
                            reason=f"Statutory {doc.doc_type} expired on {exp.strftime('%Y-%m-%d')} ({int(abs(diff_days))}d ago) without verified renewal. Legal compliance breached.",
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
                            details=f"Expired {doc.doc_type} for {inst_name} escalated to {target_role} (Level {level}) for non-renewal.",
                            ip_address=client_ip
                        )

                        for u in (recipients or [None]):
                            uid_str = str(u.id) if u else "broadcast"
                            idem_key = f"DOC:{doc.id}:esc_lvl_{level}:{uid_str}"
                            notif = dispatch_notification(
                                db=db,
                                title=f"ESCALATION: Statutory {doc.doc_type} Expired ({inst_name})",
                                message=f"{doc.doc_type} expired without verified renewal. Escalated to {target_role}.",
                                category="LEASE_EXPIRY",
                                severity="ESCALATION",
                                user=u,
                                link="/documents",
                                idempotency_key=idem_key
                            )
                            if notif:
                                notifications_created += 1

    db.commit()

    return {
        "status": "success",
        "simulated_date": now.isoformat(),
        "notifications_created": notifications_created,
        "escalations_created": escalations_created,
        "escalations_resolved": escalations_resolved,
        "updated_entities": updated_entities
    }
