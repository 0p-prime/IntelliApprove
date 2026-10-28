"""
Compliance & Deficiency Management Endpoints.
Rule #1: State changes write audit_logs entries.
Rule #2: Mandatory human oversight (never auto-approves or auto-rejects).
Rule #3: Rules loaded dynamically from DB.
"""
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.core.deps import get_current_user, get_client_ip, require_roles
from app.models.entities import User, UserRole, Application
from app.models.compliance import ComplianceNormRule, DeficiencyRecord
from app.schemas.all_schemas import ComplianceNormRuleOut, DeficiencyRecordOut, DeficiencyRectifyRequest
from app.services.compliance_service import ComplianceService
from app.services.audit_service import AuditService

router = APIRouter()

class DeficiencyVerifyRequest(BaseModel):
    is_verified: bool
    remarks: str

@router.get("/rules", response_model=List[ComplianceNormRuleOut])
def list_compliance_rules(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all AICTE Approval Process Handbook norm rules configured in DB."""
    return db.query(ComplianceNormRule).filter(ComplianceNormRule.is_active == True).all()

@router.get("/rules/{rule_id}", response_model=ComplianceNormRuleOut)
def get_compliance_rule(
    rule_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve details of a specific AICTE APH norm rule."""
    rule = db.query(ComplianceNormRule).filter(ComplianceNormRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Compliance norm rule not found")
    return rule

@router.post("/{application_id}/evaluate")
def evaluate_application_compliance(
    application_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Triggers automated AICTE APH norms evaluation.
    Updates application deficiency count and compliance score.
    Writes audit log (Rule #1). Never auto-approves or auto-rejects (Rule #2).
    """
    result = ComplianceService.run_compliance_evaluation(
        db=db,
        application_id=application_id,
        actor_user=current_user,
        ip_address=get_client_ip(request)
    )
    return result

@router.get("/{application_id}/breakdown")
def get_application_compliance_breakdown(
    application_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve comprehensive compliance checklist and active deficiencies for an application.
    """
    return ComplianceService.get_compliance_breakdown(db=db, application_id=application_id)

@router.post("/deficiencies/{deficiency_id}/rectify", response_model=DeficiencyRecordOut)
def rectify_deficiency(
    deficiency_id: int,
    req: DeficiencyRectifyRequest,
    request: Request,
    current_user: User = Depends(require_roles([UserRole.INSTITUTION.value, UserRole.ADMIN.value])),
    db: Session = Depends(get_db)
):
    """Submit rectification proof for a flagged deficiency."""
    record = db.query(DeficiencyRecord).filter(DeficiencyRecord.id == deficiency_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Deficiency record not found")

    old_rectified = record.is_rectified
    record.is_rectified = True
    record.rectification_proof = req.rectification_proof
    record.rectified_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(record)

    # Rule #1: Audit log
    AuditService.log(
        db=db,
        action="DEFICIENCY_RECTIFICATION_SUBMITTED",
        entity_type="deficiency",
        entity_id=str(record.id),
        user=current_user,
        old_value={"is_rectified": old_rectified},
        new_value={"is_rectified": True, "proof": req.rectification_proof},
        details=f"Institution submitted deficiency rectification for '{record.title}' on application #{record.application_id}.",
        ip_address=get_client_ip(request)
    )

    return record

@router.post("/deficiencies/{deficiency_id}/verify")
def verify_deficiency_rectification(
    deficiency_id: int,
    req: DeficiencyVerifyRequest,
    request: Request,
    current_user: User = Depends(require_roles([UserRole.REGIONAL_OFFICER.value, UserRole.REGIONAL_HEAD.value, UserRole.BUREAU_OFFICER.value, UserRole.ADMIN.value])),
    db: Session = Depends(get_db)
):
    """
    Scrutiny Officer verifies or rejects the submitted rectification proof.
    """
    record = db.query(DeficiencyRecord).filter(DeficiencyRecord.id == deficiency_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Deficiency record not found")

    if not req.remarks or len(req.remarks.strip()) < 5:
        raise HTTPException(status_code=400, detail="Mandatory scrutiny verification remarks required (min 5 characters)")

    old_status = record.is_rectified
    record.is_rectified = req.is_verified
    if not req.is_verified:
        # If rejected, append remarks to description
        record.description = f"{record.description} [Scrutiny Rejected: {req.remarks.strip()}]"
    db.commit()

    # Rule #1: Audit log
    AuditService.log(
        db=db,
        action="DEFICIENCY_RECTIFICATION_VERIFIED" if req.is_verified else "DEFICIENCY_RECTIFICATION_REJECTED",
        entity_type="deficiency",
        entity_id=str(record.id),
        user=current_user,
        old_value={"is_rectified": old_status},
        new_value={"is_rectified": req.is_verified, "remarks": req.remarks},
        details=f"Deficiency #{record.id} rectification {'verified compliant' if req.is_verified else 'rejected'} by {current_user.full_name}: {req.remarks.strip()}",
        ip_address=get_client_ip(request)
    )

    return {
        "id": record.id,
        "application_id": record.application_id,
        "is_rectified": record.is_rectified,
        "remarks": req.remarks,
        "status": "VERIFIED_COMPLIANT" if req.is_verified else "REJECTED_DEFICIENT"
    }

@router.get("/deficiencies/summary")
def get_deficiencies_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Aggregated statistical summary of compliance deficiencies across institutions.
    """
    total = db.query(DeficiencyRecord).count()
    rectified = db.query(DeficiencyRecord).filter(DeficiencyRecord.is_rectified == True).count()
    pending = total - rectified

    critical_count = db.query(DeficiencyRecord).filter(DeficiencyRecord.severity == "CRITICAL", DeficiencyRecord.is_rectified == False).count()
    major_count = db.query(DeficiencyRecord).filter(DeficiencyRecord.severity == "MAJOR", DeficiencyRecord.is_rectified == False).count()
    minor_count = db.query(DeficiencyRecord).filter(DeficiencyRecord.severity == "MINOR", DeficiencyRecord.is_rectified == False).count()

    # Breakdown by rule code
    by_rule = db.query(
        DeficiencyRecord.rule_code,
        func.count(DeficiencyRecord.id).label("count")
    ).group_by(DeficiencyRecord.rule_code).all()

    return {
        "total_deficiencies": total,
        "rectified_count": rectified,
        "pending_count": pending,
        "rectification_rate": round((rectified / max(total, 1)) * 100, 1),
        "by_severity": {
            "CRITICAL": critical_count,
            "MAJOR": major_count,
            "MINOR": minor_count
        },
        "by_rule": [{"rule_code": r[0], "count": r[1]} for r in by_rule]
    }
