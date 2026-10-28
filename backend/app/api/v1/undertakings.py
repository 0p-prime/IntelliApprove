"""
Undertakings & Institutional Compliance Module Endpoints for IntelliApprove.
Implements:
- Creation of undertakings when approvals are granted with conditions
- Supporting evidence upload with SHA-256 cryptographic hashing & size/type validation
- Officer verification & rejection endpoints with mandatory speaking remarks
- Dynamic status lifecycle: PENDING, SUBMITTED, VERIFIED, REJECTED, OVERDUE
- Institutional Compliance Score computation (verified on time / total)
- Compliance Heat Table for Regional/Bureau officers
- Alert engine hooks (T-7, T-3, T-1 reminders and overdue escalations)
- Universal cryptographic audit logging (Rule #1)
- Role-based data scoping (Rule #5)
"""
import os
import json
import uuid
import hashlib
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc, asc, func

from app.core.database import get_db
from app.core.deps import get_current_user, get_client_ip, require_roles
from app.models.entities import (
    User,
    UserRole,
    Application,
    Region,
    Institution,
    Undertaking,
    FileRecord,
    Notification,
    Escalation,
    SystemClock
)
from app.core.scoping import (
    scope_undertakings_by_role,
    scope_applications_by_role
)
from app.services.audit_service import AuditService

router = APIRouter()

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "uploads", "undertakings")
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".doc", ".docx"}
MAX_FILE_SIZE = 15 * 1024 * 1024  # 15 MB


def get_system_now(db: Session) -> datetime:
    """Returns simulated time if active, else UTC now (naive)."""
    clock = db.query(SystemClock).first()
    if clock and clock.simulated_date:
        d = clock.simulated_date
        return d.replace(tzinfo=None) if d.tzinfo else d
    return datetime.utcnow()


def compute_undertaking_status(u: Undertaking, now: datetime) -> str:
    """
    Computes real-time dynamic undertaking status:
    PENDING, SUBMITTED, VERIFIED, REJECTED, OVERDUE.
    """
    if u.status == "VERIFIED":
        return "VERIFIED"
    if u.status == "REJECTED":
        return "REJECTED"
    if u.status in ["SUBMITTED", "SUBMITTED_FOR_REVIEW"] or u.evidence_file_id is not None:
        return "SUBMITTED"
    if u.due_date and u.due_date < now:
        return "OVERDUE"
    return "PENDING"


