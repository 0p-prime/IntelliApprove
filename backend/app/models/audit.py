"""
AuditLog Model: Core backbone for Non-Negotiable Rule #1.
Every state change (stage, undertaking, document, alert, escalation, login, config)
MUST write an audit_logs entry.
"""
from sqlalchemy import Column, Integer, String, DateTime, Text
from datetime import datetime, timezone
from app.core.database import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True, nullable=False)
    user_id = Column(Integer, nullable=True, index=True)
    user_email = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False)
    action = Column(String(100), index=True, nullable=False)
    entity_type = Column(String(50), index=True, nullable=False)  # application, undertaking, document, alert, config, user
    entity_id = Column(String(100), index=True, nullable=False)
    old_value = Column(Text, nullable=True)  # JSON or text snapshot before transition
    new_value = Column(Text, nullable=True)  # JSON or text snapshot after transition
    details = Column(Text, nullable=True)
    ip_address = Column(String(50), default="127.0.0.1")
