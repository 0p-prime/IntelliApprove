"""
Audit Logs Explorer Endpoints.
Rule #1: Every state change writes an audit_logs entry.
Provides transparency, vigilance trail, and SHA-256 tamper-evident history.
"""
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_user, require_roles, get_client_ip
from app.models.entities import User, UserRole, AuditLog
from app.schemas.all_schemas import AuditLogOut
from app.services.audit_service import AuditService

router = APIRouter()

@router.get("", response_model=List[AuditLogOut])
def query_audit_logs(
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    user_email: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(100, le=500),
    current_user: User = Depends(require_roles([
        UserRole.ADMIN.value,
        UserRole.BUREAU_OFFICER.value,
        UserRole.REGIONAL_HEAD.value,
        UserRole.REGIONAL_OFFICER.value
    ])),
    db: Session = Depends(get_db)
):
    """
    Search and inspect audit logs with granular filters.
    Available to auditors, vigilance officers, administrators, and regional officers.
    """
    query = db.query(AuditLog)

    if action:
        query = query.filter(AuditLog.action == action)
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if entity_id:
        query = query.filter(AuditLog.entity_id == entity_id)
    if search:
        query = query.filter(
            (AuditLog.reason.ilike(f"%{search}%")) |
            (AuditLog.action.ilike(f"%{search}%")) |
            (AuditLog.entity_id.ilike(f"%{search}%")) |
            (AuditLog.hash.ilike(f"%{search}%")) |
            (AuditLog.prev_hash.ilike(f"%{search}%"))
        )

    return query.order_by(AuditLog.id.desc()).limit(limit).all()

@router.get("/verify-chain")
def verify_audit_hash_chain(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Cryptographically verifies the SHA-256 tamper-evident hash chain across all audit logs.
    Verifies that every block points to the previous block's SHA-256 digest back to GENESIS.
    """
    return AuditService.verify_chain(db=db)

@router.post("/recompute-chain")
def recompute_audit_chain(
    request: Request,
    current_user: User = Depends(require_roles([UserRole.ADMIN.value])),
    db: Session = Depends(get_db)
):
    """
    Administrative endpoint to reconcile and re-hash the cryptographic chain across all blocks.
    Strictly restricted to system administrators.
    """
    count = AuditService.recompute_chain(db=db)
    verification = AuditService.verify_chain(db=db)

    # Log the chain recomputation event
    AuditService.log(
        db=db,
        action="AUDIT_CHAIN_RECOMPUTED",
        entity_type="audit_trail",
        entity_id=str(count),
        user=current_user,
        old_value=None,
        new_value={"total_blocks": count, "head_hash": verification["head_hash"]},
        details=f"System administrator {current_user.full_name} recomputed SHA-256 chain across {count} audit records.",
        ip_address=get_client_ip(request)
    )

    return {
        "message": f"Successfully recomputed SHA-256 chain across {count} blocks.",
        "verification": verification
    }

@router.get("/export")
def export_audit_trail_certificate(
    limit: int = Query(500, le=2000),
    current_user: User = Depends(require_roles([UserRole.ADMIN.value, UserRole.BUREAU_OFFICER.value, UserRole.REGIONAL_HEAD.value])),
    db: Session = Depends(get_db)
):
    """
    Generates a cryptographically certified export of the audit trail for vigilance inspections.
    """
    verification = AuditService.verify_chain(db=db)
    logs = db.query(AuditLog).order_by(AuditLog.id.desc()).limit(limit).all()

    return {
        "export_metadata": {
            "title": "All India Council for Technical Education (AICTE) - Tamper-Evident State Audit Trail",
            "statutory_authority": "Approval Bureau, AICTE New Delhi",
            "exported_by": current_user.email,
            "exported_at": verification["verified_at"],
            "verification_status": verification["status"],
            "is_cryptographically_valid": verification["is_valid"],
            "genesis_hash": verification["genesis_hash"],
            "head_hash": verification["head_hash"],
            "total_blocks_in_db": verification["total_blocks"],
            "exported_blocks_count": len(logs),
            "algorithm": verification["algorithm"]
        },
        "blocks": [
            {
                "id": log.id,
                "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                "actor_id": log.actor_id,
                "actor_email": log.user_email,
                "role": log.role,
                "action": log.action,
                "entity_type": log.entity_type,
                "entity_id": log.entity_id,
                "details": log.details,
                "ip_address": log.ip_address,
                "prev_hash": log.prev_hash,
                "hash": log.hash
            }
            for log in logs
        ]
    }
