"""
Application models: Main application, academic programs, documents, and stage history.
Enforces Rule #2: human_oversight_required flag and tracking competent authority decisions.
"""
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base

class Application(Base):
    __tablename__ = "applications"
    
    id = Column(Integer, primary_key=True, index=True)
    application_number = Column(String(50), unique=True, index=True, nullable=False)
    institution_id = Column(Integer, ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False)
    academic_year = Column(String(20), default="2026-2027", nullable=False)
    application_type = Column(String(100), default="Extension of Approval (EoA)", nullable=False)
    
    # Workflow Stage & Status
    current_stage_id = Column(Integer, ForeignKey("stage_configs.id"), nullable=False)
    status = Column(String(50), default="DRAFT", nullable=False)
    
    # SLA & Escalation
    submission_date = Column(DateTime, nullable=True)
    stage_entered_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    sla_deadline = Column(DateTime, nullable=True)
    is_escalated = Column(Boolean, default=False)
    escalation_level = Column(Integer, default=0)
    
    # Compliance & Scrutiny
    deficiency_count = Column(Integer, default=0)
    compliance_score = Column(Float, default=100.0)
    scrutiny_remarks = Column(Text, nullable=True)
    evc_inspection_date = Column(DateTime, nullable=True)
    evc_recommendation = Column(String(50), nullable=True)  # RECOMMENDED, DEFICIENT, NEEDS_HEARING
    evc_remarks = Column(Text, nullable=True)
    
    # Rule #2: System NEVER auto-approves or auto-rejects
    human_oversight_required = Column(Boolean, default=True, nullable=False)
    decision_verdict = Column(String(50), nullable=True)  # APPROVED, APPROVED_WITH_CONDITIONS, REJECTED
    decision_notes = Column(Text, nullable=True)
    decision_date = Column(DateTime, nullable=True)
    decision_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    approval_letter_number = Column(String(100), nullable=True)
    digital_signature_hash = Column(String(255), nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    institution = relationship("Institution", back_populates="applications")
    current_stage = relationship("StageConfig")
    decision_maker = relationship("User", foreign_keys=[decision_by_user_id])
    programs = relationship("AcademicProgram", back_populates="application", cascade="all, delete-orphan")
    documents = relationship("ApplicationDocument", back_populates="application", cascade="all, delete-orphan")
    deficiencies = relationship("DeficiencyRecord", back_populates="application", cascade="all, delete-orphan")
    undertakings = relationship("Undertaking", back_populates="application", cascade="all, delete-orphan")
    stage_history = relationship("ApplicationStageHistory", back_populates="application", cascade="all, delete-orphan")

class AcademicProgram(Base):
    __tablename__ = "academic_programs"
    
    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id", ondelete="CASCADE"), nullable=False)
    program_name = Column(String(200), nullable=False)
    level = Column(String(50), default="Undergraduate")  # Undergraduate, Postgraduate, Diploma
    approved_intake_prev_year = Column(Integer, default=60)
    requested_intake = Column(Integer, default=60)
    faculty_count = Column(Integer, default=4)
    total_enrolled = Column(Integer, default=240)
    cadre_ratio = Column(String(50), default="1:2:6")  # Professor:Associate:Assistant
    
    application = relationship("Application", back_populates="programs")

class ApplicationDocument(Base):
    __tablename__ = "application_documents"
    
    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id", ondelete="CASCADE"), nullable=False)
    doc_type = Column(String(100), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_url = Column(String(500), nullable=False)
    file_size_kb = Column(Integer, default=512)
    uploaded_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    status = Column(String(50), default="PENDING_VERIFICATION")  # PENDING_VERIFICATION, VERIFIED_COMPLIANT, DEFICIENT_REJECTED
    verification_remarks = Column(Text, nullable=True)
    verified_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    
    application = relationship("Application", back_populates="documents")
    verified_by = relationship("User")

class ApplicationStageHistory(Base):
    __tablename__ = "application_stage_history"
    
    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id", ondelete="CASCADE"), nullable=False)
    from_stage_id = Column(Integer, ForeignKey("stage_configs.id"), nullable=True)
    to_stage_id = Column(Integer, ForeignKey("stage_configs.id"), nullable=False)
    action_taken = Column(String(100), nullable=False)
    transitioned_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    remarks = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    application = relationship("Application", back_populates="stage_history")
    from_stage = relationship("StageConfig", foreign_keys=[from_stage_id])
    to_stage = relationship("StageConfig", foreign_keys=[to_stage_id])
    transitioned_by = relationship("User", foreign_keys=[transitioned_by_user_id])
