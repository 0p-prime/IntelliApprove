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

# Install dependencies
pip install -r requirements.txt email-validator

# Run database seeder (initializes SQLite fallback with AICTE data)
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

## 6. Pre-Configured Demo Accounts (Role Switcher)

Use the **"Persona Switcher"** in the top navigation bar to seamlessly test all roles:

| Role | Email | Password | Primary Functions |
| :--- | :--- | :--- | :--- |
| **Competent Authority** | `member.secretary@aicte.gov.in` | `aicte123` | Complete Human Oversight Checklist, grant EoA approval or issue speaking orders |
| **Scrutiny Officer** | `scrutiny.officer@aicte.gov.in` | `aicte123` | Verify legal documents, check affidavits, submit scrutiny report |
| **EVC Inspector** | `evc.inspector@aicte.gov.in` | `aicte123` | Physical site verification, lab equipment inspection report |
| **Regional Officer** | `ro.northern@aicte.gov.in` | `aicte123` | Monitor SLA escalations, verify post-approval compliance undertakings |
| **Institution Admin** | `institute@ditm.ac.in` | `aicte123` | Submit EoA applications, review APH compliance score, rectify deficiencies |
| **System Administrator** | `admin@aicte.gov.in` | `aicte123` | Configure workflow routes, edit stage SLA hours, manage escalation ladders |
