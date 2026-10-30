# 🚀 IntelliApprove — Production Deployment Guide
**Smart India Hackathon 2026 (Problem Statement 26262)**  
*AICTE Approval Workflow Automation, Compliance & Vigilance Engine*

This guide provides end-to-end instructions for deploying IntelliApprove to production cloud infrastructure using managed PostgreSQL (Supabase or Neon), a Python FastAPI backend (Render or Railway), and a React + Vite frontend (Vercel or Netlify).

---

## 🏗️ Architecture Overview

```mermaid
flowchart LR
    subgraph CDN ["Frontend Layer (Vercel / Netlify)"]
        UI["React 19 + TypeScript SPA"]
    end

    subgraph Cloud ["Backend App Layer (Render / Railway)"]
        API["FastAPI REST Engine\n(Port 8000 / $PORT)"]
        SCHED["APScheduler (SLA & Alert Job)"]
        AICTE["AICTE Legacy Integration Bridge"]
    end

    subgraph Storage ["Managed Database & Store"]
        PG[("PostgreSQL 15+\n(Supabase / Neon)")]
        VAULT[("Encrypted File Storage\n(SHA-256 Hashes)")]
    end

    UI -->|HTTPS / JWT Bearer| API
    API -->|Async Job Runner| SCHED
    API -->|Bi-directional Sync| AICTE
    API -->|SQLAlchemy 2.0 Pool| PG
    API -->|HMAC & File Verification| VAULT
```

---

## 🗄️ Part 1: Database Setup (Supabase or Neon PostgreSQL)

IntelliApprove works seamlessly with any modern PostgreSQL service (version 14+) with SSL enforced.

