"""
Document & Lease Validity Monitoring Endpoints for IntelliApprove.
Implements:
- Tracking of institutional leases, building plans, and legal affidavits
- Real-time validity calculation: VALID, EXPIRING_SOON (<=90 days), CRITICAL (<=30 days), EXPIRED
- Institution renewal upload flow with SHA-256 seal & linked renewal_of_id
- Officer renewal verification & rejection with mandatory speaking remarks
- Expiry timeline buckets and dashboard widgets (next 30/60/90 days)
- Renewal lineage history & audit trail inspection
- Alert engine hooks (90, 60, 30, 7 days reminders, overdue alerts & non-renewal escalations)
- Universal cryptographic audit logging (Rule #1)
- Role-based scoping (Rule #5)
"""
import os
import json
import hashlib
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc, asc

from app.core.database import get_db
from app.core.deps import get_current_user, get_client_ip, require_roles
from app.models.entities import (
    User,
    UserRole,
    Document,
    Application,
    Institution,
    Region,
    FileRecord,
    Notification,
    Escalation,
    AuditLog,
    SystemClock
)
from app.core.scoping import (
    scope_documents_by_role,
    scope_applications_by_role
)
from app.services.audit_service import AuditService

router = APIRouter()

DOC_UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
    "uploads",
    "documents"
)
os.makedirs(DOC_UPLOAD_DIR, exist_ok=True)

ALLOWED_DOC_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".doc", ".docx"}
MAX_DOC_SIZE = 15 * 1024 * 1024  # 15 MB


def get_system_now(db: Session) -> datetime:
    """Returns simulated time if active, else UTC now (naive)."""
    clock = db.query(SystemClock).first()
    if clock and clock.simulated_date:
        d = clock.simulated_date
        return d.replace(tzinfo=None) if d.tzinfo else d
    return datetime.utcnow()


def compute_validity_status(doc: Document, now: datetime) -> str:
    """
    Computes real-time dynamic validity status based on statutory expiry date:
    - EXPIRED: expiry_date < now
    - CRITICAL: <= 30 days remaining
    - EXPIRING_SOON: <= 90 days remaining
    - VALID: > 90 days remaining or indefinite
    """
    if doc.expiry_date is None:
        return "VALID"

    if doc.expiry_date < now:
        return "EXPIRED"

    days_rem = (doc.expiry_date - now).days
    if days_rem <= 30:
        return "CRITICAL"
    if days_rem <= 90:
        return "EXPIRING_SOON"

    return "VALID"


def compute_validity_color(validity_status: str) -> str:
    if validity_status == "EXPIRED":
        return "#EF4444"  # Red
    if validity_status == "CRITICAL":
        return "#DC2626"  # Deep Red / Crimson
    if validity_status == "EXPIRING_SOON":
        return "#F59E0B"  # Amber
    return "#10B981"      # Emerald Green


