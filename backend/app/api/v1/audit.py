"""
Audit Logs Explorer Endpoints.
Rule #1: Every state change writes an audit_logs entry.
Provides transparency, vigilance trail, and tamper-evident history.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.user import User, UserRole
from app.models.audit import AuditLog
from app.schemas.all_schemas import AuditLogOut

router = APIRouter()

@router.get("", response_model=List[AuditLogOut])
def query_audit_logs(
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    user_email: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(100, le=500),
    current_user: User = Depends(require_roles([UserRole.ADMIN.value, UserRole.BUREAU_OFFICER.value, UserRole.REGIONAL_HEAD.value])),
    db: Session = Depends(get_db)
):
    """
    Search and inspect audit logs with granular filters.
    Available to auditors, vigilance officers, administrators, and committee members.
    """
    query = db.query(AuditLog)

    if action:
        query = query.filter(AuditLog.action == action)
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if entity_id:
        query = query.filter(AuditLog.entity_id == entity_id)
    if user_email:
        query = query.filter(AuditLog.user_email.ilike(f"%{user_email}%"))
    if search:
        query = query.filter(
            (AuditLog.details.ilike(f"%{search}%")) |
            (AuditLog.action.ilike(f"%{search}%")) |
            (AuditLog.entity_id.ilike(f"%{search}%"))
        )

    return query.order_by(AuditLog.timestamp.desc()).limit(limit).all()