def check_undertaking_alert_hooks(db: Session, u: Undertaking, now: datetime):
    """
    Connects to alert engine:
    - Reminders before due date at T-7, T-3, T-1
    - Escalation when overdue (writes to escalations & notifications)
    """
    if u.status == "VERIFIED":
        return

    days_to_due = (u.due_date - now).days if u.due_date else 99
    inst_name = u.institution.name if u.institution else "Institution"
    app_ref = u.application.ref_no if u.application else f"App #{u.application_id}"
    cond_summary = u.condition_text[:60] + "..." if len(u.condition_text) > 60 else u.condition_text

    # 1. Overdue Escalation
    if u.due_date and u.due_date < now and u.status not in ["VERIFIED", "SUBMITTED"]:
        existing_esc = db.query(Escalation).filter(
            Escalation.entity_type == "UNDERTAKING",
            Escalation.entity_id == u.id
        ).first()

        days_overdue = (now - u.due_date).days
        esc_level = 2 if days_overdue > 7 else 1
        esc_target = "Regional Head" if esc_level == 2 else "Regional Officer"

        if not existing_esc:
            esc = Escalation(
                entity_type="UNDERTAKING",
                entity_id=u.id,
                level=esc_level,
                escalated_to=esc_target,
                reason=f"Statutory undertaking #{u.id} for {inst_name} ({app_ref}) is overdue past deadline {u.due_date.date()}."
            )
            db.add(esc)

            # Alert Regional Officers / Head
            reg_officers = db.query(User).filter(
                User.role.in_([UserRole.REGIONAL_OFFICER.value, UserRole.REGIONAL_HEAD.value, UserRole.ADMIN.value])
            ).all()
            for ro in reg_officers:
                if ro.region_id == u.institution.region_id or ro.role == UserRole.ADMIN.value:
                    db.add(Notification(
                        user_id=ro.id,
                        title=f"URGENT: Overdue Undertaking ({inst_name})",
                        message=f"Institutional undertaking '{cond_summary}' breached compliance deadline. Escalated to {esc_target}.",
                        category="UNDERTAKING_ESCALATION",
                        severity="CRITICAL",
                        link="/undertakings"
                    ))

    # 2. Reminders at T-7, T-3, T-1
    elif days_to_due in [7, 3, 1] and u.status not in ["VERIFIED", "SUBMITTED"]:
        sev = "CRITICAL" if days_to_due == 1 else "WARNING" if days_to_due == 3 else "INFO"
        cat = f"UNDERTAKING_REMINDER_T{days_to_due}"

        # Find institution users
        inst_users = db.query(User).filter(
            User.role == UserRole.INSTITUTION.value,
            User.email == u.institution.contact_email
        ).all() if u.institution else []

        for iu in inst_users:
            notif_exists = db.query(Notification).filter(
                Notification.user_id == iu.id,
                Notification.category == cat,
                Notification.title.contains(f"#{u.id}")
            ).first()
            if not notif_exists:
                db.add(Notification(
                    user_id=iu.id,
                    title=f"Compliance Undertaking Reminder T-{days_to_due} (#{u.id})",
                    message=f"Statutory condition '{cond_summary}' is due in {days_to_due} day(s) on {u.due_date.date()}. Upload supporting compliance evidence immediately.",
                    category=cat,
                    severity=sev,
                    link="/undertakings"
                ))


def serialize_undertaking(u: Undertaking, now: datetime, db: Session) -> Dict[str, Any]:
    """Helper to serialize an undertaking with countdowns, status, and related metadata."""
    computed_st = compute_undertaking_status(u, now)
    days_rem = max(0, (u.due_date - now).days) if (u.due_date and u.due_date >= now) else 0
    days_ovd = max(0, (now - u.due_date).days) if (u.due_date and u.due_date < now) else 0

    inst = u.institution
    app = u.application
    ev_file = u.evidence_file
    verifier = u.verifier

    # Check alert hooks
    check_undertaking_alert_hooks(db, u, now)

    # Legacy remarks support
    remarks_text = u.remarks or getattr(u, "verification_remarks", None)

    return {
        "id": u.id,
        "institution_id": u.institution_id,
        "institution_name": inst.name if inst else "Unknown Institution",
        "institution_type": inst.type if inst else "Engineering",
        "state": inst.state if inst else "Unknown",
        "region_id": inst.region_id if inst else (app.region_id if app else None),
        "region_name": inst.region.name if inst and inst.region else (app.region.name if app and app.region else "Unknown"),
        "application_id": u.application_id,
        "application_ref_no": app.ref_no if app else f"APP-{u.application_id:04d}",
        "condition_text": u.condition_text,
        "title": u.title,
        "description": u.condition_text,
        "category": u.category,
        "due_date": u.due_date.isoformat() if u.due_date else None,
        "status": computed_st,
        "raw_status": u.status,
        "days_remaining": days_rem,
        "days_overdue": days_ovd,
        "is_overdue": computed_st == "OVERDUE",
        "evidence_file_id": u.evidence_file_id,
        "evidence_filename": ev_file.filename if ev_file else None,
        "evidence_file_hash": ev_file.sha256_hash if ev_file else None,
        "evidence_file_url": f"/api/v1/undertakings/{u.id}/evidence/download" if ev_file else None,
        "submission_evidence": ev_file.filename if ev_file else None,
        "verified_by_user_id": u.verified_by,
        "verifier_name": verifier.name if verifier else None,
        "verified_at": u.verified_at.isoformat() if u.verified_at else None,
        "remarks": remarks_text,
        "verification_remarks": remarks_text,
        "created_at": u.due_date.isoformat() if u.due_date else None
    }


