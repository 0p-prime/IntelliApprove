"""
Alerts and Escalations Endpoints.
Rule #1: State changes write audit_logs entries.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_user, get_client_ip
from app.models.user import User
from app.models.alert import Alert, EscalationEvent
from app.schemas.all_schemas import AlertOut
from app.services.scheduler_service import check_sla_breaches_and_escalations
from app.services.audit_service import AuditService

router = APIRouter()

@router.get("", response_model=List[AlertOut])
def get_alerts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve alerts applicable for current user and their role."""
    query = db.query(Alert).filter(
        (Alert.recipient_user_id == current_user.id) |
        (Alert.recipient_role == current_user.role) |
        (Alert.recipient_role == None)
    )
    return query.order_by(Alert.created_at.desc()).limit(50).all()

@router.post("/{alert_id}/read")
def mark_alert_read(
    alert_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark an alert as read."""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.is_read = True
    db.commit()
    return {"status": "success", "alert_id": alert_id}

@router.post("/trigger-sla-check")
def trigger_sla_check_manual(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Manually invoke the background SLA breach and escalation evaluator."""
    check_sla_breaches_and_escalations()
    
    AuditService.log(
        db=db,
        action="MANUAL_SLA_CHECK_INVOKED",
        entity_type="system",
        entity_id="sla_worker",
        user=current_user,
        details=f"User {current_user.email} triggered on-demand SLA breach monitor.",
        ip_address=get_client_ip(request)
    )
    return {"status": "success", "message": "SLA and escalation audit executed."}

@router.get("/escalations")
def get_escalation_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve all automated escalation events."""
    events = db.query(EscalationEvent).order_by(EscalationEvent.created_at.desc()).all()
    return [
        {
            "id": e.id,
            "application_id": e.application_id,
            "application_number": e.application.application_number if e.application else f"App #{e.application_id}",
            "institution_name": e.application.institution.name if (e.application and e.application.institution) else "Unknown",
            "from_role": e.from_role,
            "escalated_to_role": e.escalated_to_role,
            "escalation_reason": e.escalation_reason,
            "escalation_level": e.escalation_level,
            "created_at": e.created_at
        }
        for e in events
    ]
