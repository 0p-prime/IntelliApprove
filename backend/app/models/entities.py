"""
SQLAlchemy database models for IntelliApprove.
Implements the 15 core tables specified in the AICTE approval workflow architecture.
"""
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Boolean,
    DateTime,
    ForeignKey,
    Text,
    Enum as SQLEnum,
    Index
)
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum
from app.core.database import Base

class UserRole(str, enum.Enum):
    INSTITUTION = "INSTITUTION"
    REGIONAL_OFFICER = "REGIONAL_OFFICER"
    REGIONAL_HEAD = "REGIONAL_HEAD"
    BUREAU_OFFICER = "BUREAU_OFFICER"
    EVC_MEMBER = "EVC_MEMBER"
    ADMIN = "ADMIN"

    # Compatibility mappings
    SCRUTINY_OFFICER = "REGIONAL_OFFICER"
    EVC_INSPECTOR = "EVC_MEMBER"
    COMPETENT_AUTHORITY = "BUREAU_OFFICER"

class Region(Base):
    __tablename__ = "regions"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    
    # Relationships
    users = relationship("User", back_populates="region")
    institutions = relationship("Institution", back_populates="region")
    applications = relationship("Application", back_populates="region")

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, index=True)
    region_id = Column(Integer, ForeignKey("regions.id", ondelete="SET NULL"), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Relationships
    region = relationship("Region", back_populates="users")
    assigned_applications = relationship("Application", foreign_keys="Application.assigned_officer_id", back_populates="assigned_officer")
    notifications = relationship("Notification", back_populates="user")
    uploaded_files = relationship("FileRecord", back_populates="uploader")

    @property
    def hashed_password(self) -> str:
        return self.password_hash

    @hashed_password.setter
    def hashed_password(self, val: str):
        self.password_hash = val

    @property
    def full_name(self) -> str:
        return self.name

    @full_name.setter
    def full_name(self, val: str):
        self.name = val

    @property
    def designation(self) -> str:
        return self.role

    @property
    def institution_id(self):
        return None

class Institution(Base):
    __tablename__ = "institutions"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    type = Column(String(100), nullable=False)  # Engineering, Management, Pharmacy, Architecture, Polytechnic
    state = Column(String(100), nullable=False, index=True)
    region_id = Column(Integer, ForeignKey("regions.id", ondelete="RESTRICT"), nullable=False)
    is_new = Column(Boolean, default=False, nullable=False)
    contact_email = Column(String(255), nullable=False)
    
    # Relationships
    region = relationship("Region", back_populates="institutions")
    applications = relationship("Application", back_populates="institution")
    documents = relationship("Document", back_populates="institution")
    undertakings = relationship("Undertaking", back_populates="institution")

class WorkflowTemplate(Base):
    __tablename__ = "workflow_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), unique=True, nullable=False)  # "Only Scrutiny", "Scrutiny + EVC", etc.
    stages_json = Column(Text, nullable=False)               # JSON encoded stage definitions
    transitions_json = Column(Text, nullable=False)          # JSON encoded transitions and rules
    
    # Relationships
    applications = relationship("Application", back_populates="workflow_template")

class Application(Base):
    __tablename__ = "applications"
    
    id = Column(Integer, primary_key=True, index=True)
    ref_no = Column(String(100), unique=True, index=True, nullable=False)
    institution_id = Column(Integer, ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False)
    application_type = Column(String(100), nullable=False)   # Extension of Approval (EoA), New Institute, etc.
    workflow_template_id = Column(Integer, ForeignKey("workflow_templates.id", ondelete="RESTRICT"), nullable=False)
    current_stage = Column(String(100), nullable=False, index=True)  # SUBMITTED, SCRUTINY, EVC, SAC_SHC, BUREAU_DECISION, APPROVED, REJECTED
    status = Column(String(50), nullable=False, index=True)          # DRAFT, IN_PROGRESS, PENDING_REVIEW, APPROVED, REJECTED, DEFICIENT, ESCALATED
    region_id = Column(Integer, ForeignKey("regions.id", ondelete="RESTRICT"), nullable=False)
    assigned_officer_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    submitted_at = Column(DateTime, nullable=True)
    stage_entered_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    due_date = Column(DateTime, nullable=True, index=True)
    risk_score = Column(Float, default=0.0, nullable=False)
    
    # Relationships
    institution = relationship("Institution", back_populates="applications")
    workflow_template = relationship("WorkflowTemplate", back_populates="applications")
    region = relationship("Region", back_populates="applications")
    assigned_officer = relationship("User", foreign_keys=[assigned_officer_id], back_populates="assigned_applications")
    stage_history = relationship("StageHistory", back_populates="application", cascade="all, delete-orphan")
    evc_schedules = relationship("EVCSchedule", back_populates="application", cascade="all, delete-orphan")
    undertakings = relationship("Undertaking", back_populates="application", cascade="all, delete-orphan")

class StageHistory(Base):
    __tablename__ = "stage_history"
    
    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True)
    stage = Column(String(100), nullable=False)
    entered_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    completed_at = Column(DateTime, nullable=True)
    officer_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(100), nullable=False)
    remarks = Column(Text, nullable=True)
    
    # Relationships
    application = relationship("Application", back_populates="stage_history")
    officer = relationship("User")

