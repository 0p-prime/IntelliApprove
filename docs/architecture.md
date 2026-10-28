# IntelliApprove: System Architecture Specification
**AICTE Approval Workflow Automation, Compliance Monitoring and Alert Management System**  
**SIH 2026 — Problem Statement 26262**

---

## 1. High-Level Modular Architecture

```mermaid
graph TB
    subgraph UI ["Frontend Web Application (React + Vite + TypeScript + Tailwind)"]
        UI_Dash["Dashboard Module<br/>(Metrics, Recharts, Regional Heat)"]
        UI_Apps["Applications Portal<br/>(Submission & Lifecycle Track)"]
        UI_Docs["Document Store UI<br/>(Upload & Scrutiny Workspace)"]
        UI_EVC["EVC Inspection Workspace<br/>(Field Verification Evidence)"]
        UI_Decision["Competent Authority Panel<br/>(Human Oversight Required Gate)"]
        UI_Under["Undertakings Tracker<br/>(Post-Approval Monitoring)"]
        UI_Audit["Audit Trail Explorer<br/>(Vigilance & State Log Viewer)"]
        UI_Config["Workflow & Ladder Configurator<br/>(Rule #3 Database Config)"]
    end

    subgraph API_GW ["FastAPI Gateway & Auth Layer (Python 3.11/3.13)"]
        AUTH["JWT & RBAC Security Module<br/>(Role Enforcement & Token Signer)"]
        CORS["CORS & Request Middleware"]
    end

    subgraph Core_Services ["Backend Core Modules"]
        WORKFLOW["Workflow Engine<br/>• Stage Route Resolution<br/>• State Transitions<br/>• SLA Window Evaluator"]
        ALERT_ENG["Alert Engine<br/>• APScheduler Worker<br/>• Escalation Ladder Dispatcher<br/>• Reminder Offsets (T-24h, T-6h)"]
        COMPLIANCE["Compliance & Norms Auditor<br/>• APH Formula Calculator (FSR, Land, Built-up, PCs)<br/>• Deficiency Record Generator"]
        AUDIT_MOD["Audit Module<br/>• Append-only State Logger<br/>• Actor & IP Diff Capture<br/>• Non-Negotiable Rule #1"]
        NOTIF["Notification Module<br/>• In-App Alerts Queue<br/>• Role Broadcaster<br/>• Priority Routing"]
        DOC_STORE["Document Store<br/>• Legal Deed & NOC Verification<br/>• Scrutiny Stamp & Status"]
        INTEG_ADAPT["Integration Adapter<br/>• External AICTE Portal Connectors<br/>• Digilocker / NAD Verification<br/>• Digital Signature Hasher"]
    end

    subgraph Data_Layer ["Persistence & Storage Layer"]
        DB[(PostgreSQL / SQLite Local Fallback)]
        FS[Static Document Files & Digital Evidence]
    end

    UI --> API_GW
    API_GW --> Core_Services
    WORKFLOW --> DB
    ALERT_ENG --> DB
    COMPLIANCE --> DB
    AUDIT_MOD --> DB
    NOTIF --> DB
    DOC_STORE --> FS
    DOC_STORE --> DB
    INTEG_ADAPT --> DB

    WORKFLOW -. Every State Change .-> AUDIT_MOD
    ALERT_ENG -. SLA Breach Escalation .-> NOTIF
    ALERT_ENG -. Escalation Event .-> AUDIT_MOD
    WORKFLOW -. Approaching Deadline .-> ALERT_ENG
    DOC_STORE -. Verification Result .-> AUDIT_MOD
```

---

## 2. Core Modules Breakdown

### 1. Workflow Engine
- **Purpose**: Governs the application lifecycle from DRAFT through SCRUTINY, EVC, HEARING, and COMPETENT AUTHORITY DECISION.
- **Rule #3 Dynamic Compliance**: Reads valid transitions exclusively from the `workflow_routes` and `stage_configs` database tables, preventing hardcoded business logic.
- **Rule #2 Human Oversight Gate**: Enforces that automated engines cannot advance an application directly into APPROVED or REJECTED. Only an authenticated human user with role `COMPETENT_AUTHORITY` can sign the final verdict.

### 2. Alert Engine
- **Purpose**: Background daemon (powered by APScheduler) monitoring stage timeouts and pending deadlines.
- **Escalation Ladders**: Reads configurable `escalation_ladders` per stage.
  - Generates warning notifications at configured reminder offsets (e.g. 24 hours and 6 hours prior to breach).
  - When SLA deadline lapses, automatically elevates the application to `is_escalated = True` and escalates notification to Regional Directors or Member Secretary.
  - Automatically flags overdue compliance undertakings as `BREACHED`.

