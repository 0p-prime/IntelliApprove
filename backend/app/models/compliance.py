"""
Compliance and Deficiency models based on AICTE Approval Process Handbook (APH) norms.
All norms and thresholds are CONFIGURABLE per Rule #3.
"""
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base

class ComplianceNormRule(Base):
    __tablename__ = "compliance_norm_rules"
    
    id = Column(Integer, primary_key=True, index=True)
    rule_code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(150), nullable=False)
    category = Column(String(50), nullable=False)  # Faculty, Land & Infrastructure, Computing, Governance, Statutory
    description = Column(Text, nullable=False)
    standard_value = Column(Float, nullable=False)  # e.g., 15 for 1:15 FSR, 5.0 for Land acres, 0.25 for PC ratio
    threshold_margin_percent = Column(Float, default=10.0)  # allowable margin before critical violation
    unit = Column(String(50), default="Ratio")  # Ratio, Acres, Sqm, Count, Yes/No
    severity = Column(String(50), default="CRITICAL")  # CRITICAL, MAJOR, MINOR
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class DeficiencyRecord(Base):
    __tablename__ = "deficiency_records"
    
    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id", ondelete="CASCADE"), nullable=False)
    rule_id = Column(Integer, ForeignKey("compliance_norm_rules.id", ondelete="SET NULL"), nullable=True)
    rule_code = Column(String(50), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    severity = Column(String(50), default="CRITICAL")  # CRITICAL, MAJOR, MINOR
    flagged_by = Column(String(50), default="SYSTEM")  # SYSTEM, SCRUTINY_OFFICER, EVC_INSPECTOR
    is_rectified = Column(Boolean, default=False)
    rectification_proof = Column(Text, nullable=True)
    rectified_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    application = relationship("Application", back_populates="deficiencies")
    rule = relationship("ComplianceNormRule")