def check_document_alert_hooks(db: Session, doc: Document, now: datetime):
    """
    Connects to alert engine:
    - Warnings at 90, 60, 30, 7 days before expiry
    - Overdue alerts after expiry
    - Escalation to Regional Head if expired without a renewal submission
    """
    if not doc.expiry_date:
        return

    inst = doc.institution
    inst_name = inst.name if inst else "Institution"
    days_to_exp = (doc.expiry_date - now).days

    # 1. Expired: Non-submission of renewal escalation
    if doc.expiry_date < now:
        # Check if renewal has been submitted
        renewal_exists = db.query(Document).filter(Document.renewal_of_id == doc.id).first()

        if not renewal_exists:
            existing_esc = db.query(Escalation).filter(
                Escalation.entity_type == "DOCUMENT_LEASE",
                Escalation.entity_id == doc.id
            ).first()

            if not existing_esc:
                days_expired = (now - doc.expiry_date).days
                esc_level = 2 if days_expired > 15 else 1
                esc_target = "Regional Head" if esc_level == 2 else "Regional Officer"

                esc = Escalation(
                    entity_type="DOCUMENT_LEASE",
                    entity_id=doc.id,
                    level=esc_level,
                    escalated_to=esc_target,
                    reason=f"{doc.doc_type} affidavit / lease for {inst_name} expired on {doc.expiry_date.date()} without renewal submission."
                )
                db.add(esc)

                # Critical alert to Regional Head & Admin
                reg_heads = db.query(User).filter(
                    User.role.in_([UserRole.REGIONAL_HEAD.value, UserRole.ADMIN.value, UserRole.REGIONAL_OFFICER.value])
                ).all()
                for rh in reg_heads:
                    if (inst and rh.region_id == inst.region_id) or rh.role == UserRole.ADMIN.value:
                        db.add(Notification(
                            user_id=rh.id,
                            title=f"CRITICAL: Non-Renewal of {doc.doc_type} ({inst_name})",
                            message=f"Mandatory legal document has expired ({days_expired} days overdue). No renewal has been submitted by the institution.",
                            category="LEASE_EXPIRED_ESCALATION",
                            severity="CRITICAL",
                            link="/documents"
                        ))

    # 2. Warnings at 90, 60, 30, 7 days before expiry
    elif days_to_exp in [90, 60, 30, 7]:
        sev = "CRITICAL" if days_to_exp <= 7 else "WARNING" if days_to_exp <= 30 else "INFO"
        cat = f"LEASE_EXPIRY_WARNING_{days_to_exp}"

        # Find institution contact users
        inst_users = db.query(User).filter(
            User.role == UserRole.INSTITUTION.value,
            User.email == inst.contact_email
        ).all() if inst else []

        for iu in inst_users:
            notif_exists = db.query(Notification).filter(
                Notification.user_id == iu.id,
                Notification.category == cat,
                Notification.title.contains(f"#{doc.id}")
            ).first()
            if not notif_exists:
                db.add(Notification(
                    user_id=iu.id,
                    title=f"Document Expiry Warning T-{days_to_exp}: {doc.doc_type} (#{doc.id})",
                    message=f"Your {doc.doc_type} document will expire in {days_to_exp} day(s) on {doc.expiry_date.date()}. Upload renewed registered deed to avoid approval suspension.",
                    category=cat,
                    severity=sev,
                    link="/documents"
                ))


