# IntelliApprove

> **AICTE Approval Workflow Automation, Compliance Monitoring, and Alert Management System**  
> **Smart India Hackathon (SIH) 2026 — Problem Statement 26262**  
> **All India Council for Technical Education (AICTE), Ministry of Education, Govt. of India**

---

## 1. Project Overview
IntelliApprove is an integrated, government-grade workflow automation platform designed to streamline the annual approval cycle for 10,000+ technical institutions across India. It eliminates administrative latency through automated handbook compliance auditing, configurable multi-stage workflow routes, background SLA timeout monitoring, and automated escalation ladders—while guaranteeing absolute auditability and mandatory human oversight.

---

## 2. Monorepo Structure

```text
IntelliApprove/
├── backend/                  # FastAPI Application (Python 3.11/3.13)
│   ├── app/
│   │   ├── api/v1/          # REST Endpoints (Auth, Apps, Workflow, Compliance, Docs, Alerts, Config, Audit, Analytics)
│   │   ├── core/            # Config, Database Session, Security (JWT), RBAC Dependencies
│   │   ├── models/          # SQLAlchemy Models (Users, Applications, Stages, Ladders, Audits, Undertakings)
│   │   ├── schemas/         # Pydantic Schemas for Strict Typing & Validation
│   │   ├── services/        # Business Logic (AuditService, WorkflowService, ComplianceEngine, Scheduler)
│   │   ├── main.py          # FastAPI App Entrypoint, CORS, Lifespan Hooks
│   │   └── seed.py          # Database Seeder with Realistic AICTE Institutions & Demo Personas
│   ├── tests/               # Pytest Suite Verifying Non-Negotiable Rules 1, 2, 3 & 5
│   ├── requirements.txt     # Python Dependencies
│   └── Dockerfile           # Backend Container Definition
├── frontend/                 # React 19 + Vite + TypeScript + Tailwind CSS
│   ├── src/
│   │   ├── api/             # Fetch Client with Automatic Bearer Token Management
│   │   ├── components/      # UI Shell (Sidebar, Header, HumanOversightBadge, StatusPill, AlertsDrawer, States)
│   │   ├── context/         # AuthContext & Multi-Role Demo Switcher
│   │   ├── pages/           # Pages (Dashboard, Applications, EVC, Undertakings, Documents, Alerts, Reports, Audit, Admin)
│   │   └── types/           # Strict Domain TypeScript Interfaces
│   ├── nginx.conf           # Production Reverse Proxy Config
│   ├── package.json         # Frontend Dependencies
│   └── Dockerfile           # Multi-Stage Build Container Definition
├── docs/                     # Architectural Documentation
│   ├── problem.md           # Full SIH 2026 Problem Statement 26262 Specification
│   └── architecture.md      # Detailed Architecture & Mermaid Diagrams
├── docker-compose.yml        # Multi-Container Orchestration (Postgres + Backend + Frontend)
└── README.md                 # Project Setup & Verification Instructions
```

---

## 3. Non-Negotiable System Tenets

1. **Universal Audit Trail**: Every single state change (application stage transition, document review, undertaking creation/verification, automated escalation, user login, and config modification) immediately writes an append-only `audit_logs` record containing actor context, timestamp, IP, and before/after diffs.
2. **Strict Human Oversight Required**: The platform **never auto-approves or auto-rejects** an application. Automated engines only compute compliance scores and highlight deficiencies to assist human reviewers. Final decisions are strictly reserved for Competent Authority members and require explicit confirmation of a 4-point verification checklist.
3. **Database-Driven Dynamic Configuration**: All stage timelines, transition routes, reminder offsets (T-24h, T-6h), escalation ladders, and handbook compliance norms are stored in the database—never hardcoded.
4. **Role-Based Access Control (RBAC)**: Enforces role permissions on every API endpoint across 6 roles: `INSTITUTION`, `SCRUTINY_OFFICER`, `EVC_INSPECTOR`, `REGIONAL_OFFICER`, `COMPETENT_AUTHORITY`, and `ADMIN`.
5. **Government-Tech UI Excellence**: Deep Blue (`#0B2240`) primary, warm Saffron (`#E05A1B`) accent, Ashoka green indicators, tricolor accent ribbon, Recharts visualizations, and accessible loading/empty/error states.

---

## 4. Quick Start: Local Development

