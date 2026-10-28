"""
Application Management Endpoints.
Rule #1: State changes write audit_logs entries.
Rule #2: Human oversight required flag.
Rule #5: Role-based permissions enforced.
"""
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_user, get_client_ip, require_roles
from app.models.user import User, UserRole
from app.models.application import Application, AcademicProgram, ApplicationStageHistory
from app.models.institution import Institution
from app.models.workflow import StageConfig
from app.schemas.all_schemas import ApplicationOut, ApplicationDetailOut, ApplicationCreate
from app.services.audit_service import AuditService

router = APIRouter()

@router.get("", response_model=List[ApplicationOut])
def list_applications(
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = None,
    escalated_only: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List applications with role-based scoping and multi-attribute filters."""
    query = db.query(Application)

    # Scoping: Institutions only see their own applications
    if current_user.role == UserRole.INSTITUTION.value:
        if current_user.institution_id:
            query = query.filter(Application.institution_id == current_user.institution_id)
        else:
            return []

    if status_filter:
        query = query.filter(Application.status == status_filter)

    if escalated_only:
        query = query.filter(Application.is_escalated == True)

    if search:
        query = query.join(Institution).filter(
            (Application.application_number.ilike(f"%{search}%")) |
            (Institution.name.ilike(f"%{search}%")) |
            (Institution.aicte_id.ilike(f"%{search}%"))
        )

    return query.order_by(Application.created_at.desc()).all()

@router.post("", response_model=ApplicationDetailOut)
def create_application(
    app_in: ApplicationCreate,
    request: Request,
    current_user: User = Depends(require_roles([UserRole.INSTITUTION.value, UserRole.ADMIN.value])),
    db: Session = Depends(get_db)
):
    """Create a new application draft for an institution."""
    inst_id = app_in.institution_id
    if current_user.role == UserRole.INSTITUTION.value and current_user.institution_id:
        inst_id = current_user.institution_id

    institution = db.query(Institution).filter(Institution.id == inst_id).first()
    if not institution:
        raise HTTPException(status_code=404, detail="Institution not found")

    # Find initial draft stage
    draft_stage = db.query(StageConfig).filter(StageConfig.stage_key == "DRAFT").first()
    if not draft_stage:
        draft_stage = db.query(StageConfig).order_sequence == 1

    app_count = db.query(Application).count() + 101
    app_num = f"AICTE-2026-{institution.aicte_id.replace('-', '')[-4:]}-{app_count}"

    new_app = Application(
        application_number=app_num,
        institution_id=institution.id,
        academic_year=app_in.academic_year,
        application_type=app_in.application_type,
        current_stage_id=draft_stage.id if draft_stage else 1,
        status="DRAFT",
        human_oversight_required=True
    )
    db.add(new_app)
    db.flush()

    # Add academic programs
    for prog in app_in.programs:
        p_obj = AcademicProgram(
            application_id=new_app.id,
            program_name=prog.program_name,
            level=prog.level,
            approved_intake_prev_year=prog.approved_intake_prev_year,
            requested_intake=prog.requested_intake,
            faculty_count=prog.faculty_count,
            total_enrolled=prog.total_enrolled,
            cadre_ratio=prog.cadre_ratio
        )
        db.add(p_obj)

    db.commit()
    db.refresh(new_app)

    # Non-negotiable Rule #1: Audit log
    AuditService.log(
        db=db,
        action="APPLICATION_CREATED",
        entity_type="application",
        entity_id=str(new_app.id),
        user=current_user,
        new_value={"application_number": app_num, "status": "DRAFT", "type": app_in.application_type},
        details=f"New application draft created for {institution.name} ({institution.aicte_id}).",
        ip_address=get_client_ip(request)
    )

    return new_app

@router.get("/{application_id}", response_model=ApplicationDetailOut)
def get_application(
    application_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve full application detail with all related relations."""
    app_obj = db.query(Application).filter(Application.id == application_id).first()
    if not app_obj:
        raise HTTPException(status_code=404, detail="Application not found")

    if current_user.role == UserRole.INSTITUTION.value and current_user.institution_id != app_obj.institution_id:
        raise HTTPException(status_code=403, detail="Unauthorized access to this application")

    return app_obj

@router.post("/{application_id}/submit", response_model=ApplicationDetailOut)
def submit_application(
    application_id: int,
    request: Request,
    current_user: User = Depends(require_roles([UserRole.INSTITUTION.value, UserRole.ADMIN.value])),
    db: Session = Depends(get_db)
):
    """Submits application from DRAFT into the official AICTE Scrutiny queue."""
    app_obj = db.query(Application).filter(Application.id == application_id).first()
    if not app_obj:
        raise HTTPException(status_code=404, detail="Application not found")

    if app_obj.status != "DRAFT":
        raise HTTPException(status_code=400, detail="Only DRAFT applications can be submitted")

    scrutiny_stage = db.query(StageConfig).filter(StageConfig.stage_key == "SCRUTINY").first()
    if not scrutiny_stage:
        raise HTTPException(status_code=500, detail="Scrutiny stage configuration not found in DB")

    now = datetime.now(timezone.utc)
    app_obj.current_stage_id = scrutiny_stage.id
    app_obj.status = "UNDER_SCRUTINY"
    app_obj.submission_date = now
    app_obj.stage_entered_at = now
    app_obj.sla_deadline = now + timedelta(hours=scrutiny_stage.sla_hours)
    app_obj.human_oversight_required = True  # Strict Rule #2

    # Add stage history
    history = ApplicationStageHistory(
        application_id=app_obj.id,
        from_stage_id=1,
        to_stage_id=scrutiny_stage.id,
        action_taken="Submit Application for Scrutiny",
        transitioned_by_user_id=current_user.id,
        remarks="Application submitted by institute authority with mandatory undertakings.",
        created_at=now
    )
    db.add(history)
    db.commit()
    db.refresh(app_obj)

    # Non-negotiable Rule #1: Audit log
    AuditService.log(
        db=db,
        action="APPLICATION_SUBMITTED",
        entity_type="application",
        entity_id=str(app_obj.id),
        user=current_user,
        old_value={"status": "DRAFT"},
        new_value={"status": "UNDER_SCRUTINY", "stage": scrutiny_stage.name, "sla_hours": scrutiny_stage.sla_hours},
        details=f"Application {app_obj.application_number} formally submitted to AICTE Scrutiny.",
        ip_address=get_client_ip(request)
    )

    return app_obj