### 3. Dashboard Module
- **Purpose**: Real-time aggregated visualization for educational administrators and institutional leadership.
- **Key Metrics**: Application funnel counts, compliance score distribution, SLA breach alerts, regional distribution heatmap, and pending competent authority decisions.

### 4. Audit Module (Non-Negotiable Rule #1)
- **Purpose**: Provides an append-only, tamper-evident record of all system events.
- **Coverage**: Every state change (stage movement, document verification, undertaking status change, alert creation, automated escalation, user login, and configuration update) records:
  - Timestamp (UTC)
  - Actor User ID, Email, and Role
  - Action Key and Target Entity (e.g., `application`, `undertaking`, `document`, `config`)
  - Before state (`old_value`) and After state (`new_value`) JSON diffs
  - Client IP Address and Detailed contextual remarks

### 5. Notification Module
- **Purpose**: Delivers prioritized in-app alerts categorized by severity (`INFO`, `WARNING`, `CRITICAL`, `ESCALATION`).
- **Targeting**: Dispatches alerts to individual users or to entire role groups (e.g., all Regional Officers or Scrutiny Officers).

### 6. Document Store
- **Purpose**: Manages institutional proof submissions (Land Title Deeds, Municipal Approved Building Plans, Fire Safety NOCs, Audited Financial Accounts, and Faculty Affidavits).
- **Scrutiny Workflow**: Supports inline verification status stamping (`PENDING_VERIFICATION`, `VERIFIED_COMPLIANT`, `DEFICIENT_REJECTED`) with remarks and reviewer signature.

### 7. Integration Adapter
- **Purpose**: Abstraction layer for external government systems and digital authenticity validation.
- **Capabilities**:
  - Generates verifiable approval letter numbers (`AICTE/EOA/2026-2027/XXXXX`).
  - Computes SHA-256 digital signature hashes combining application metadata, competent authority credentials, and decision timestamp.
  - Prepared for DigiLocker and National Academic Depository (NAD) integration.

---

## 3. Database Entity Relationship Model

```mermaid
erDiagram
    INSTITUTIONS ||--o{ APPLICATIONS : submits
    INSTITUTIONS ||--o{ USERS : employs
    APPLICATIONS ||--o{ ACADEMIC_PROGRAMS : contains
    APPLICATIONS ||--o{ APPLICATION_DOCUMENTS : includes
    APPLICATIONS ||--o{ DEFICIENCY_RECORDS : flags
    APPLICATIONS ||--o{ UNDERTAKINGS : binds
    APPLICATIONS ||--o{ APPLICATION_STAGE_HISTORY : logs
    APPLICATIONS ||--o{ ALERTS : triggers
    STAGE_CONFIGS ||--o{ WORKFLOW_ROUTES : defines
    STAGE_CONFIGS ||--o{ ESCALATION_LADDERS : schedules
    STAGE_CONFIGS ||--o{ APPLICATIONS : assigns
    COMPLIANCE_NORM_RULES ||--o{ DEFICIENCY_RECORDS : benchmarks
    USERS ||--o{ AUDIT_LOGS : records
```

---

## 4. Role-Based Access Control (RBAC) Matrix

| Endpoint Group | Allowed Roles | Description |
| :--- | :--- | :--- |
| `/api/v1/auth/*` | Public / All | Login, profile, demo role switcher |
| `/api/v1/applications` (Create/Draft) | `INSTITUTION`, `ADMIN` | Submit new application drafts |
| `/api/v1/applications` (List/View) | All (Scoped) | Scoped to institution or full access for officers |
| `/api/v1/workflow/scrutiny-report` | `SCRUTINY_OFFICER`, `ADMIN` | Submit legal and document findings |
| `/api/v1/workflow/evc-report` | `EVC_INSPECTOR`, `ADMIN` | Submit field verification and lab reports |
| `/api/v1/workflow/authority-decision` | `COMPETENT_AUTHORITY`, `ADMIN` | Record human approval/rejection with checklist |
| `/api/v1/config/*` | `ADMIN`, `COMPETENT_AUTHORITY` | Edit stages, routes, SLAs, and escalation ladders |
| `/api/v1/audit/*` | `ADMIN`, `COMPETENT_AUTHORITY`, `REGIONAL_OFFICER` | View immutable audit logs |
