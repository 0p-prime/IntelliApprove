"""
Undertakings & Post-Approval Compliance Tracking Endpoints.
Rule #1: State changes write audit_logs entries.
Rule #5: Role-based permissions enforced.
"""
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_user, get_client_ip, require_roles
from app.models.user import User, UserRole
from app.models.undertaking import Undertaking
from app.schemas.all_schemas import (
    UndertakingOut,
    UndertakingCreate,
    UndertakingFulfillRequest,
    UndertakingVerifyRequest
)
from app.services.audit_service import AuditService

router = APIRouter()

@router.get("", response_model=List[UndertakingOut])
def list_undertakings(
    application_id: Optional[int] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List compliance undertakings with filters."""
    query = db.query(Undertaking)
    if application_id:
        query = query.filter(Undertaking.application_id == application_id)
    if status_filter:
        query = query.filter(Undertaking.status == status_filter)
    return query.order_by(Undertaking.due_date.asc()).all()

@router.post("", response_model=UndertakingOut)
def create_undertaking(
    req: UndertakingCreate,
    request: Request,
    current_user: User = Depends(require_roles([UserRole.COMPETENT_AUTHORITY.value, UserRole.REGIONAL_OFFICER.value, UserRole.ADMIN.value])),
    db: Session = Depends(get_db)
):
    """Impose an undertaking requirement on an institution for conditional approval."""
    undertaking = Undertaking(
        application_id=req.application_id,
        title=req.title,
        description=req.description,
        category=req.category,
        due_date=req.due_date,
        status="PENDING"
    )
    db.add(undertaking)
    db.commit()
    db.refresh(undertaking)

    # Rule #1: Audit log
    AuditService.log(
        db=db,
        action="UNDERTAKING_CREATED",
        entity_type="undertaking",
        entity_id=str(undertaking.id),
        user=current_user,
        new_value={"title": req.title, "due_date": req.due_date.isoformat(), "category": req.category},
        details=f"Compliance undertaking #{undertaking.id} imposed on application #{req.application_id} by {current_user.full_name}.",
        ip_address=get_client_ip(request)
    )

    return undertaking

@router.post("/{undertaking_id}/fulfill", response_model=UndertakingOut)
def fulfill_undertaking(
    undertaking_id: int,
    req: UndertakingFulfillRequest,
    request: Request,
    current_user: User = Depends(require_roles([UserRole.INSTITUTION.value, UserRole.ADMIN.value])),
    db: Session = Depends(get_db)
):
    """Institution uploads compliance evidence fulfilling their undertaking."""
    undertaking = db.query(Undertaking).filter(Undertaking.id == undertaking_id).first()
    if not undertaking:
        raise HTTPException(status_code=404, detail="Undertaking not found")

    old_status = undertaking.status
    now = datetime.now(timezone.utc)
    undertaking.status = "SUBMITTED_FOR_REVIEW"
    undertaking.submission_evidence = req.submission_evidence
    undertaking.submitted_at = now
    db.commit()
    db.refresh(undertaking)

    # Rule #1: Audit log
    AuditService.log(
        db=db,
        action="UNDERTAKING_EVIDENCE_SUBMITTED",
        entity_type="undertaking",
        entity_id=str(undertaking.id),
        user=current_user,
        old_value={"status": old_status},
        new_value={"status": "SUBMITTED_FOR_REVIEW", "evidence": req.submission_evidence},
        details=f"Institution submitted fulfillment evidence for undertaking #{undertaking.id} '{undertaking.title}'.",
        ip_address=get_client_ip(request)
    )

    return undertaking

@router.post("/{undertaking_id}/verify", response_model=UndertakingOut)
def verify_undertaking(
    undertaking_id: int,
    req: UndertakingVerifyRequest,
    request: Request,
    current_user: User = Depends(require_roles([UserRole.REGIONAL_OFFICER.value, UserRole.COMPETENT_AUTHORITY.value, UserRole.ADMIN.value])),
    db: Session = Depends(get_db)
):
    """Regional Directorate verifies whether institution's evidence satisfies undertaking."""
    undertaking = db.query(Undertaking).filter(Undertaking.id == undertaking_id).first()
    if not undertaking:
        raise HTTPException(status_code=404, detail="Undertaking not found")

    old_status = undertaking.status
    now = datetime.now(timezone.utc)
    undertaking.status = req.status
    undertaking.verification_remarks = req.remarks
    undertaking.verified_by_user_id = current_user.id
    undertaking.verified_at = now
    db.commit()
    db.refresh(undertaking)

    # Rule #1: Audit log
    AuditService.log(
        db=db,
        action="UNDERTAKING_VERIFICATION_RECORDED",
        entity_type="undertaking",
        entity_id=str(undertaking.id),
        user=current_user,
        old_value={"status": old_status},
        new_value={"status": req.status, "remarks": req.remarks},
        details=f"Regional Officer {current_user.full_name} marked undertaking #{undertaking.id} as '{req.status}'.",
        ip_address=get_client_ip(request)
    )

    return undertaking