### Option A: Supabase (Recommended)
1. Log in to [Supabase](https://supabase.com) and click **New Project**.
2. Set Project Name to `intelliapprove-prod` and generate a strong database password.
3. Select your preferred AWS region (e.g., `ap-south-1` Mumbai).
4. Once created, navigate to **Project Settings** -> **Database**.
5. Copy the **Connection String (URI)** under the *Transaction Pooler* or *Direct Connection*:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres?sslmode=require
   ```

### Option B: Neon Serverless Postgres
1. Log in to [Neon](https://neon.tech) and create a project `intelliapprove`.
2. Select PostgreSQL 16 and your nearest region.
3. Under the Dashboard, copy the connection string:
   ```
   postgresql://[USER]:[PASSWORD]@[ENDPOINT].neon.tech/neondb?sslmode=require
   ```

> [!NOTE]
> IntelliApprove automatically normalizes legacy `postgres://` URLs to `postgresql://` and enables connection pre-ping (`pool_pre_ping=True`) for serverless auto-suspending databases like Neon.

---

## ⚙️ Part 2: Backend Deployment (Render or Railway)

### Option A: Render (Using `render.yaml` Blueprint)
1. Fork or push your IntelliApprove repository to GitHub or GitLab.
2. Sign in to [Render](https://render.com).
3. Click **New** -> **Blueprint**.
4. Select your repository. Render will automatically detect [`backend/render.yaml`](file:///d:/IntelliApprove/backend/render.yaml).
5. Enter your database connection string under `DATABASE_URL` (or let Render provision a managed database automatically).
6. Click **Apply**.
7. The build command will execute:
   ```bash
   pip install -r requirements.txt && python -m app.seed
   ```
   and launch:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```
8. Copy your backend URL (e.g., `https://intelliapprove-backend.onrender.com`).

### Option B: Railway (One-Click)
1. Go to [Railway](https://railway.app) and click **New Project** -> **Deploy from GitHub repo**.
2. Select the `IntelliApprove` repository.
3. Under Settings:
   - Root Directory: `backend`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `python -m app.seed && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Under Variables, configure:
   - `DATABASE_URL`: `postgresql://...`
   - `SECRET_KEY`: `[YOUR_RANDOM_SECRET_KEY]`
   - `ENABLE_SCHEDULER`: `true`
5. Generate a public domain under **Networking**.

---

## 🌐 Part 3: Frontend Deployment (Vercel or Netlify)

### Option A: Vercel (Recommended)
1. Log in to [Vercel](https://vercel.com) and click **Add New** -> **Project**.
2. Import your GitHub repository.
3. Configure project settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Under **Environment Variables**, add:
   | Key | Value |
   | :--- | :--- |
   | `VITE_API_URL` | `https://intelliapprove-backend.onrender.com` (Your backend URL) |
5. Click **Deploy**. Vercel will apply [`frontend/vercel.json`](file:///d:/IntelliApprove/frontend/vercel.json) ensuring all SPA deep links redirect cleanly to `index.html`.

### Option B: Netlify
1. Log in to [Netlify](https://netlify.com) and click **Add new site** -> **Import an existing project**.
2. Choose your repository.
3. Netlify will detect [`frontend/netlify.toml`](file:///d:/IntelliApprove/frontend/netlify.toml):
   - Base directory: `frontend`
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Set Environment Variable:
   - `VITE_API_URL` = `https://intelliapprove-backend.onrender.com`
5. Click **Deploy Site**.

---

## 🔑 Part 4: Environment Variables Master Matrix

### Backend Variables (`backend/.env`)

| Variable Name | Required | Example / Default | Description |
| :--- | :---: | :--- | :--- |
| `DATABASE_URL` | **Yes** | `postgresql://user:pass@host:5432/db?sslmode=require` | Managed PostgreSQL database URI (or SQLite for local dev). |
| `SECRET_KEY` | **Yes** | `[256-bit-random-hex-string]` | Used to sign JWT auth tokens (`HS256`). |
| `ALGORITHM` | No | `HS256` | JWT cryptographic signature algorithm. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `1440` (24 hours) | JWT token lifespan. |
| `BACKEND_CORS_ORIGINS` | **Yes** | `["https://intelliapprove.vercel.app"]` | Allowed origins permitted to make cross-origin browser requests. |
| `ENABLE_SCHEDULER` | No | `true` | Runs the APScheduler background thread for SLA checking and alert evaluation. |
| `SLA_CHECK_INTERVAL_SECONDS` | No | `30` | Interval in seconds between statutory SLA checks. |
| `ALERT_EVAL_INTERVAL_SECONDS` | No | `60` | Interval between alert rule evaluations. |
| `SMTP_HOST` | No | `smtp.mailtrap.io` | SMTP gateway host for email alert delivery. |
| `SMTP_PORT` | No | `587` | SMTP gateway port. |
| `SMTP_USER` | No | `[mailtrap-user]` | SMTP credentials username. |
| `SMTP_PASSWORD` | No | `[mailtrap-password]` | SMTP credentials password. |
| `SMTP_FROM` | No | `alerts@aicte.gov.in` | Sender email address. |
| `GEMINI_API_KEY` | No | `AIzaSy...` | Optional Gemini API key for Natural-Language Assistant and OCR. |

### Frontend Variables (`frontend/.env`)

| Variable Name | Required | Example / Default | Description |
| :--- | :---: | :--- | :--- |
| `VITE_API_URL` | **Yes** (Prod) | `https://intelliapprove-backend.onrender.com` | Base URL of deployed backend. Omit in local development to use Vite's proxy. |

---

## 🔄 Part 5: One-Step Cloud Database Seeding & Verification

Once deployed, initialize and populate the database with complete AICTE seed data using either method below:

### Method 1: Using the Cloud Seed Reset Endpoint (No Terminal Needed)
Log in to the web interface as System Administrator (`admin@aicte.gov.in`), open browser console or make an authenticated POST request:
```bash
curl -X POST "https://YOUR_BACKEND_URL/api/v1/admin/reset-demo-data" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Method 2: Via Terminal CLI
```bash
python seed_reset.py
# or on Windows
seed-reset.bat
# or on Linux
./seed-reset.sh
```

### Post-Deployment Verification Checklist
1. Visit `https://YOUR_FRONTEND_URL/health` -> Verify status returns `{"status":"healthy","database":"connected"}`.
2. Sign in as `admin@aicte.gov.in` / `aicte123` via Quick Demo Persona dropdown.
3. Open **Vigilance Explorer** (`/audit`) -> Confirm `"Tamper-Evident SHA-256 Hash Chain: 100% Verified"`.
4. Click **Statutory Reports** (`/reports`) -> Export CSV and PDF reports.
5. Click **+30d Time Travel** in the Demo Banner -> Confirm instant simulated time acceleration and SLA alerts.

