"""
Audit Service: Centralized execution of Non-Negotiable Rule #1.
Guarantees every state change writes an immutable audit_logs record with cryptographic hash chain.
Provides SHA-256 tamper-evident integrity verification.
"""
import json
import hashlib
import threading
import time
from typing import Optional, Any, Dict, List
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.entities import AuditLog
from app.models.entities import User

GENESIS_HASH = hashlib.sha256("INTELLIAPPROVE_AICTE_GENESIS_STATE_2026".encode("utf-8")).hexdigest()
_AUDIT_LOCK = threading.Lock()

class AuditService:
    @staticmethod
    def canonical_json(data: Dict[str, Any]) -> str:
        """
        Produces deterministic canonical JSON representation of an audit row:
        sorted keys, compact separators without whitespace, deterministic string values.
        """
        return json.dumps(data, sort_keys=True, separators=(',', ':'), default=str)

    @staticmethod
    def compute_hash(
        prev_hash: str,
        actor_id: Any = None,
        action: str = "",
        entity_type: str = "",
        entity_id: str = "0",
        timestamp_str: str = "",
        old_value: Optional[str] = None,
        new_value: Optional[str] = None,
        reason: Optional[str] = None,
        ip: str = "127.0.0.1",
        row_dict: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Computes SHA256(prev_hash + canonical_json(row)).
        Accepts explicit row_dict or individual kwargs for flexibility and backward compatibility.
        """
        if row_dict is not None:
            c_json = AuditService.canonical_json(row_dict)
        else:
            data = {
                "action": action,
                "actor_id": actor_id,
                "entity_id": str(entity_id),
                "entity_type": entity_type,
                "ip": ip,
                "new_value": new_value,
                "old_value": old_value,
                "reason": reason,
                "timestamp": timestamp_str
            }
            c_json = AuditService.canonical_json(data)

        payload = f"{prev_hash}{c_json}"
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    @staticmethod
    def log(
        db: Optional[Session] = None,
        action: str = "STATE_CHANGE",
        entity_type: str = "system",
        entity_id: Any = "0",
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
        Participates in caller's session to prevent SQLite file lock collisions.
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

        with _AUDIT_LOCK:
            target_db = db
            is_own_session = False
            if target_db is None:
                target_db = SessionLocal()
                is_own_session = True

            try:
                last_log = target_db.query(AuditLog).order_by(AuditLog.id.desc()).first()
                prev_hash = last_log.hash if last_log and last_log.hash else GENESIS_HASH

                now_ts = datetime.now(timezone.utc).replace(tzinfo=None)
                ts_str = now_ts.isoformat()
                old_serialized = serialize(old_value)
                new_serialized = serialize(new_value)

                row_dict = {
                    "action": action,
                    "actor_id": user_id,
                    "entity_id": str(entity_id),
                    "entity_type": entity_type,
                    "ip": ip_address,
                    "new_value": new_serialized,
                    "old_value": old_serialized,
                    "reason": details,
                    "timestamp": ts_str
                }
                curr_hash = AuditService.compute_hash(prev_hash, row_dict=row_dict)

                audit_entry = AuditLog(
                    actor_id=user_id,
                    action=action,
                    entity_type=entity_type,
                    entity_id=str(entity_id),
                    old_value_json=old_serialized,
                    new_value_json=new_serialized,
                    reason=details,
                    ip=ip_address,
                    timestamp=now_ts,
                    prev_hash=prev_hash,
                    hash=curr_hash
                )
                
                target_db.add(audit_entry)
                if is_own_session:
                    target_db.commit()
                    target_db.refresh(audit_entry)
                else:
                    target_db.flush()
                return audit_entry
            finally:
                if is_own_session:
                    target_db.close()

    @staticmethod
    def verify_chain(db: Session) -> Dict[str, Any]:
        """
        Cryptographically verifies the entire SHA-256 audit hash chain:
        1. Checks prev_hash linkage back to GENESIS_HASH.
        2. Recomputes SHA-256(prev_hash + canonical_json(row)) to detect any content mutation.
        Returns detailed integrity diagnostics, first broken row if tampered,
        and latency benchmark.
        """
        start_time = time.perf_counter()
        logs = db.query(AuditLog).order_by(AuditLog.id.asc()).all()
        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

        if not logs:
            return {
                "is_valid": True,
                "total_blocks": 0,
                "tampered_block_id": None,
                "first_broken_row": None,
                "genesis_hash": GENESIS_HASH,
                "head_hash": None,
                "broken_links_count": 0,
                "broken_blocks": [],
                "verification_duration_ms": elapsed_ms,
                "verified_at": datetime.now(timezone.utc).isoformat(),
                "algorithm": "SHA-256 Merkle-Lineage (prev_hash + canonical_json)",
                "status": "EMPTY_CHAIN"
            }

        expected_prev = GENESIS_HASH
        broken_blocks = []

        for log in logs:
            ts_str = log.timestamp.replace(tzinfo=None).isoformat() if log.timestamp else None
            row_dict = {
                "action": log.action,
                "actor_id": log.actor_id,
                "entity_id": str(log.entity_id),
                "entity_type": log.entity_type,
                "ip": log.ip,
                "new_value": log.new_value_json,
                "old_value": log.old_value_json,
                "reason": log.reason,
                "timestamp": ts_str
            }
            recomputed_hash = AuditService.compute_hash(log.prev_hash, row_dict=row_dict)

            link_intact = (log.prev_hash == expected_prev)
            content_intact = (log.hash == recomputed_hash)

            if not link_intact or not content_intact:
                broken_blocks.append({
                    "block_id": log.id,
                    "action": log.action,
                    "actual_prev_hash": log.prev_hash,
                    "expected_prev_hash": expected_prev,
                    "actual_hash": log.hash,
                    "expected_hash": recomputed_hash,
                    "link_intact": link_intact,
                    "content_intact": content_intact,
                    "tamper_type": "CHAIN_DISCONNECT" if not link_intact else "CONTENT_MUTATION",
                    "timestamp": ts_str
                })
            expected_prev = log.hash

        is_valid = len(broken_blocks) == 0
        head_hash = logs[-1].hash if logs else None
        first_broken = broken_blocks[0] if broken_blocks else None

        return {
            "is_valid": is_valid,
            "total_blocks": len(logs),
            "tampered_block_id": first_broken["block_id"] if first_broken else None,
            "first_broken_row": first_broken,
            "broken_links_count": len(broken_blocks),
            "broken_blocks": broken_blocks[:10],
            "genesis_hash": GENESIS_HASH,
            "head_hash": head_hash,
            "verification_duration_ms": elapsed_ms,
            "verified_at": datetime.now(timezone.utc).isoformat(),
            "algorithm": "SHA-256 Merkle-Lineage (prev_hash + canonical_json)",
            "status": "CHAIN_INTEGRITY_VERIFIED" if is_valid else "TAMPER_DETECTED"
        }

    @staticmethod
    def recompute_chain(db: Session) -> int:
        """
        Recalculates continuous cryptographic chain linkage across all logs:
        prev_hash = prev
        hash = SHA256(prev_hash + canonical_json(row))
        """
        with _AUDIT_LOCK:
            logs = db.query(AuditLog).order_by(AuditLog.id.asc()).all()
            prev = GENESIS_HASH
            for log in logs:
                log.prev_hash = prev
                ts_str = log.timestamp.replace(tzinfo=None).isoformat() if log.timestamp else datetime.now(timezone.utc).replace(tzinfo=None).isoformat()
                row_dict = {
                    "action": log.action,
                    "actor_id": log.actor_id,
                    "entity_id": str(log.entity_id),
                    "entity_type": log.entity_type,
                    "ip": log.ip,
                    "new_value": log.new_value_json,
                    "old_value": log.old_value_json,
                    "reason": log.reason,
                    "timestamp": ts_str
                }
                log.hash = AuditService.compute_hash(prev, row_dict=row_dict)
                prev = log.hash
            db.commit()
            return len(logs)
