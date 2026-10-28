"""
Document Verification and Evidence Endpoints with role-based scoping.
Rule #1: State changes write audit_logs entries.
Rule #5: Role-based permissions enforced.
"""
from typing import List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_user, get_client_ip, require_roles
from app.models.entities import User, UserRole, Document, Application
from app.core.scoping import scope_documents_by_role, scope_applications_by_role
from app.schemas.all_schemas import DocumentOut, DocumentVerificationRequest
from app.services.audit_service import AuditService

router = APIRouter()

@router.get("", response_model=List[DocumentOut])
def list_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List documents scoped by user's role."""
    query = scope_documents_by_role(db.query(Document), current_user, db)
    return query.order_by(Document.expiry_date.asc()).all()

@router.get("/application/{application_id}", response_model=List[DocumentOut])
def list_application_documents(
    application_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List documents for an application with role-based scoping check."""
    # Ensure application is within user's scope
    scoped_app = scope_applications_by_role(
        db.query(Application).filter(Application.id == application_id),
        current_user,
        db
    ).first()
    
    if not scoped_app:
        exists = db.query(Application).filter(Application.id == application_id).first()
        if exists:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this application's documents")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    docs = db.query(Document).filter(Document.institution_id == scoped_app.institution_id).all()
    return docs

@router.post("/verify/{document_id}", response_model=DocumentOut)
def verify_document(
    document_id: int,
    req: DocumentVerificationRequest,
    request: Request,
    current_user: User = Depends(require_roles([UserRole.REGIONAL_OFFICER.value, UserRole.ADMIN.value])),
    db: Session = Depends(get_db)
):
    """
    Officer verifies document against AICTE requirements.
    Writes audit log (Rule #1).
    """
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    old_status = doc.verification_status
    doc.verification_status = req.status
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
        details=f"Document '{doc.doc_type}' verified by {current_user.name}: {req.status}.",
        ip_address=get_client_ip(request)
    )

    return doc
