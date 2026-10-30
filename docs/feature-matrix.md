# 📊 IntelliApprove — Statutory Requirement & Feature Traceability Matrix
**Smart India Hackathon 2026 (Problem Statement 26262)**  
*AICTE Approval Process Automation, Compliance Monitoring & Vigilance Engine*

This matrix provides comprehensive traceability mapping every statutory requirement, problem statement clause, and evaluation criterion to the exact architectural module, backend API endpoint, frontend user interface component, and automated test suite in **IntelliApprove**.

---

## 🏛️ Section A: Approval Workflow Engine

| Clause / Requirement | Statutory Description | Backend Implementation | Frontend UI Component | Verification & Test Suite |
| :--- | :--- | :--- | :--- | :--- |
| **A.1 Route Definitions** | Configurable workflow templates loaded from database (JSON stages & transitions). | `WorkflowTemplate` model, `WorkflowService.get_template_stages()` | `WorkflowConfigPage.tsx`, `ApplicationDetailPage.tsx` | `test_rule_3_configurable_routes_and_slas`, `test_backend.py` |
| **A.2 Dynamic Route Assignment** | Assigns 1 of 5 templates (Only Scrutiny, Scrutiny+EVC, EVC+SAC/SHC, Only EVC, Full Route) based on institution type/risk. | `WorkflowService.create_application()` | `NewApplicationPage.tsx`, `ApplicationDetailPage.tsx` | `test_create_application_with_dynamic_template`, `test_workflow.py` |
| **A.3 Complete Stage & Auto-Advance** | Validates officer authority, marks stage complete, advances to next stage; queues EVC if route requires inspection. | `WorkflowService.complete_stage()`, `POST /workflow/transition` | `ApplicationDetailPage.tsx` (`StageStepper` & action buttons) | `test_complete_stage_advances_application`, `test_workflow.py` |
| **A.4 Mandatory Reason Revert** | Deficiency revert back to previous stage or institution with status `"RETURNED"`. Rejects submission if reason omitted. | `WorkflowService.return_application()`, `POST /applications/{id}/return` | `ReturnApplicationModal` in `ApplicationDetailPage.tsx` | `test_return_application_requires_mandatory_reason` |
| **A.5 Strict State-Machine Validation** | Enforces valid stage progression; rejects out-of-order transitions with HTTP 400/422. | State machine guards in `workflow_service.py` | UI disabled buttons and status pill indicators | `test_invalid_transition_rejected` |
| **A.6 Rule #2: Human Oversight Gate** | Final decision stages (`APPROVED`/`REJECTED`) strictly restricted to authorized human role (`BUREAU_OFFICER`). Never auto-decided. | `WorkflowService.record_authority_decision()` | `CompetentAuthorityDecisionModal` in `ApplicationDetailPage.tsx` | `test_rule_2_human_oversight_required_on_decision` |
| **A.7 Electronic Case Summary** | Auto-generates summary document (institution, route, timeline, observations, pending items) watermarked *"Draft for official review"*. | `WorkflowService.generate_case_summary()`, `GET /applications/{id}/case-summary` | `CaseSummaryModal` in `ApplicationDetailPage.tsx` | `test_case_summary_generation_and_draft_watermark` |
| **A.8 Audit & Lineage Tracking** | Every stage movement writes `audit_logs` and `stage_history` records. | `AuditService.log()`, `StageHistory` model | `ApplicationDetailPage.tsx` (`FullHistoryTab`) | `test_stage_transition_creates_audit_log` |

---

## 📈 Section B: Role-Based Real-Time Dashboards

