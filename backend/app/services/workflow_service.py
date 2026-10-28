"""
Workflow Service: Approval Workflow Engine for IntelliApprove (Section A).
Enforces:
- Rule #1: Universal audit logging on every stage transition and return.
- Rule #2: System NEVER auto-approves or auto-rejects; final decisions strictly reserved for human competent authorities.
- Rule #3: Allowed transitions, route definitions, and stages loaded from workflow_templates JSON.
- Rule #4: Revert to previous stage or institution with mandatory reason on deficiency/clarification.
- Rule #5: Role-based permissions enforced on every stage completion.
"""
import json
import uuid
import hashlib
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.entities import (
    Application,
    WorkflowTemplate,
    StageHistory,
    EVCSchedule,
    Institution,
    User,
    UserRole,
    AuditLog,
    Notification
)
from app.models.workflow import StageConfig, WorkflowRoute
from app.services.audit_service import AuditService

# Canonical stage permission mapping
STAGE_PERMISSIONS = {
    "SUBMITTED": ["INSTITUTION", "REGIONAL_OFFICER", "SCRUTINY_OFFICER", "ADMIN"],
    "SCRUTINY": ["REGIONAL_OFFICER", "SCRUTINY_OFFICER", "ADMIN"],
    "EVC": ["EVC_MEMBER", "EVC_INSPECTOR", "ADMIN"],
    "SAC_SHC": ["REGIONAL_HEAD", "ADMIN"],
    "BUREAU_DECISION": ["BUREAU_OFFICER", "COMPETENT_AUTHORITY", "ADMIN"],
}


