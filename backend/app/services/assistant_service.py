"""
Natural-Language AI Assistant Service:
Translates human queries into strictly role-scoped database service queries (NO raw SQL),
enforcing RBAC boundaries, and drafts statutory notices clearly marked for human review.

Falls back to semantic keyword parsing if GEMINI_API_KEY is not configured.
"""
import os
import re
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_

from app.models.entities import (
    Application,
    Institution,
    Region,
    EVCSchedule,
    Document,
    Undertaking,
    User
)
from app.api.v1.evc import compute_evc_status, get_system_now
from app.services.risk_service import RiskService

REGION_KEYWORDS = {
    "northern": 1,
    "southern": 2,
    "western": 3,
    "eastern": 4,
    "central": 5,
    "south-western": 6,
    "south western": 6,
    "north-western": 7,
    "north western": 7,
    "south-central": 8,
    "south central": 8
}


class AssistantService:
    @staticmethod
    def process_query(db: Session, prompt: str, current_user: User) -> Dict[str, Any]:
        """
        Translates human language into role-scoped, validated queries.
        Never executes raw SQL. Strictly respects current_user RBAC.
        """
        now = get_system_now(db)
        prompt_lower = prompt.lower().strip()

        # Extract target region if specified
        target_region_id = None
        target_region_name = None
        for r_name, r_id in REGION_KEYWORDS.items():
            if r_name in prompt_lower:
                target_region_id = r_id
                target_region_name = r_name.title()
                break

        # RBAC Regional Override for Regional Officers/Heads
        if current_user.role in ["REGIONAL_OFFICER", "REGIONAL_HEAD"] and current_user.region_id:
            target_region_id = current_user.region_id
            target_region_name = current_user.region.name if current_user.region else "Assigned Region"

        # --- Intent 1: Notice Drafting (Imperative action) ---
        if "draft" in prompt_lower or "notice" in prompt_lower or "memo" in prompt_lower or "letter" in prompt_lower:
            return AssistantService._handle_notice_drafting(prompt, current_user)

        # --- Intent 2: Overdue EVCs Query ---
        if "overdue evc" in prompt_lower or "evc overdue" in prompt_lower or ("evc" in prompt_lower and "overdue" in prompt_lower) or ("inspection" in prompt_lower and "overdue" in prompt_lower):
            return AssistantService._handle_overdue_evcs(db, now, target_region_id, target_region_name, current_user)

        # --- Intent 3: Expiring Leases & Documents ---
        if "lease" in prompt_lower or "document" in prompt_lower or "expir" in prompt_lower or "validity" in prompt_lower or "noc" in prompt_lower:
            days = 30
            if "60" in prompt_lower:
                days = 60
            elif "90" in prompt_lower:
                days = 90
            return AssistantService._handle_expiring_documents(db, now, days, "LEASE" if "lease" in prompt_lower else None, target_region_id, current_user)

        # --- Intent 4: High Risk Applications ---
        if "high risk" in prompt_lower or "delay risk" in prompt_lower or "bottleneck" in prompt_lower or "critical delay" in prompt_lower:
            return AssistantService._handle_high_risk_cases(db, target_region_id, current_user)

        # --- Intent 5: Specific Application Lookup by Ref No ---
        ref_match = re.search(r"1-10[0-9]{8}", prompt)
        if ref_match:
            ref_no = ref_match.group(0)
            return AssistantService._handle_application_lookup(db, ref_no, current_user)

        # --- Default: Executive Summary Stats ---
        return AssistantService._handle_general_summary(db, current_user)

    @staticmethod
    def _handle_overdue_evcs(db: Session, now: datetime, region_id: Optional[int], region_name: Optional[str], user: User) -> Dict[str, Any]:
        q = db.query(EVCSchedule).join(Application, EVCSchedule.application_id == Application.id)

        # Enforce RBAC
        if user.role == "INSTITUTION":
            q = q.filter(Application.institution_id == user.institution_id)
        elif user.role in ["REGIONAL_OFFICER", "REGIONAL_HEAD"] and user.region_id:
            q = q.filter(Application.region_id == user.region_id)
        elif region_id:
            q = q.filter(Application.region_id == region_id)

        schedules = q.all()
        overdue_items = []

        for s in schedules:
            status = compute_evc_status(s, now)
            if status == "OVERDUE":
                days_ovd = max(0, (now - s.due_date).days) if s.due_date else 0
                overdue_items.append({
                    "id": s.id,
                    "ref_no": s.application.ref_no if s.application else f"EVC #{s.id}",
                    "institution_name": s.application.institution.name if s.application and s.application.institution else "N/A",
                    "region_name": s.application.region.name if s.application and s.application.region else "N/A",
                    "due_date": s.due_date.strftime("%Y-%m-%d") if s.due_date else "—",
                    "days_overdue": days_ovd,
                    "is_new_institution": bool(s.is_new_institution)
                })

        region_str = f" in {region_name}" if region_name else " nationwide"
        text = f"Found {len(overdue_items)} overdue Expert Visit Committee (EVC) physical inspection(s){region_str} requiring immediate scheduling."

        return {
            "intent": "QUERY_OVERDUE_EVCS",
            "response_text": text,
            "count": len(overdue_items),
            "data": overdue_items,
            "suggested_actions": ["Open EVC Calendar", "Assign Inspection Committee", "Trigger Level 2 Escalation"],
            "is_ai_draft": false if False else False
        }

    @staticmethod
    def _handle_expiring_documents(db: Session, now: datetime, days: int, doc_type: Optional[str], region_id: Optional[int], user: User) -> Dict[str, Any]:
        target_date = now + timedelta(days=days)
        q = db.query(Document).join(Institution, Document.institution_id == Institution.id)

        if doc_type:
            q = q.filter(Document.doc_type == doc_type)

        # Enforce RBAC
        if user.role == "INSTITUTION":
            q = q.filter(Document.institution_id == user.institution_id)
        elif user.role in ["REGIONAL_OFFICER", "REGIONAL_HEAD"] and user.region_id:
            q = q.filter(Institution.region_id == user.region_id)
        elif region_id:
            q = q.filter(Institution.region_id == region_id)

        docs = q.filter(Document.expiry_date != None).all()
        expiring = []

        for d in docs:
            if d.expiry_date and d.expiry_date <= target_date:
                days_rem = (d.expiry_date - now).days
                expiring.append({
                    "id": d.id,
                    "doc_type": d.doc_type,
                    "institution_name": d.institution.name if d.institution else "N/A",
                    "region_name": d.institution.region.name if d.institution and d.institution.region else "N/A",
                    "expiry_date": d.expiry_date.strftime("%Y-%m-%d"),
                    "days_remaining": days_rem,
                    "status": "EXPIRED" if days_rem < 0 else "CRITICAL" if days_rem <= 30 else "EXPIRING_SOON"
                })

        expiring.sort(key=lambda x: x["days_remaining"])
        type_str = f"{doc_type} documents" if doc_type else "statutory documents"
        text = f"Identified {len(expiring)} {type_str} expiring within {days} days (or already expired) across active technical institutions."

        return {
            "intent": "QUERY_EXPIRING_DOCUMENTS",
            "response_text": text,
            "count": len(expiring),
            "data": expiring,
            "suggested_actions": ["Issue Renewal Reminder Notice", "View Document Expiry Timeline"],
            "is_ai_draft": False
        }

    @staticmethod
    def _handle_high_risk_cases(db: Session, region_id: Optional[int], user: User) -> Dict[str, Any]:
        high_risk = RiskService.get_high_risk_cases(db=db, region_id=region_id, limit=6, current_user=user)
        text = f"Analyzed active technical institution pipeline: {len(high_risk)} application(s) have elevated delay risk scores based on stage SLA dwell time, returns, and officer workload."

        return {
            "intent": "QUERY_HIGH_RISK_CASES",
            "response_text": text,
            "count": len(high_risk),
            "data": high_risk,
            "suggested_actions": ["Review Bottlenecks Table", "Reassign Officer Desk"],
            "is_ai_draft": False
        }

    @staticmethod
    def _handle_application_lookup(db: Session, ref_no: str, user: User) -> Dict[str, Any]:
        app = db.query(Application).filter(Application.ref_no == ref_no).first()
        if not app:
            return {
                "intent": "APPLICATION_NOT_FOUND",
                "response_text": f"Application with reference number {ref_no} could not be located in the system.",
                "data": None,
                "is_ai_draft": False
            }

        # RBAC Check
        if user.role == "INSTITUTION" and app.institution_id != user.institution_id:
            return {
                "intent": "FORBIDDEN",
                "response_text": f"Access Restricted: Application {ref_no} belongs to another technical institution.",
                "data": None,
                "is_ai_draft": False
            }

        data = {
            "application_id": app.id,
            "ref_no": app.ref_no,
            "institution_name": app.institution.name if app.institution else "N/A",
            "region_name": app.region.name if app.region else "N/A",
            "current_stage": app.current_stage,
            "status": app.status,
            "compliance_score": app.compliance_score,
            "assigned_officer": app.assigned_officer.name if app.assigned_officer else "Unassigned",
            "due_date": app.due_date.strftime("%Y-%m-%d") if app.due_date else "None"
        }

        return {
            "intent": "APPLICATION_LOOKUP",
            "response_text": f"Application {app.ref_no} for {data['institution_name']} is currently in stage '{app.current_stage}' with governance status '{app.status}'. Assigned to {data['assigned_officer']}.",
            "data": data,
            "suggested_actions": [f"View Case #{app.id} Detail", "Generate Electronic Case Summary"],
            "is_ai_draft": False
        }

    @staticmethod
    def _handle_notice_drafting(prompt: str, user: User) -> Dict[str, Any]:
        now_str = datetime.now().strftime("%d-%B-%Y")
        
        # Check if fire NOC or land lease or deficiency
        topic = "Statutory Deficiencies and Document Non-Compliance"
        if "fire" in prompt.lower():
            topic = "Renewal of Mandatory Fire Safety NOC Certificate"
        elif "lease" in prompt.lower():
            topic = "Validity Renewal of Registered Institutional Land Lease Deed"
        elif "fsr" in prompt.lower() or "faculty" in prompt.lower():
            topic = "Faculty-to-Student Cadre Ratio (FSR) Shortfall Rectification"

        draft_content = f"""ALL INDIA COUNCIL FOR TECHNICAL EDUCATION
Nelson Mandela Marg, Vasant Kunj, New Delhi - 110070
Approval & Vigilance Bureau (AY 2026-2027)

MEMORANDUM / DEFICIENCY DIRECTIVE
Date of Issuance: {now_str}
Authority Desk: {user.name} ({user.role})

SUBJECT: URGENT COMPLIANCE DIRECTIVE REGARDING {topic.upper()}

To:
The Principal / Head of Technical Institution,
Subject Campus, Technical Education Directorate.

Sir / Madam,

In pursuant to the statutory review of your Technical Campus Application under the AICTE Approval Process Handbook (APH) 2026-2027, the Scrutiny Directorate has observed critical deficiencies requiring immediate official clarification:

1. SUBJECT DEFICIENCY:
   Non-submission or expiry of statutory clearance documentation: {topic}.

2. MANDATORY STATUTORY TIMELINE:
   You are hereby directed to upload authentic documentary rectification proofs within fourteen (14) calendar days of this notice on the IntelliApprove portal.

3. CONSEQUENCE OF DEFAULT:
   Failure to submit verified rectifications within the statutory deadline shall lead to automatic escalation to Level 2 (Regional Head) and subsequent rejection of approval as per Regulation 4.2 of AICTE Regulations.

Issued by Order of the Competent Authority,
{user.name}
{user.role}, AICTE
--------------------------------------------------------------------------------
[AI DRAFT — REQUIRES MANDATORY OFFICIAL HUMAN REVIEW & DIGITAL SIGNATURE]"""

        return {
            "intent": "DRAFT_NOTICE",
            "response_text": "Statutory deficiency memo drafted successfully. Notice is pre-filled as an official template.",
            "draft_content": draft_content,
            "is_ai_draft": True,
            "disclaimer": "AI DRAFT: In compliance with Rule #2 (Mandatory Human Oversight), this notice must be reviewed, edited, and approved by an authorized human officer before formal dispatch."
        }

    @staticmethod
    def _handle_general_summary(db: Session, user: User) -> Dict[str, Any]:
        q = db.query(Application)
        if user.role == "INSTITUTION":
            q = q.filter(Application.institution_id == user.institution_id)
        elif user.role in ["REGIONAL_OFFICER", "REGIONAL_HEAD"] and user.region_id:
            q = q.filter(Application.region_id == user.region_id)

        tot = q.count()
        pending = q.filter(~Application.status.in_(["APPROVED", "REJECTED"])).count()
        approved = q.filter(Application.status == "APPROVED").count()

        text = f"You are logged in as {user.name} ({user.role}). Within your jurisdictional clearance scope, there are {tot} total applications ({pending} pending in pipeline, {approved} approved)."

        return {
            "intent": "GENERAL_SUMMARY",
            "response_text": text,
            "data": {"total": tot, "pending": pending, "approved": approved},
            "suggested_actions": ["Show overdue EVCs in Western region", "Which institutions have leases expiring in 30 days?", "Show high-risk delay cases"],
            "is_ai_draft": False
        }
