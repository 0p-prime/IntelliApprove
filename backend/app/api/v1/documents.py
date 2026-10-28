"""
Document Verification and Evidence Endpoints.
Rule #1: State changes write audit_logs entries.
Rule #5: Role-based permissions enforced.
"""
from typing import List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_user, get_client_ip, require_roles
from app.models.user import User, UserRole
from app.models.application import ApplicationDocument, Application
from app.schemas.all_schemas import DocumentOut, DocumentVerificationRequest
from app.services.audit_service import AuditService

router = APIRouter()

@router.get("/application/{application_id}", response_model=List[DocumentOut])
def list_application_documents(
    application_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all documents submitted for an application."""
    return db.query(ApplicationDocument).filter(ApplicationDocument.application_id == application_id).all()

@router.post("/verify/{document_id}", response_model=DocumentOut)
def verify_document(
    document_id: int,
    req: DocumentVerificationRequest,
    request: Request,
    current_user: User = Depends(require_roles([UserRole.SCRUTINY_OFFICER.value, UserRole.ADMIN.value])),
    db: Session = Depends(get_db)
):
    """
    Scrutiny Officer verifies document against AICTE requirements.
    Writes audit log (Rule #1).
    """
    doc = db.query(ApplicationDocument).filter(ApplicationDocument.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    old_status = doc.status
    now = datetime.now(timezone.utc)
    doc.status = req.status
    doc.verification_remarks = req.remarks
    doc.verified_by_user_id = current_user.id
    doc.verified_at = now
    db.commit()
    db.refresh(doc)

    # Rule #1: Audit log
    AuditService.log(
        db=db,
        action="DOCUMENT_VERIFICATION_STATUS_UPDATED",
        entity_type="document",
        entity_id=str(doc.id),
        user=current_user,
        old_value={"status": old_status},
        new_value={"status": req.status, "remarks": req.remarks},
        details=f"Document '{doc.doc_type}' ({doc.file_name}) verified by {current_user.full_name}: {req.status}.",
        ip_address=get_client_ip(request)
    )

    return doc