class EVCSchedule(Base):
    __tablename__ = "evc_schedules"
    
    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True)
    scheduled_date = Column(DateTime, nullable=False)
    status = Column(String(50), default="SCHEDULED", nullable=False)  # SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED, OVERDUE
    committee_ids = Column(Text, nullable=False)                     # JSON list of user ids
    due_date = Column(DateTime, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    is_new_institution = Column(Boolean, default=False, nullable=False)
    
    # Relationships
    application = relationship("Application", back_populates="evc_schedules")

class FileRecord(Base):
    __tablename__ = "files"
    
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    path = Column(String(500), nullable=False)
    sha256_hash = Column(String(64), nullable=False)
    uploaded_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    uploaded_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    
    # Relationships
    uploader = relationship("User", back_populates="uploaded_files")

class Undertaking(Base):
    __tablename__ = "undertakings"
    
    id = Column(Integer, primary_key=True, index=True)
    institution_id = Column(Integer, ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False, index=True)
    application_id = Column(Integer, ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True)
    condition_text = Column(Text, nullable=False)
    due_date = Column(DateTime, nullable=False, index=True)
    status = Column(String(50), default="PENDING", nullable=False)  # PENDING, DUE_SOON, OVERDUE, VERIFIED, BREACHED
    evidence_file_id = Column(Integer, ForeignKey("files.id", ondelete="SET NULL"), nullable=True)
    verified_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    
    # Relationships
    institution = relationship("Institution", back_populates="undertakings")
    application = relationship("Application", back_populates="undertakings")
    evidence_file = relationship("FileRecord")
    verifier = relationship("User", foreign_keys=[verified_by])

class Document(Base):
    __tablename__ = "documents"
    
    id = Column(Integer, primary_key=True, index=True)
    institution_id = Column(Integer, ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False, index=True)
    doc_type = Column(String(100), nullable=False, index=True)  # LEASE, BUILDING_PLAN, NOC, FIRE_SAFETY, AUDITED_ACCOUNTS
    issue_date = Column(DateTime, nullable=False)
    expiry_date = Column(DateTime, nullable=True, index=True)
    file_id = Column(Integer, ForeignKey("files.id", ondelete="SET NULL"), nullable=True)
    verification_status = Column(String(50), default="PENDING", nullable=False)  # PENDING, VERIFIED, REJECTED, EXPIRED
    renewal_of_id = Column(Integer, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)
    
    # Relationships
    institution = relationship("Institution", back_populates="documents")
    file = relationship("FileRecord")
    parent_document = relationship("Document", remote_side=[id], foreign_keys=[renewal_of_id])

class AlertRule(Base):
    __tablename__ = "alert_rules"
    
    id = Column(Integer, primary_key=True, index=True)
    category = Column(String(100), nullable=False)      # STAGE_SLA, LEASE_EXPIRY, UNDERTAKING_DEADLINE, DEFICIENCY
    trigger_type = Column(String(100), nullable=False)  # REMINDER, OVERDUE, ESCALATION, EXPIRY_WARNING
    offset_days = Column(Integer, nullable=False)       # -7, -3, -1, 0, 30, 60, 90
    severity = Column(String(50), default="INFO", nullable=False)  # INFO, WARNING, CRITICAL, ESCALATION
    escalation_level = Column(Integer, default=0, nullable=False)
    notify_roles_json = Column(Text, nullable=False)    # JSON array of role names
    is_active = Column(Boolean, default=True, nullable=False)

class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    category = Column(String(100), default="GENERAL", nullable=False)
    severity = Column(String(50), default="INFO", nullable=False)
    link = Column(String(500), nullable=True)
    is_read = Column(Boolean, default=False, nullable=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    channel = Column(String(50), default="IN_APP", nullable=False)  # IN_APP, EMAIL, SMS
    
    # Relationships
    user = relationship("User", back_populates="notifications")

class Escalation(Base):
    __tablename__ = "escalations"
    
    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String(50), nullable=False, index=True)  # APPLICATION, UNDERTAKING, EVC
    entity_id = Column(Integer, nullable=False, index=True)
    level = Column(Integer, default=1, nullable=False)            # 1: Regional Officer, 2: Regional Head, 3: Bureau Officer
    escalated_to = Column(String(100), nullable=False)
    reason = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    resolved_at = Column(DateTime, nullable=True)

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    actor_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(String(100), nullable=False, index=True)
    entity_type = Column(String(50), nullable=False, index=True)
    entity_id = Column(String(100), nullable=False, index=True)
    old_value_json = Column(Text, nullable=True)
    new_value_json = Column(Text, nullable=True)
    reason = Column(Text, nullable=True)
    ip = Column(String(50), default="127.0.0.1", nullable=False)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    prev_hash = Column(String(64), nullable=False)
    hash = Column(String(64), nullable=False, unique=True, index=True)
    
    # Relationships
    actor = relationship("User")

    @property
    def user_id(self):
        return self.actor_id

    @property
    def user_email(self):
        return self.actor.email if self.actor else "SYSTEM"

    @property
    def role(self):
        return self.actor.role if self.actor else "SYSTEM"

    @property
    def old_value(self):
        return self.old_value_json

    @property
    def new_value(self):
        return self.new_value_json

    @property
    def details(self):
        return self.reason

    @property
    def ip_address(self):
        return self.ip

class SystemClock(Base):
    __tablename__ = "system_clock"
    
    id = Column(Integer, primary_key=True, index=True)
    simulated_date = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
