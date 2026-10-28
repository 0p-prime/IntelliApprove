"""
Pydantic Schemas for IntelliApprove.
Provides strict validation and serialization across all endpoints.
"""
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import List, Optional, Dict, Any
from datetime import datetime

# --- Auth & User ---
class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    user_id: int
    email: str
    full_name: str
    institution_id: Optional[int] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str
    designation: Optional[str] = None
    phone: Optional[str] = None
    institution_id: Optional[int] = None

class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    designation: Optional[str] = None
    phone: Optional[str] = None
    institution_id: Optional[int] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

# --- Institution ---
class InstitutionOut(BaseModel):
    id: int
    name: str
    type: Optional[str] = None
    state: str
    region_id: int
    is_new: bool = False
    contact_email: str
    # Compatibility fields
    aicte_id: Optional[str] = None
    category: Optional[str] = None
    region: Optional[str] = None
    address: Optional[str] = None
    established_year: Optional[int] = 2012
    trust_society_name: Optional[str] = None
    head_of_institution_name: Optional[str] = None
    head_email: Optional[str] = None
    head_phone: Optional[str] = None
    total_land_acres: Optional[float] = 7.5
    total_builtup_sqm: Optional[float] = 12500.0
    total_computers: Optional[int] = 250
    broadband_bandwidth_mbps: Optional[int] = 500
    has_anti_ragging_committee: Optional[int] = 1
    has_icc_committee: Optional[int] = 1
    has_grievance_committee: Optional[int] = 1
    has_sc_st_cell: Optional[int] = 1
    has_barrier_free_environment: Optional[int] = 1

    @field_validator("region", mode="before")
    def format_region(cls, v):
        if hasattr(v, "name"):
            return v.name
        return str(v) if v else None

    class Config:
        from_attributes = True

# --- Stage & Workflow Routes ---
class StageConfigOut(BaseModel):
    id: int
    stage_key: str
    name: str
    description: Optional[str] = None
    order_sequence: int
    sla_hours: int
    assigned_role: str
    can_flag_deficiencies: bool
    is_terminal: bool
    is_active: bool

    class Config:
        from_attributes = True

class StageConfigUpdate(BaseModel):
    name: Optional[str] = None
    sla_hours: Optional[int] = None
    assigned_role: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class WorkflowRouteOut(BaseModel):
    id: int
    from_stage_id: int
    to_stage_id: int
    action_name: str
    required_role: str
    requires_human_badge: bool
    description: Optional[str] = None
    is_active: bool
    from_stage: Optional[StageConfigOut] = None
    to_stage: Optional[StageConfigOut] = None

    class Config:
        from_attributes = True

class WorkflowRouteCreate(BaseModel):
    from_stage_id: int
    to_stage_id: int
    action_name: str
    required_role: str
    requires_human_badge: bool = True
    description: Optional[str] = None

class EscalationLadderOut(BaseModel):
    id: int
    stage_id: int
    stage_name: Optional[str] = None
    sla_hours: int
    first_reminder_hours_before: int
    second_reminder_hours_before: int
    escalate_to_role: str
    escalate_action: str
    is_active: bool

    class Config:
        from_attributes = True

class EscalationLadderUpdate(BaseModel):
    sla_hours: Optional[int] = None
    first_reminder_hours_before: Optional[int] = None
    second_reminder_hours_before: Optional[int] = None
    escalate_to_role: Optional[str] = None
    is_active: Optional[bool] = None

# --- Academic Programs ---
class AcademicProgramSchema(BaseModel):
    id: Optional[int] = None
    program_name: str
    level: str = "Undergraduate"
    approved_intake_prev_year: int = 60
    requested_intake: int = 60
    faculty_count: int = 4
    total_enrolled: int = 240
    cadre_ratio: str = "1:2:6"

    class Config:
        from_attributes = True

# --- Documents ---
class DocumentOut(BaseModel):
    id: int
    institution_id: Optional[int] = None
    application_id: Optional[int] = 1
    doc_type: str
    file_name: Optional[str] = "document.pdf"
    file_url: Optional[str] = "/files/doc.pdf"
    file_size_kb: Optional[int] = 1024
    uploaded_at: Optional[datetime] = None
    issue_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    status: Optional[str] = "PENDING"
    verification_status: Optional[str] = "PENDING"
    verification_remarks: Optional[str] = None
    verified_by_user_id: Optional[int] = None
    verified_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class DocumentVerificationRequest(BaseModel):
    status: str  # VERIFIED_COMPLIANT, DEFICIENT_REJECTED
    remarks: Optional[str] = None

# --- Compliance & Deficiencies ---
class ComplianceNormRuleOut(BaseModel):
    id: int
    rule_code: str
    name: str
    category: str
    description: str
    standard_value: float
    threshold_margin_percent: float
    unit: str
    severity: str
    is_active: bool

    class Config:
        from_attributes = True

class ComplianceNormRuleUpdate(BaseModel):
    name: Optional[str] = None
    standard_value: Optional[float] = None
    threshold_margin_percent: Optional[float] = None
    severity: Optional[str] = None
    is_active: Optional[bool] = None

class DeficiencyRecordOut(BaseModel):
    id: int
    application_id: int
    rule_id: Optional[int] = None
    rule_code: str
    title: str
    description: str
    severity: str
    flagged_by: str
    is_rectified: bool
    rectification_proof: Optional[str] = None
    rectified_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