class WorkflowService:
    @staticmethod
    def get_template_stages(template: WorkflowTemplate) -> List[str]:
        """Parses and returns stages from workflow template JSON."""
        try:
            return json.loads(template.stages_json)
        except Exception:
            return ["SUBMITTED", "SCRUTINY", "BUREAU_DECISION", "APPROVED", "REJECTED"]

    @staticmethod
    def get_template_transitions(template: WorkflowTemplate) -> List[Dict[str, Any]]:
        """Parses and returns allowed transitions from workflow template JSON."""
        try:
            return json.loads(template.transitions_json)
        except Exception:
            return []

    @staticmethod
    def create_application(
        db: Session,
        institution_id: int,
        application_type: str = "Extension of Approval (EoA)",
        template_id: Optional[int] = None,
        user: Optional[User] = None,
        ip_address: str = "127.0.0.1"
    ) -> Application:
        """
        Creates an application, assigns the prescribed route template based on institution profile / type,
        and sets initial stage to SUBMITTED with initial stage_history and audit trail.
        """
        institution = db.query(Institution).filter(Institution.id == institution_id).first()
        if not institution:
            raise HTTPException(status_code=404, detail="Institution not found")

        # Assign template
        if template_id:
            template = db.query(WorkflowTemplate).filter(WorkflowTemplate.id == template_id).first()
            if not template:
                raise HTTPException(status_code=404, detail=f"Workflow template #{template_id} not found")
        else:
            # Automatic template selection
            if institution.is_new:
                template = db.query(WorkflowTemplate).filter(WorkflowTemplate.name == "Scrutiny + EVC").first()
            else:
                template = db.query(WorkflowTemplate).filter(WorkflowTemplate.name == "Only Scrutiny").first()
            
            if not template:
                template = db.query(WorkflowTemplate).first()

        stages = json.loads(template.stages_json) if template else ["SUBMITTED"]
        initial_stage = stages[0] if stages else "SUBMITTED"

        # Unique reference number
        count = db.query(Application).count() + 1
        ref_no = f"AICTE/2026-27/{uuid.uuid4().hex[:6].upper()}-{count:04d}"

        now = datetime.now(timezone.utc)
        due_date = now + timedelta(days=21)

        app_obj = Application(
            ref_no=ref_no,
            institution_id=institution.id,
            application_type=application_type,
            workflow_template_id=template.id,
            current_stage=initial_stage,
            status="SUBMITTED",
            region_id=institution.region_id,
            submitted_at=now,
            stage_entered_at=now,
            due_date=due_date,
            risk_score=0.2 if institution.is_new else 0.05
        )
        db.add(app_obj)
        db.flush()

        # Initial stage history
        hist = StageHistory(
            application_id=app_obj.id,
            stage=initial_stage,
            entered_at=now,
            officer_id=user.id if user else None,
            action="APPLICATION_SUBMITTED",
            remarks=f"Application submitted under workflow route: {template.name}."
        )
        db.add(hist)

        # Non-negotiable Rule #1: Audit log
        AuditService.log(
            db=db,
            action="APPLICATION_CREATED",
            entity_type="application",
            entity_id=str(app_obj.id),
            user=user,
            new_value={
                "ref_no": ref_no,
                "template": template.name,
                "stage": initial_stage,
                "status": "SUBMITTED"
            },
            details=f"Application {ref_no} created under route '{template.name}' for {institution.name}.",
            ip_address=ip_address
        )

        db.commit()
        db.refresh(app_obj)
        return app_obj

    @staticmethod
    def complete_stage(
        db: Session,
        application_id: int,
        officer: User,
        remarks: Optional[str] = None,
        verdict: Optional[str] = None,
        checklist_acknowledgement: Optional[Dict[str, bool]] = None,
        ip_address: str = "127.0.0.1"
    ) -> Application:
        """
        Validates officer authority, marks stage complete, and AUTOMATICALLY moves application
        to the next stage in its template.
        - If next stage is EVC: places application in the EVC queue.
        - If stage is BUREAU_DECISION: requires human authorized verdict (APPROVED/REJECTED).
        """
        application = db.query(Application).filter(Application.id == application_id).first()
        if not application:
            raise HTTPException(status_code=404, detail="Application not found")

        # Check if already terminal
        if application.current_stage in ["APPROVED", "REJECTED"]:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot complete stage. Application has already reached terminal state '{application.current_stage}'."
            )

        # Validate officer role authority for current stage
        allowed_roles = STAGE_PERMISSIONS.get(application.current_stage, ["ADMIN"])
        if officer.role not in allowed_roles and officer.role != UserRole.ADMIN.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Stage '{application.current_stage}' requires authorized role: {allowed_roles}. Your role is '{officer.role}'."
            )

        template = application.workflow_template
        if not template:
            raise HTTPException(status_code=500, detail="Application workflow template not configured")

        stages: List[str] = json.loads(template.stages_json)
        workflow_stages = [s for s in stages if s not in ["APPROVED", "REJECTED"]]

        now = datetime.now(timezone.utc)
        old_stage = application.current_stage
        old_status = application.status

        # Case 1: Final Human Decision Gate (BUREAU_DECISION)
        if application.current_stage == "BUREAU_DECISION":
            if not verdict or verdict.upper() not in ["APPROVED", "APPROVED_WITH_CONDITIONS", "REJECTED"]:
                raise HTTPException(
                    status_code=400,
                    detail="Final human decision verdict ('APPROVED' or 'REJECTED') is mandatory for Bureau Decision stage."
                )

            clean_verdict = "APPROVED" if verdict.upper() in ["APPROVED", "APPROVED_WITH_CONDITIONS"] else "REJECTED"

            application.current_stage = clean_verdict
            application.status = clean_verdict
            application.stage_entered_at = now
            application.decision_verdict = clean_verdict
            application.decision_notes = remarks or "Human decision recorded."
            application.decision_date = now
            application.decision_by_user_id = officer.id
            application.human_oversight_required = False

            # Digital signature hash
            hash_seed = f"{application.ref_no}-{clean_verdict}-{officer.email}-{now.isoformat()}"
            application.digital_signature_hash = hashlib.sha256(hash_seed.encode("utf-8")).hexdigest()

            if clean_verdict == "APPROVED":
                application.approval_letter_number = f"AICTE/EOA/2026-27/{application.id:05d}"

            # Complete open stage history
            open_hist = db.query(StageHistory).filter(
                StageHistory.application_id == application.id,
                StageHistory.completed_at == None
            ).order_by(StageHistory.id.desc()).first()
            if open_hist:
                open_hist.completed_at = now
                open_hist.action = f"Decision Issued: {clean_verdict}"
                if remarks:
                    open_hist.remarks = remarks

            # Terminal stage history record
            db.add(StageHistory(
                application_id=application.id,
                stage=clean_verdict,
                entered_at=now,
                completed_at=now,
                officer_id=officer.id,
                action=f"Final Verdict: {clean_verdict}",
                remarks=remarks or f"Decision issued by {officer.name} ({officer.role})."
            ))

            AuditService.log(
                db=db,
                action="FINAL_DECISION_RECORDED",
                entity_type="application",
                entity_id=str(application.id),
                user=officer,
                old_value={"stage": old_stage, "status": old_status},
                new_value={
                    "stage": clean_verdict,
                    "status": clean_verdict,
                    "approval_letter_number": getattr(application, "approval_letter_number", None),
                    "digital_signature_hash": application.digital_signature_hash
                },
                details=f"Human Competent Authority {officer.name} issued final verdict '{clean_verdict}'. Remarks: {remarks or 'None'}",
                ip_address=ip_address
            )

            db.commit()
            db.refresh(application)
            return application

        # Case 2: Intermediate stage -> automatically advance to next stage
        if application.current_stage not in workflow_stages:
            raise HTTPException(
                status_code=400,
                detail=f"Current stage '{application.current_stage}' not in template sequence {workflow_stages}."
            )

        curr_idx = workflow_stages.index(application.current_stage)
        if curr_idx + 1 >= len(workflow_stages):
            raise HTTPException(
                status_code=400,
                detail=f"No subsequent stage defined in template after '{application.current_stage}'."
            )

        next_stage = workflow_stages[curr_idx + 1]
        application.current_stage = next_stage
        application.stage_entered_at = now
        application.due_date = now + timedelta(days=7)

        # Status mapping & automated queueing
        if next_stage == "EVC":
            application.status = "UNDER_EVC"
            # Queue in EVC schedules if not already queued or scheduled
            existing_evc = db.query(EVCSchedule).filter(EVCSchedule.application_id == application.id).first()
            if not existing_evc:
                is_new = application.institution.is_new if application.institution else False
                # Shorter due window for new institutions (10 days vs 21 days for existing)
                due_days = 10 if is_new else 21
                evc_schedule = EVCSchedule(
                    application_id=application.id,
                    scheduled_date=now + timedelta(days=max(1, due_days - 3)),
                    due_date=now + timedelta(days=due_days),
                    status="QUEUED",
                    committee_ids="[]",
                    is_new_institution=is_new
                )
                db.add(evc_schedule)
        elif next_stage == "SCRUTINY":
            application.status = "UNDER_SCRUTINY"
        elif next_stage == "SAC_SHC":
            application.status = "UNDER_SAC_SHC"
        elif next_stage == "BUREAU_DECISION":
            application.status = "PENDING_DECISION"
        else:
            application.status = f"UNDER_{next_stage}"

        # Close out current open stage history entry
        open_hist = db.query(StageHistory).filter(
            StageHistory.application_id == application.id,
            StageHistory.completed_at == None
        ).order_by(StageHistory.id.desc()).first()
        if open_hist:
            open_hist.completed_at = now
            open_hist.action = f"Completed {old_stage}"
            if remarks:
                open_hist.remarks = remarks

        # Open new stage history entry
        db.add(StageHistory(
            application_id=application.id,
            stage=next_stage,
            entered_at=now,
            officer_id=officer.id,
            action=f"Advanced to {next_stage}",
            remarks=remarks or f"Stage completed by {officer.name}."
        ))

        # Non-negotiable Rule #1: Audit log
        AuditService.log(
            db=db,
            action="STAGE_COMPLETED",
            entity_type="application",
            entity_id=str(application.id),
            user=officer,
            old_value={"stage": old_stage, "status": old_status},
            new_value={"stage": next_stage, "status": application.status},
            details=f"Stage '{old_stage}' completed by {officer.name} ({officer.role}). Application automatically moved to '{next_stage}'.",
            ip_address=ip_address
        )

        db.commit()
        db.refresh(application)
        return application

    @staticmethod
    def return_application(
        db: Session,
        application_id: int,
        officer: User,
        reason: str,
        target_stage: Optional[str] = None,
        ip_address: str = "127.0.0.1"
    ) -> Application:
        """
        Mandatory-reason revert (for deficiency / clarification / verification) back to a
        previous stage or to the institution, setting status to 'RETURNED'.
        """
        if not reason or not reason.strip():
            raise HTTPException(
                status_code=400,
                detail="A mandatory reason must be provided when returning an application for deficiency or verification."
            )

        application = db.query(Application).filter(Application.id == application_id).first()
        if not application:
            raise HTTPException(status_code=404, detail="Application not found")

        if application.current_stage in ["APPROVED", "REJECTED"]:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot return an application that has already reached final decision '{application.current_stage}'."
            )

        if officer.role == UserRole.INSTITUTION.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Institution users cannot return applications."
            )

        template = application.workflow_template
        stages: List[str] = json.loads(template.stages_json) if template else ["SUBMITTED"]
        workflow_stages = [s for s in stages if s not in ["APPROVED", "REJECTED"]]

        curr_idx = workflow_stages.index(application.current_stage) if application.current_stage in workflow_stages else 999

        if target_stage:
            target_stage = target_stage.strip().upper()
            if target_stage not in workflow_stages:
                raise HTTPException(
                    status_code=400,
                    detail=f"Target stage '{target_stage}' is not a valid stage in route {workflow_stages}."
                )
            target_idx = workflow_stages.index(target_stage)
            if target_idx >= curr_idx:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot return application forward or to the same stage. Target stage must precede '{application.current_stage}'."
                )
        else:
            # Revert to immediate preceding stage or SUBMITTED
            if curr_idx > 0:
                target_stage = workflow_stages[curr_idx - 1]
            else:
                target_stage = "SUBMITTED"

        now = datetime.now(timezone.utc)
        old_stage = application.current_stage
        old_status = application.status

        application.current_stage = target_stage
        application.status = "RETURNED"
        application.stage_entered_at = now

        # Close out current stage history
        open_hist = db.query(StageHistory).filter(
            StageHistory.application_id == application.id,
            StageHistory.completed_at == None
        ).order_by(StageHistory.id.desc()).first()
        if open_hist:
            open_hist.completed_at = now
            open_hist.action = f"Returned to {target_stage}"
            open_hist.remarks = reason

        # Open reverted stage history entry
        db.add(StageHistory(
            application_id=application.id,
            stage=target_stage,
            entered_at=now,
            officer_id=officer.id,
            action="RETURNED",
            remarks=f"Reverted to {target_stage}. Reason: {reason}"
        ))

        # Non-negotiable Rule #1: Audit log
        AuditService.log(
            db=db,
            action="APPLICATION_RETURNED",
            entity_type="application",
            entity_id=str(application.id),
            user=officer,
            old_value={"stage": old_stage, "status": old_status},
            new_value={"stage": target_stage, "status": "RETURNED", "reason": reason},
            details=f"Application {application.ref_no} returned to stage '{target_stage}' by {officer.name} ({officer.role}). Reason: {reason}",
            ip_address=ip_address
        )

        db.commit()
        db.refresh(application)
        return application

    @staticmethod
    def generate_case_summary(db: Session, application_id: int) -> Dict[str, Any]:
        """
        Auto-generates template-based 'Electronic Case Summary' marked 'Draft for official review'.
        Synthesizes institution details, route, stage progression timeline, committee observations,
        and pending compliance items.
        """
        application = db.query(Application).filter(Application.id == application_id).first()
        if not application:
            raise HTTPException(status_code=404, detail="Application not found")

        institution = application.institution
        template = application.workflow_template
        now = datetime.now(timezone.utc)

        # Timeline entries
        timeline_entries = []
        observations = []
        for h in sorted(application.stage_history, key=lambda x: x.entered_at or datetime.min):
            officer_str = f"{h.officer.name} ({h.officer.role})" if h.officer else "System / Nodal Desk"
            timeline_entries.append({
                "stage": h.stage,
                "entered_at": h.entered_at.isoformat() if h.entered_at else None,
                "completed_at": h.completed_at.isoformat() if h.completed_at else None,
                "action": h.action,
                "remarks": h.remarks,
                "officer": officer_str
            })
            if h.remarks and h.action in ["RETURNED", "SCRUTINY_EVALUATION", "EVC_FINDINGS"]:
                observations.append({
                    "stage": h.stage,
                    "action": h.action,
                    "officer": officer_str,
                    "notes": h.remarks
                })

        # Pending items
        pending_undertakings = [u for u in application.undertakings if u.status != "VERIFIED"]
        pending_docs = [d for d in institution.documents if d.verification_status != "VERIFIED"] if institution else []

        route_stages = json.loads(template.stages_json) if template else []

        # Formatted Markdown report
        markdown_text = f"""# ALL INDIA COUNCIL FOR TECHNICAL EDUCATION
## ELECTRONIC CASE SUMMARY (ECS)
**Document Classification:** Draft for official review
**Reference Number:** `{application.ref_no}`
**Generated On:** {now.strftime('%d-%b-%Y %H:%M:%S UTC')}

---

### 1. Institution Particulars
- **Institution Name:** {institution.name if institution else 'N/A'}
- **Permanent AICTE ID:** {institution.aicte_id if institution else 'N/A'}
- **Stream / Category:** {institution.type if institution else 'N/A'}
- **Jurisdiction:** {institution.state if institution else 'N/A'} ({institution.region.name if institution and institution.region else 'National'} Region)
- **Institution Status:** {"Newly Established Campus" if institution and institution.is_new else "Existing Operating Institution"}
- **Nodal Head Email:** {institution.contact_email if institution else 'N/A'}

---

### 2. Application & Approval Route
- **Application Type:** {application.application_type}
- **Prescribed Approval Route:** {template.name if template else 'Standard AICTE Route'}
- **Workflow Sequence:** {' → '.join(route_stages)}
- **Current Stage:** **{application.current_stage}**
- **Governance Status:** **{application.status}**
- **Risk Score:** {application.risk_score:.2f} ({'Low Risk' if application.risk_score < 0.3 else 'Elevated Vigilance Required'})

---

### 3. Stage Progression Timeline
| Stage | Action Taken | Date Recorded | Handled By | Remarks |
| :--- | :--- | :--- | :--- | :--- |
"""
        for t in timeline_entries:
            dt_str = t["entered_at"][:16].replace("T", " ") if t["entered_at"] else "—"
            rem = (t["remarks"] or "—").replace("|", "/")
            markdown_text += f"| **{t['stage']}** | {t['action']} | {dt_str} | {t['officer']} | {rem} |\n"

        markdown_text += f"""
---

### 4. Observations & Committee Findings
"""
        if observations:
            for obs in observations:
                markdown_text += f"- **[{obs['stage']}] {obs['action']}** ({obs['officer']}): {obs['notes']}\n"
        else:
            markdown_text += "- *No negative observations or deficiency notices recorded to date.*\n"

        markdown_text += f"""
---

### 5. Compliance & Statutory Undertakings
- **Total Undertakings:** {len(application.undertakings)}
- **Pending / Unverified Undertakings:** {len(pending_undertakings)}
- **Total Institutional Documents:** {len(institution.documents) if institution else 0}
- **Pending Document Verifications:** {len(pending_docs)}

---

### 6. Official Human Gate Clearance
> [!NOTE]
> **Strict Rule #2 Mandate:** Automated systems NEVER approve or reject applications.
> Current Decision State: **{application.status}**
> Human Oversight Clearance: **{'PENDING OFFICIAL REVIEW' if application.status not in ['APPROVED', 'REJECTED'] else 'RECORDED'}**
"""

        return {
            "application_id": application.id,
            "ref_no": application.ref_no,
            "watermark": "Draft for official review",
            "generated_at": now,
            "institution": {
                "id": institution.id if institution else None,
                "name": institution.name if institution else None,
                "aicte_id": institution.aicte_id if institution else None,
                "type": institution.type if institution else None,
                "state": institution.state if institution else None,
                "region": institution.region.name if institution and institution.region else None,
                "contact_email": institution.contact_email if institution else None,
                "is_new": institution.is_new if institution else False
            },
            "workflow_route": {
                "template_id": template.id if template else None,
                "template_name": template.name if template else None,
                "stages": route_stages,
                "current_stage": application.current_stage,
                "status": application.status
            },
            "stage_timeline": timeline_entries,
            "observations": observations,
            "pending_items": {
                "undertakings_total": len(application.undertakings),
                "undertakings_pending": len(pending_undertakings),
                "documents_total": len(institution.documents) if institution else 0,
                "documents_pending": len(pending_docs)
            },
            "risk_assessment": {
                "risk_score": application.risk_score,
                "due_date": application.due_date.isoformat() if application.due_date else None,
                "is_escalated": application.is_escalated
            },
            "markdown_summary": markdown_text
        }

    @staticmethod
    def get_application_timeline(db: Session, application_id: int) -> Dict[str, Any]:
        """Returns the route stages, current stage, and progression history for an application."""
        application = db.query(Application).filter(Application.id == application_id).first()
        if not application:
            raise HTTPException(status_code=404, detail="Application not found")

        template = application.workflow_template
        stages = json.loads(template.stages_json) if template else []

        history_list = []
        for h in sorted(application.stage_history, key=lambda x: x.entered_at or datetime.min):
            history_list.append({
                "id": h.id,
                "stage": h.stage,
                "action": h.action,
                "remarks": h.remarks,
                "entered_at": h.entered_at.isoformat() if h.entered_at else None,
                "completed_at": h.completed_at.isoformat() if h.completed_at else None,
                "officer_id": h.officer_id,
                "officer_name": h.officer.name if h.officer else "Nodal Officer / System",
                "officer_role": h.officer.role if h.officer else "N/A"
            })

        return {
            "application_id": application.id,
            "ref_no": application.ref_no,
            "template_name": template.name if template else "Standard Route",
            "stages": stages,
            "current_stage": application.current_stage,
            "status": application.status,
            "history": history_list
        }

    # Backward compatibility for existing tests
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
        return WorkflowService.complete_stage(
            db=db,
            application_id=application_id,
            officer=user,
            remarks=remarks,
            ip_address=ip_address
        )

    @staticmethod
    def record_authority_decision(
        db: Session,
        application_id: int,
        user: User,
        verdict: str,
        notes: str,
        human_verified_checklist: Dict[str, bool],
        ip_address: str = "127.0.0.1"
    ) -> Application:
        if user.role not in [UserRole.BUREAU_OFFICER.value, "COMPETENT_AUTHORITY", UserRole.ADMIN.value]:
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
        old_stage = application.current_stage

        application.decision_verdict = verdict
        application.status = verdict
        application.current_stage = verdict
        application.decision_notes = notes
        application.decision_date = now
        application.decision_by_user_id = user.id
        application.human_oversight_required = False

        hash_seed = f"{application.ref_no}-{verdict}-{user.email}-{now.isoformat()}"
        application.digital_signature_hash = hashlib.sha256(hash_seed.encode("utf-8")).hexdigest()
        
        if verdict in ["APPROVED", "APPROVED_WITH_CONDITIONS"]:
            application.approval_letter_number = f"AICTE/EOA/2026-27/{application.id:05d}"

        # Close open stage history
        open_hist = db.query(StageHistory).filter(
            StageHistory.application_id == application.id,
            StageHistory.completed_at == None
        ).order_by(StageHistory.id.desc()).first()
        if open_hist:
            open_hist.completed_at = now
            open_hist.action = f"Decision Issued: {verdict}"
            open_hist.remarks = notes

        db.add(StageHistory(
            application_id=application.id,
            stage=verdict,
            entered_at=now,
            completed_at=now,
            officer_id=user.id,
            action=f"Final Verdict: {verdict}",
            remarks=notes or f"Decision issued by {user.name}."
        ))

        AuditService.log(
            db=db,
            action="COMPETENT_AUTHORITY_DECISION_RECORDED",
            entity_type="application",
            entity_id=str(application.id),
            user=user,
            old_value={"status": old_status, "stage": old_stage},
            new_value={
                "status": verdict,
                "stage": verdict,
                "approval_letter_number": getattr(application, "approval_letter_number", None),
                "digital_signature_hash": application.digital_signature_hash
            },
            details=f"Human Competent Authority {user.name} issued verdict '{verdict}'. Notes: {notes}",
            ip_address=ip_address
        )
        db.commit()
        db.refresh(application)
        return application
