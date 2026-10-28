"""
Undertaking models for compliance commitments and post-approval tracking.
Every state change writes an audit_logs entry per Rule #1.
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base

class Undertaking(Base):
    __tablename__ = "undertakings"
    
    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String(100), default="Faculty & Infrastructure")  # Faculty, Lab Equipment, Building NOC, Statutory
    due_date = Column(DateTime, nullable=False)
    status = Column(String(50), default="PENDING")  # PENDING, SUBMITTED_FOR_REVIEW, COMPLIANT, BREACHED
    submission_evidence = Column(Text, nullable=True)
    submitted_at = Column(DateTime, nullable=True)
    verified_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    verification_remarks = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    application = relationship("Application", back_populates="undertakings")
    verified_by = relationship("User")
