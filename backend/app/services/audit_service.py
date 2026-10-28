"""
Audit Service: Centralized execution of Non-Negotiable Rule #1.
Guarantees every state change writes an audit_logs record with cryptographic hash chain.
"""
import json
import hashlib
from typing import Optional, Any
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.entities import AuditLog
from app.models.entities import User

GENESIS_HASH = hashlib.sha256("INTELLIAPPROVE_AICTE_GENESIS_STATE_2026".encode("utf-8")).hexdigest()

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
        Maintains a cryptographic SHA-256 tamper-evident hash chain.
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
        
        # Calculate prev_hash
        last_log = db.query(AuditLog).order_by(AuditLog.id.desc()).first()
        prev_hash = last_log.hash if last_log and last_log.hash else GENESIS_HASH

        now_ts = datetime.now(timezone.utc)
        payload = f"{prev_hash}|{user_id}|{action}|{entity_type}|{entity_id}|{now_ts.isoformat()}"
        curr_hash = hashlib.sha256(payload.encode("utf-8")).hexdigest()

        audit_entry = AuditLog(
            actor_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id),
            old_value_json=serialize(old_value),
            new_value_json=serialize(new_value),
            reason=details,
            ip=ip_address,
            timestamp=now_ts,
            prev_hash=prev_hash,
            hash=curr_hash
        )
        
        db.add(audit_entry)
        db.commit()
        db.refresh(audit_entry)
        return audit_entry