### Prerequisites
- Python 3.11 or newer
- Node.js v18 or newer & npm

### Step 1: Backend Setup
```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment
python -m venv venv
# On Windows:
.\venv\Scripts\Activate.ps1
# On macOS/Linux:
source venv/bin/activate

# Install dependencies (including Alembic)
pip install -r requirements.txt email-validator

# Run database migrations with Alembic
alembic upgrade head

# Run database seeder (initializes 15 core tables with rich AICTE seed data)
python -m app.seed

# Run backend test suite
pytest tests/test_backend.py

# Start FastAPI server
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
*Backend API will be running at `http://127.0.0.1:8000` with interactive Swagger docs at `http://127.0.0.1:8000/docs`.*

### Step 2: Frontend Setup
```bash
# Open a new terminal in frontend directory
cd frontend

# Install packages
npm install

# Build for production validation
npm run build

# Start Vite development server
npm run dev
```
*Frontend will be running at `http://127.0.0.1:5173`.*

---

## 5. Running with Docker Compose

To spin up the complete production-like stack (PostgreSQL 16 + FastAPI + Nginx React Frontend):

```bash
docker compose up --build
```

- **Frontend Application**: `http://localhost:5173`
- **Backend API**: `http://localhost:8000`
- **Swagger Documentation**: `http://localhost:8000/docs`
- **PostgreSQL Database**: Port `5432`

---

## 6. Pre-Configured Demo Accounts (All Roles)

Default password for all demo accounts: **`aicte123`**

| Role | Email | Region / Scope | Primary Functions |
| :--- | :--- | :--- | :--- |
| **ADMIN** | `admin@aicte.gov.in` | National HQ | System administration, user & region management |
| **ADMIN** | `system.admin@aicte.gov.in` | National HQ | Audit log inspection, security policy configuration |
| **BUREAU_OFFICER** | `member.secretary@aicte.gov.in` | Approval Bureau | Human oversight decision panel, speaking orders, digital signatures |
| **BUREAU_OFFICER** | `bureau.policy@aicte.gov.in` | Policy Bureau | Workflow template routing & high-level SLA escalations |
| **REGIONAL_HEAD** | `head.nw@aicte.gov.in` | North-Western | Regional oversight, Level-2 SLA escalations, committee appointments |
| **REGIONAL_HEAD** | `head.w@aicte.gov.in` | Western | Western region oversight (Mumbai / Pune) |
| **REGIONAL_HEAD** | `head.sw@aicte.gov.in` | South-Western | South-Western region oversight (Bengaluru / Kerala) |
| **REGIONAL_OFFICER** | `ro.nw@aicte.gov.in` | North-Western | Scrutiny review, undertaking tracking, Level-1 escalations |
| **REGIONAL_OFFICER** | `ro.w@aicte.gov.in` | Western | Scrutiny evaluation & compliance verification |
| **REGIONAL_OFFICER** | `ro.s@aicte.gov.in` | Southern | Scrutiny evaluation & document verification |
| **EVC_MEMBER** | `evc.expert1@aicte.gov.in` | Eastern | Expert Visit Committee physical & virtual inspections |
| **EVC_MEMBER** | `evc.expert2@aicte.gov.in` | South-Western | Infrastructure, laboratory and faculty verification |
| **INSTITUTION** | `principal@ditm.ac.in` | Delhi (NW) | Submit EoA applications, upload deeds, track approvals |
| **INSTITUTION** | `director@mcer.edu.in` | Maharashtra (W) | Manage undertakings, rectify document shortfalls |

---

## 7. Database Architecture & Seed Dataset

IntelliApprove implements an 18-table architecture managed via **SQLAlchemy + Alembic migrations**:

