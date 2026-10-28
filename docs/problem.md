# Problem Statement: AICTE Approval Workflow Automation, Compliance Monitoring, and Alert Management System

**Event:** Smart India Hackathon (SIH) 2026  
**Problem Statement ID:** 26262  
**Organization:** All India Council for Technical Education (AICTE), Ministry of Education, Govt. of India  
**Category:** Software / GovTech  

---

## 1. Background & Context
The All India Council for Technical Education (AICTE) is the statutory body responsible for proper planning and coordinated development of technical education across India. Every year, over 10,000+ technical institutions (Engineering, Management, Pharmacy, Architecture, Polytechnic, etc.) apply for:
- Extension of Approval (EoA)
- Establishment of New Technical Institutions
- Increase in Intake / Addition of New Courses
- Closure / Mergers / Change of Trust or Site

The current evaluation process involves multiple stakeholders:
1. **Educational Institutions**: Submitting institutional profiles, land surveys, building approvals, academic programs, faculty cadre ratios, and affidavits.
2. **Scrutiny Committee**: Verifying submitted affidavits, legal deeds, and adherence to AICTE Approval Process Handbook (APH) norms.
3. **Expert Visit Committee (EVC)**: Conducting physical / virtual inspections of laboratories, classrooms, and faculty presence.
4. **Standing Hearing Committee (SHC) / Standing Appellate Committee (SAC)**: Reviewing non-compliant or appealed applications.
5. **Regional Offices & Competent Authority**: Regional Directors, Executive Committee, and Member Secretary making final approval/refusal orders.

---

## 2. Challenges in the Existing Manual Workflow
- **SLA Breaches & Latency**: Applications frequently stall between stages without visibility into responsible officers or timeline countdowns.
- **Manual Compliance Auditing**: Manual calculation of Faculty-to-Student Ratios (FSR), built-up area per student, and computer terminal ratios leads to human errors and delays.
- **Lack of Proactive Escalation**: When scrutiny officers or inspection committees exceed allowed windows, delays propagate without automated escalation ladders.
- **Post-Approval Undertakings Non-Compliance**: Institutions granted conditional approval subject to rectifying minor deficiencies within 6 months often lack continuous monitoring.
- **Audit & Vigilance Vulnerability**: Inadequate tamper-evident audit trails make vigilance inspections difficult to verify after the fact.

---

## 3. Objective & Key System Requirements
Design and build **IntelliApprove**, an automated, transparent, auditable, and resilient workflow automation system with:
1. **Automated Stage Routing & Workflow Management**: Configurable lifecycle progression from submission to scrutiny, EVC inspection, hearing, and authority decision.
2. **AICTE APH Norms Compliance Engine**: Automated calculation of FSR, land area, instructional built-up area, computing facilities, and mandatory statutory committees (Anti-Ragging, ICC, Student Grievance, Barrier-Free Environment).
3. **Automated Alert & Escalation Engine**: Background scheduling (APScheduler) monitoring stage SLAs, dispatching warning alerts at reminder offsets (T-24h, T-6h), and escalating overdue tasks up the administrative chain (Regional Officer -> Competent Authority).
4. **Undertakings & Post-Approval Tracker**: Tracking time-bound compliance commitments made by institutions for conditional approvals.
5. **Universal Immutable Audit Trail**: Cryptographic / state-change logging of every single action, login, document review, config modification, and decision.
6. **Strict Human Oversight Guarantee**: The system must **never** auto-approve or auto-reject. Automated engines calculate scores and highlight deficiencies; final decisions require competent authority human sign-off with mandatory checklists.
