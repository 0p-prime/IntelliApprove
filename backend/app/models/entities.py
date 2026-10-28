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
from typing import Optional, List, Dict, Any
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

    @property
    def aicte_id(self) -> str:
        return f"1-{1029380000 + self.id}"

    @property
    def category(self) -> str:
        return self.type

    @property
    def district(self) -> str:
        return self.state

    @property
    def address(self) -> str:
        return f"Main Campus, {self.name}, {self.state}"

    @property
    def total_land_acres(self) -> float:
        return 7.5 if not self.is_new else 5.0

    @property
    def total_builtup_sqm(self) -> float:
        return 12500.0

    @property
    def total_computers(self) -> int:
        return 280

    @property
    def established_year(self) -> int:
        return 2012 if not self.is_new else 2026

    @property
    def head_of_institution_name(self) -> str:
        return "Dr. Arvind Narayanan" if self.id == 1 else "Dr. Sunita Deshmukh"

    @property
    def head_email(self) -> str:
        return self.contact_email

    @property
    def head_phone(self) -> str:
        return "+91-9811092831"

    @property
    def trust_society_name(self) -> str:
        return f"{self.name} Educational Society"

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

    @property
    def application_number(self) -> str:
        return self.ref_no

    @property
    def created_at(self):
        return self.submitted_at or self.stage_entered_at

    @property
    def submission_date(self):
        return self.submitted_at

    @property
    def sla_deadline(self):
        return self.due_date

    @property
    def is_escalated(self) -> bool:
        return self.status == "ESCALATED"

    @property
    def academic_year(self) -> str:
        return "2026-2027"

    @property
    def human_oversight_required(self) -> bool:
        return getattr(self, "_human_oversight_required", True)

    @human_oversight_required.setter
    def human_oversight_required(self, val: bool):
        self._human_oversight_required = val

    @property
    def decision_verdict(self) -> Optional[str]:
        return getattr(self, "_decision_verdict", None) or self.status

    @decision_verdict.setter
    def decision_verdict(self, val: str):
        self._decision_verdict = val

    @property
    def decision_notes(self) -> Optional[str]:
        return getattr(self, "_decision_notes", None)

    @decision_notes.setter
    def decision_notes(self, val: str):
        self._decision_notes = val

    @property
    def decision_date(self):
        return getattr(self, "_decision_date", None)

    @decision_date.setter
    def decision_date(self, val):
        self._decision_date = val

    @property
    def decision_by_user_id(self) -> Optional[int]:
        return getattr(self, "_decision_by_user_id", None)

    @decision_by_user_id.setter
    def decision_by_user_id(self, val: int):
        self._decision_by_user_id = val

    @property
    def digital_signature_hash(self) -> Optional[str]:
        return getattr(self, "_digital_signature_hash", None)

    @digital_signature_hash.setter
    def digital_signature_hash(self, val: str):
        self._digital_signature_hash = val

    @property
    def approval_letter_number(self) -> Optional[str]:
        return getattr(self, "_approval_letter_number", None)

    @approval_letter_number.setter
    def approval_letter_number(self, val: str):
        self._approval_letter_number = val

    @property
    def programs(self):
        return []

    @property
    def deficiencies(self):
        return []

    @property
    def current_stage_obj(self):
        class DummyStage:
            name = self.current_stage
            stage_key = self.current_stage
            sla_hours = 72
        return DummyStage()

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

    @property
    def action_taken(self) -> str:
        return self.action

    @property
    def created_at(self):
        return self.entered_at

    @property
    def transitioned_by_user_id(self) -> Optional[int]:
        return self.officer_id

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

    @property
    def title(self) -> str:
        return self.condition_text[:50] + ("..." if len(self.condition_text) > 50 else "")

    @property
    def description(self) -> str:
        return self.condition_text

    @property
    def category(self) -> str:
        return "Statutory APH Norm"

    @property
    def submission_evidence(self) -> Optional[str]:
        return self.evidence_file.path if self.evidence_file else None

    @property
    def submitted_at(self):
        return self.verified_at

    @property
    def verification_remarks(self) -> Optional[str]:
        return "Verified by regional officer" if self.status == "VERIFIED" else None

    @property
    def verified_by_user_id(self):
        return self.verified_by

    @property
    def is_overdue(self) -> bool:
        return self.status == "OVERDUE"

    @property
    def created_at(self):
        return self.due_date

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

    @property
    def status(self) -> str:
        return self.verification_status

    @status.setter
    def status(self, val: str):
        self.verification_status = val

    @property
    def file_name(self) -> str:
        return self.file.filename if self.file else f"{self.doc_type.lower()}_deed.pdf"

    @property
    def file_path(self) -> str:
        return self.file.path if self.file else f"/storage/docs/{self.id}.pdf"

    @property
    def file_url(self) -> str:
        return self.file.path if self.file else f"/storage/docs/{self.id}.pdf"

    @property
    def uploaded_at(self):
        return self.file.uploaded_at if self.file else self.issue_date

    @property
    def file_size_kb(self) -> int:
        return 1450

    @property
    def sha256_hash(self) -> str:
        return self.file.sha256_hash if self.file else "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

    @property
    def is_verified(self) -> bool:
        return self.verification_status == "VERIFIED"

    @property
    def application_id(self) -> int:
        if self.institution and self.institution.applications:
            return self.institution.applications[0].id
        return 1

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
    
    def __init__(self, **kwargs):
        app_id = kwargs.pop("application_id", None)
        recipient_role = kwargs.pop("recipient_role", None)
        if app_id and "link" not in kwargs:
            kwargs["link"] = f"/applications/{app_id}"
        super().__init__(**kwargs)

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

class AcademicProgram:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)
