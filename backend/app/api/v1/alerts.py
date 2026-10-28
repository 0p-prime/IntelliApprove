"""
Alerts and Escalations Endpoints.
Rule #1: State changes write audit_logs entries.
"""
import re
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_user, get_client_ip
from app.models.entities import (
    Notification,
    Escalation,
    AlertRule,
    User,
    Application,
    Institution,
    Undertaking,
    Document,
    EVCSchedule
)
from app.schemas.all_schemas import (
    AlertOut,
    NotificationOut,
    EscalationOut,
    AlertRuleOut,
    AlertRuleUpdate
)
from app.services.alert_engine import evaluate_all_alert_rules
from app.services.audit_service import AuditService

router = APIRouter()


def _format_notification_to_alert_out(n: Notification) -> AlertOut:
    """Helper to convert Notification entity to AlertOut schema with parsed application_id."""
    app_id = None
    if n.link and "/applications/" in n.link:
        m = re.search(r"/applications/(\d+)", n.link)
        if m:
            try:
                app_id = int(m.group(1))
            except Exception:
                pass

    role_str = None
    if n.user and n.user.role:
        role_str = n.user.role

    return AlertOut(
        id=n.id,
        application_id=app_id,
        title=n.title,
        message=n.message,
        severity=n.severity,
        recipient_role=role_str,
        is_read=n.is_read,
        created_at=n.created_at
    )


@router.get("", response_model=List[AlertOut])
def get_alerts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    category: Optional[str] = None,
    severity: Optional[str] = None,
    unread_only: bool = False
):
    """Retrieve alerts applicable for current user based on RBAC scoping."""
    query = db.query(Notification)

    # Scoping by role
    if current_user.role in ["ADMIN", "BUREAU_OFFICER"]:
        # National HQ sees all alerts
        pass
    elif current_user.role in ["REGIONAL_OFFICER", "REGIONAL_HEAD"]:
        # Region officers see alerts assigned to them, general alerts, or alerts referencing applications in their region
        query = query.filter(
            (Notification.user_id == current_user.id) |
            (Notification.user_id.is_(None)) |
            (Notification.category.in_(["STAGE_SLA", "EVC_SCHEDULE", "UNDERTAKING_DEADLINE", "LEASE_EXPIRY"]))
        )
    elif current_user.role == "INSTITUTION":
        # Institution sees notifications targeted to their user or general institutional alerts
        query = query.filter(
            (Notification.user_id == current_user.id) |
            (Notification.category.in_(["UNDERTAKING_DEADLINE", "LEASE_EXPIRY", "STAGE_SLA"]))
        )
    elif current_user.role == "EVC_MEMBER":
        query = query.filter(
            (Notification.user_id == current_user.id) |
            (Notification.category.in_(["EVC_SCHEDULE", "GENERAL"]))
        )

    if category:
        query = query.filter(Notification.category == category)
    if severity and severity != "ALL":
        query = query.filter(Notification.severity == severity)
    if unread_only:
        query = query.filter(Notification.is_read == False)

    notifications = query.order_by(Notification.created_at.desc()).limit(100).all()
    return [_format_notification_to_alert_out(n) for n in notifications]


