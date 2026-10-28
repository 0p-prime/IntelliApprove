"""
Alert and Escalation Event models for proactive compliance & SLA management.
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base

class Alert(Base):
    __tablename__ = "alerts"
    
    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id", ondelete="CASCADE"), nullable=True)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    severity = Column(String(50), default="INFO")  # INFO, WARNING, CRITICAL, ESCALATION
    recipient_role = Column(String(50), nullable=True)  # All users in role or specific user
    recipient_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    application = relationship("Application")
    recipient = relationship("User")

class EscalationEvent(Base):
    __tablename__ = "escalation_events"
    
    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id", ondelete="CASCADE"), nullable=False)
    stage_id = Column(Integer, ForeignKey("stage_configs.id"), nullable=False)
    from_role = Column(String(50), nullable=False)
    escalated_to_role = Column(String(50), nullable=False)
    escalation_reason = Column(String(255), nullable=False)
    escalation_level = Column(Integer, default=1)
    resolved = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    application = relationship("Application")
    stage = relationship("StageConfig")