### Database Tables (18 Core Tables)
1. **`users`**: User identity, role-based access (`INSTITUTION`, `REGIONAL_OFFICER`, `REGIONAL_HEAD`, `BUREAU_OFFICER`, `EVC_MEMBER`, `ADMIN`), regional jurisdiction, salted password hashes.
2. **`regions`**: 8 official AICTE regions (Northern, Southern, Western, Eastern, Central, South-Western, North-Western, South-Central).
3. **`institutions`**: 60 AICTE-approved institutions across Indian states, mapped to regions and institution categories (Engineering, Management, Pharmacy, Architecture, Polytechnic).
4. **`applications`**: 150 applications spanning lifecycle stages (`SUBMITTED`, `SCRUTINY`, `EVC`, `SAC_SHC`, `BUREAU_DECISION`, `APPROVED`, `REJECTED`, `DEFICIENT`), assigned officers, risk scores, compliance scores, deficiency counts, and due dates.
5. **`workflow_templates`**: Configurable route definitions ("Only Scrutiny", "Scrutiny + EVC", "EVC + SAC/SHC", "Only EVC", "Scrutiny + EVC + SAC/SHC") stored as JSON stages and transitions.
6. **`stage_history`**: Granular immutable state transitions for each application with timestamps, acting officers, and remarks.
7. **`evc_schedules`**: 25 Expert Visit Committee inspection schedules (upcoming, due soon, overdue, completed) with committee member IDs and new-institution flags.
8. **`undertakings`**: 40 post-approval compliance commitments (pending, due soon, overdue, verified) tied to legal conditions and verification proofs.
9. **`documents`**: 60 institutional documents (leases, building plans, fire NOCs, audited accounts) with lease expiry dates spread from -30 to +365 days.
10. **`files`**: Static evidence file registry with SHA-256 digital fingerprinting.
11. **`alert_rules`**: Automated alert policies (T-7, T-3, T-1, overdue; lease warnings at 90/60/30/7 days; multi-tier escalation ladders).
12. **`notifications`**: Targeted user alerts with severities (`INFO`, `WARNING`, `CRITICAL`, `ESCALATION`).
13. **`escalations`**: Automated multi-tier escalation records (Level 1: Regional Officer -> Level 2: Regional Head -> Level 3: Bureau Officer).
14. **`audit_logs`**: Append-only cryptographic audit trail linking every event in a SHA-256 hash chain (`prev_hash` -> `hash`) anchored to genesis digest `7c1c21e...`.
15. **`system_clock`**: Simulated date controller for time-travel demonstrations during evaluations.
16. **`compliance_norm_rules`**: Configurable AICTE Approval Process Handbook (APH) norms (FSR, Land, Built-up area, Digital computers, Anti-Ragging, POSH ICC, Student Grievance, Barrier-Free Divyangjan, Cadre Ratios).
17. **`academic_programs`**: Departmental program enrolment records (UG, PG, Diploma) with faculty counts, intake, student populations, and division numbers.
18. **`deficiency_records`**: Granular flagged deficiencies against statutory norms, rectification proofs, officer verifications, and compliance scores.

### Full Automated Verification Suite (83 of 83 Tests Passing)
Run the entire comprehensive test suite across all 10 modules:
```bash
pytest -o pythonpath=backend backend/tests -v
```

Test coverage includes:
- `test_alerts_and_clock.py`: System clock simulation, manual advance, SLA evaluations, escalation generation, rules CRUD.
- `test_aph_compliance_and_audit_chain.py`: APH norm evaluations, deficiency rectification & officer verification, national reports, SHA-256 cryptographic chain integrity verification & tamper detection, CSV export.
- `test_backend.py`: Health checks, Non-Negotiable Rule #1 (Login audit log), Rule #2 (Human oversight gate), Rule #3 (Configurable workflows & SLAs), Rule #5 (RBAC).
- `test_dashboard.py`: National KPIs, 8-region performance distribution, stage funnel, ageing buckets, officer workload, bottlenecks, upcoming deadlines.
- `test_documents.py`: Validity status computations (VALID, EXPIRING_SOON, CRITICAL, EXPIRED), renewals upload & verification, document timelines.
- `test_evc.py`: EVC auto-creation, new-institution queue prioritization, scheduling/rescheduling with audit logs, inspection completion & auto-advancement.
- `test_rbac_scoping.py`: Strict data scoping across all 6 roles (ADMIN, BUREAU_OFFICER, REGIONAL_HEAD, REGIONAL_OFFICER, EVC_MEMBER, INSTITUTION).
- `test_time_travel_30d_engine.py`: Fast-forwarding time +30 days, multi-entity escalations, idempotency, auto-resolution on compliance fulfillment, external channel dispatching.
- `test_undertakings.py`: Conditional approvals, SHA-256 evidence hashing, officer verification/rejection with mandatory speaking orders, compliance score heat tables.
- `test_workflow_engine.py`: State-machine validation across all 5 workflow routes, human oversight barriers, return-to-stage deficiency handling, and Electronic Case Summary (ECS) generation.
