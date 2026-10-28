"""
Workflow Service: Handles application stage transitions and competent authority decisions.
Enforces:
- Rule #1: Universal audit logging on every stage transition.
- Rule #2: System NEVER auto-approves or auto-rejects; final decision reserved for human competent authorities.
- Rule #3: Allowed transitions, roles, and SLA timelines strictly read from database WorkflowRoutes.
"""
import uuid
import hashlib
from typing import Optional, Dict, Any
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.application import Application, ApplicationStageHistory
from app.models.workflow import StageConfig, WorkflowRoute
from app.models.user import User, UserRole
from app.models.alert import Alert
from app.services.audit_service import AuditService

class WorkflowService:
    @staticmethod
    def transition_stage(
        db: Session,
        application_id: int,
        target_stage_id: int,
        user: User,
        action_name: str,
        remarks: Optional[str] = None,
        ip_address: str = "127.0.0.1"
    ) -> Application:
        """
        Transitions application to target stage adhering to DB-configured routes and role checks.
        """
        application = db.query(Application).filter(Application.id == application_id).first()
        if not application:
            raise HTTPException(status_code=404, detail="Application not found")

        current_stage = db.query(StageConfig).filter(StageConfig.id == application.current_stage_id).first()
        target_stage = db.query(StageConfig).filter(StageConfig.id == target_stage_id).first()
        
        if not target_stage or not target_stage.is_active:
            raise HTTPException(status_code=400, detail="Target stage does not exist or is inactive")

        # Find valid route in DB (Rule #3: dynamic configuration)
        route = db.query(WorkflowRoute).filter(
            WorkflowRoute.from_stage_id == application.current_stage_id,
            WorkflowRoute.to_stage_id == target_stage_id,
            WorkflowRoute.is_active == True
        ).first()

        if not route and user.role != UserRole.ADMIN.value:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid stage transition from '{current_stage.name if current_stage else 'Unknown'}' to '{target_stage.name}'. No active route configured."
            )

        # Check role permission
        if route and user.role != route.required_role and user.role != UserRole.ADMIN.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Action '{action_name}' requires role '{route.required_role}'. Your role is '{user.role}'."
            )

        # Old snapshot for audit
        old_stage_name = current_stage.name if current_stage else "None"
        old_status = application.status

        # Update application state
        now = datetime.now(timezone.utc)
        application.current_stage_id = target_stage.id
        application.status = target_stage.stage_key
        application.stage_entered_at = now
        application.sla_deadline = now + timedelta(hours=target_stage.sla_hours)
        application.is_escalated = False
        application.escalation_level = 0
        application.updated_at = now

        # Add stage history record
        history = ApplicationStageHistory(
            application_id=application.id,
            from_stage_id=current_stage.id if current_stage else None,
            to_stage_id=target_stage.id,
            action_taken=action_name,
            transitioned_by_user_id=user.id,
            remarks=remarks,
            created_at=now
        )
        db.add(history)
        db.commit()
        db.refresh(application)

        # Non-negotiable Rule #1: Write audit log
        AuditService.log(
            db=db,
            action="APPLICATION_STAGE_TRANSITION",
            entity_type="application",
            entity_id=str(application.id),
            user=user,
            old_value={"stage": old_stage_name, "status": old_status},
            new_value={"stage": target_stage.name, "status": target_stage.stage_key, "action": action_name},
            details=f"Stage transitioned from '{old_stage_name}' to '{target_stage.name}' by {user.full_name} ({user.role}). Remarks: {remarks or 'None'}",
            ip_address=ip_address
        )

        # Notify responsible role
        alert = Alert(
            application_id=application.id,
            title=f"Application {application.application_number} Moved to {target_stage.name}",
            message=f"Action '{action_name}' performed. Assigned role: {target_stage.assigned_role}. SLA: {target_stage.sla_hours} hours.",
            severity="INFO",
            recipient_role=target_stage.assigned_role
        )
        db.add(alert)
        db.commit()

        return application

    @staticmethod
    def record_authority_decision(
        db: Session,
        application_id: int,
        user: User,
        verdict: str,  # APPROVED, APPROVED_WITH_CONDITIONS, REJECTED
        notes: str,
        human_verified_checklist: Dict[str, bool],
        ip_address: str = "127.0.0.1"
    ) -> Application:
        """
        Enforces Rule #2: Final decision requires Competent Authority human sign-off.
        The system NEVER auto-approves or auto-rejects.
        """
        if user.role not in [UserRole.COMPETENT_AUTHORITY.value, UserRole.ADMIN.value]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Final approval/rejection decisions are strictly reserved for Competent Authority human members."
            )

        valid_verdicts = ["APPROVED", "APPROVED_WITH_CONDITIONS", "REJECTED"]
        if verdict not in valid_verdicts:
            raise HTTPException(status_code=400, detail=f"Invalid verdict. Must be one of: {valid_verdicts}")

        application = db.query(Application).filter(Application.id == application_id).first()
        if not application:
            raise HTTPException(status_code=404, detail="Application not found")

        # Verify all human oversight items were ticked
        if not all(human_verified_checklist.values()):
            raise HTTPException(
                status_code=400,
                detail="All mandatory Human Oversight Checklist items must be explicitly confirmed before issuing a verdict."
            )

        now = datetime.now(timezone.utc)
        old_status = application.status
        old_verdict = application.decision_verdict

        application.decision_verdict = verdict
        application.status = verdict
        application.decision_notes = notes
        application.decision_date = now
        application.decision_by_user_id = user.id
        application.human_oversight_required = False  # Human has fulfilled oversight

        # Generate verifiable EoA number and digital signature hash
        hash_seed = f"{application.application_number}-{verdict}-{user.email}-{now.isoformat()}"
        application.digital_signature_hash = hashlib.sha256(hash_seed.encode("utf-8")).hexdigest()
        
        if verdict in ["APPROVED", "APPROVED_WITH_CONDITIONS"]:
            application.approval_letter_number = f"AICTE/EOA/{application.academic_year}/{application.id:05d}"

        db.commit()
        db.refresh(application)

        # Rule #1: Audit log
        AuditService.log(
            db=db,
            action="COMPETENT_AUTHORITY_DECISION_RECORDED",
            entity_type="application",
            entity_id=str(application.id),
            user=user,
            old_value={"status": old_status, "verdict": old_verdict},
            new_value={
                "status": verdict,
                "verdict": verdict,
                "approval_letter_number": application.approval_letter_number,
                "digital_signature_hash": application.digital_signature_hash
            },
            details=f"Human Competent Authority {user.full_name} issued verdict '{verdict}'. Notes: {notes}",
            ip_address=ip_address
        )

        # Broadcast critical alert to institute & regional office
        Alert(
            application_id=application.id,
            title=f"Final Decision Issued: {verdict}",
            message=f"Application {application.application_number} received final decision '{verdict}' by Competent Authority.",
            severity="CRITICAL" if verdict == "REJECTED" else "INFO",
            recipient_role=UserRole.INSTITUTION.value
        )
        db.commit()

        return application
