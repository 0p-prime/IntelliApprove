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
from app.models.entities import Application, Institution, Region, EVCSchedule, AcademicProgram
from app.schemas.all_schemas import (
    ApplicationOut,
    ApplicationDetailOut,
    ApplicationCreate,
    ApplicationUpdate,
    CompleteStageRequest,
    ReturnApplicationRequest,
    TimelineOut,
    CaseSummaryOut
)
from app.services.workflow_service import WorkflowService
from app.core.scoping import scope_applications_by_role, scope_evc_schedules_by_role

router = APIRouter()

@router.get("", response_model=List[ApplicationOut])
def list_applications(
    status_filter: Optional[str] = Query(None, alias="status"),
    stage_filter: Optional[str] = Query(None, alias="stage"),
    region_filter: Optional[str] = Query(None, alias="region"),
    institution_filter: Optional[str] = Query(None, alias="institution"),
    min_age_days: Optional[int] = Query(None, alias="min_age"),
    max_age_days: Optional[int] = Query(None, alias="max_age"),
    search: Optional[str] = None,
    escalated_only: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List applications with multi-attribute filtering and role-based data scoping:
    - INSTITUTION: only own institution's applications
    - REGIONAL_OFFICER and REGIONAL_HEAD: only applications in their assigned region
    - BUREAU_OFFICER and ADMIN: all applications nationwide
    - EVC_MEMBER: only applications with assigned EVC inspections
    """
    base_query = db.query(Application).join(Institution, Application.institution_id == Institution.id)
    query = scope_applications_by_role(base_query, current_user, db)

    # 1. Status Filter
    if status_filter:
        query = query.filter(Application.status == status_filter.upper())

    # 2. Stage Filter
    if stage_filter:
        query = query.filter(Application.current_stage == stage_filter.upper())

    # 3. Region Filter (ID or Name)
    if region_filter:
        if region_filter.isdigit():
            query = query.filter(Application.region_id == int(region_filter))
        else:
            query = query.join(Region, Application.region_id == Region.id).filter(
                Region.name.ilike(f"%{region_filter}%")
            )

    # 4. Institution Filter (ID or Name)
    if institution_filter:
        if institution_filter.isdigit():
            query = query.filter(Application.institution_id == int(institution_filter))
        else:
            query = query.filter(Institution.name.ilike(f"%{institution_filter}%"))

    # 5. Age Filters (based on stage_entered_at or submitted_at)
    now = datetime.now(timezone.utc)
    if min_age_days is not None:
        cutoff_max = now - timedelta(days=min_age_days)
        query = query.filter(Application.stage_entered_at <= cutoff_max)
    if max_age_days is not None:
        cutoff_min = now - timedelta(days=max_age_days)
        query = query.filter(Application.stage_entered_at >= cutoff_min)

    # 6. Escalated Only
    if escalated_only:
        query = query.filter(Application.status == "ESCALATED")

    # 7. Search text
    if search:
        query = query.filter(
            (Application.ref_no.ilike(f"%{search}%")) |
            (Institution.name.ilike(f"%{search}%"))
        )

    return query.order_by(Application.stage_entered_at.desc()).all()


@router.post("", response_model=ApplicationDetailOut)
def create_application(
    app_in: ApplicationCreate,
    request: Request,
    current_user: User = Depends(require_roles([UserRole.INSTITUTION.value, UserRole.ADMIN.value])),
    db: Session = Depends(get_db)
):
    """
    Creates a new application assigning the prescribed template and setting the first stage.
    """
    inst_id = app_in.institution_id
    if current_user.role == UserRole.INSTITUTION.value and current_user.institution_id:
        inst_id = current_user.institution_id

    app_obj = WorkflowService.create_application(
        db=db,
        institution_id=inst_id,
        application_type=app_in.application_type,
        template_id=app_in.template_id,
        user=current_user,
        ip_address=get_client_ip(request)
    )

    return app_obj


@router.get("/evc-schedules/list")
def list_evc_schedules(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List EVC schedules with role-based scoping."""
    import json
    query = scope_evc_schedules_by_role(db.query(EVCSchedule), current_user, db)
    schedules = query.order_by(EVCSchedule.scheduled_date.asc()).all()
    res = []
    for s in schedules:
        c_ids = []
        try:
            c_ids = json.loads(s.committee_ids) if isinstance(s.committee_ids, str) else s.committee_ids
        except Exception:
            pass
        res.append({
            "id": s.id,
            "application_id": s.application_id,
            "application_ref_no": s.application.ref_no if s.application else None,
            "institution_name": s.application.institution.name if s.application and s.application.institution else None,
            "scheduled_date": s.scheduled_date,
            "status": s.status,
            "due_date": s.due_date,
            "completed_at": s.completed_at,
            "is_new_institution": s.is_new_institution,
            "committee_ids": c_ids
        })
    return res


@router.get("/{application_id}", response_model=ApplicationDetailOut)
def get_application(
    application_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve full application detail with role-based scoping."""
    scoped_query = scope_applications_by_role(
        db.query(Application).filter(Application.id == application_id),
        current_user,
        db
    )
    app_obj = scoped_query.first()
    if not app_obj:
        exists = db.query(Application).filter(Application.id == application_id).first()
        if exists:
            raise HTTPException(
                status_code=403,
                detail="Unauthorized access to this application (outside your role jurisdiction)"
            )
        raise HTTPException(status_code=404, detail="Application not found")

    return app_obj


@router.put("/{application_id}", response_model=ApplicationDetailOut)
def update_application(
    application_id: int,
    app_in: ApplicationUpdate,
    request: Request,
    current_user: User = Depends(require_roles([UserRole.ADMIN.value, UserRole.REGIONAL_OFFICER.value, UserRole.BUREAU_OFFICER.value])),
    db: Session = Depends(get_db)
):
    """Updates application risk score, due date, or assigned officer."""
    app_obj = db.query(Application).filter(Application.id == application_id).first()
    if not app_obj:
        raise HTTPException(status_code=404, detail="Application not found")

    if app_in.application_type is not None:
        app_obj.application_type = app_in.application_type
    if app_in.risk_score is not None:
        app_obj.risk_score = app_in.risk_score
    if app_in.due_date is not None:
        app_obj.due_date = app_in.due_date
    if app_in.assigned_officer_id is not None:
        app_obj.assigned_officer_id = app_in.assigned_officer_id

    db.commit()
    db.refresh(app_obj)
    return app_obj


@router.delete("/{application_id}")
def delete_application(
    application_id: int,
    current_user: User = Depends(require_roles([UserRole.ADMIN.value])),
    db: Session = Depends(get_db)
):
    """Deletes an application (Admin only)."""
    app_obj = db.query(Application).filter(Application.id == application_id).first()
    if not app_obj:
        raise HTTPException(status_code=404, detail="Application not found")

    db.delete(app_obj)
    db.commit()
    return {"status": "success", "message": f"Application {application_id} deleted."}


@router.post("/{application_id}/complete-stage", response_model=ApplicationDetailOut)
def complete_stage_endpoint(
    application_id: int,
    req: CompleteStageRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Validates officer authority, marks current stage complete, and AUTOMATICALLY moves
    the application to the next stage in its template.
    If preceding stage requires an EVC next, places it in the EVC queue.
    If Bureau Decision stage: requires authorized human decision verdict.
    """
    return WorkflowService.complete_stage(
        db=db,
        application_id=application_id,
        officer=current_user,
        remarks=req.remarks,
        verdict=req.verdict,
        checklist_acknowledgement=req.checklist_acknowledgement,
        ip_address=get_client_ip(request)
    )


@router.post("/{application_id}/return", response_model=ApplicationDetailOut)
def return_application_endpoint(
    application_id: int,
    req: ReturnApplicationRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Mandatory-reason revert (for deficiency / clarification / verification) back to
    a previous stage or to the institution with status 'RETURNED'.
    """
    return WorkflowService.return_application(
        db=db,
        application_id=application_id,
        officer=current_user,
        reason=req.reason,
        target_stage=req.target_stage,
        ip_address=get_client_ip(request)
    )


@router.get("/{application_id}/timeline", response_model=TimelineOut)
def get_application_timeline_endpoint(
    application_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns the visual route sequence, current active stage, and complete stage history."""
    return WorkflowService.get_application_timeline(db=db, application_id=application_id)


@router.get("/{application_id}/case-summary", response_model=CaseSummaryOut)
def get_case_summary_endpoint(
    application_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Auto-generates template-based 'Electronic Case Summary' synthesizing institution details,
    route, progression timeline, observations, and pending items, marked 'Draft for official review'.
    """
    return WorkflowService.generate_case_summary(db=db, application_id=application_id)


@router.get("/{application_id}/full-history")
def get_application_full_history_endpoint(
    application_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns the comprehensive, unified chronological lifecycle history combining:
    1. Stage transitions
    2. Automated alerts
    3. Multi-tier escalations
    4. Submissions (initial app, undertakings proofs, renewals, rectifications)
    5. Verifications (scrutiny, EVC report, undertaking checks, final authority orders)
    6. Cryptographic audit trail blocks
    """
    return WorkflowService.get_application_full_history(db=db, application_id=application_id)