| Clause / Requirement | Statutory Description | Backend Implementation | Frontend UI Component | Verification & Test Suite |
| :--- | :--- | :--- | :--- | :--- |
| **B.1 Dashboard Summary** | Aggregated KPI cards: Total, In-Progress, Returned, Completed, and Overdue SLA breach counts. | `GET /dashboard/summary` | `DashboardPage.tsx` (`KPICardsGrid`) | `test_national_dashboard_summary`, `test_dashboard.py` |
| **B.2 Stage Funnel Analytics** | Visual distribution count of applications active in each stage. | `GET /dashboard/stage-funnel` | Recharts Funnel/Bar Chart in `DashboardPage.tsx` | `test_stage_funnel_endpoint`, `test_dashboard.py` |
| **B.3 Ageing Buckets** | Pendency categorisation: 0-7 days, 8-15 days, 16-30 days, 30+ days. | `GET /dashboard/ageing` | Recharts Ageing Bar Chart in `DashboardPage.tsx` | `test_ageing_endpoint`, `test_dashboard.py` |
| **B.4 Regional Performance Heatmap** | Average processing dwell time and pendency per region. | `GET /dashboard/region-performance` | Recharts Regional Bar Chart in `DashboardPage.tsx` | `test_regional_performance_endpoint` |
| **B.5 Officer Workload & Overdue** | Case count and overdue volume per assigned scrutiny officer. | `GET /dashboard/officer-workload` | Workload Table/Chart in `DashboardPage.tsx` | `test_officer_workload_endpoint` |
| **B.6 Dwell-Time Bottlenecks** | Identifies statutory stages with highest average dwell time vs SLA. | `GET /dashboard/bottlenecks` | Bottleneck Analysis Table in `DashboardPage.tsx` | `test_bottlenecks_endpoint` |
| **B.7 Upcoming Statutory Deadlines** | Cross-module aggregation of next 14 days deadlines (applications, EVCs, undertakings, leases). | `GET /dashboard/upcoming-deadlines` | Upcoming Deadlines Card in `DashboardPage.tsx` | `test_upcoming_deadlines_endpoint` |
| **B.8 Role Scoping (Rule #5)** | Strict data visibility: Admin/Bureau (National), Regional Head/Officer (Region), EVC (Assigned), Institution (Own). | Scope filters in `backend/app/api/v1/dashboard.py` | Role-adaptive views in `DashboardPage.tsx` | `test_role_scoped_data`, `test_rbac_scoping.py` |
| **B.9 SLA & Deadline Counters** | Prominent red SLA breach counter and amber approaching deadline indicators. | Real-time aggregate count fields | Floating top badges & Header widgets in `Header.tsx` | Playwright QA Walkthrough (`03_dash_*.png`) |

---

## 👥 Section C: Expert Visit Committee (EVC) Module

| Clause / Requirement | Statutory Description | Backend Implementation | Frontend UI Component | Verification & Test Suite |
| :--- | :--- | :--- | :--- | :--- |
| **C.1 Auto-Queue Creation** | When application completes preliminary scrutiny on an EVC route, automatically creates `EVCSchedule` in status `"QUEUED"`. | Event hook in `WorkflowService.complete_stage()` | `EVCPage.tsx` (`QueueTab`) | `test_evc_workflow_auto_creation_and_prescribed_windows` |
| **C.2 New Institution Priority** | Prioritises new institutions (`is_new_institution = true`) with shorter due windows (T-10 vs T-15). | Priority calculation in `evc_service.py` | `"New Institution (T-10)"` badge in `EVCPage.tsx` | `test_evc_queue_prioritizes_new_institutions` |
| **C.3 Lifecycle State Machine** | Computes status: `QUEUED`, `SCHEDULED`, `DUE_SOON`, `OVERDUE`, `COMPLETED`. | Dynamic status property in `EVCSchedule` | Filter tabs & Status chips in `EVCPage.tsx` | `test_evc_status_computation` |
| **C.4 Committee Scheduling & Rescheduling** | Date selection, committee member assignment, conflict prevention, mandatory reschedule reason. | `POST /evc/{id}/schedule`, `POST /evc/{id}/reschedule` | `ScheduleEVCModal` in `EVCPage.tsx` | `test_evc_scheduling_and_rescheduling_lifecycle` |
| **C.5 Calendar Visualization** | Interactive month-view calendar with color-coded inspection visits. | `GET /evc/calendar` | Recharts/CSS Month Grid in `EVCPage.tsx` (`CalendarTab`) | `test_evc_calendar_endpoint` |
| **C.6 Report Upload & Auto-Advance** | Report upload advances application to next stage (SAC/SHC or Bureau Decision). | `POST /evc/{id}/complete` | Report Upload Modal in `EVCPage.tsx` | `test_evc_completion_advances_workflow` |

---

## 📜 Section D: Undertakings & Institutional Compliance Module

| Clause / Requirement | Statutory Description | Backend Implementation | Frontend UI Component | Verification & Test Suite |
| :--- | :--- | :--- | :--- | :--- |
| **D.1 Conditional Approval Undertakings** | Automatic undertaking creation when approval is granted with conditions (condition text, due date). | `UndertakingService.create_undertaking()` | `UndertakingsPage.tsx` | `test_create_undertaking_conditional_approval` |
| **D.2 Evidence Upload & SHA-256 Hash** | Institutional evidence upload with file type/size validation and cryptographic SHA-256 hash storage. | `StorageService.store_file()`, `POST /undertakings/{id}/submit-evidence` | `UploadEvidenceModal` in `UndertakingsPage.tsx` | `test_upload_undertaking_evidence_sha256` |
| **D.3 Officer Verification with Mandatory Remarks** | Officer endpoints to `VERIFY` or `REJECT` evidence with mandatory remarks. | `POST /undertakings/{id}/verify`, `POST /undertakings/{id}/reject` | `ReviewEvidenceModal` in `UndertakingsPage.tsx` | `test_verify_undertaking_evidence_mandatory_remarks` |
| **D.4 Compliance Scoring** | Per-institution compliance score computation: $(\text{verified on time} / \text{total}) \times 100$. | `ComplianceService.calculate_institution_score()` | Score Badge & Heat Table in `UndertakingsPage.tsx` | `test_compliance_score_computation` |
| **D.5 Compliance Heat Table** | Regional/Bureau officer overview of institutions vs undertakings status. | `GET /undertakings/compliance-matrix` | Compliance Heat Table in `UndertakingsPage.tsx` | `test_compliance_matrix_endpoint` |

---

## 📑 Section E: Document & Lease Validity Monitoring Module

| Clause / Requirement | Statutory Description | Backend Implementation | Frontend UI Component | Verification & Test Suite |
| :--- | :--- | :--- | :--- | :--- |
| **E.1 Validity Status Computation** | Computes status: `VALID`, `EXPIRING_SOON` ($\le 90\text{d}$), `CRITICAL` ($\le 30\text{d}$), `EXPIRED`. | `DocumentService.compute_validity_status()` | Color-coded status chips in `DocumentsPage.tsx` | `test_document_validity_status_computation` |
| **E.2 Renewal Upload Flow** | Institution uploads renewed document linked via `renewal_of_id`. | `POST /documents/{id}/renew` | `UploadRenewalModal` in `DocumentsPage.tsx` | `test_institution_renewal_upload_flow` |
| **E.3 Officer Verification Flow** | Officer verifies or rejects renewed document with mandatory remarks. | `POST /documents/{id}/verify-renewal` | Verification Modal in `DocumentsPage.tsx` | `test_officer_verify_renewal_with_mandatory_remarks` |
| **E.4 Color-Coded Expiry Timeline** | Visual timeline displaying documents categorized by green/amber/red expiry windows. | `GET /documents/expiry-timeline` | Interactive Timeline Card in `DocumentsPage.tsx` | `test_expiry_timeline_endpoint` |
| **E.5 Dashboard Expiry Widget** | "Expiring in next 30/60/90 days" cross-module widget on dashboards. | `GET /documents/expiring-summary` | Expiring Documents Card in `DashboardPage.tsx` | `test_expiring_summary_widget_endpoint` |
| **E.6 Document Detail Drawer** | Drawer with complete audit lineage and renewal history. | `GET /documents/{id}/history` | `DocumentDetailDrawer` in `DocumentsPage.tsx` | `test_renewal_history_and_audit_lineage` |

---

## ⏰ Section F: Automated Notification, Alert & Escalation Engine

| Clause / Requirement | Statutory Description | Backend Implementation | Frontend UI Component | Verification & Test Suite |
| :--- | :--- | :--- | :--- | :--- |
| **F.1 Background Alert Job** | APScheduler evaluates all alert rules every minute against applications, EVCs, undertakings, and documents. | `alert_engine.evaluate_all_alert_rules()` | Background Worker | `test_trigger_sla_check_manual`, `test_alerts_and_clock.py` |
| **F.2 Idempotency & De-duplication** | Prevents duplicate alerts via idempotency key: `entity_id + rule_id + level`. | Idempotent key generation in `alert_engine.py` | In-App Alerts List | `test_alert_idempotency_prevents_duplicate_notifications` |
| **F.3 4-Level Escalation Ladder** | Level 0 (Officer) $\to$ Level 1 (Regional Officer) $\to$ Level 2 (Regional Head) $\to$ Level 3 (Bureau Officer). | `escalation_engine.py`, `escalations` table | `EscalationLadderPage.tsx`, `AlertsPage.tsx` | `test_escalation_ladder_progression` |
| **F.4 Multi-Channel Dispatches** | In-app notification + simulated SMTP email + mock SMS/WhatsApp adapters. | `notification_service.py` | Notification Bell & Dropdown in `Header.tsx` | `test_dispatches_endpoint`, `test_admin.py` |
| **F.5 Time-Travel Simulation** | `SystemClock` table. All date logic uses `get_current_date()`. `POST /admin/time-travel` and `POST /admin/reset-clock`. | `admin.py`, `system_clock.py` | `TimeTravelWidget` in `Header.tsx` & Demo Banner | `test_time_travel_30_days_evaluation`, `test_time_travel_30d_engine.py` |

---

## 🔒 Section G: Tamper-Evident Audit Trail & Statutory Reports

| Clause / Requirement | Statutory Description | Backend Implementation | Frontend UI Component | Verification & Test Suite |
| :--- | :--- | :--- | :--- | :--- |
| **G.1 Rule #1: SHA-256 Hash Chain** | Each log stores `prev_hash` and $\text{hash} = \text{SHA256}(\text{prev\_hash} + \text{canonical\_json}(\text{row}))$. | `AuditService.compute_hash()` | `AuditExplorerPage.tsx` | `test_cryptographic_audit_chain_verification` |
| **G.2 Chain Integrity Verification** | `GET /audit/verify-chain` recomputes the entire ledger and reports intact status or first tampered row. | `AuditService.verify_chain()` | Integrity Verified Banner in `AuditExplorerPage.tsx` | `test_audit_verify_chain_endpoint`, `test_audit_chain_tamper_detection` |
| **G.3 Search & Diff Explorer** | Filterable by actor, action, entity, and date range; side-by-side old vs new value JSON diff view. | `GET /audit` | Filter Bar & JSON Diff Modal in `AuditExplorerPage.tsx` | `test_audit_explorer_filtering` |
| **G.4 Application Full History** | Combined view of stage history, alerts, escalations, submissions, and verifications. | `GET /applications/{id}/full-history` | `FullHistoryTab` in `ApplicationDetailPage.tsx` | `test_application_full_history_endpoint` |
| **G.5 6 Statutory Export Reports** | Application Pendency, EVC Status, Undertaking Compliance, Document Validity, Overdue Escalations, Region Performance. | `GET /reports/{type}` (Excel/CSV export) | Interactive Recharts + Export Buttons in `ReportsPage.tsx` | `test_all_6_statutory_reports_and_audit_logging` |

---

## 🚀 Section H: Differentiating Capabilities

| Feature Name | Statutory Impact | Implementation | Frontend Experience |
| :--- | :--- | :--- | :--- |
| **1. Explainable Delay Risk Score** | Predicts application delay risk (0-100) using a transparent weighted formula: SLA ageing, dwell time, officer workload, returns, and new institution flag. | `risk_service.py`, `GET /applications/{id}/risk-score` | Color-coded Risk Badge + "Why this score?" 5-factor breakdown tooltip in `ApplicationDetailPage.tsx`. |
| **2. Natural-Language Assistant** | Translates natural language inquiries into role-scoped queries and drafts official deficiency notices. | `assistant.py`, `assistant_service.py` | Slide-over AI Assistant floating drawer in `AIAssistantWidget.tsx`. |
| **3. Lease OCR Assist** | Extracts expiration date from uploaded lease PDFs/images and pre-fills the expiry field for human officer verification. | `ocr_service.py`, `POST /documents/ocr-extract-expiry` | Pre-fill modal with mandatory human review banner in `DocumentsPage.tsx`. |
| **4. AICTE National Portal Bridge** | Bidirectional mock adapter interface syncing applications, stage transitions, and HMAC-authenticated webhooks. | `integration.py`, `integration_service.py` | Telemetry Dashboard & Push/Pull Simulator in `IntegrationPage.tsx`. |
| **5. Multilingual Interface** | Instant client-side English / Hindi (राजभाषा) translation of navigation, headers, and core statutory terms. | `LanguageContext.tsx` | Top bar language switcher (`🇮🇳 हिंदी` / `🇬🇧 EN`) in `Header.tsx`. |
| **6. Statutory Simulation & Guided Tour Suite** | Header controls with evaluator persona switcher, 10-step interactive guided tour, and instant +30d time-travel clock advance. | `Header.tsx`, `TimeTravelWidget.tsx`, `GuidedTourModal.tsx` | Header navigation bar and step-by-step guided modal overlay. |

