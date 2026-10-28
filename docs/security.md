# IntelliApprove — Security Architecture & Hardening Guide
**AICTE Approval Workflow Automation & Institutional Governance Platform**  
**Smart India Hackathon (SIH) 2026 — Problem Statement 26262**

---

## 1. Executive Security Overview

IntelliApprove implements a defense-in-depth security model specifically tailored for statutory government clearance systems, regulatory oversight, and legal evidence handling. The platform enforces strict access boundaries, immutable audit lineage, encrypted document repositories, and anti-abuse safeguards.

---

## 2. Authentication & Session Security

### A. Password Hashing & Salt Invariants
- Passwords are encrypted using a salted hash derivation: `salt$sha256(salt + password)` utilizing high-entropy hexadecimal salts (16+ bytes).
- Plaintext passwords are never persisted to disk, cached in memory, or printed in logs.
- Compatible with bcrypt and FIPS-140 standard implementations.

### B. JWT Lifecycle & Refresh Token Rotation
- **Access Tokens**: Short-lived JSON Web Tokens (default: 60 minutes) signed with `HS256` secret keys.
- **Refresh Tokens**: Long-lived cryptographic tokens (7 days) scoped exclusively with `"type": "refresh"`.
- **Endpoint**: `POST /auth/refresh`
  - Validates the active status of the user account.
  - Generates a new access token and performs single-use refresh token rotation to prevent replay attacks.

### C. Rate Limiting on Authentication Endpoints
- **Sliding Window Protection**: Tracks failed authentication attempts per `email:client_ip`.
- **Threshold**: Maximum of **5 consecutive failed login attempts within a 300-second (5-minute) window**.
- **Lockout Policy**: Returns `HTTP 429 Too Many Requests` with retry cooldown headers.
- **Audit Logging**: Every rate limit trigger and failed authentication attempt is permanently committed to `audit_logs` (`USER_LOGIN_FAILED`, `LOGIN_RATE_LIMITED`).
- Counter automatically clears upon successful authentication.

---

## 3. Storage Security & Document Hardening

### A. Encrypted File Storage at Rest (AES-256)
- Implemented via `StorageService` using **AES-256 in CBC mode with HMAC authentication (Fernet specification)**.
- Sensitive institutional assets (registered land lease deeds, structural safety certificates, fire NOCs, and financial trust balance sheets) are encrypted before writing to physical volumes.
- Decryption occurs in-memory only upon authenticated, role-scoped requests.

### B. File Upload Validation & Content Verification
- **Size Limitation**: Hard enforcement of maximum **10 MB per file** (`MAX_FILE_SIZE_BYTES`).
- **MIME Type Allowlist**: Strictly limited to:
  - `application/pdf` (`.pdf`)
  - `image/png` (`.png`)
  - `image/jpeg` (`.jpg`, `.jpeg`)
- **Magic Byte Inspection**: Validates file headers (`%PDF`, `\x89PNG`, `\xff\xd8`) to eliminate extension spoofing and embedded executable threats.

---

## 4. Non-Negotiable Tenet #1: Tamper-Evident SHA-256 Audit Trail

- **Blockchain-Inspired Ledger**: Every statutory state transition, document verification, authority verdict, and security event is recorded as a cryptographically chained block.
- **Hash Formulation**:
  $$H_n = \text{SHA-256}(H_{n-1} \parallel \text{canonical\_json}(\text{row}))$$
- **Canonical Serialization**: Deterministically sorts dictionary keys with compact separators `(',', ':')` and standardized UTC timestamps to eliminate JSON whitespace ambiguity.
- **Genesis Block**: Root trust anchor anchored to digest `7c1c21e909a349be88a1040854d68ab6c867201cff2eb61ce7b99c80d8697dd6`.
- **Verification Endpoint**: `GET /audit/verify-chain` recomputes the entire ledger in milliseconds, reporting chain health and locating the exact block index of any unauthorized direct SQL mutation.

---

## 5. Non-Negotiable Tenet #2: Mandatory Human Oversight Barrier

- **No Machine Decisions**: Autonomous system engines (APScheduler, SLA ladders, OCR, and AI Assistants) are strictly restricted to advisory and drafting roles.
- **Decision Invariant**:
  - The workflow engine outright rejects any automatic transition into terminal stages (`APPROVED` or `REJECTED`).
  - Decisions can only be executed by human officers holding the authorized role (`BUREAU_OFFICER` or `COMPETENT_AUTHORITY`).
- **Statutory 4-Point Clearance**: Approvals require affirmative human check of:
  1. Contiguous campus land & built-up area norm fulfillment.
  2. Faculty-Student Ratio (FSR) & cadre distribution.
  3. Laboratory, computing, and broadband readiness.
  4. Vigilance clearance & institutional committee compliance.

---

## 6. Role-Based Access Control (RBAC) & Data Isolation

| Role | Access & Clearance Scope | Jurisdictional Restrictions |
| :--- | :--- | :--- |
| **`INSTITUTION`** | Own technical institution only | Zero cross-institution visibility; can only view own applications, upload compliance proofs, and submit document renewals. |
| **`REGIONAL_OFFICER`** | Own assigned AICTE region | Restricted to regional application scrutiny, defect returns, and document verification within assigned regional boundary. |
| **`REGIONAL_HEAD`** | Own assigned AICTE region | SAC/SHC hearing management, regional officer review, and escalation handling within assigned region. |
| **`EVC_MEMBER`** | Assigned inspection visits | Can only access applications and campus details for specifically assigned EVC inspection schedules. |
| **`BUREAU_OFFICER`** | Nationwide jurisdiction | Full national pipeline visibility, final approval/rejection decision recording, and Level 3 escalation management. |
| **`ADMIN`** | System Administration | Platform configuration, user management, audit verification, and system clock simulation. |

---

## 7. Natural Language & OCR Safety Guardrails

- **Zero Direct SQL Execution**: The Natural-Language Assistant (`/assistant/chat`) translates human prompts exclusively into existing, validated service methods with enforced RBAC parameters. Raw SQL statements are never constructed or executed.
- **AI Notice Watermarking**: All drafted letters or deficiency directives carry a non-removable warning banner: `[AI DRAFT — REQUIRES MANDATORY OFFICIAL HUMAN REVIEW & SIGN-OFF]`.
- **OCR Pre-Fill Protocol**: Document OCR assistance extracts dates for pre-filling input fields only; the platform strictly forbids auto-verifying documents without human officer sign-off.

