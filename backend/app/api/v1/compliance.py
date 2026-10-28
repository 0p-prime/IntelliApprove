"""
Compliance & Deficiency Management Endpoints.
Rule #1: State changes write audit_logs entries.
Rule #3: Rules loaded dynamically from DB.
"""
from typing import List, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_user, get_client_ip, require_roles
from app.models.user import User, UserRole
from app.models.compliance import ComplianceNormRule, DeficiencyRecord
from app.schemas.all_schemas import ComplianceNormRuleOut, DeficiencyRecordOut, DeficiencyRectifyRequest
from app.services.compliance_service import ComplianceService
from app.services.audit_service import AuditService

router = APIRouter()

@router.get("/rules", response_model=List[ComplianceNormRuleOut])
def list_compliance_rules(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all AICTE Approval Process Handbook norm rules configured in DB."""
    return db.query(ComplianceNormRule).filter(ComplianceNormRule.is_active == True).all()

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
