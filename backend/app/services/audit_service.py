"""
Audit Service: Centralized execution of Non-Negotiable Rule #1.
Guarantees every state change writes an audit_logs record with complete actor context.
"""
import json
from typing import Optional, Any
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.audit import AuditLog
from app.models.user import User

class AuditService:
    @staticmethod
    def log(
        db: Session,
        action: str,
        entity_type: str,
        entity_id: Any,
        user: Optional[User] = None,
        old_value: Optional[Any] = None,
        new_value: Optional[Any] = None,
        details: Optional[str] = None,
        ip_address: str = "127.0.0.1",
        system_actor_name: Optional[str] = None
    ) -> AuditLog:
        """
        Record an immutable audit entry in the database.
        Can be called with user context or automated system worker context.
        """
        def serialize(val: Any) -> Optional[str]:
            if val is None:
                return None
            if isinstance(val, (dict, list)):
                try:
                    return json.dumps(val, default=str)
                except Exception:
                    return str(val)
            return str(val)

        user_id = user.id if user else None
        user_email = user.email if user else (system_actor_name or "SYSTEM_SCHEDULER")
        role = user.role if user else "SYSTEM"

        audit_entry = AuditLog(
            timestamp=datetime.now(timezone.utc),
            user_id=user_id,
            user_email=user_email,
            role=role,
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id),
            old_value=serialize(old_value),
            new_value=serialize(new_value),
            details=details,
            ip_address=ip_address
        )
        
        db.add(audit_entry)
        db.commit()
        db.refresh(audit_entry)
        return audit_entry
