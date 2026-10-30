/**
 * IntelliApprove TypeScript Type Definitions
 */

export type UserRole =
  | 'INSTITUTION'
  | 'REGIONAL_OFFICER'
  | 'REGIONAL_HEAD'
  | 'BUREAU_OFFICER'
  | 'EVC_MEMBER'
  | 'ADMIN'
  | 'SCRUTINY_OFFICER'
  | 'EVC_INSPECTOR'
  | 'COMPETENT_AUTHORITY';

export interface User {
  id: number;
  email: string;
  name?: string;
  full_name: string;
  role: UserRole;
  region_id?: number | null;
  region_name?: string | null;
  institution_id?: number | null;
  institution_name?: string | null;
  designation?: string;
  phone?: string;
  is_active: boolean;
  created_at?: string;
}

export interface Institution {
  id: number;
  aicte_id: string;
  name: string;
  category: string;
  state: string;
  region: string;
  district?: string;
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

export type WorkflowStage = StageConfig;

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

export type WorkflowRouteTransition = WorkflowRoute;

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

export interface DocumentItem {
  id: number;
  institution_id: number;
  institution_name?: string;
  institution_type?: string;
  state?: string;
  region_id?: number;
  region_name?: string;
  application_id?: number;
  doc_type: string;
  issue_date: string;
  expiry_date?: string | null;
  status: string;
  verification_status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED' | string;
  validity_status: 'VALID' | 'EXPIRING_SOON' | 'CRITICAL' | 'EXPIRED';
  days_remaining: number;
  days_expired: number;
  is_expired: boolean;
  is_critical: boolean;
  is_expiring_soon: boolean;
  color_code: string;
  renewal_of_id?: number | null;
  has_renewals?: boolean;
  file_id?: number;
  file_name: string;
  file_url: string;
  file_size_kb: number;
  sha256_hash?: string;
  uploaded_at: string;
  verified_by_user_id?: number;
  verifier_name?: string;
  verified_at?: string;
  remarks?: string;
  verification_remarks?: string;
  audit_trail?: any[];
}

export interface DocumentExpiringSummary {
  expired: number;
  next_30_days: number;
  next_60_days: number;
  next_90_days: number;
  safe_over_90_days: number;
  total_documents: number;
  total_with_expiry: number;
}

export interface DocumentTimelineBucket {
  label: string;
  color: string;
  count: number;
  documents: DocumentItem[];
}

export interface DocumentExpiryTimelineData {
  summary: {
    total: number;
    expired_count: number;
    critical_count: number;
    expiring_soon_count: number;
    valid_count: number;
  };
  buckets: {
    expired: DocumentTimelineBucket;
    critical: DocumentTimelineBucket;
    expiring_soon: DocumentTimelineBucket;
    valid: DocumentTimelineBucket;
  };
}

export interface DocumentRenewalHistory {
  target_document_id: number;
  root_document_id: number;
  total_renewals: number;
  lineage: DocumentItem[];
  audit_trail: {
    id: number;
    action: string;
    entity_id: string;
    actor_id?: number;
    actor_name: string;
    actor_role: string;
    timestamp: string;
    details: string;
    hash: string;
  }[];
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
  institution_id?: number;
  institution_name?: string;
  institution_type?: string;
  state?: string;
  region_id?: number;
  region_name?: string;
  application_id: number;
  application_ref_no?: string;
  condition_text?: string;
  title: string;
  description: string;
  category: string;
  due_date: string;
  status: 'PENDING' | 'SUBMITTED' | 'SUBMITTED_FOR_REVIEW' | 'VERIFIED' | 'COMPLIANT' | 'REJECTED' | 'OVERDUE' | 'BREACHED';
  raw_status?: string;
  days_remaining?: number;
  days_overdue?: number;
  is_overdue?: boolean;
  evidence_file_id?: number;
  evidence_filename?: string;
  evidence_file_hash?: string;
  evidence_file_url?: string;
  submission_evidence?: string;
  submitted_at?: string;
  verified_by_user_id?: number;
  verifier_name?: string;
  verified_at?: string;
  remarks?: string;
  verification_remarks?: string;
  created_at?: string;
}

export interface ComplianceScoreItem {
  institution_id: number;
  institution_name: string;
  institution_type: string;
  state: string;
  region_id: number;
  region_name: string;
  total_undertakings: number;
  verified_on_time: number;
  verified_late: number;
  submitted_pending_review: number;
  pending_active: number;
  overdue_breached: number;
  rejected_deficiencies: number;
  compliance_score: number;
  grade: 'EXCELLENT' | 'MODERATE' | 'CRITICAL';
  color: string;
}

export interface RegionComplianceSummary {
  region_id: number;
  region_name: string;
  institutions_count: number;
  total_undertakings: number;
  verified_on_time: number;
  overdue_count: number;
  avg_compliance_score: number;
  grade: 'EXCELLENT' | 'MODERATE' | 'CRITICAL';
  color: string;
}

export interface ComplianceHeatTableData {
  summary: {
    total_institutions: number;
    total_undertakings: number;
    verified_on_time: number;
    overdue_count: number;
    national_average_score: number;
    grade: 'EXCELLENT' | 'MODERATE' | 'CRITICAL';
  };
  regional_breakdown: RegionComplianceSummary[];
  institutions: ComplianceScoreItem[];
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
  ref_no?: string;
  application_number: string;
  institution_id: number;
  academic_year: string;
  application_type: string;
  current_stage_id?: number;
  workflow_template_id?: number;
  status: string;
  submission_date?: string;
  stage_entered_at: string;
  sla_deadline?: string;
  due_date?: string;
  risk_score?: number;
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
  current_stage?: any;
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

export interface TimelineHistoryItem {
  id: number;
  stage: string;
  action: string;
  remarks?: string;
  entered_at?: string;
  completed_at?: string;
  officer_id?: number;
  officer_name?: string;
  officer_role?: string;
}

export interface TimelineData {
  application_id: number;
  ref_no: string;
  template_name: string;
  stages: string[];
  current_stage: string;
  status: string;
  history: TimelineHistoryItem[];
}

export interface CaseSummaryData {
  application_id: number;
  ref_no: string;
  watermark: string;
  generated_at: string;
  institution: {
    id: number;
    name: string;
    aicte_id: string;
    type: string;
    state: string;
    region: string;
    contact_email: string;
    is_new: boolean;
  };
  workflow_route: {
    template_id: number;
    template_name: string;
    stages: string[];
    current_stage: string;
    status: string;
  };
  stage_timeline: Array<{
    stage: string;
    entered_at?: string;
    completed_at?: string;
    action: string;
    remarks?: string;
    officer: string;
  }>;
  observations: Array<{
    stage: string;
    action: string;
    officer: string;
    notes: string;
  }>;
  pending_items: {
    undertakings_total: number;
    undertakings_pending: number;
    documents_total: number;
    documents_pending: number;
  };
  risk_assessment: {
    risk_score: number;
    due_date?: string;
    is_escalated: boolean;
  };
  markdown_summary: string;
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
  category?: string;
  link?: string;
}

export interface SystemClock {
  id: number;
  simulated_date: string;
  is_simulated: boolean;
  real_date: string;
  delta_days: number;
}

export interface EscalationItem {
  id: number;
  entity_type: string;
  entity_id: number;
  application_id?: number;
  application_number: string;
  institution_name: string;
  from_role: string;
  escalated_to_role: string;
  escalation_reason: string;
  escalation_level: number;
  created_at: string;
  resolved_at?: string | null;
}

export interface AlertRuleItem {
  id: number;
  category: string;
  trigger_type: string;
  offset_days: number;
  severity: string;
  escalation_level: number;
  notify_roles_json: string;
  is_active: boolean;
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
  prev_hash?: string;
  hash?: string;
}

export interface ChainVerificationResult {
  is_valid: boolean;
  total_blocks: number;
  tampered_block_id?: number | null;
  broken_links_count: number;
  genesis_hash: string;
  head_hash: string | null;
  verification_duration_ms: number;
  verified_at: string;
  algorithm: string;
  status: string;
}

export interface DeficiencyReportData {
  summary: {
    total_deficiencies: number;
    rectified_count: number;
    pending_count: number;
    rectification_rate: number;
    critical_unresolved: number;
    major_unresolved: number;
    minor_unresolved: number;
  };
  category_breakdown: Array<{ category: string; count: number }>;
  rule_rankings: Array<{
    rule_code: string;
    name: string;
    category: string;
    severity: string;
    deficiency_count: number;
  }>;
  regional_deficiencies: Array<{ region: string; deficiency_count: number }>;
  top_deficient_institutions: Array<{
    application_id: number;
    ref_no: string;
    institution_name: string;
    state: string;
    region: string;
    deficiency_count: number;
    compliance_score: number;
    current_stage: string;
    status: string;
  }>;
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

export interface DashboardSummaryData {
  summary: {
    total: number;
    in_progress: number;
    returned: number;
    completed: number;
    approved: number;
    rejected: number;
    overdue: number;
    sla_breach_count: number;
    approaching_deadline_count: number;
    average_risk_score: number;
    timestamp: string;
  };
  top_overdue_cases: Array<{
    id: number;
    ref_no: string;
    institution_name: string;
    region_name: string;
    current_stage: string;
    status: string;
    due_date?: string;
    days_overdue: number;
    assigned_officer_name: string;
    risk_score: number;
  }>;
  role_context: Record<string, any>;
  user_role: string;
  jurisdiction: string;
}

export interface StageFunnelItem {
  stage: string;
  stage_name: string;
  count: number;
  percentage: number;
  sla_hours: number;
  color: string;
}

export interface AgeingItem {
  bucket: string;
  range: string;
  count: number;
  overdue_count: number;
  percentage: number;
  color: string;
}

export interface RegionPerformanceItem {
  region_id: number;
  region_name: string;
  total_applications: number;
  pendency: number;
  overdue: number;
  completed: number;
  avg_processing_days: number;
  sla_compliance_rate: number;
  is_user_region: boolean;
}

export interface OfficerWorkloadItem {
  officer_id: number;
  officer_name: string;
  officer_role: string;
  region_name: string;
  active_cases: number;
  overdue_cases: number;
  completed_cases: number;
  utilization_pct: number;
}

export interface BottleneckItem {
  stage: string;
  stage_name: string;
  avg_dwell_days: number;
  sla_standard_days: number;
  current_pending_cases: number;
  bottleneck_severity: 'HIGH' | 'MEDIUM' | 'LOW';
  longest_dwell_days: number;
  longest_dwell_ref: string;
  longest_dwell_inst: string;
}

export interface UpcomingDeadlineItem {
  id: string;
  module: 'APPLICATION' | 'EVC' | 'UNDERTAKING' | 'DOCUMENT';
  title: string;
  ref_no: string;
  institution_name: string;
  region_name: string;
  due_date: string;
  days_remaining: number;
  is_overdue: boolean;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  link: string;
}

export interface EVCScheduleItem {
  id: number;
  application_id: number;
  application_ref_no?: string;
  application_status?: string;
  current_stage?: string;
  institution_id?: number;
  institution_name: string;
  institution_type: string;
  state: string;
  region_id?: number;
  region_name: string;
  scheduled_date?: string;
  due_date: string;
  completed_at?: string;
  status: 'QUEUED' | 'SCHEDULED' | 'DUE_SOON' | 'OVERDUE' | 'COMPLETED';
  raw_status: string;
  committee_ids: number[];
  committee_members: Array<{
    id: number;
    name: string;
    email: string;
    role: string;
    region_name: string;
  }>;
  is_new_institution: boolean;
  days_remaining: number;
  days_overdue: number;
  is_overdue: boolean;
  is_due_soon: boolean;
  inspection_notes?: string;
  recommendation?: string;
}

export interface EVCCommitteeMember {
  id: number;
  name: string;
  email: string;
  role: string;
  region_id?: number;
  region_name: string;
  active_assignments: number;
}

export interface FullHistoryEvent {
  id: string;
  event_type: 'SUBMISSION' | 'STAGE_TRANSITION' | 'VERIFICATION' | 'ALERT' | 'ESCALATION' | 'AUDIT_BLOCK';
  category: string;
  title: string;
  timestamp: string;
  actor_name: string;
  actor_role: string;
  action: string;
  details: string;
  badge_color: string;
  icon: string;
  metadata?: Record<string, any>;
}

export interface ApplicationFullHistoryResponse {
  application_id: number;
  ref_no: string;
  institution_name: string;
  current_stage: string;
  status: string;
  total_events: number;
  events: FullHistoryEvent[];
}

export interface ReportSummaryKPI {
  label: string;
  value: string | number;
  color?: string;
}

export interface ReportColumn {
  key: string;
  label: string;
  type?: 'text' | 'mono' | 'badge' | 'status' | 'number' | 'date' | 'score' | 'percentage' | 'boolean';
}

export interface ReportMetadataItem {
  id: string;
  title: string;
  category: string;
  description: string;
  chart_type: 'bar' | 'pie' | 'composed';
}

export interface StatutoryReportData {
  report_id: string;
  title: string;
  subtitle: string;
  generated_at: string;
  summary_kpis: ReportSummaryKPI[];
  chart_type: 'bar' | 'pie' | 'composed';
  chart_data: Array<Record<string, any>>;
  chart_config: Record<string, any>;
  table_columns: ReportColumn[];
  table_data: Array<Record<string, any>>;
}

