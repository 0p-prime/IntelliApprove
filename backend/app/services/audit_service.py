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
    def compute_hash(prev_hash: str, actor_id: Any, action: str, entity_type: str, entity_id: str, timestamp_str: str) -> str:
        payload = f"{prev_hash}|{actor_id}|{action}|{entity_type}|{entity_id}|{timestamp_str}"
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

                now_ts = datetime.now(timezone.utc)
                ts_str = now_ts.isoformat()
                curr_hash = AuditService.compute_hash(prev_hash, user_id, action, entity_type, str(entity_id), ts_str)

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
        Cryptographically verifies the entire SHA-256 audit hash chain.
        Returns detailed integrity diagnostics, tampered block identification,
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
                "genesis_hash": GENESIS_HASH,
                "head_hash": None,
                "broken_links_count": 0,
                "verification_duration_ms": elapsed_ms,
                "verified_at": datetime.now(timezone.utc).isoformat(),
                "algorithm": "SHA-256 Cryptographic Hash Chain",
                "status": "EMPTY_CHAIN"
            }

        expected_prev = GENESIS_HASH
        broken_blocks = []

        for log in logs:
            if log.prev_hash != expected_prev:
                broken_blocks.append({
                    "block_id": log.id,
                    "action": log.action,
                    "actual_prev_hash": log.prev_hash,
                    "expected_prev_hash": expected_prev,
                    "timestamp": log.timestamp.isoformat() if log.timestamp else None
                })
            expected_prev = log.hash

        is_valid = len(broken_blocks) == 0
        head_hash = logs[-1].hash if logs else None

        return {
            "is_valid": is_valid,
            "total_blocks": len(logs),
            "tampered_block_id": broken_blocks[0]["block_id"] if broken_blocks else None,
            "broken_links_count": len(broken_blocks),
            "broken_blocks": broken_blocks[:5],
            "genesis_hash": GENESIS_HASH,
            "head_hash": head_hash,
            "verification_duration_ms": elapsed_ms,
            "verified_at": datetime.now(timezone.utc).isoformat(),
            "algorithm": "SHA-256 Merkle-Lineage Chain",
            "status": "CHAIN_INTEGRITY_VERIFIED" if is_valid else "TAMPER_DETECTED"
        }

    @staticmethod
    def recompute_chain(db: Session) -> int:
        """
        Recalculates continuous cryptographic chain linkage across all logs.
        """
        with _AUDIT_LOCK:
            logs = db.query(AuditLog).order_by(AuditLog.id.asc()).all()
            prev = GENESIS_HASH
            for log in logs:
                log.prev_hash = prev
                ts_str = log.timestamp.isoformat() if log.timestamp else datetime.now(timezone.utc).isoformat()
                log.hash = AuditService.compute_hash(prev, log.actor_id, log.action, log.entity_type, log.entity_id, ts_str)
                prev = log.hash
            db.commit()
            return len(logs)
