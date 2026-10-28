/**
 * IntelliApprove TypeScript Type Definitions
 */

export type UserRole =
  | 'INSTITUTION'
  | 'SCRUTINY_OFFICER'
  | 'EVC_INSPECTOR'
  | 'REGIONAL_OFFICER'
  | 'COMPETENT_AUTHORITY'
  | 'ADMIN';

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  designation?: string;
  phone?: string;
  institution_id?: number;
  is_active: boolean;
  created_at: string;
}

export interface Institution {
  id: number;
  aicte_id: string;
  name: string;
  category: string;
  state: string;
  region: string;
  address: string;
  established_year: number;
  trust_society_name: string;
  head_of_institution_name: string;
  head_email: string;
  head_phone: string;
  total_land_acres: number;
  total_builtup_sqm: number;
  total_computers: number;
  broadband_bandwidth_mbps: number;
  has_anti_ragging_committee: number;
  has_icc_committee: number;
  has_grievance_committee: number;
  has_sc_st_cell: number;
  has_barrier_free_environment: number;
}

export interface StageConfig {
  id: number;
  stage_key: string;
  name: string;
  description?: string;
  order_sequence: number;
  sla_hours: number;
  assigned_role: UserRole;
  can_flag_deficiencies: boolean;
  is_terminal: boolean;
  is_active: boolean;
}

export interface WorkflowRoute {
  id: number;
  from_stage_id: number;
  to_stage_id: number;
  action_name: string;
  required_role: UserRole;
  requires_human_badge: boolean;
  description?: string;
  is_active: boolean;
  from_stage?: StageConfig;
  to_stage?: StageConfig;
}

export interface EscalationLadder {
  id: number;
  stage_id: number;
  stage_name?: string;
  sla_hours: number;
  first_reminder_hours_before: number;
  second_reminder_hours_before: number;
  escalate_to_role: UserRole;
  escalate_action: string;
  is_active: boolean;
}

export interface AcademicProgram {
  id?: number;
  program_name: string;
  level: string;
  approved_intake_prev_year: number;
  requested_intake: number;
  faculty_count: number;
  total_enrolled: number;
  cadre_ratio: string;
}

export interface ApplicationDocument {
  id: number;
  application_id: number;
  doc_type: string;
  file_name: string;
  file_url: string;
  file_size_kb: number;
  uploaded_at: string;
  status: 'PENDING_VERIFICATION' | 'VERIFIED_COMPLIANT' | 'DEFICIENT_REJECTED';
  verification_remarks?: string;
  verified_by_user_id?: number;
  verified_at?: string;
}

export interface ComplianceNormRule {
  id: number;
  rule_code: string;
  name: string;
  category: string;
  description: string;
  standard_value: number;
  threshold_margin_percent: number;
  unit: string;
  severity: 'CRITICAL' | 'MAJOR' | 'MINOR';
  is_active: boolean;
}

export interface DeficiencyRecord {
  id: number;
  application_id: number;
  rule_id?: number;
  rule_code: string;
  title: string;
  description: string;
  severity: 'CRITICAL' | 'MAJOR' | 'MINOR';
  flagged_by: string;
  is_rectified: boolean;
  rectification_proof?: string;
  rectified_at?: string;
  created_at: string;
}

export interface Undertaking {
  id: number;
  application_id: number;
  title: string;
  description: string;
  category: string;
  due_date: string;
  status: 'PENDING' | 'SUBMITTED_FOR_REVIEW' | 'COMPLIANT' | 'BREACHED';
  submission_evidence?: string;
  submitted_at?: string;
  verified_by_user_id?: number;
  verified_at?: string;
  verification_remarks?: string;
  created_at: string;
}

export interface ApplicationStageHistory {
  id: number;
  action_taken: string;
  transitioned_by_user_id?: number;
  remarks?: string;
  created_at: string;
}

export interface Application {
  id: number;
  application_number: string;
  institution_id: number;
  academic_year: string;
  application_type: string;
  current_stage_id: number;
  status: string;
  submission_date?: string;
  stage_entered_at: string;
  sla_deadline?: string;
  is_escalated: boolean;
  escalation_level: number;
  deficiency_count: number;
  compliance_score: number;
  human_oversight_required: boolean;
  decision_verdict?: 'APPROVED' | 'APPROVED_WITH_CONDITIONS' | 'REJECTED';
  decision_date?: string;
  approval_letter_number?: string;
  created_at: string;
  institution?: Institution;
  current_stage?: StageConfig;
  programs?: AcademicProgram[];
  documents?: ApplicationDocument[];
  deficiencies?: DeficiencyRecord[];
  undertakings?: Undertaking[];
  stage_history?: ApplicationStageHistory[];
  scrutiny_remarks?: string;
  evc_recommendation?: string;
  evc_remarks?: string;
  decision_notes?: string;
  digital_signature_hash?: string;
}

export interface Alert {
  id: number;
  application_id?: number;
  title: string;
  message: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | 'ESCALATION';
  recipient_role?: string;
  is_read: boolean;
  created_at: string;
}

export interface AuditLog {
  id: number;
  timestamp: string;
  user_id?: number;
  user_email: string;
  role: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_value?: string;
  new_value?: string;
  details?: string;
  ip_address?: string;
}

export interface DashboardMetrics {
  summary: {
    total_applications: number;
    approved: number;
    rejected: number;
    under_scrutiny: number;
    under_evc: number;
    pending_authority_decision: number;
    sla_breaches: number;
    average_compliance_score: number;
    active_undertakings: number;
  };
  stage_breakdown: Array<{
    stage_id: number;
    stage_name: string;
    stage_key: string;
    count: number;
    sla_hours: number;
    assigned_role: string;
  }>;
  regional_breakdown: Array<{
    region: string;
    count: number;
  }>;
  recent_escalations: Array<{
    id: number;
    application_id: number;
    from_role: string;
    escalated_to_role: string;
    reason: string;
    created_at: string;
  }>;
}
