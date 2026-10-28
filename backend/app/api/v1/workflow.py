"""
Workflow Execution Endpoints.
Rule #1: State changes write audit_logs entries.
Rule #2: The system NEVER auto-approves or auto-rejects; final decisions reserved for human competent authorities.
Rule #3: Routes loaded from database.
Rule #5: Role-based permissions enforced.
"""
from typing import List, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_user, get_client_ip, require_roles
from app.models.user import User, UserRole
from app.models.application import Application
from app.models.workflow import StageConfig, WorkflowRoute
from app.schemas.all_schemas import (
    ApplicationDetailOut,
    StageTransitionRequest,
    AuthorityDecisionRequest,
    ScrutinySubmitRequest,
    EVCSubmitRequest,
    WorkflowRouteOut
)
from app.services.workflow_service import WorkflowService
from app.services.audit_service import AuditService

router = APIRouter()

@router.get("/allowed-actions/{application_id}", response_model=List[WorkflowRouteOut])
def get_allowed_workflow_actions(
    application_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns the dynamically allowed next transitions based on current stage and user's role.
    Adheres strictly to Rule #3 (configurable database routes).
    """
    import json
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    template = application.workflow_template
    if not template or not template.transitions_json:
        return []

    try:
        transitions = json.loads(template.transitions_json)
    except Exception:
        return []

    current_stage = application.current_stage
    results = []
    STAGE_ROLE_MAP = {
        "SUBMITTED": "REGIONAL_OFFICER",
        "SCRUTINY": "REGIONAL_OFFICER",
        "DEFICIENT": "INSTITUTION",
        "EVC": "EVC_MEMBER",
        "SAC_SHC": "REGIONAL_HEAD",
        "BUREAU_DECISION": "BUREAU_OFFICER",
        "APPROVED": "BUREAU_OFFICER",
        "REJECTED": "BUREAU_OFFICER",
    }

    user_role_str = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)

    for idx, t in enumerate(transitions):
        from_st = t.get("from")
        to_st = t.get("to")
        action = t.get("action", f"Transition to {to_st}")
        if from_st == current_stage:
            req_role = STAGE_ROLE_MAP.get(from_st, "REGIONAL_OFFICER")
            is_human = to_st in ("APPROVED", "REJECTED") or from_st == "BUREAU_DECISION"

            if (
                user_role_str == "ADMIN"
                or user_role_str == req_role
                or (user_role_str == "BUREAU_OFFICER" and req_role in ("BUREAU_OFFICER", "REGIONAL_HEAD"))
                or (user_role_str == "REGIONAL_HEAD" and req_role in ("REGIONAL_HEAD", "REGIONAL_OFFICER"))
            ):
                results.append(
                    WorkflowRouteOut(
                        id=idx + 1,
                        from_stage_id=idx,
                        to_stage_id=idx + 1,
                        action_name=action,
                        required_role=req_role,
                        requires_human_badge=is_human,
                        description=f"Advance from {from_st} to {to_st}",
                        is_active=True
                    )
                )

    return results

@router.post("/transition", response_model=ApplicationDetailOut)
def transition_application_stage(
    req: StageTransitionRequest,
    application_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Transition an application through the workflow route."""
    app_obj = WorkflowService.transition_stage(
        db=db,
        application_id=application_id,
        target_stage_id=req.target_stage_id,
        user=current_user,
        action_name=req.action_name,
        remarks=req.remarks,
        ip_address=get_client_ip(request)
    )
    return app_obj

@router.post("/scrutiny-report/{application_id}", response_model=ApplicationDetailOut)
def submit_scrutiny_report(
    application_id: int,
    req: ScrutinySubmitRequest,
    request: Request,
    current_user: User = Depends(require_roles([UserRole.SCRUTINY_OFFICER.value, UserRole.ADMIN.value])),
    db: Session = Depends(get_db)
):
    """
    Scrutiny Committee submits document evaluation notes and recommendation.
    Enforces Rule #1 (audit) & Rule #2 (Human scrutiny).
    """
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    old_remarks = application.scrutiny_remarks
    application.scrutiny_remarks = req.remarks
    application.updated_at = datetime.now(timezone.utc)
    db.commit()

    # Rule #1: Audit log
    AuditService.log(
        db=db,
        action="SCRUTINY_REPORT_SUBMITTED",
        entity_type="application",
        entity_id=str(application.id),
        user=current_user,
        old_value={"scrutiny_remarks": old_remarks},
        new_value={"scrutiny_remarks": req.remarks, "recommendation": req.recommendation},
        details=f"Scrutiny Officer {current_user.full_name} submitted scrutiny assessment with recommendation: {req.recommendation}.",
        ip_address=get_client_ip(request)
    )

    return application

@router.post("/evc-report/{application_id}", response_model=ApplicationDetailOut)
def submit_evc_inspection_report(
    application_id: int,
    req: EVCSubmitRequest,
    request: Request,
    current_user: User = Depends(require_roles([UserRole.EVC_INSPECTOR.value, UserRole.ADMIN.value])),
    db: Session = Depends(get_db)
):
    """
    Expert Visit Committee (EVC) member submits physical inspection evaluation.
    Enforces Rule #1 (audit) & Rule #2 (Human physical inspection).
    """
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    now = datetime.now(timezone.utc)
    application.evc_inspection_date = now
    application.evc_recommendation = req.recommendation
    application.evc_remarks = f"Notes: {req.inspection_notes} | Infra: {'Pass' if req.infra_verified else 'Deficient'} | Faculty: {'Pass' if req.faculty_verified else 'Deficient'} | Labs: {'Functional' if req.labs_functional else 'Incomplete'}"
    application.updated_at = now
    db.commit()

    # Rule #1: Audit log
    AuditService.log(
        db=db,
        action="EVC_INSPECTION_REPORT_SUBMITTED",
        entity_type="application",
        entity_id=str(application.id),
        user=current_user,
        new_value={
            "recommendation": req.recommendation,
            "infra_verified": req.infra_verified,
            "faculty_verified": req.faculty_verified,
            "labs_functional": req.labs_functional
        },
        details=f"EVC Member {current_user.full_name} submitted physical inspection report: {req.recommendation}.",
        ip_address=get_client_ip(request)
    )

    return application

@router.post("/authority-decision/{application_id}", response_model=ApplicationDetailOut)
def record_competent_authority_decision(
    application_id: int,
    req: AuthorityDecisionRequest,
    request: Request,
    current_user: User = Depends(require_roles([UserRole.COMPETENT_AUTHORITY.value, UserRole.ADMIN.value])),
    db: Session = Depends(get_db)
):
    """
    Non-Negotiable Rule #2: Final decisions are strictly reserved for human competent authorities.
    The system NEVER auto-approves or auto-rejects.
    Requires explicit checklist confirmation.
    """
    app_obj = WorkflowService.record_authority_decision(
        db=db,
        application_id=application_id,
        user=current_user,
        verdict=req.verdict,
        notes=req.notes,
        human_verified_checklist=req.checklist_acknowledgement,
        ip_address=get_client_ip(request)
    )
    return app_obj