class DeficiencyRectifyRequest(BaseModel):
    rectification_proof: str

# --- Undertakings ---
class UndertakingOut(BaseModel):
    id: int
    application_id: int
    title: str
    description: str
    category: str
    due_date: datetime
    status: str
    submission_evidence: Optional[str] = None
    submitted_at: Optional[datetime] = None
    verified_by_user_id: Optional[int] = None
    verified_at: Optional[datetime] = None
    verification_remarks: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class UndertakingCreate(BaseModel):
    application_id: int
    title: str
    description: str
    category: str = "Faculty & Infrastructure"
    due_date: datetime

class UndertakingFulfillRequest(BaseModel):
    submission_evidence: str

class UndertakingVerifyRequest(BaseModel):
    status: str  # COMPLIANT, BREACHED
    remarks: Optional[str] = None

# --- Application Models ---
class ApplicationStageHistoryOut(BaseModel):
    id: int
    action_taken: str
    transitioned_by_user_id: Optional[int] = None
    remarks: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ApplicationOut(BaseModel):
    id: int
    ref_no: str
    institution_id: int
    application_type: str
    workflow_template_id: int
    current_stage: str
    status: str
    region_id: int
    assigned_officer_id: Optional[int] = None
    submitted_at: Optional[datetime] = None
    stage_entered_at: datetime
    due_date: Optional[datetime] = None
    risk_score: float = 0.0
    # Compatibility fields for frontend
    application_number: Optional[str] = None
    academic_year: Optional[str] = "2026-2027"
    is_escalated: Optional[bool] = False
    escalation_level: Optional[int] = 0
    deficiency_count: Optional[int] = 0
    compliance_score: Optional[float] = 85.0
    human_oversight_required: Optional[bool] = True
    submission_date: Optional[datetime] = None
    sla_deadline: Optional[datetime] = None
    created_at: Optional[datetime] = None
    institution: Optional[InstitutionOut] = None

    class Config:
        from_attributes = True

class ApplicationDetailOut(ApplicationOut):
    programs: List[AcademicProgramSchema] = []
    documents: List[DocumentOut] = []
    deficiencies: List[DeficiencyRecordOut] = []
    undertakings: List[UndertakingOut] = []
    stage_history: List[ApplicationStageHistoryOut] = []
    scrutiny_remarks: Optional[str] = None
    evc_recommendation: Optional[str] = None
    evc_remarks: Optional[str] = None
    decision_verdict: Optional[str] = None
    decision_notes: Optional[str] = None
    approval_letter_number: Optional[str] = None
    digital_signature_hash: Optional[str] = None

class ApplicationCreate(BaseModel):
    institution_id: int
    academic_year: str = "2026-2027"
    application_type: str = "Extension of Approval (EoA)"
    template_id: Optional[int] = None
    programs: List[AcademicProgramSchema] = []

class ApplicationUpdate(BaseModel):
    application_type: Optional[str] = None
    risk_score: Optional[float] = None
    due_date: Optional[datetime] = None
    assigned_officer_id: Optional[int] = None

class CompleteStageRequest(BaseModel):
    remarks: Optional[str] = None
    verdict: Optional[str] = None  # APPROVED, REJECTED (for Bureau Decision)
    checklist_acknowledgement: Optional[Dict[str, bool]] = None

class ReturnApplicationRequest(BaseModel):
    reason: str
    target_stage: Optional[str] = None

class TimelineOut(BaseModel):
    application_id: int
    ref_no: str
    template_name: str
    stages: List[str]
    current_stage: str
    status: str
    history: List[Dict[str, Any]]

class CaseSummaryOut(BaseModel):
    application_id: int
    ref_no: str
    watermark: str = "Draft for official review"
    generated_at: datetime
    institution: Dict[str, Any]
    workflow_route: Dict[str, Any]
    stage_timeline: List[Dict[str, Any]]
    observations: List[Dict[str, Any]]
    pending_items: Dict[str, Any]
    risk_assessment: Dict[str, Any]
    markdown_summary: str

class StageTransitionRequest(BaseModel):
    target_stage_id: int
    action_name: str
    remarks: Optional[str] = None

class AuthorityDecisionRequest(BaseModel):
    verdict: str  # APPROVED, APPROVED_WITH_CONDITIONS, REJECTED
    notes: str
    checklist_acknowledgement: Dict[str, bool] = Field(
        ...,
        description="Must acknowledge human review of physical report, compliance deficiency check, and vigilance clearance."
    )

class ScrutinySubmitRequest(BaseModel):
    remarks: str
    deficiencies_noted: Optional[List[str]] = []
    recommendation: str  # PASS_TO_EVC, REJECT_TO_INSTITUTE, ESCALATE_TO_SHC

class EVCSubmitRequest(BaseModel):
    inspection_notes: str
    recommendation: str  # RECOMMENDED, DEFICIENT_HEARING, NOT_RECOMMENDED
    infra_verified: bool
    faculty_verified: bool
    labs_functional: bool

# --- Alerts & Audit ---
class AlertOut(BaseModel):
    id: int
    application_id: Optional[int] = None
    title: str
    message: str
    severity: str
    recipient_role: Optional[str] = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True

class AuditLogOut(BaseModel):
    id: int
    timestamp: datetime
    user_id: Optional[int] = None
    user_email: str
    role: str
    action: str
    entity_type: str
    entity_id: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    details: Optional[str] = None
    ip_address: Optional[str] = None

    class Config:
        from_attributes = True