# --- Request Schemas ---

class CreateUndertakingRequest(BaseModel):
    application_id: int = Field(..., description="Application to which conditional approval is attached")
    condition_text: str = Field(..., min_length=5, description="Specific condition text / norm requirement")
    due_date: datetime = Field(..., description="Stipulated deadline for compliance evidence submission")


class VerifyUndertakingRequest(BaseModel):
    remarks: str = Field(..., min_length=5, description="Mandatory remarks recording officer verification findings")


class RejectUndertakingRequest(BaseModel):
    remarks: str = Field(..., min_length=5, description="Mandatory speaking reason for rejecting evidence")


class LegacyVerifyRequest(BaseModel):
    status: str = Field("VERIFIED", description="VERIFIED, REJECTED, COMPLIANT, BREACHED")
    remarks: Optional[str] = None


class LegacyFulfillRequest(BaseModel):
    submission_evidence: str = Field(..., min_length=3)


# --- Endpoints ---

@router.get("")
def list_undertakings(
    application_id: Optional[int] = Query(None),
    institution_id: Optional[int] = Query(None),
    region_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List compliance undertakings with role-based scoping, countdowns, and dynamic statuses.
    """
    now = get_system_now(db)
    base_query = db.query(Undertaking)
    query = scope_undertakings_by_role(base_query, current_user, db)

    if application_id:
        query = query.filter(Undertaking.application_id == application_id)
    if institution_id:
        query = query.filter(Undertaking.institution_id == institution_id)
    if region_id and current_user.role in [UserRole.ADMIN.value, UserRole.BUREAU_OFFICER.value]:
        query = query.join(Institution, Undertaking.institution_id == Institution.id).filter(
            Institution.region_id == region_id
        )

    all_items = query.all()
    serialized = [serialize_undertaking(u, now, db) for u in all_items]

    # Status filter
    if status_filter and status_filter != "ALL":
        serialized = [u for u in serialized if u["status"] == status_filter]

    # Search filter
    if search:
        s_low = search.lower()
        serialized = [
            u for u in serialized
            if (u["condition_text"] and s_low in u["condition_text"].lower()) or
               (u["institution_name"] and s_low in u["institution_name"].lower()) or
               (u["application_ref_no"] and s_low in u["application_ref_no"].lower())
        ]

    # Sort: OVERDUE first, then earliest due date
    def sort_key(item):
        st_order = 0 if item["status"] == "OVERDUE" else 1 if item["status"] == "SUBMITTED" else 2 if item["status"] == "PENDING" else 3
        return (st_order, item["due_date"] or "")

    serialized.sort(key=sort_key)
    return serialized


@router.post("")
def create_undertaking(
    req: CreateUndertakingRequest,
    request: Request,
    current_user: User = Depends(require_roles([
        UserRole.REGIONAL_OFFICER.value,
        UserRole.REGIONAL_HEAD.value,
        UserRole.BUREAU_OFFICER.value,
        UserRole.ADMIN.value,
        "COMPETENT_AUTHORITY"
    ])),
    db: Session = Depends(get_db)
):
    """
    Creates an undertaking when approval is granted with conditions.
    Attaches condition text, due date, and links to application and institution.
    """
    now = get_system_now(db)
    application = db.query(Application).filter(Application.id == req.application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail=f"Application #{req.application_id} not found")

    due_naive = req.due_date.replace(tzinfo=None) if req.due_date.tzinfo else req.due_date

    undertaking = Undertaking(
        institution_id=application.institution_id,
        application_id=application.id,
        condition_text=req.condition_text.strip(),
        due_date=due_naive,
        status="PENDING",
        remarks=None
    )
    db.add(undertaking)
    db.commit()
    db.refresh(undertaking)

    inst_name = application.institution.name if application.institution else "Institution"

    # Rule #1: Audit log
    AuditService.log(
        db=db,
        action="UNDERTAKING_CREATED",
        entity_type="undertaking",
        entity_id=str(undertaking.id),
        user=current_user,
        new_value={
            "application_id": req.application_id,
            "institution_id": application.institution_id,
            "condition_text": req.condition_text,
            "due_date": due_naive.isoformat(),
            "status": "PENDING"
        },
        details=f"Compliance condition imposed on application {application.ref_no} ({inst_name}) by {current_user.name} ({current_user.role}).",
        ip_address=get_client_ip(request)
    )

    # Notify Institution
    if application.institution and application.institution.contact_email:
        inst_users = db.query(User).filter(
            User.role == UserRole.INSTITUTION.value,
            User.email == application.institution.contact_email
        ).all()
        for iu in inst_users:
            db.add(Notification(
                user_id=iu.id,
                title=f"Conditional Approval Undertaking Imposed: {application.ref_no}",
                message=f"A statutory undertaking has been attached to your approval: '{req.condition_text[:80]}...'. Compliance evidence must be submitted by {due_naive.strftime('%d %b %Y')}.",
                category="UNDERTAKING_IMPOSED",
                severity="WARNING",
                link="/undertakings"
            ))
        db.commit()

    return serialize_undertaking(undertaking, now, db)


@router.post("/{undertaking_id}/upload-evidence")
async def upload_supporting_evidence(
    undertaking_id: int,
    request: Request,
    file: Optional[UploadFile] = File(None),
    current_user: User = Depends(require_roles([
        UserRole.INSTITUTION.value,
        UserRole.ADMIN.value,
        UserRole.REGIONAL_OFFICER.value
    ])),
    db: Session = Depends(get_db)
):
    """
    Institution endpoint to upload supporting evidence.
    Computes SHA-256 hash, validates size and allowed mime/extension types,
    saves FileRecord, and transitions undertaking status to SUBMITTED.
    """
    now = get_system_now(db)
    undertaking = db.query(Undertaking).filter(Undertaking.id == undertaking_id).first()
    if not undertaking:
        raise HTTPException(status_code=404, detail="Undertaking not found")

    if undertaking.status == "VERIFIED":
        raise HTTPException(status_code=400, detail="Cannot upload evidence for an already verified undertaking")

    # Handle file validation & upload
    if not file:
        raise HTTPException(status_code=400, detail="A supporting evidence file is required (PDF, PNG, JPG)")

    filename = file.filename or "evidence.pdf"
    _, ext = os.path.splitext(filename)
    ext_lower = ext.lower()

    if ext_lower not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file extension '{ext_lower}'. Allowed types: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    # Read and check size
    content = await file.read()
    file_size = len(content)

    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds maximum permissible size of 15MB (uploaded size: {file_size / (1024*1024):.2f} MB)"
        )

    if file_size == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty (0 bytes)")

    # Compute SHA-256
    sha256 = hashlib.sha256(content).hexdigest()

    # Save to disk
    safe_filename = f"{sha256[:12]}_{filename.replace(' ', '_')}"
    saved_path = os.path.join(UPLOAD_DIR, safe_filename)
    with open(saved_path, "wb") as f_out:
        f_out.write(content)

    # Create FileRecord
    file_record = FileRecord(
        filename=filename,
        path=saved_path,
        sha256_hash=sha256,
        uploaded_by=current_user.id,
        uploaded_at=now
    )
    db.add(file_record)
    db.flush()

    old_status = undertaking.status
    undertaking.evidence_file_id = file_record.id
    undertaking.status = "SUBMITTED"

    # Rule #1: Audit log
    AuditService.log(
        db=db,
        action="UNDERTAKING_EVIDENCE_SUBMITTED",
        entity_type="undertaking",
        entity_id=str(undertaking.id),
        user=current_user,
        old_value={"status": old_status},
        new_value={
            "status": "SUBMITTED",
            "file_id": file_record.id,
            "filename": filename,
            "sha256_hash": sha256,
            "size_bytes": file_size
        },
        details=f"Compliance evidence '{filename}' (SHA256: {sha256[:16]}...) uploaded for undertaking #{undertaking.id}.",
        ip_address=get_client_ip(request)
    )

    # Notify Regional Officers
    app = undertaking.application
    inst_name = undertaking.institution.name if undertaking.institution else "Institution"
    ro_users = db.query(User).filter(
        User.role.in_([UserRole.REGIONAL_OFFICER.value, UserRole.ADMIN.value])
    ).all()
    for ro in ro_users:
        if ro.region_id == (app.region_id if app else None) or ro.role == UserRole.ADMIN.value:
            db.add(Notification(
                user_id=ro.id,
                title=f"Compliance Evidence Submitted: {inst_name}",
                message=f"Evidence uploaded for undertaking #{undertaking.id}. Ready for officer verification.",
                category="UNDERTAKING_EVIDENCE_SUBMITTED",
                severity="INFO",
                link="/undertakings"
            ))

    db.commit()
    db.refresh(undertaking)
    return {
        "status": "success",
        "message": "Supporting evidence uploaded successfully with cryptographic SHA-256 seal.",
        "file": {
            "id": file_record.id,
            "filename": filename,
            "sha256_hash": sha256,
            "size_bytes": file_size
        },
        "undertaking": serialize_undertaking(undertaking, now, db)
    }


@router.post("/{undertaking_id}/fulfill")
async def legacy_fulfill_undertaking(
    undertaking_id: int,
    request: Request,
    current_user: User = Depends(require_roles([UserRole.INSTITUTION.value, UserRole.ADMIN.value])),
    db: Session = Depends(get_db)
):
    """
    Backward-compatible JSON fulfill endpoint. If JSON body contains submission evidence text,
    we record a synthetic document file record and mark status as SUBMITTED.
    """
    now = get_system_now(db)
    undertaking = db.query(Undertaking).filter(Undertaking.id == undertaking_id).first()
    if not undertaking:
        raise HTTPException(status_code=404, detail="Undertaking not found")

    try:
        body = await request.json()
    except Exception:
        body = {}

    evidence_text = body.get("submission_evidence", "Supporting document verified and archived.")
    sha256 = hashlib.sha256(evidence_text.encode("utf-8")).hexdigest()

    # Create file record
    sim_filename = f"undertaking_{undertaking_id}_evidence.pdf"
    file_record = FileRecord(
        filename=sim_filename,
        path=os.path.join(UPLOAD_DIR, sim_filename),
        sha256_hash=sha256,
        uploaded_by=current_user.id,
        uploaded_at=now
    )
    db.add(file_record)
    db.flush()

    old_status = undertaking.status
    undertaking.evidence_file_id = file_record.id
    undertaking.status = "SUBMITTED"

    AuditService.log(
        db=db,
        action="UNDERTAKING_EVIDENCE_SUBMITTED",
        entity_type="undertaking",
        entity_id=str(undertaking.id),
        user=current_user,
        old_value={"status": old_status},
        new_value={"status": "SUBMITTED", "file_id": file_record.id, "sha256": sha256},
        details=f"Compliance evidence text submitted for undertaking #{undertaking.id}.",
        ip_address=get_client_ip(request)
    )

    db.commit()
    db.refresh(undertaking)
    return serialize_undertaking(undertaking, now, db)


@router.post("/{undertaking_id}/verify")
def verify_undertaking_evidence(
    undertaking_id: int,
    req: VerifyUndertakingRequest,
    request: Request,
    current_user: User = Depends(require_roles([
        UserRole.REGIONAL_OFFICER.value,
        UserRole.REGIONAL_HEAD.value,
        UserRole.BUREAU_OFFICER.value,
        UserRole.ADMIN.value,
        "COMPETENT_AUTHORITY"
    ])),
    db: Session = Depends(get_db)
):
    """
    Officer endpoint to VERIFY supporting evidence with mandatory remarks.
    Sets status to VERIFIED, records verifier and timestamp, and logs immutable audit.
    """
    now = get_system_now(db)
    undertaking = db.query(Undertaking).filter(Undertaking.id == undertaking_id).first()
    if not undertaking:
        raise HTTPException(status_code=404, detail="Undertaking not found")

    if not req.remarks or len(req.remarks.strip()) < 5:
        raise HTTPException(status_code=400, detail="Mandatory verification remarks required (min 5 characters)")

    old_status = undertaking.status
    undertaking.status = "VERIFIED"
    undertaking.verified_by = current_user.id
    undertaking.verified_at = now
    undertaking.remarks = req.remarks.strip()

    # Rule #1: Audit log
    AuditService.log(
        db=db,
        action="UNDERTAKING_VERIFIED",
        entity_type="undertaking",
        entity_id=str(undertaking.id),
        user=current_user,
        old_value={"status": old_status},
        new_value={
            "status": "VERIFIED",
            "verified_by": current_user.id,
            "verifier_name": current_user.name,
            "remarks": req.remarks.strip()
        },
        details=f"Officer {current_user.name} ({current_user.role}) VERIFIED undertaking #{undertaking.id}. Remarks: {req.remarks.strip()}",
        ip_address=get_client_ip(request)
    )

    # Notify Institution
    if undertaking.institution and undertaking.institution.contact_email:
        inst_users = db.query(User).filter(
            User.role == UserRole.INSTITUTION.value,
            User.email == undertaking.institution.contact_email
        ).all()
        for iu in inst_users:
            db.add(Notification(
                user_id=iu.id,
                title=f"Undertaking Verified: #{undertaking.id}",
                message=f"Compliance evidence for condition '{undertaking.condition_text[:60]}...' has been approved by Regional Directorate. Remarks: {req.remarks.strip()}",
                category="UNDERTAKING_VERIFIED",
                severity="INFO",
                link="/undertakings"
            ))

    db.commit()
    db.refresh(undertaking)
    return {
        "status": "success",
        "message": f"Undertaking #{undertaking.id} successfully verified and marked compliant.",
        "undertaking": serialize_undertaking(undertaking, now, db)
    }


@router.post("/{undertaking_id}/reject")
def reject_undertaking_evidence(
    undertaking_id: int,
    req: RejectUndertakingRequest,
    request: Request,
    current_user: User = Depends(require_roles([
        UserRole.REGIONAL_OFFICER.value,
        UserRole.REGIONAL_HEAD.value,
        UserRole.BUREAU_OFFICER.value,
        UserRole.ADMIN.value,
        "COMPETENT_AUTHORITY"
    ])),
    db: Session = Depends(get_db)
):
    """
    Officer endpoint to REJECT supporting evidence with mandatory speaking remarks.
    Sets status to REJECTED, requiring the institution to submit fresh compliant evidence.
    """
    now = get_system_now(db)
    undertaking = db.query(Undertaking).filter(Undertaking.id == undertaking_id).first()
    if not undertaking:
        raise HTTPException(status_code=404, detail="Undertaking not found")

    if not req.remarks or len(req.remarks.strip()) < 5:
        raise HTTPException(status_code=400, detail="Mandatory rejection remarks / deficiencies required (min 5 characters)")

    old_status = undertaking.status
    undertaking.status = "REJECTED"
    undertaking.verified_by = current_user.id
    undertaking.verified_at = now
    undertaking.remarks = req.remarks.strip()

    # Rule #1: Audit log
    AuditService.log(
        db=db,
        action="UNDERTAKING_REJECTED",
        entity_type="undertaking",
        entity_id=str(undertaking.id),
        user=current_user,
        old_value={"status": old_status},
        new_value={
            "status": "REJECTED",
            "verified_by": current_user.id,
            "verifier_name": current_user.name,
            "remarks": req.remarks.strip()
        },
        details=f"Officer {current_user.name} ({current_user.role}) REJECTED evidence for undertaking #{undertaking.id}. Reason: {req.remarks.strip()}",
        ip_address=get_client_ip(request)
    )

    # Notify Institution with high priority
    if undertaking.institution and undertaking.institution.contact_email:
        inst_users = db.query(User).filter(
            User.role == UserRole.INSTITUTION.value,
            User.email == undertaking.institution.contact_email
        ).all()
        for iu in inst_users:
            db.add(Notification(
                user_id=iu.id,
                title=f"DEFICIENCY: Evidence Rejected for Undertaking #{undertaking.id}",
                message=f"Submitted evidence for condition '{undertaking.condition_text[:60]}...' was rejected. Reason: {req.remarks.strip()}. Please upload compliant rectification evidence.",
                category="UNDERTAKING_REJECTED",
                severity="CRITICAL",
                link="/undertakings"
            ))

    db.commit()
    db.refresh(undertaking)
    return {
        "status": "success",
        "message": f"Undertaking evidence rejected. Deficiency remarks recorded in audit trail.",
        "undertaking": serialize_undertaking(undertaking, now, db)
    }


@router.get("/compliance-scores")
def compute_institutional_compliance_scores(
    region_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Computes Compliance Score per institution:
    Score = (verified on time / total undertakings) * 100
    Role-scoped for Institution, Regional Officer/Head, Bureau, Admin.
    """
    now = get_system_now(db)
    inst_query = db.query(Institution)

    if current_user.role == UserRole.INSTITUTION.value:
        inst_query = inst_query.filter(Institution.contact_email == current_user.email)
    elif current_user.role in [UserRole.REGIONAL_OFFICER.value, UserRole.REGIONAL_HEAD.value]:
        if current_user.region_id:
            inst_query = inst_query.filter(Institution.region_id == current_user.region_id)
    elif region_id and current_user.role in [UserRole.ADMIN.value, UserRole.BUREAU_OFFICER.value]:
        inst_query = inst_query.filter(Institution.region_id == region_id)

    if search:
        s_low = search.lower()
        inst_query = inst_query.filter(
            or_(
                func.lower(Institution.name).contains(s_low),
                func.lower(Institution.state).contains(s_low)
            )
        )

    institutions = inst_query.all()
    results = []

    for inst in institutions:
        unds = db.query(Undertaking).filter(Undertaking.institution_id == inst.id).all()
        total = len(unds)

        verified_on_time = 0
        verified_late = 0
        submitted = 0
        pending = 0
        overdue = 0
        rejected = 0

        for u in unds:
            st = compute_undertaking_status(u, now)
            if st == "VERIFIED":
                if u.verified_at and u.due_date and u.verified_at <= u.due_date:
                    verified_on_time += 1
                else:
                    verified_late += 1
            elif st == "SUBMITTED":
                submitted += 1
            elif st == "REJECTED":
                rejected += 1
            elif st == "OVERDUE":
                overdue += 1
            else:
                pending += 1

        # Compliance score: (verified on time / total)
        if total == 0:
            score = 100.0  # Perfect score if zero statutory deficiencies/conditions
        else:
            score = round((verified_on_time / total) * 100.0, 1)

        # Grade & Color
        if score >= 85.0:
            grade = "EXCELLENT"
            color = "#10B981"  # Emerald
        elif score >= 60.0:
            grade = "MODERATE"
            color = "#F59E0B"  # Amber
        else:
            grade = "CRITICAL"
            color = "#EF4444"  # Red

        results.append({
            "institution_id": inst.id,
            "institution_name": inst.name,
            "institution_type": inst.type,
            "state": inst.state,
            "region_id": inst.region_id,
            "region_name": inst.region.name if inst.region else "Unknown",
            "total_undertakings": total,
            "verified_on_time": verified_on_time,
            "verified_late": verified_late,
            "submitted_pending_review": submitted,
            "pending_active": pending,
            "overdue_breached": overdue,
            "rejected_deficiencies": rejected,
            "compliance_score": score,
            "grade": grade,
            "color": color
        })

    # Sort descending by compliance score
    results.sort(key=lambda item: item["compliance_score"], reverse=True)
    return results


@router.get("/compliance-heat-table")
def get_compliance_heat_table(
    region_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns data for the Compliance Heat Table for Regional and Bureau officers:
    - Institution vs undertakings matrix with colour-coded cells
    - Regional summary aggregates
    """
    scores = compute_institutional_compliance_scores(
        region_id=region_id,
        search=None,
        current_user=current_user,
        db=db
    )

    # Regional aggregates
    regions_map: Dict[str, Dict[str, Any]] = {}
    for item in scores:
        r_name = item["region_name"]
        if r_name not in regions_map:
            regions_map[r_name] = {
                "region_id": item["region_id"],
                "region_name": r_name,
                "institutions_count": 0,
                "total_undertakings": 0,
                "verified_on_time": 0,
                "overdue_count": 0,
                "score_sum": 0.0
            }
        reg = regions_map[r_name]
        reg["institutions_count"] += 1
        reg["total_undertakings"] += item["total_undertakings"]
        reg["verified_on_time"] += item["verified_on_time"]
        reg["overdue_count"] += item["overdue_breached"]
        reg["score_sum"] += item["compliance_score"]

    regional_summary = []
    for r_name, r_data in regions_map.items():
        avg_score = round(r_data["score_sum"] / max(1, r_data["institutions_count"]), 1)
        regional_summary.append({
            "region_id": r_data["region_id"],
            "region_name": r_name,
            "institutions_count": r_data["institutions_count"],
            "total_undertakings": r_data["total_undertakings"],
            "verified_on_time": r_data["verified_on_time"],
            "overdue_count": r_data["overdue_count"],
            "avg_compliance_score": avg_score,
            "grade": "EXCELLENT" if avg_score >= 85 else "MODERATE" if avg_score >= 60 else "CRITICAL",
            "color": "#10B981" if avg_score >= 85 else "#F59E0B" if avg_score >= 60 else "#EF4444"
        })

    regional_summary.sort(key=lambda r: r["avg_compliance_score"], reverse=True)

    # Overall system aggregates
    total_insts = len(scores)
    total_unds = sum(s["total_undertakings"] for s in scores)
    total_on_time = sum(s["verified_on_time"] for s in scores)
    total_overdue = sum(s["overdue_breached"] for s in scores)
    national_avg = round(sum(s["compliance_score"] for s in scores) / max(1, total_insts), 1) if total_insts > 0 else 100.0

    return {
        "summary": {
            "total_institutions": total_insts,
            "total_undertakings": total_unds,
            "verified_on_time": total_on_time,
            "overdue_count": total_overdue,
            "national_average_score": national_avg,
            "grade": "EXCELLENT" if national_avg >= 85 else "MODERATE" if national_avg >= 60 else "CRITICAL"
        },
        "regional_breakdown": regional_summary,
        "institutions": scores
    }


@router.get("/{undertaking_id}/evidence/download")
def download_evidence_file(
    undertaking_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Downloads or previews the uploaded evidence file for an undertaking.
    """
    undertaking = db.query(Undertaking).filter(Undertaking.id == undertaking_id).first()
    if not undertaking:
        raise HTTPException(status_code=404, detail="Undertaking not found")

    if not undertaking.evidence_file:
        raise HTTPException(status_code=404, detail="No evidence file attached to this undertaking")

    file_rec = undertaking.evidence_file
    if os.path.exists(file_rec.path):
        return FileResponse(
            path=file_rec.path,
            filename=file_rec.filename,
            media_type="application/octet-stream"
        )

    # Generate synthetic simulated preview file if path is abstract (e.g. from seed)
    sim_path = os.path.join(UPLOAD_DIR, file_rec.filename)
    if not os.path.exists(sim_path):
        with open(sim_path, "w", encoding="utf-8") as f:
            f.write(f"IntelliApprove AICTE Official Compliance Evidence\n")
            f.write(f"Undertaking ID: {undertaking.id}\n")
            f.write(f"Condition: {undertaking.condition_text}\n")
            f.write(f"SHA-256 Hash: {file_rec.sha256_hash}\n")
            f.write(f"Generated at: {datetime.utcnow().isoformat()}\n")

    return FileResponse(
        path=sim_path,
        filename=file_rec.filename,
        media_type="text/plain"
    )