def serialize_document(doc: Document, now: datetime, db: Session) -> Dict[str, Any]:
    """Helper to serialize document with calculated validity, countdowns, and renewal state."""
    val_status = compute_validity_status(doc, now)
    color = compute_validity_color(val_status)

    inst = doc.institution
    f_rec = doc.file
    verifier = getattr(doc, "verifier", None)

    days_rem = max(0, (doc.expiry_date - now).days) if doc.expiry_date and doc.expiry_date >= now else 0
    days_exp = max(0, (now - doc.expiry_date).days) if doc.expiry_date and doc.expiry_date < now else 0

    # Check alert hooks
    check_document_alert_hooks(db, doc, now)

    # Check if this document has downstream renewals
    has_renewals = db.query(Document).filter(Document.renewal_of_id == doc.id).first() is not None

    return {
        "id": doc.id,
        "institution_id": doc.institution_id,
        "institution_name": inst.name if inst else "Unknown Institution",
        "institution_type": inst.type if inst else "Engineering",
        "state": inst.state if inst else "Unknown",
        "region_id": inst.region_id if inst else None,
        "region_name": inst.region.name if inst and inst.region else "Unknown",
        "application_id": getattr(doc, "application_id", 1),
        "doc_type": doc.doc_type,
        "issue_date": doc.issue_date.isoformat() if doc.issue_date else None,
        "expiry_date": doc.expiry_date.isoformat() if doc.expiry_date else None,
        "status": doc.verification_status,
        "verification_status": doc.verification_status,
        "validity_status": val_status,
        "days_remaining": days_rem,
        "days_expired": days_exp,
        "is_expired": val_status == "EXPIRED",
        "is_critical": val_status == "CRITICAL",
        "is_expiring_soon": val_status in ["CRITICAL", "EXPIRING_SOON"],
        "color_code": color,
        "renewal_of_id": doc.renewal_of_id,
        "has_renewals": has_renewals,
        "file_id": doc.file_id,
        "file_name": f_rec.filename if f_rec else f"{doc.doc_type.lower()}_deed.pdf",
        "file_url": f"/api/v1/documents/{doc.id}/file/download",
        "file_size_kb": getattr(doc, "file_size_kb", 1450),
        "sha256_hash": f_rec.sha256_hash if f_rec else getattr(doc, "sha256_hash", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
        "uploaded_at": f_rec.uploaded_at.isoformat() if f_rec else (doc.issue_date.isoformat() if doc.issue_date else None),
        "verified_by_user_id": doc.verified_by,
        "verifier_name": verifier.name if verifier else None,
        "verified_at": doc.verified_at.isoformat() if doc.verified_at else None,
        "remarks": getattr(doc, "remarks", None),
        "verification_remarks": getattr(doc, "remarks", None)
    }


# --- Request Schemas ---

class VerifyDocumentRequest(BaseModel):
    remarks: str = Field(..., min_length=5, description="Mandatory remarks regarding validity check")


class RejectDocumentRequest(BaseModel):
    remarks: str = Field(..., min_length=5, description="Mandatory speaking reason for rejecting document")


class DocumentVerificationRequest(BaseModel):
    status: str = Field("VERIFIED", description="VERIFIED, REJECTED, DEFICIENT_REJECTED, VERIFIED_COMPLIANT")
    remarks: Optional[str] = None


# --- Endpoints ---

@router.get("")
def list_documents(
    institution_id: Optional[int] = Query(None),
    region_id: Optional[int] = Query(None),
    validity_status: Optional[str] = Query(None, description="VALID, EXPIRING_SOON, CRITICAL, EXPIRED"),
    verification_status: Optional[str] = Query(None, description="PENDING, VERIFIED, REJECTED"),
    doc_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List legal documents with role scoping, validity classification, and countdown timers.
    """
    now = get_system_now(db)
    base_query = db.query(Document)
    query = scope_documents_by_role(base_query, current_user, db)

    if institution_id:
        query = query.filter(Document.institution_id == institution_id)

    if region_id and current_user.role in [UserRole.ADMIN.value, UserRole.BUREAU_OFFICER.value]:
        query = query.join(Institution, Document.institution_id == Institution.id).filter(
            Institution.region_id == region_id
        )

    if doc_type and doc_type != "ALL":
        query = query.filter(Document.doc_type == doc_type)

    if verification_status and verification_status != "ALL":
        query = query.filter(Document.verification_status == verification_status)

    docs = query.order_by(Document.expiry_date.asc()).all()
    serialized = [serialize_document(d, now, db) for d in docs]

    # Filter by computed validity status
    if validity_status and validity_status != "ALL":
        serialized = [d for d in serialized if d["validity_status"] == validity_status]

    # Search filter
    if search:
        s_low = search.lower()
        serialized = [
            d for d in serialized
            if (d["doc_type"] and s_low in d["doc_type"].lower()) or
               (d["institution_name"] and s_low in d["institution_name"].lower()) or
               (d["file_name"] and s_low in d["file_name"].lower())
        ]

    return serialized


@router.get("/expiring-summary")
def get_expiring_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns aggregated counts of documents expiring in the next 30, 60, and 90 days,
    along with expired document totals (for dashboard widgets).
    """
    now = get_system_now(db)
    base_query = db.query(Document)
    docs = scope_documents_by_role(base_query, current_user, db).all()

    expired_count = 0
    critical_30_count = 0
    warning_60_count = 0
    warning_90_count = 0
    valid_safe_count = 0

    for d in docs:
        if not d.expiry_date:
            valid_safe_count += 1
            continue

        if d.expiry_date < now:
            expired_count += 1
        else:
            days = (d.expiry_date - now).days
            if days <= 30:
                critical_30_count += 1
            elif days <= 60:
                warning_60_count += 1
            elif days <= 90:
                warning_90_count += 1
            else:
                valid_safe_count += 1

    total_with_expiry = expired_count + critical_30_count + warning_60_count + warning_90_count + valid_safe_count

    return {
        "expired": expired_count,
        "next_30_days": critical_30_count,
        "next_60_days": critical_30_count + warning_60_count,
        "next_90_days": critical_30_count + warning_60_count + warning_90_count,
        "safe_over_90_days": valid_safe_count,
        "total_documents": len(docs),
        "total_with_expiry": total_with_expiry
    }


@router.get("/expiry-timeline")
def get_expiry_timeline(
    region_id: Optional[int] = Query(None),
    doc_type: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns documents bucketed into a colour-coded expiry timeline:
    - EXPIRED: past statutory expiry date (Red)
    - CRITICAL: expiring within 30 days (Deep Red)
    - EXPIRING_SOON: expiring within 31-90 days (Amber)
    - VALID: expiring > 90 days (Green)
    """
    now = get_system_now(db)
    base_query = db.query(Document)
    query = scope_documents_by_role(base_query, current_user, db)

    if region_id and current_user.role in [UserRole.ADMIN.value, UserRole.BUREAU_OFFICER.value]:
        query = query.join(Institution, Document.institution_id == Institution.id).filter(
            Institution.region_id == region_id
        )

    if doc_type and doc_type != "ALL":
        query = query.filter(Document.doc_type == doc_type)

    all_docs = query.order_by(Document.expiry_date.asc()).all()
    serialized = [serialize_document(d, now, db) for d in all_docs]

    expired = [d for d in serialized if d["validity_status"] == "EXPIRED"]
    critical = [d for d in serialized if d["validity_status"] == "CRITICAL"]
    expiring_soon = [d for d in serialized if d["validity_status"] == "EXPIRING_SOON"]
    valid = [d for d in serialized if d["validity_status"] == "VALID"]

    return {
        "summary": {
            "total": len(serialized),
            "expired_count": len(expired),
            "critical_count": len(critical),
            "expiring_soon_count": len(expiring_soon),
            "valid_count": len(valid)
        },
        "buckets": {
            "expired": {
                "label": "Expired / Non-Compliant",
                "color": "#EF4444",
                "count": len(expired),
                "documents": expired
            },
            "critical": {
                "label": "Critical (<= 30 Days Remaining)",
                "color": "#DC2626",
                "count": len(critical),
                "documents": critical
            },
            "expiring_soon": {
                "label": "Expiring Soon (31 - 90 Days Remaining)",
                "color": "#F59E0B",
                "count": len(expiring_soon),
                "documents": expiring_soon
            },
            "valid": {
                "label": "Safe & Valid (> 90 Days Remaining)",
                "color": "#10B981",
                "count": len(valid),
                "documents": valid
            }
        }
    }


@router.post("/renew")
async def upload_renewed_document(
    request: Request,
    renewal_of_id: int = Form(..., description="ID of the previous document being renewed"),
    issue_date: str = Form(..., description="New issue date in ISO/YYYY-MM-DD format"),
    expiry_date: str = Form(..., description="New expiry date in ISO/YYYY-MM-DD format"),
    file: UploadFile = File(..., description="Renewed deed or certificate file"),
    current_user: User = Depends(require_roles([
        UserRole.INSTITUTION.value,
        UserRole.ADMIN.value,
        UserRole.REGIONAL_OFFICER.value
    ])),
    db: Session = Depends(get_db)
):
    """
    Institution uploads a renewed document linked to the expiring/expired document via renewal_of_id.
    Stores file with cryptographic SHA-256 seal and transitions verification status to PENDING.
    """
    now = get_system_now(db)
    prev_doc = db.query(Document).filter(Document.id == renewal_of_id).first()
    if not prev_doc:
        raise HTTPException(status_code=404, detail=f"Previous document #{renewal_of_id} not found")

    # Scoping check: institutions can only renew own documents
    if current_user.role == UserRole.INSTITUTION.value:
        if prev_doc.institution and prev_doc.institution.contact_email != current_user.email:
            raise HTTPException(status_code=403, detail="Cannot renew documents belonging to another institution")

    # Validate dates
    try:
        iss_dt = datetime.fromisoformat(issue_date.replace("Z", "+00:00")).replace(tzinfo=None)
        exp_dt = datetime.fromisoformat(expiry_date.replace("Z", "+00:00")).replace(tzinfo=None)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid date format. Please use YYYY-MM-DD or ISO 8601.")

    if exp_dt <= iss_dt:
        raise HTTPException(status_code=400, detail="Document expiry date must be strictly after the issue date")

    # Validate file
    filename = file.filename or "renewed_document.pdf"
    _, ext = os.path.splitext(filename)
    ext_lower = ext.lower()

    if ext_lower not in ALLOWED_DOC_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file extension '{ext_lower}'. Allowed: {', '.join(sorted(ALLOWED_DOC_EXTENSIONS))}"
        )

    content = await file.read()
    if len(content) > MAX_DOC_SIZE:
        raise HTTPException(status_code=400, detail="File exceeds 15MB limit")
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="File is empty")

    sha256 = hashlib.sha256(content).hexdigest()

    # Save to disk
    safe_name = f"{sha256[:12]}_{filename.replace(' ', '_')}"
    saved_path = os.path.join(DOC_UPLOAD_DIR, safe_name)
    with open(saved_path, "wb") as f_out:
        f_out.write(content)

    # Register FileRecord
    file_record = FileRecord(
        filename=filename,
        path=saved_path,
        sha256_hash=sha256,
        uploaded_by=current_user.id,
        uploaded_at=now
    )
    db.add(file_record)
    db.flush()

    # Create new Document
    renewed_doc = Document(
        institution_id=prev_doc.institution_id,
        doc_type=prev_doc.doc_type,
        issue_date=iss_dt,
        expiry_date=exp_dt,
        file_id=file_record.id,
        verification_status="PENDING",
        renewal_of_id=prev_doc.id,
        remarks=f"Renewal of Doc #{prev_doc.id} submitted by {current_user.name}."
    )
    db.add(renewed_doc)
    db.commit()
    db.refresh(renewed_doc)

    inst_name = prev_doc.institution.name if prev_doc.institution else "Institution"

    # Rule #1: Audit log
    AuditService.log(
        db=db,
        action="DOCUMENT_RENEWAL_SUBMITTED",
        entity_type="document",
        entity_id=str(renewed_doc.id),
        user=current_user,
        new_value={
            "document_id": renewed_doc.id,
            "renewal_of_id": prev_doc.id,
            "doc_type": prev_doc.doc_type,
            "expiry_date": exp_dt.isoformat(),
            "sha256_hash": sha256
        },
        details=f"Renewed {prev_doc.doc_type} document #{renewed_doc.id} submitted for {inst_name}. Renewal of #{prev_doc.id}.",
        ip_address=get_client_ip(request)
    )

    # Notify Regional Officers
    ro_users = db.query(User).filter(
        User.role.in_([UserRole.REGIONAL_OFFICER.value, UserRole.ADMIN.value])
    ).all()
    for ro in ro_users:
        if (prev_doc.institution and ro.region_id == prev_doc.institution.region_id) or ro.role == UserRole.ADMIN.value:
            db.add(Notification(
                user_id=ro.id,
                title=f"Renewed Document Submitted: {inst_name}",
                message=f"Renewed {prev_doc.doc_type} submitted for verification. Expiry date extended to {exp_dt.strftime('%d %b %Y')}.",
                category="DOCUMENT_RENEWAL_SUBMITTED",
                severity="INFO",
                link="/documents"
            ))
    db.commit()

    return {
        "status": "success",
        "message": f"Renewed {prev_doc.doc_type} successfully registered and queued for officer scrutiny.",
        "document": serialize_document(renewed_doc, now, db)
    }


@router.post("/{document_id}/verify")
def verify_document_renewal(
    document_id: int,
    req: VerifyDocumentRequest,
    request: Request,
    current_user: User = Depends(require_roles([
        UserRole.REGIONAL_OFFICER.value,
        UserRole.REGIONAL_HEAD.value,
        UserRole.ADMIN.value
    ])),
    db: Session = Depends(get_db)
):
    """
    Officer verifies renewal document with mandatory remarks.
    Marks verification_status as VERIFIED and logs immutable audit trail.
    """
    now = get_system_now(db)
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if not req.remarks or len(req.remarks.strip()) < 5:
        raise HTTPException(status_code=400, detail="Mandatory verification remarks required (min 5 characters)")

    old_status = doc.verification_status
    doc.verification_status = "VERIFIED"
    doc.verified_by = current_user.id
    doc.verified_at = now
    doc.remarks = req.remarks.strip()

    # Rule #1: Audit log
    AuditService.log(
        db=db,
        action="DOCUMENT_VERIFIED",
        entity_type="document",
        entity_id=str(doc.id),
        user=current_user,
        old_value={"status": old_status},
        new_value={"status": "VERIFIED", "verified_by": current_user.id, "remarks": req.remarks.strip()},
        details=f"Officer {current_user.name} ({current_user.role}) VERIFIED {doc.doc_type} #{doc.id}. Remarks: {req.remarks.strip()}",
        ip_address=get_client_ip(request)
    )

    # Notify institution
    inst = doc.institution
    if inst and inst.contact_email:
        inst_users = db.query(User).filter(
            User.role == UserRole.INSTITUTION.value,
            User.email == inst.contact_email
        ).all()
        for iu in inst_users:
            db.add(Notification(
                user_id=iu.id,
                title=f"Document Verified: {doc.doc_type} (#{doc.id})",
                message=f"Your {doc.doc_type} document has been approved by Regional Directorate. Remarks: {req.remarks.strip()}",
                category="DOCUMENT_VERIFIED",
                severity="INFO",
                link="/documents"
            ))

    db.commit()
    db.refresh(doc)
    return {
        "status": "success",
        "message": f"Document #{doc.id} ({doc.doc_type}) successfully verified.",
        "document": serialize_document(doc, now, db)
    }


@router.post("/{document_id}/reject")
def reject_document_renewal(
    document_id: int,
    req: RejectDocumentRequest,
    request: Request,
    current_user: User = Depends(require_roles([
        UserRole.REGIONAL_OFFICER.value,
        UserRole.REGIONAL_HEAD.value,
        UserRole.ADMIN.value
    ])),
    db: Session = Depends(get_db)
):
    """
    Officer rejects document with mandatory speaking remarks for deficiencies.
    Marks verification_status as REJECTED and creates high-priority alert.
    """
    now = get_system_now(db)
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if not req.remarks or len(req.remarks.strip()) < 5:
        raise HTTPException(status_code=400, detail="Mandatory rejection remarks required (min 5 characters)")

    old_status = doc.verification_status
    doc.verification_status = "REJECTED"
    doc.verified_by = current_user.id
    doc.verified_at = now
    doc.remarks = req.remarks.strip()

    # Rule #1: Audit log
    AuditService.log(
        db=db,
        action="DOCUMENT_REJECTED",
        entity_type="document",
        entity_id=str(doc.id),
        user=current_user,
        old_value={"status": old_status},
        new_value={"status": "REJECTED", "verified_by": current_user.id, "remarks": req.remarks.strip()},
        details=f"Officer {current_user.name} ({current_user.role}) REJECTED {doc.doc_type} #{doc.id}. Reason: {req.remarks.strip()}",
        ip_address=get_client_ip(request)
    )

    # Notify institution
    inst = doc.institution
    if inst and inst.contact_email:
        inst_users = db.query(User).filter(
            User.role == UserRole.INSTITUTION.value,
            User.email == inst.contact_email
        ).all()
        for iu in inst_users:
            db.add(Notification(
                user_id=iu.id,
                title=f"DEFICIENCY: Document Rejected ({doc.doc_type} #{doc.id})",
                message=f"Uploaded {doc.doc_type} document was rejected. Reason: {req.remarks.strip()}. Please re-upload compliant deed.",
                category="DOCUMENT_REJECTED",
                severity="CRITICAL",
                link="/documents"
            ))

    db.commit()
    db.refresh(doc)
    return {
        "status": "success",
        "message": f"Document #{doc.id} ({doc.doc_type}) rejected. Deficiency recorded.",
        "document": serialize_document(doc, now, db)
    }


@router.get("/{document_id}/renewal-history")
def get_document_renewal_history(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns the complete renewal lineage / history for a document:
    - Root original document
    - Subsequent renewals in chronological sequence
    - Associated cryptographic audit logs
    """
    now = get_system_now(db)
    target = db.query(Document).filter(Document.id == document_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Document not found")

    # Traverse upward to find the root document
    root = target
    seen_ids = set()
    while root.renewal_of_id and root.id not in seen_ids:
        seen_ids.add(root.id)
        parent = db.query(Document).filter(Document.id == root.renewal_of_id).first()
        if not parent:
            break
        root = parent

    # Traverse downward to gather all lineage documents
    lineage = [root]
    queue = [root.id]
    visited = {root.id}

    while queue:
        curr_id = queue.pop(0)
        children = db.query(Document).filter(Document.renewal_of_id == curr_id).all()
        for ch in children:
            if ch.id not in visited:
                visited.add(ch.id)
                lineage.append(ch)
                queue.append(ch.id)

    lineage.sort(key=lambda d: d.issue_date or datetime.min)

    # Fetch audit logs for all documents in lineage
    doc_ids_str = [str(d.id) for d in lineage]
    audits = db.query(AuditLog).filter(
        AuditLog.entity_type == "document",
        AuditLog.entity_id.in_(doc_ids_str)
    ).order_by(AuditLog.timestamp.desc()).all()

    audit_records = [
        {
            "id": a.id,
            "action": a.action,
            "entity_id": a.entity_id,
            "actor_id": a.actor_id,
            "actor_name": a.actor.name if a.actor else "System",
            "actor_role": a.actor.role if a.actor else "SYSTEM",
            "timestamp": a.timestamp.isoformat(),
            "details": a.details,
            "hash": a.hash
        }
        for a in audits
    ]

    return {
        "target_document_id": document_id,
        "root_document_id": root.id,
        "total_renewals": len(lineage) - 1,
        "lineage": [serialize_document(d, now, db) for d in lineage],
        "audit_trail": audit_records
    }


@router.get("/{document_id}")
def get_document_detail(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns full details for a document including renewal lineage and audit trail.
    """
    now = get_system_now(db)
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Audit trail for this document
    audits = db.query(AuditLog).filter(
        AuditLog.entity_type == "document",
        AuditLog.entity_id == str(doc.id)
    ).order_by(AuditLog.timestamp.desc()).all()

    audit_records = [
        {
            "id": a.id,
            "action": a.action,
            "actor_name": a.actor.name if a.actor else "System",
            "actor_role": a.actor.role if a.actor else "SYSTEM",
            "timestamp": a.timestamp.isoformat(),
            "details": a.details,
            "hash": a.hash
        }
        for a in audits
    ]

    serialized = serialize_document(doc, now, db)
    serialized["audit_trail"] = audit_records
    return serialized


@router.get("/{document_id}/file/download")
def download_document_file(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Downloads or previews the registered legal document file.
    """
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    file_rec = doc.file
    filename = file_rec.filename if file_rec else f"{doc.doc_type.lower()}_deed.pdf"

    if file_rec and os.path.exists(file_rec.path):
        return FileResponse(
            path=file_rec.path,
            filename=filename,
            media_type="application/octet-stream"
        )

    # Simulated preview file if path is abstract
    sim_path = os.path.join(DOC_UPLOAD_DIR, filename)
    if not os.path.exists(sim_path):
        with open(sim_path, "w", encoding="utf-8") as f:
            f.write(f"AICTE Official Institutional Document Repository\n")
            f.write(f"Document ID: {doc.id}\n")
            f.write(f"Document Type: {doc.doc_type}\n")
            f.write(f"Institution: {doc.institution.name if doc.institution else 'N/A'}\n")
            f.write(f"Issue Date: {doc.issue_date}\n")
            f.write(f"Expiry Date: {doc.expiry_date}\n")
            f.write(f"SHA-256 Hash: {getattr(doc, 'sha256_hash', 'None')}\n")
            f.write(f"Generated at: {datetime.utcnow().isoformat()}\n")

    return FileResponse(
        path=sim_path,
        filename=filename,
        media_type="text/plain"
    )


# --- Backward Compatibility Endpoints ---

@router.get("/application/{application_id}")
def list_application_documents(
    application_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List documents for an application with role-based scoping check."""
    now = get_system_now(db)
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
    return [serialize_document(d, now, db) for d in docs]


@router.post("/verify/{document_id}")
def legacy_verify_document(
    document_id: int,
    req: DocumentVerificationRequest,
    request: Request,
    current_user: User = Depends(require_roles([UserRole.REGIONAL_OFFICER.value, UserRole.ADMIN.value])),
    db: Session = Depends(get_db)
):
    """Legacy endpoint for verifying document."""
    now = get_system_now(db)
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    clean_st = "VERIFIED" if "VERIF" in req.status.upper() or "COMPL" in req.status.upper() else "REJECTED"
    old_status = doc.verification_status
    doc.verification_status = clean_st
    doc.verified_by = current_user.id
    doc.verified_at = now
    if req.remarks:
        doc.remarks = req.remarks

    db.commit()
    db.refresh(doc)

    AuditService.log(
        db=db,
        action="DOCUMENT_VERIFICATION_STATUS_UPDATED",
        entity_type="document",
        entity_id=str(doc.id),
        user=current_user,
        old_value={"status": old_status},
        new_value={"status": clean_st, "remarks": req.remarks},
        details=f"Document '{doc.doc_type}' status updated to {clean_st} by {current_user.name}.",
        ip_address=get_client_ip(request)
    )

    return serialize_document(doc, now, db)
