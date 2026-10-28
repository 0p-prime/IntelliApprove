"""
Background Scheduler Service using APScheduler.
Monitors SLA deadlines, triggers configured reminder offsets,
and executes escalation ladders stored in the database.
Enforces Rule #1: Every escalation and state change writes an audit_logs entry.
"""
from datetime import datetime, timezone
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.application import Application
from app.models.workflow import EscalationLadder, StageConfig
from app.models.undertaking import Undertaking
from app.models.alert import Alert, EscalationEvent
from app.services.audit_service import AuditService

scheduler = BackgroundScheduler()

def check_sla_breaches_and_escalations():
    """
    Evaluates all active applications against stage SLAs and escalation ladder configurations.
    """
    db: Session = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        
        # 1. Check SLA breaches on pending applications
        active_apps = db.query(Application).filter(
            Application.sla_deadline.isnot(None),
            Application.status.notin_(["APPROVED", "APPROVED_WITH_CONDITIONS", "REJECTED", "DRAFT"])
        ).all()

        for app in active_apps:
            if not app.sla_deadline:
                continue

            # Compare UTC datetimes safely
            deadline = app.sla_deadline
            if deadline.tzinfo is None:
                deadline = deadline.replace(tzinfo=timezone.utc)

            # Check if breached and not yet escalated
            if now > deadline and not app.is_escalated:
                ladder = db.query(EscalationLadder).filter(
                    EscalationLadder.stage_id == app.current_stage_id,
                    EscalationLadder.is_active == True
                ).first()

                stage = db.query(StageConfig).filter(StageConfig.id == app.current_stage_id).first()
                stage_name = stage.name if stage else "Current Stage"
                from_role = stage.assigned_role if stage else "OFFICER"
                escalate_to = ladder.escalate_to_role if ladder else "REGIONAL_OFFICER"

                app.is_escalated = True
                app.escalation_level = (app.escalation_level or 0) + 1
                
                # Record escalation event
                event = EscalationEvent(
                    application_id=app.id,
                    stage_id=app.current_stage_id,
                    from_role=from_role,
                    escalated_to_role=escalate_to,
                    escalation_reason=f"SLA breached at {stage_name}. SLA deadline was {deadline.strftime('%Y-%m-%d %H:%M UTC')}.",
                    escalation_level=app.escalation_level
                )
                db.add(event)

                # Dispatch high-priority alert
                alert = Alert(
                    application_id=app.id,
                    title=f"URGENT ESCALATION: SLA Breached for {app.application_number}",
                    message=f"Application {app.application_number} at stage '{stage_name}' has exceeded its SLA window. Escalated from {from_role} to {escalate_to}.",
                    severity="ESCALATION",
                    recipient_role=escalate_to
                )
                db.add(alert)
                db.commit()

                # Non-negotiable Rule #1: Audit log
                AuditService.log(
                    db=db,
                    action="AUTOMATED_ESCALATION_TRIGGERED",
                    entity_type="escalation",
                    entity_id=str(app.id),
                    user=None,
                    system_actor_name="APScheduler_SLA_Monitor",
                    old_value={"is_escalated": False, "escalation_level": 0},
                    new_value={"is_escalated": True, "escalation_level": app.escalation_level, "escalated_to": escalate_to},
                    details=f"Automated SLA breach escalation triggered for application {app.application_number} in stage {stage_name}."
                )

        # 2. Check Overdue Undertakings
        pending_undertakings = db.query(Undertaking).filter(
            Undertaking.status == "PENDING"
        ).all()

        for u in pending_undertakings:
            due = u.due_date
            if due.tzinfo is None:
                due = due.replace(tzinfo=timezone.utc)
            
            if now > due:
                old_status = u.status
                u.status = "BREACHED"
                db.commit()

                # Create Alert
                Alert(
                    application_id=u.application_id,
                    title=f"Undertaking Breached: {u.title}",
                    message=f"Compliance undertaking '{u.title}' passed deadline without fulfillment evidence. Marked as BREACHED.",
                    severity="CRITICAL",
                    recipient_role="REGIONAL_OFFICER"
                )
                db.commit()

                # Non-negotiable Rule #1: Audit log
                AuditService.log(
                    db=db,
                    action="UNDERTAKING_STATUS_CHANGED",
                    entity_type="undertaking",
                    entity_id=str(u.id),
                    user=None,
                    system_actor_name="APScheduler_Undertaking_Monitor",
                    old_value={"status": old_status},
                    new_value={"status": "BREACHED"},
                    details=f"Compliance undertaking #{u.id} '{u.title}' automatically marked BREACHED due to missed deadline {due.strftime('%Y-%m-%d')}."
                )

    except Exception as e:
        db.rollback()
        print(f"[Scheduler Error] SLA check failed: {e}")
    finally:
        db.close()

def start_scheduler():
    """Start background scheduler if not already running."""
    if not scheduler.running:
        scheduler.add_job(
            check_sla_breaches_and_escalations,
            'interval',
            seconds=30,
            id='sla_breach_monitor',
            replace_existing=True
        )
        scheduler.start()
        print("[Scheduler] APScheduler started for SLA and Escalation monitoring.")

def shutdown_scheduler():
    """Stop background scheduler."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        print("[Scheduler] APScheduler stopped.")