@router.get("/unread-count")
def get_unread_alerts_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns unread alert count for badge indicators."""
    query = db.query(Notification).filter(Notification.is_read == False)
    if current_user.role not in ["ADMIN", "BUREAU_OFFICER"]:
        query = query.filter(
            (Notification.user_id == current_user.id) | (Notification.user_id.is_(None))
        )
    return {"unread_count": query.count()}


@router.post("/{alert_id}/read")
def mark_alert_read(
    alert_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark an alert / notification as read."""
    alert = db.query(Notification).filter(Notification.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.is_read = True
    db.commit()
    return {"status": "success", "alert_id": alert_id}


@router.post("/read-all")
def mark_all_alerts_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark all alerts for the current user as read."""
    query = db.query(Notification).filter(Notification.is_read == False)
    if current_user.role not in ["ADMIN", "BUREAU_OFFICER"]:
        query = query.filter(
            (Notification.user_id == current_user.id) | (Notification.user_id.is_(None))
        )
    updated = query.update({Notification.is_read: True}, synchronize_session=False)
    db.commit()
    return {"status": "success", "marked_read_count": updated}


@router.post("/trigger-sla-check")
def trigger_sla_check_manual(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Manually invoke the background SLA breach and escalation evaluator."""
    client_ip = get_client_ip(request)
    result = evaluate_all_alert_rules(db=db, actor_user=current_user, client_ip=client_ip)
    
    AuditService.log(
        db=db,
        action="MANUAL_SLA_CHECK_INVOKED",
        entity_type="SYSTEM",
        entity_id="sla_worker",
        user=current_user,
        details=f"User {current_user.email} triggered on-demand SLA breach monitor. Result: {result}",
        ip_address=client_ip
    )
    return {
        "status": "success",
        "message": "SLA and escalation audit executed successfully.",
        "result": result
    }


@router.get("/escalations")
def get_escalation_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve all automated escalation events with enriched entity context."""
    events = db.query(Escalation).order_by(Escalation.created_at.desc()).all()
    
    result = []
    for e in events:
        ref_text = f"{e.entity_type} #{e.entity_id}"
        inst_name = "AICTE Regulated Entity"

        if e.entity_type == "APPLICATION":
            app = db.query(Application).filter(Application.id == e.entity_id).first()
            if app:
                ref_text = app.ref_no
                if app.institution:
                    inst_name = app.institution.name
        elif e.entity_type == "UNDERTAKING":
            und = db.query(Undertaking).filter(Undertaking.id == e.entity_id).first()
            if und and und.institution:
                inst_name = und.institution.name
                ref_text = f"Undertaking #{und.id}"
        elif e.entity_type == "DOCUMENT":
            doc = db.query(Document).filter(Document.id == e.entity_id).first()
            if doc and doc.institution:
                inst_name = doc.institution.name
                ref_text = f"{doc.doc_type} #{doc.id}"
        elif e.entity_type == "EVC":
            evc = db.query(EVCSchedule).filter(EVCSchedule.id == e.entity_id).first()
            if evc and evc.application and evc.application.institution:
                inst_name = evc.application.institution.name
                ref_text = f"EVC for {evc.application.ref_no}"

        result.append({
            "id": e.id,
            "entity_type": e.entity_type,
            "entity_id": e.entity_id,
            "application_id": e.entity_id if e.entity_type == "APPLICATION" else None,
            "application_number": ref_text,
            "institution_name": inst_name,
            "from_role": "REGIONAL_OFFICER" if e.level == 1 else "REGIONAL_HEAD",
            "escalated_to_role": e.escalated_to,
            "escalation_reason": e.reason,
            "escalation_level": e.level,
            "created_at": e.created_at,
            "resolved_at": e.resolved_at
        })
    return result


@router.get("/rules", response_model=List[AlertRuleOut])
def get_alert_rules(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve all configured alert and escalation rules."""
    return db.query(AlertRule).order_by(AlertRule.category, AlertRule.offset_days).all()


@router.put("/rules/{rule_id}", response_model=AlertRuleOut)
def update_alert_rule(
    rule_id: int,
    payload: AlertRuleUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update alert rule configuration (Authorized roles: ADMIN, BUREAU_OFFICER)."""
    if current_user.role not in ["ADMIN", "BUREAU_OFFICER"]:
        raise HTTPException(status_code=403, detail="Unauthorized to modify alert rules")

    rule = db.query(AlertRule).filter(AlertRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Alert rule not found")

    old_val = {
        "category": rule.category,
        "trigger_type": rule.trigger_type,
        "offset_days": rule.offset_days,
        "severity": rule.severity,
        "notify_roles_json": rule.notify_roles_json,
        "is_active": rule.is_active
    }

    if payload.trigger_type is not None:
        rule.trigger_type = payload.trigger_type
    if payload.offset_days is not None:
        rule.offset_days = payload.offset_days
    if payload.severity is not None:
        rule.severity = payload.severity
    if payload.notify_roles_json is not None:
        rule.notify_roles_json = payload.notify_roles_json
    if payload.is_active is not None:
        rule.is_active = payload.is_active

    db.commit()
    db.refresh(rule)

    AuditService.log(
        db=db,
        action="ALERT_RULE_UPDATED",
        entity_type="ALERT_RULE",
        entity_id=str(rule.id),
        user=current_user,
        old_value=old_val,
        new_value=payload.model_dump(exclude_unset=True),
        details=f"Alert rule #{rule.id} updated by {current_user.email}",
        ip_address=get_client_ip(request)
    )

    return rule
