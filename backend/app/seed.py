"""
Seed script for IntelliApprove AICTE Approval Platform.
Populates realistic, India-specific data: exactly 20 institutions and 94 applications.
Enforces all statutory distributions, role-based scoping, and Rule #1 SHA-256 audit ledger.
"""
import sys
import os
import json
import random
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any, Tuple

# Ensure backend directory is in python path
from pathlib import Path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.core.database import SessionLocal, engine, Base
from app.core.security import get_password_hash
from app.services.audit_service import AuditService
from app.models.entities import (
    UserRole,
    Region,
    User,
    Institution,
    WorkflowTemplate,
    Application,
    StageHistory,
    EVCSchedule,
    FileRecord,
    Undertaking,
    Document,
    AlertRule,
    Notification,
    Escalation,
    AuditLog,
    SystemClock,
    ComplianceNormRule,
    DeficiencyRecord,
    AcademicProgram,
)

DEMO_DEFAULT_PASSWORD = "aicte123"

def compute_audit_hash(prev_hash: str, actor_id: Any, action: str, entity_type: str, entity_id: str, timestamp_str: str) -> str:
    payload = f"{prev_hash}|{actor_id}|{action}|{entity_type}|{entity_id}|{timestamp_str}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()

def get_current_date() -> datetime:
    """Returns baseline simulated reference date (naive UTC for SQLite compatibility)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)

def to_naive_dt(dt: Any) -> Any:
    if dt is None:
        return None
    return dt.replace(tzinfo=None) if getattr(dt, "tzinfo", None) else dt

def seed_database(reset: bool = False):
    """Seed the database with exact 20 institutions and 94 applications dataset."""
    random.seed(42)
    db = SessionLocal()
    now = get_current_date()

    if not reset and db.query(Region).first() is not None:
        print("[Seed] Database already seeded. Skipping (use --reset to reseed).")
        db.close()
        return

    try:
        if reset:
            print("[Seed] Reset requested: Dropping and recreating tables for clean state...")
            db.close()
            Base.metadata.drop_all(bind=engine)
            Base.metadata.create_all(bind=engine)
            db = SessionLocal()

        # 1. System Clock
        print("[Seed] 1/15 Seeding System Clock...")
        clock = SystemClock(id=1, simulated_date=now)
        db.add(clock)
        db.flush()

        # 2. 8 AICTE Regions
        print("[Seed] 2/15 Seeding 8 AICTE Regions...")
        region_names = [
            "Northern",        # UP, Uttarakhand
            "Southern",        # Tamil Nadu
            "Western",         # Maharashtra, Goa
            "Eastern",         # West Bengal, Odisha
            "Central",         # Madhya Pradesh, Chhattisgarh
            "South-Western",   # Karnataka, Kerala
            "North-Western",   # Delhi, Rajasthan, Chandigarh
            "South-Central"    # Andhra Pradesh, Telangana
        ]
        region_map: Dict[str, Region] = {}
        for r_name in region_names:
            reg = Region(name=r_name)
            db.add(reg)
            db.flush()
            region_map[r_name] = reg

        # 3. Users (Covering all roles, all 8 regions have a Regional Officer, and 8 EVC members)
        print("[Seed] 3/15 Seeding 31 Users across all roles...")
        hashed_pw = get_password_hash(DEMO_DEFAULT_PASSWORD)

        users_meta = [
            # 2 ADMIN
            ("Dr. Anil Sahasrabudhe", "admin@aicte.gov.in", UserRole.ADMIN.value, None),
            ("Prof. T. G. Sitharam", "system.admin@aicte.gov.in", UserRole.ADMIN.value, None),
            
            # 3 BUREAU_OFFICER
            ("Dr. Rajive Kumar", "member.secretary@aicte.gov.in", UserRole.BUREAU_OFFICER.value, None),
            ("Dr. Neeraj Saxena", "bureau.policy@aicte.gov.in", UserRole.BUREAU_OFFICER.value, None),
            ("Dr. Mamta Rani Agarwal", "bureau.institutions@aicte.gov.in", UserRole.BUREAU_OFFICER.value, None),
            
            # 8 REGIONAL_HEAD (One for each AICTE region)
            ("Dr. Ramesh Unnikrishnan", "head.sw@aicte.gov.in", UserRole.REGIONAL_HEAD.value, region_map["South-Western"].id),
            ("Dr. Manoj Kumar", "head.w@aicte.gov.in", UserRole.REGIONAL_HEAD.value, region_map["Western"].id),
            ("Dr. S. K. Goel", "head.n@aicte.gov.in", UserRole.REGIONAL_HEAD.value, region_map["Northern"].id),
            ("Dr. R. Balamurugan", "head.s@aicte.gov.in", UserRole.REGIONAL_HEAD.value, region_map["Southern"].id),
            ("Dr. P. V. Ramana", "head.sc@aicte.gov.in", UserRole.REGIONAL_HEAD.value, region_map["South-Central"].id),
            ("Dr. Amit Roy", "head.e@aicte.gov.in", UserRole.REGIONAL_HEAD.value, region_map["Eastern"].id),
            ("Dr. Sanjay Sharma", "head.nw@aicte.gov.in", UserRole.REGIONAL_HEAD.value, region_map["North-Western"].id),
            ("Dr. Sunita Sen", "head.c@aicte.gov.in", UserRole.REGIONAL_HEAD.value, region_map["Central"].id),
            
            # 8 REGIONAL_OFFICER (One for every region)
            ("Er. Vikramaditya Rathore", "ro.nw@aicte.gov.in", UserRole.REGIONAL_OFFICER.value, region_map["North-Western"].id),
            ("Er. Sneha Kulkarni", "ro.w@aicte.gov.in", UserRole.REGIONAL_OFFICER.value, region_map["Western"].id),
            ("Er. K. Venkatasubramanian", "ro.s@aicte.gov.in", UserRole.REGIONAL_OFFICER.value, region_map["Southern"].id),
            ("Er. Ananya Mukherjee", "ro.e@aicte.gov.in", UserRole.REGIONAL_OFFICER.value, region_map["Eastern"].id),
            ("Er. Rajesh Verma", "ro.n@aicte.gov.in", UserRole.REGIONAL_OFFICER.value, region_map["Northern"].id),
            ("Er. K. S. Manjunatha", "ro.sw@aicte.gov.in", UserRole.REGIONAL_OFFICER.value, region_map["South-Western"].id),
            ("Er. Alok Tripathi", "ro.c@aicte.gov.in", UserRole.REGIONAL_OFFICER.value, region_map["Central"].id),
            ("Er. S. Chandrasekhar", "ro.sc@aicte.gov.in", UserRole.REGIONAL_OFFICER.value, region_map["South-Central"].id),
            
            # 8 EVC_MEMBER (One associated with each region)
            ("Prof. D. K. Pratihar", "evc.expert1@aicte.gov.in", UserRole.EVC_MEMBER.value, region_map["Eastern"].id),
            ("Prof. B. M. Murari", "evc.expert2@aicte.gov.in", UserRole.EVC_MEMBER.value, region_map["South-Western"].id),
            ("Prof. S. R. Chawathe", "evc.expert3@aicte.gov.in", UserRole.EVC_MEMBER.value, region_map["Western"].id),
            ("Prof. G. K. Ananthasuresh", "evc.expert4@aicte.gov.in", UserRole.EVC_MEMBER.value, region_map["Southern"].id),
            ("Prof. K. Rajagopal", "evc.expert5@aicte.gov.in", UserRole.EVC_MEMBER.value, region_map["Central"].id),
            ("Prof. M. S. Ananth", "evc.expert6@aicte.gov.in", UserRole.EVC_MEMBER.value, region_map["Northern"].id),
            ("Prof. Devang Khakhar", "evc.expert7@aicte.gov.in", UserRole.EVC_MEMBER.value, region_map["North-Western"].id),
            ("Prof. Ashok Jhunjhunwala", "evc.expert8@aicte.gov.in", UserRole.EVC_MEMBER.value, region_map["South-Central"].id),
            
            # 2 INSTITUTION (Institute Nodal Officers / Principals)
            ("Dr. Arvind Narayanan", "principal@ditm.ac.in", UserRole.INSTITUTION.value, region_map["North-Western"].id),
            ("Dr. Sunita Deshmukh", "director@mcer.edu.in", UserRole.INSTITUTION.value, region_map["Western"].id),
        ]

        users_list: List[User] = []
        user_by_email: Dict[str, User] = {}
        ro_by_region: Dict[int, User] = {}

        for name, email, role, r_id in users_meta:
            u = User(
                name=name,
                email=email,
                password_hash=hashed_pw,
                role=role,
                region_id=r_id,
                is_active=True
            )
            db.add(u)
            db.flush()
            users_list.append(u)
            user_by_email[email] = u
            if role == UserRole.REGIONAL_OFFICER.value and r_id is not None:
                ro_by_region[r_id] = u

        evc_members = [u for u in users_list if u.role == UserRole.EVC_MEMBER.value]
        bureau_officers = [u for u in users_list if u.role == UserRole.BUREAU_OFFICER.value]

        # 4. Workflow Templates (5 routes)
        print("[Seed] 4/15 Seeding 5 Workflow Templates...")
        templates_meta = [
            {
                "name": "Only Scrutiny",
                "stages": ["SUBMITTED", "SCRUTINY", "BUREAU_DECISION", "APPROVED", "REJECTED"],
                "transitions": [
                    {"from": "SUBMITTED", "to": "SCRUTINY", "action": "Assign Scrutiny Officer"},
                    {"from": "SCRUTINY", "to": "BUREAU_DECISION", "action": "Recommend to Bureau"},
                    {"from": "BUREAU_DECISION", "to": "APPROVED", "action": "Grant Approval"},
                    {"from": "BUREAU_DECISION", "to": "REJECTED", "action": "Refuse Approval"}
                ]
            },
            {
                "name": "Scrutiny + EVC",
                "stages": ["SUBMITTED", "SCRUTINY", "EVC", "BUREAU_DECISION", "APPROVED", "REJECTED"],
                "transitions": [
                    {"from": "SUBMITTED", "to": "SCRUTINY", "action": "Start Document Scrutiny"},
                    {"from": "SCRUTINY", "to": "EVC", "action": "Clear Scrutiny & Order EVC"},
                    {"from": "EVC", "to": "BUREAU_DECISION", "action": "Submit Positive EVC Report"},
                    {"from": "BUREAU_DECISION", "to": "APPROVED", "action": "Grant Approval"},
                    {"from": "BUREAU_DECISION", "to": "REJECTED", "action": "Refuse Approval"}
                ]
            },
            {
                "name": "EVC + SAC/SHC",
                "stages": ["SUBMITTED", "EVC", "SAC_SHC", "BUREAU_DECISION", "APPROVED", "REJECTED"],
                "transitions": [
                    {"from": "SUBMITTED", "to": "EVC", "action": "Schedule Inspection Committee"},
                    {"from": "EVC", "to": "SAC_SHC", "action": "Refer to Standing Appellate/Hearing Committee"},
                    {"from": "SAC_SHC", "to": "BUREAU_DECISION", "action": "Submit Committee Recommendations"},
                    {"from": "BUREAU_DECISION", "to": "APPROVED", "action": "Grant Approval"},
                    {"from": "BUREAU_DECISION", "to": "REJECTED", "action": "Refuse Approval"}
                ]
            },
            {
                "name": "Only EVC",
                "stages": ["SUBMITTED", "EVC", "BUREAU_DECISION", "APPROVED", "REJECTED"],
                "transitions": [
                    {"from": "SUBMITTED", "to": "EVC", "action": "Deploy Field Committee"},
                    {"from": "EVC", "to": "BUREAU_DECISION", "action": "Submit Inspection Verdict"},
                    {"from": "BUREAU_DECISION", "to": "APPROVED", "action": "Grant Approval"},
                    {"from": "BUREAU_DECISION", "to": "REJECTED", "action": "Refuse Approval"}
                ]
            },
            {
                "name": "Scrutiny + EVC + SAC/SHC",
                "stages": ["SUBMITTED", "SCRUTINY", "EVC", "SAC_SHC", "BUREAU_DECISION", "APPROVED", "REJECTED"],
                "transitions": [
                    {"from": "SUBMITTED", "to": "SCRUTINY", "action": "Begin Scrutiny"},
                    {"from": "SCRUTINY", "to": "EVC", "action": "Clear Scrutiny & Order EVC"},
                    {"from": "EVC", "to": "SAC_SHC", "action": "Disputed Inspection -> Convene SAC/SHC"},
                    {"from": "SAC_SHC", "to": "BUREAU_DECISION", "action": "Forward Hearing Speaking Order"},
                    {"from": "BUREAU_DECISION", "to": "APPROVED", "action": "Grant Approval"},
                    {"from": "BUREAU_DECISION", "to": "REJECTED", "action": "Refuse Approval"}
                ]
            }
        ]

        templates_by_name: Dict[str, WorkflowTemplate] = {}
        for t in templates_meta:
            tmpl = WorkflowTemplate(
                name=t["name"],
                stages_json=json.dumps(t["stages"]),
                transitions_json=json.dumps(t["transitions"])
            )
            db.add(tmpl)
            db.flush()
            templates_by_name[t["name"]] = tmpl

        # 5. Exactly 20 Institutions across 8 regions (4 regions with 3, 4 regions with 2)
        # Mix of Engineering, Polytechnic, Management, Pharmacy, Architecture. Exactly 6 is_new=True.
        print("[Seed] 5/15 Seeding exactly 20 Institutions across 8 AICTE regions...")
        institutions_raw = [
            # North-Western (3 institutions)
            ("Delhi Institute of Technology & Management", "Engineering", "Delhi", "North-Western", False, "principal@ditm.ac.in"), # Demo login inst
            ("Rajasthan Institute of Engineering & Technology", "Engineering", "Rajasthan", "North-Western", True, "contact@riet-jaipur.edu.in"),
            ("Chandigarh College of Architecture & Design", "Architecture", "Chandigarh", "North-Western", False, "admin@ccad.edu.in"),
            
            # Western (3 institutions)
            ("Maharashtra College of Engineering & Research", "Engineering", "Maharashtra", "Western", False, "director@mcer.edu.in"), # Demo login inst 2
            ("Pune Institute of Management Studies", "Management", "Maharashtra", "Western", False, "info@pims-pune.edu.in"),
            ("Goa Government Polytechnic Institute", "Polytechnic", "Goa", "Western", True, "principal@ggpi-goa.org"),
            
            # Southern (3 institutions)
            ("Tamil Nadu Institute of Technology & Science", "Engineering", "Tamil Nadu", "Southern", False, "admin@tnits-chennai.edu.in"),
            ("Coimbatore College of Pharmacy & Healthcare", "Pharmacy", "Tamil Nadu", "Southern", False, "dean@ccph-cbe.org"),
            ("Madurai Polytechnic & Vocational Academy", "Polytechnic", "Tamil Nadu", "Southern", True, "info@mpva-mdu.edu.in"),
            
            # South-Western (3 institutions)
            ("Bangalore Institute of Advanced Computing & AI", "Engineering", "Karnataka", "South-Western", True, "admissions@biac-ai.edu.in"),
            ("Kochi School of Architecture & Planning", "Architecture", "Kerala", "South-Western", False, "dean@ksap-kochi.edu.in"),
            ("Mysore Institute of Management & Leadership", "Management", "Karnataka", "South-Western", False, "office@miml-mysore.edu.in"),
            
            # Northern (2 institutions)
            ("Uttar Pradesh Institute of Technology", "Engineering", "Uttar Pradesh", "Northern", False, "info@upit-lucknow.edu.in"),
            ("Dehradun College of Pharmaceutical Sciences", "Pharmacy", "Uttarakhand", "Northern", True, "dean@dcps-doon.org"),
            
            # Eastern (2 institutions)
            ("Kolkata Institute of Engineering & Applied Science", "Engineering", "West Bengal", "Eastern", False, "registrar@kieas-kol.edu.in"),
            ("Bhubaneswar Polytechnic & Technical Institute", "Polytechnic", "Odisha", "Eastern", False, "principal@bpti-bbsr.edu.in"),
            
            # Central (2 institutions)
            ("Madhya Pradesh Technological Institute", "Engineering", "Madhya Pradesh", "Central", False, "admin@mpti-bhopal.edu.in"),
            ("Chhattisgarh Institute of Architecture", "Architecture", "Chhattisgarh", "Central", True, "contact@cia-raipur.org"),
            
            # South-Central (2 institutions)
            ("Hyderabad Institute of Technology & Management", "Management", "Telangana", "South-Central", False, "info@hitm-hyd.ac.in"),
            ("Andhra College of Pharmaceutical Research", "Pharmacy", "Andhra Pradesh", "South-Central", False, "dean@acpr-vja.org"),
        ]

        institutions_list: List[Institution] = []
        for name, itype, state, reg_name, is_new, email in institutions_raw:
            inst = Institution(
                name=name,
                type=itype,
                state=state,
                region_id=region_map[reg_name].id,
                is_new=is_new,
                contact_email=email
            )
            db.add(inst)
            db.flush()
            institutions_list.append(inst)

        # 6. File Records (50 files)
        print("[Seed] 6/15 Seeding File Records for evidence...")
        files_list: List[FileRecord] = []
        doc_categories = ["lease_deed", "building_plan", "fire_noc", "audited_accounts", "undertaking_proof", "lab_report"]
        for idx in range(1, 51):
            cat = doc_categories[idx % len(doc_categories)]
            fname = f"{cat}_doc_2026_{idx:03d}.pdf"
            fpath = f"/storage/evidence/2026/{fname}"
            fhash = hashlib.sha256(f"{fname}_{idx}".encode("utf-8")).hexdigest()
            f_rec = FileRecord(
                filename=fname,
                path=fpath,
                sha256_hash=fhash,
                uploaded_by=users_list[idx % len(users_list)].id,
                uploaded_at=now - timedelta(days=(idx % 60) + 1)
            )
            db.add(f_rec)
            db.flush()
            files_list.append(f_rec)

        # 7. Exactly 94 Applications
        # Route requirements:
        # Only Scrutiny 19, Scrutiny + EVC 33, EVC + SAC/SHC 14, Only EVC 9, Scrutiny + EVC + SAC/SHC 19 = 94
        # Stage requirements:
        # Submission 8, Scrutiny 26, EVC 22, SAC/SHC 13, Bureau decision 7, Approved 11, Refused 4, Returned for clarification 3 = 94
        # Ageing of 76 active cases:
        # 0-7 days: 19, 8-15 days: 19, 16-30 days: 23, 30+ days: 15 = 76
        # Deadlines: 14 overdue, 9 due within 7 days, 7 returned at least once
        print("[Seed] 7/15 Seeding exactly 94 Applications with exact distributions...")

        # Application allocation per institution:
        # Inst 1 has exactly 8 applications. The other 19 institutions have between 4 and 5 applications.
        inst_app_counts = [
            8, # Inst 1 (Dr. Arvind Narayanan - DITM)
            5, 5, 5, 5, 4, 5, 4, 4, 5, # Inst 2 to 10
            4, 4, 5, 4, 5, 4, 5, 4, 5, 4  # Inst 11 to 20
        ]
        assert sum(inst_app_counts) == 94
        assert inst_app_counts[0] == 8
        assert all(3 <= c <= 8 for c in inst_app_counts)

        # Map index to institution
        app_to_inst_idx: List[int] = []
        for i_idx, cnt in enumerate(inst_app_counts):
            app_to_inst_idx.extend([i_idx] * cnt)

        # Stage pool (94 items)
        stages_pool = (
            ["SUBMITTED"] * 8 +
            ["SCRUTINY"] * 26 +
            ["EVC"] * 22 +
            ["SAC_SHC"] * 13 +
            ["BUREAU_DECISION"] * 7 +
            ["APPROVED"] * 11 +
            ["REJECTED"] * 4 +
            ["RETURNED"] * 3
        )

        # Route pool (94 items)
        routes_pool = (
            ["Only Scrutiny"] * 19 +
            ["Scrutiny + EVC"] * 33 +
            ["EVC + SAC/SHC"] * 14 +
            ["Only EVC"] * 9 +
            ["Scrutiny + EVC + SAC/SHC"] * 19
        )

        # Active cases ageing & deadline pairs:
        # Exactly:
        # 0-7: 19 cases (3 DUE_SOON, 16 HEALTHY)
        # 8-15: 19 cases (3 DUE_SOON, 16 HEALTHY)
        # 16-30: 23 cases (6 OVERDUE, 3 DUE_SOON, 14 HEALTHY)
        # 30+: 15 cases (8 OVERDUE, 7 HEALTHY)
        # Totals: 19 + 19 + 23 + 15 = 76 active cases
        # Deadlines: 6 + 8 = 14 OVERDUE, 3 + 3 + 3 = 9 DUE_SOON, 16 + 16 + 14 + 7 = 53 HEALTHY!
        active_pairs = (
            [("0-7", "DUE_SOON")] * 3 +
            [("0-7", "HEALTHY")] * 16 +
            [("8-15", "DUE_SOON")] * 3 +
            [("8-15", "HEALTHY")] * 16 +
            [("16-30", "OVERDUE")] * 6 +
            [("16-30", "DUE_SOON")] * 3 +
            [("16-30", "HEALTHY")] * 14 +
            [("30+", "OVERDUE")] * 8 +
            [("30+", "HEALTHY")] * 7
        )
        assert len(active_pairs) == 76

        # Allocate stages for Inst 1 (8 applications):
        # 1 Submitted, 2 Scrutiny, 1 EVC, 1 SAC_SHC, 2 Approved, 1 Returned
        inst1_stages = ["SUBMITTED", "SCRUTINY", "SCRUTINY", "EVC", "SAC_SHC", "APPROVED", "APPROVED", "RETURNED"]
        for s in inst1_stages:
            stages_pool.remove(s)

        # Shuffle remaining stages deterministically
        random.shuffle(stages_pool)
        assigned_stages = inst1_stages + stages_pool
        assert len(assigned_stages) == 94

        # Active indices in assigned_stages
        active_app_indices = [idx for idx, s in enumerate(assigned_stages) if s not in ["APPROVED", "REJECTED", "RETURNED"]]
        assert len(active_app_indices) == 76

        # For Inst 1 (indices 0, 1, 2, 3, 4):
        # 1 OVERDUE (from 30+), 1 DUE_SOON (from 8-15), 3 HEALTHY (from 0-7, 16-30, 16-30)
        inst1_pairs = [
            ("0-7", "HEALTHY"),
            ("30+", "OVERDUE"),
            ("8-15", "DUE_SOON"),
            ("16-30", "HEALTHY"),
            ("16-30", "HEALTHY")
        ]
        for p in inst1_pairs:
            active_pairs.remove(p)

        # Shuffle remaining 71 active pairs
        random.shuffle(active_pairs)

        active_pair_map: Dict[int, Tuple[str, str]] = {}
        for a_idx, p in zip([0, 1, 2, 3, 4], inst1_pairs):
            active_pair_map[a_idx] = p

        rem_active_indices = [idx for idx in active_app_indices if idx not in [0, 1, 2, 3, 4]]
        for a_idx, p in zip(rem_active_indices, active_pairs):
            active_pair_map[a_idx] = p

        # Shuffle route pool deterministically
        random.shuffle(routes_pool)

        applications_list: List[Application] = []
        returned_history_apps_target = set()

        for i in range(94):
            inst_idx = app_to_inst_idx[i]
            inst = institutions_list[inst_idx]
            stage = assigned_stages[i]
            tmpl = templates_by_name[routes_pool[i]]
            ro = ro_by_region[inst.region_id]
            ref_no = f"AICTE/2026-27/RO-{inst.region.name[:2].upper()}-{i+1:04d}"

            # Determine status
            if stage == "APPROVED":
                status = "APPROVED"
            elif stage == "REJECTED":
                status = "REJECTED"
            elif stage == "RETURNED":
                status = "RETURNED"
                returned_history_apps_target.add(i)
            else:
                age_b, dline = active_pair_map[i]
                if dline == "OVERDUE":
                    status = "ESCALATED" if i % 2 == 0 else "IN_PROGRESS"
                elif stage in ["SAC_SHC", "BUREAU_DECISION"]:
                    status = "PENDING_REVIEW"
                else:
                    status = "IN_PROGRESS"

            # Determine timestamps strictly ensuring submitted_at < stage_entered_at < due_date
            if stage in ["APPROVED", "REJECTED"]:
                sub_days = 50 + (i % 30)
                entered_days = 12 + (i % 15)
                submitted_at = now - timedelta(days=sub_days)
                stage_entered = now - timedelta(days=entered_days)
                due_dt = stage_entered + timedelta(days=14)
                risk = 10.0 if stage == "APPROVED" else 80.0
            elif stage == "RETURNED":
                sub_days = 25 + (i % 10)
                entered_days = 3 + (i % 3)
                submitted_at = now - timedelta(days=sub_days)
                stage_entered = now - timedelta(days=entered_days)
                due_dt = now + timedelta(days=14)
                risk = 65.0
            else:
                age_b, dline = active_pair_map[i]
                if age_b == "0-7":
                    sub_days = 2 + (i % 5) # 2 to 6 days
                    submitted_at = now - timedelta(days=sub_days)
                    stage_entered = submitted_at if stage == "SUBMITTED" else submitted_at + timedelta(hours=4)
                    if dline == "DUE_SOON":
                        due_dt = now + timedelta(days=1 + (i % 3)) # +1, +2, +3 days
                    else:
                        due_dt = now + timedelta(days=10 + (i % 15))
                    risk = round(15.0 + (i % 25) * 0.8, 1)

                elif age_b == "8-15":
                    sub_days = 9 + (i % 6) # 9 to 14 days
                    submitted_at = now - timedelta(days=sub_days)
                    stage_entered = submitted_at if stage == "SUBMITTED" else submitted_at + timedelta(days=3)
                    if dline == "DUE_SOON":
                        due_dt = now + timedelta(days=1 + (i % 3))
                    else:
                        due_dt = now + timedelta(days=12 + (i % 15))
                    risk = round(25.0 + (i % 25) * 0.9, 1)

                elif age_b == "16-30":
                    sub_days = 17 + (i % 12) # 17 to 28 days
                    submitted_at = now - timedelta(days=sub_days)
                    stage_entered = submitted_at if stage == "SUBMITTED" else submitted_at + timedelta(days=6)
                    if dline == "OVERDUE":
                        # Overdue by 2 to 5 days, stage_entered was 6+ days after sub_days
                        due_dt = now - timedelta(days=2 + (i % 4))
                    elif dline == "DUE_SOON":
                        due_dt = now + timedelta(days=1 + (i % 3))
                    else:
                        due_dt = now + timedelta(days=14 + (i % 15))
                    risk = round(65.0 + (i % 25) * 1.0, 1)

                else: # "30+"
                    sub_days = 32 + (i % 15) # 32 to 46 days
                    submitted_at = now - timedelta(days=sub_days)
                    stage_entered = submitted_at if stage == "SUBMITTED" else submitted_at + timedelta(days=12)
                    if dline == "OVERDUE":
                        due_dt = now - timedelta(days=3 + (i % 6))
                    else:
                        due_dt = now + timedelta(days=15 + (i % 15))
                    risk = round(75.0 + (i % 20) * 0.9, 1)

            # Strict chronological verification
            assert submitted_at <= stage_entered, f"App {ref_no}: submitted_at {submitted_at} > stage_entered {stage_entered}"
            assert stage_entered < due_dt, f"App {ref_no}: stage_entered {stage_entered} >= due_dt {due_dt}"

            app = Application(
                ref_no=ref_no,
                institution_id=inst.id,
                application_type="Extension of Approval (EoA)" if i % 3 != 0 else "New Institution Approval",
                workflow_template_id=tmpl.id,
                current_stage=stage,
                status=status,
                region_id=inst.region_id,
                assigned_officer_id=ro.id,
                submitted_at=submitted_at,
                stage_entered_at=stage_entered,
                due_date=due_dt,
                risk_score=risk
            )
            db.add(app)
            db.flush()
            applications_list.append(app)

            # Add StageHistory
            # 1. Initial Submission
            h1 = StageHistory(
                application_id=app.id,
                stage="SUBMITTED",
                entered_at=submitted_at,
                completed_at=submitted_at + timedelta(hours=4) if stage != "SUBMITTED" else None,
                officer_id=None,
                action="ONLINE_APPLICATION_SUBMITTED",
                remarks="Online regulatory application submitted with DSC verification."
            )
            db.add(h1)

            # 2. Stage history progression
            if stage != "SUBMITTED":
                h2 = StageHistory(
                    application_id=app.id,
                    stage=stage if stage not in ["APPROVED", "REJECTED", "RETURNED"] else "SCRUTINY",
                    entered_at=stage_entered,
                    completed_at=stage_entered + timedelta(days=2) if stage in ["APPROVED", "REJECTED"] else None,
                    officer_id=ro.id,
                    action="STAGE_IN_PROGRESS" if stage not in ["APPROVED", "REJECTED", "RETURNED"] else "SCRUTINY_EVALUATION",
                    remarks=f"Processed by Regional Officer {ro.name}."
                )
                db.add(h2)

            if stage in ["APPROVED", "REJECTED"]:
                h_final = StageHistory(
                    application_id=app.id,
                    stage="BUREAU_DECISION",
                    entered_at=stage_entered + timedelta(days=2),
                    completed_at=stage_entered + timedelta(days=3),
                    officer_id=bureau_officers[0].id,
                    action="FINAL_AUTHORITY_DECISION",
                    remarks=f"Final order: {stage}. Speaking order uploaded."
                )
                db.add(h_final)

        # Ensure exactly 7 applications have returned history
        # 3 are currently in RETURNED. Pick 4 others:
        extra_returned_candidates = [a for a in applications_list if a.status != "RETURNED" and a.current_stage in ["SCRUTINY", "EVC", "APPROVED"]][:4]
        for a in extra_returned_candidates:
            returned_history_apps_target.add(a.id)
            ret_time = a.submitted_at + timedelta(days=3)
            h_ret = StageHistory(
                application_id=a.id,
                stage="SCRUTINY",
                entered_at=ret_time,
                completed_at=ret_time + timedelta(days=4),
                officer_id=a.assigned_officer_id,
                action="RETURNED",
                remarks="Faculty details incomplete: shortage of 2 cadre professors in Computer Science. Re-uploaded by institute."
            )
            db.add(h_ret)

        for a in applications_list:
            if a.status == "RETURNED":
                h_ret = StageHistory(
                    application_id=a.id,
                    stage="RETURNED",
                    entered_at=a.stage_entered_at,
                    completed_at=None,
                    officer_id=a.assigned_officer_id,
                    action="RETURNED",
                    remarks="Building plan municipal approval stamp not legible. Returned for clarification."
                )
                db.add(h_ret)

        db.flush()

        # 8. Exactly 40 EVC Schedules across 8 regions and 5 statuses
        # Every EVC member has at least 5 assigned visits:
        # (1 queued, 2 scheduled, 1 due this week, 1 overdue, plus completed)
        # Every region has queued, scheduled, due-soon, overdue and completed visits.
        # New institutions get shorter due windows (10 days vs 21 days).
        print("[Seed] 8/15 Seeding 40 EVC Schedules across 8 regions and 5 statuses...")
        
        all_regions = list(region_map.values())
        apps_by_region: Dict[int, List[Application]] = {r.id: [] for r in all_regions}
        for a in applications_list:
            apps_by_region[a.region_id].append(a)

        evc_schedules_list: List[EVCSchedule] = []
        
        for r_idx, reg in enumerate(all_regions):
            reg_apps = apps_by_region[reg.id]
            for s_idx, st in enumerate(["QUEUED", "SCHEDULED", "DUE_SOON", "OVERDUE", "COMPLETED"]):
                target_app = reg_apps[s_idx % len(reg_apps)]
                is_new = target_app.institution.is_new
                due_window = 10 if is_new else 21

                # Committee assignments ensuring every member has visits across all statuses
                m1 = evc_members[r_idx].id
                m2 = evc_members[(r_idx + s_idx + 1) % len(evc_members)].id
                c_members = [m1, m2]

                if st == "QUEUED":
                    sched_dt = None
                    due_dt = now + timedelta(days=due_window)
                    comp_dt = None
                elif st == "SCHEDULED":
                    sched_dt = now + timedelta(days=12 + (r_idx % 4))
                    due_dt = sched_dt + timedelta(days=due_window)
                    comp_dt = None
                elif st == "DUE_SOON":
                    # Scheduled visit due this week
                    sched_dt = now + timedelta(days=2 + (r_idx % 2))
                    due_dt = now + timedelta(days=3 + (r_idx % 2))
                    comp_dt = None
                elif st == "OVERDUE":
                    sched_dt = now - timedelta(days=12)
                    due_dt = now - timedelta(days=4 + (r_idx % 3))
                    comp_dt = None
                else: # COMPLETED
                    sched_dt = now - timedelta(days=22)
                    due_dt = sched_dt + timedelta(days=due_window)
                    comp_dt = now - timedelta(days=8)

                evc_item = EVCSchedule(
                    application_id=target_app.id,
                    scheduled_date=sched_dt,
                    status=st,
                    committee_ids=json.dumps(c_members),
                    due_date=due_dt,
                    completed_at=comp_dt,
                    is_new_institution=is_new
                )
                db.add(evc_item)
                db.flush()
                evc_schedules_list.append(evc_item)

                AuditService.log(
                    db=db,
                    action="EVC_SCHEDULED" if st != "COMPLETED" else "EVC_COMPLETED",
                    entity_type="EVC_SCHEDULE",
                    entity_id=str(evc_item.id),
                    user=users_list[r_idx % len(users_list)],
                    old_value=None,
                    new_value={"status": st, "members": c_members, "due_date": due_dt.isoformat() if due_dt else None},
                    details=f"EVC schedule record initialized with status {st} for application {target_app.ref_no}"
                )

        # 9. Exactly 30 Undertakings
        # pending (6), submitted (6), verified (6), rejected (6), overdue (6)
        # Due dates from -30 to +60 days
        print("[Seed] 9/15 Seeding exactly 30 Undertakings across 5 statuses...")
        undertakings_list: List[Undertaking] = []
        u_statuses = ["PENDING"] * 6 + ["SUBMITTED"] * 6 + ["VERIFIED"] * 6 + ["REJECTED"] * 6 + ["OVERDUE"] * 6
        conditions = [
            "Construct permanent boundary wall around entire 7.5 acres perimeter within 90 days.",
            "Recruit 4 regular Ph.D. Associate Professors in Computer Engineering before next academic cycle.",
            "Upgrade campus leased line Internet connectivity from 100 Mbps to 1 Gbps fiber optic link.",
            "Set up dedicated Innovation and Entrepreneurship Development Centre (IEDC) lab facility.",
            "Complete installation of wheelchair ramps and braille elevators across all academic blocks.",
            "Submit renewed structural safety certificate from State Public Works Department."
        ]

        for u_idx in range(30):
            target_app = applications_list[(u_idx * 3) % len(applications_list)]
            st = u_statuses[u_idx]
            cond = conditions[u_idx % len(conditions)]
            ev_file = files_list[u_idx % len(files_list)]
            ro = ro_by_region[target_app.region_id]

            if st == "PENDING":
                due_dt = now + timedelta(days=20 + (u_idx * 5))
                v_file = None
                v_by = None
                v_at = None
            elif st == "SUBMITTED":
                due_dt = now + timedelta(days=8 + (u_idx % 10))
                v_file = ev_file.id
                v_by = None
                v_at = None
            elif st == "VERIFIED":
                due_dt = now - timedelta(days=10 + (u_idx % 15))
                v_file = ev_file.id
                v_by = ro.id
                v_at = now - timedelta(days=3)
            elif st == "REJECTED":
                due_dt = now - timedelta(days=5 + (u_idx % 15))
                v_file = ev_file.id
                v_by = ro.id
                v_at = now - timedelta(days=2)
            else: # OVERDUE
                due_dt = now - timedelta(days=3 + (u_idx % 25))
                v_file = None
                v_by = None
                v_at = None

            und = Undertaking(
                institution_id=target_app.institution_id,
                application_id=target_app.id,
                condition_text=cond,
                due_date=due_dt,
                status=st,
                evidence_file_id=v_file,
                verified_by=v_by,
                verified_at=v_at
            )
            db.add(und)
            db.flush()
            undertakings_list.append(und)

        # 10. Exactly 40 Documents
        # 3 expired (-45 to -1d), 4 expiring in 30d (+1 to +30d), 6 in 90d (+31 to +90d), 27 long-term (+91 to +300d), 3 renewals
        print("[Seed] 10/15 Seeding exactly 40 Documents with strict expiry bands and 3 renewals...")
        documents_list: List[Document] = []
        doc_types = ["LEASE", "BUILDING_PLAN", "FIRE_NOC", "AFFILIATION_ORDER"]

        for d_idx in range(40):
            inst = institutions_list[d_idx % len(institutions_list)]
            dtype = doc_types[d_idx % len(doc_types)]
            f_record = files_list[d_idx % len(files_list)]
            issue_dt = now - timedelta(days=400 + (d_idx * 10))

            if d_idx < 3:
                # 3 Expired (-45 to -1 days)
                offset = - (5 + d_idx * 10)
                v_status = "EXPIRED" if dtype == "LEASE" else "REJECTED"
            elif d_idx < 7:
                # 4 Expiring within 30 days (+1 to +30 days)
                offset = 4 + (d_idx - 3) * 7
                v_status = "VERIFIED"
            elif d_idx < 13:
                # 6 within 90 days (+31 to +90 days)
                offset = 35 + (d_idx - 7) * 9
                v_status = "VERIFIED"
            else:
                # 27 Long term (+91 to +300 days)
                offset = 95 + (d_idx - 13) * 7
                v_status = "VERIFIED"

            exp_dt = now + timedelta(days=offset)
            
            # Exactly 3 renewals (documents 1, 2, 3 have renewal documents at indices 37, 38, 39)
            renewal_id = None
            if d_idx in [37, 38, 39]:
                renewal_id = documents_list[d_idx - 37].id

            doc = Document(
                institution_id=inst.id,
                doc_type=dtype,
                issue_date=issue_dt,
                expiry_date=exp_dt,
                file_id=f_record.id,
                verification_status=v_status,
                renewal_of_id=renewal_id
            )
            db.add(doc)
            db.flush()
            documents_list.append(doc)

        # 11. Alert Rules
        print("[Seed] 11/15 Seeding Alert Rules...")
        alert_rules_data = [
            ("STAGE_SLA", "REMINDER", -7, "INFO", 0, ["INSTITUTION", "REGIONAL_OFFICER"]),
            ("STAGE_SLA", "REMINDER", -3, "WARNING", 0, ["INSTITUTION", "REGIONAL_OFFICER"]),
            ("STAGE_SLA", "REMINDER", -1, "CRITICAL", 0, ["INSTITUTION", "REGIONAL_OFFICER"]),
            ("STAGE_SLA", "OVERDUE", 0, "ESCALATION", 1, ["REGIONAL_OFFICER", "REGIONAL_HEAD"]),
            ("STAGE_SLA", "ESCALATION", 2, "ESCALATION", 2, ["REGIONAL_HEAD"]),
            ("STAGE_SLA", "ESCALATION", 5, "ESCALATION", 3, ["BUREAU_OFFICER"]),
            ("LEASE_EXPIRY", "EXPIRY_WARNING", 90, "INFO", 0, ["INSTITUTION", "REGIONAL_OFFICER"]),
            ("LEASE_EXPIRY", "EXPIRY_WARNING", 60, "WARNING", 0, ["INSTITUTION", "REGIONAL_OFFICER"]),
            ("LEASE_EXPIRY", "EXPIRY_WARNING", 30, "CRITICAL", 1, ["INSTITUTION", "REGIONAL_OFFICER", "REGIONAL_HEAD"]),
            ("LEASE_EXPIRY", "EXPIRY_WARNING", 7, "CRITICAL", 2, ["INSTITUTION", "REGIONAL_OFFICER", "REGIONAL_HEAD", "BUREAU_OFFICER"]),
            ("UNDERTAKING_DEADLINE", "REMINDER", -7, "INFO", 0, ["INSTITUTION"]),
            ("UNDERTAKING_DEADLINE", "REMINDER", -3, "WARNING", 0, ["INSTITUTION", "REGIONAL_OFFICER"]),
            ("UNDERTAKING_DEADLINE", "OVERDUE", 0, "CRITICAL", 1, ["REGIONAL_OFFICER", "REGIONAL_HEAD"]),
            ("UNDERTAKING_DEADLINE", "ESCALATION", 3, "ESCALATION", 2, ["REGIONAL_HEAD", "BUREAU_OFFICER"])
        ]
        for cat, trg, off, sev, esc_lvl, roles in alert_rules_data:
            ar = AlertRule(
                category=cat,
                trigger_type=trg,
                offset_days=off,
                severity=sev,
                escalation_level=esc_lvl,
                notify_roles_json=json.dumps(roles),
                is_active=True
            )
            db.add(ar)
        db.flush()

        # 12. Exactly 15 Notifications
        print("[Seed] 12/15 Seeding exactly 15 Notifications consistent with overdue items...")
        notifs_data = [
            ("SLA Breach: Application Overdue", "Application AICTE/2026-27/RO-NW-0002 has exceeded Scrutiny SLA by 4 days.", "STAGE_SLA", "CRITICAL", False, user_by_email["ro.nw@aicte.gov.in"].id, "/applications/2"),
            ("SLA Alert: Application Due Tomorrow", "Application AICTE/2026-27/RO-NW-0003 reaches deadline in 24 hours.", "STAGE_SLA", "WARNING", False, user_by_email["principal@ditm.ac.in"].id, "/applications/3"),
            ("Registered Lease Deed EXPIRED", "Lease agreement for Delhi Institute of Technology & Management expired. Urgent renewal required.", "LEASE_EXPIRY", "CRITICAL", False, user_by_email["principal@ditm.ac.in"].id, "/documents"),
            ("Level 2 Escalation Dispatched", "Application AICTE/2026-27/RO-W-0004 has exceeded regional threshold.", "STAGE_SLA", "ESCALATION", False, user_by_email["head.w@aicte.gov.in"].id, "/alerts"),
            ("EVC Inspection Scheduled", "Field inspection confirmed for Rajasthan Institute of Eng & Tech on 08 Nov 2026.", "EVC_INSPECTION", "INFO", True, user_by_email["evc.expert7@aicte.gov.in"].id, "/evc"),
            ("Compliance Undertaking Overdue", "Undertaking for barrier-free access is 6 days overdue.", "UNDERTAKING_DEADLINE", "CRITICAL", False, user_by_email["ro.w@aicte.gov.in"].id, "/undertakings"),
            ("Approval Order Dispatched", "Extension of Approval (EoA) 2026-27 digitally approved.", "APPROVAL", "INFO", True, user_by_email["director@mcer.edu.in"].id, "/applications/6"),
            ("Level 3 Escalation: National Bureau", "Severe SLA breach for AICTE/2026-27/RO-SO-0007 escalated to Bureau.", "STAGE_SLA", "ESCALATION", False, user_by_email["member.secretary@aicte.gov.in"].id, "/alerts"),
            ("Building Plan Approval Expiring", "Municipal approval expires in 25 days for Coimbatore College of Pharmacy.", "LEASE_EXPIRY", "WARNING", False, user_by_email["ro.s@aicte.gov.in"].id, "/documents"),
            ("EVC Inspection Report Overdue", "Field visit report delayed beyond prescribed committee deadline.", "EVC_INSPECTION", "CRITICAL", False, user_by_email["ro.e@aicte.gov.in"].id, "/evc"),
            ("Application Due This Week", "Application AICTE/2026-27/RO-SW-0010 due in 2 days.", "STAGE_SLA", "WARNING", True, user_by_email["ro.sw@aicte.gov.in"].id, "/applications/10"),
            ("Level 1 Escalation: Scrutiny Delay", "Scrutiny officer attention required on AICTE/2026-27/RO-NO-0013.", "STAGE_SLA", "ESCALATION", False, user_by_email["ro.n@aicte.gov.in"].id, "/alerts"),
            ("Undertaking Evidence Submitted", "Institute uploaded bank guarantee deposit receipt.", "UNDERTAKING_DEADLINE", "INFO", True, user_by_email["ro.c@aicte.gov.in"].id, "/undertakings"),
            ("Fire NOC Renewal Required", "State fire service inspection due in 15 days.", "LEASE_EXPIRY", "WARNING", False, user_by_email["ro.sc@aicte.gov.in"].id, "/documents"),
            ("Annual Regulatory Audit Complete", "Cryptographic ledger hash validated by Competent Authority.", "APPROVAL", "INFO", True, user_by_email["admin@aicte.gov.in"].id, "/audit")
        ]
        assert len(notifs_data) == 15

        for title, msg, cat, sev, read, u_id, link in notifs_data:
            notif = Notification(
                user_id=u_id,
                title=title,
                message=msg,
                category=cat,
                severity=sev,
                link=link,
                is_read=read,
                created_at=now - timedelta(hours=random.randint(2, 48)),
                channel="IN_APP"
            )
            db.add(notif)
        db.flush()

        # 13. Exactly 6 Escalations across levels
        print("[Seed] 13/15 Seeding exactly 6 Escalations across Levels 1, 2, 3...")
        escalations_meta = [
            ("APPLICATION", applications_list[1].id, 1, "Regional Officer (Er. Vikramaditya Rathore)", "Scrutiny timeline exceeded 72 hours SLA window without action."),
            ("APPLICATION", applications_list[3].id, 2, "Regional Head (Dr. Manoj Kumar)", "Application pending beyond 5 days after initial SLA breach; regional escalation triggered."),
            ("APPLICATION", applications_list[6].id, 3, "Bureau Officer (Dr. Rajive Kumar)", "Critical delay: application pending over 10 days in Scrutiny. Referred to Headquarters Bureau."),
            ("UNDERTAKING", undertakings_list[24].id, 1, "Regional Officer (Er. Sneha Kulkarni)", "Institute failed to submit bank guarantee evidence by stipulated due date."),
            ("UNDERTAKING", undertakings_list[25].id, 2, "Regional Head (Dr. Manoj Kumar)", "Statutory faculty recruitment undertaking lapsed for over 15 days."),
            ("EVC", evc_schedules_list[9].id, 1, "Regional Officer (Er. Ananya Mukherjee)", "Inspection team report submission delayed past committee due date.")
        ]
        assert len(escalations_meta) == 6

        for etype, eid, lvl, to_role, rsn in escalations_meta:
            esc = Escalation(
                entity_type=etype,
                entity_id=eid,
                level=lvl,
                escalated_to=to_role,
                reason=rsn,
                created_at=now - timedelta(days=(lvl * 2)),
                resolved_at=None if lvl >= 2 else (now - timedelta(days=1))
            )
            db.add(esc)
        db.flush()

        # 14. Audit Logs (Tamper-evident cryptographic SHA-256 chain)
        print("[Seed] 14/15 Seeding Tamper-Evident SHA-256 Audit Trail...")
        genesis_hash = hashlib.sha256("INTELLIAPPROVE_AICTE_GENESIS_STATE_2026".encode("utf-8")).hexdigest()
        prev_h = genesis_hash

        audit_actions = [
            ("SYSTEM_INIT", "CONFIG", "1", None, {"status": "INITIALIZED", "system": "AICTE_APPROVAL_SUITE"}, "System baseline bootstrap & schema validation"),
            ("USER_LOGIN_SUCCESS", "USER", "1", None, {"auth": "SUCCESS", "role": "ADMIN"}, "Administrator authenticated successfully"),
            ("APPLICATION_SUBMIT", "APPLICATION", "1", None, {"stage": "SUBMITTED", "status": "IN_PROGRESS"}, "Institutional nodal officer submitted EoA application"),
            ("DOCUMENT_UPLOAD", "DOCUMENT", "1", None, {"doc_type": "LEASE", "status": "PENDING"}, "Registered deed proof uploaded by institution"),
            ("DOCUMENT_VERIFY", "DOCUMENT", "1", {"status": "PENDING"}, {"status": "VERIFIED"}, "Scrutiny officer stamped document as verified compliant"),
            ("EVC_SCHEDULED", "EVC_SCHEDULE", "1", None, {"status": "SCHEDULED", "members": [22, 23]}, "Field inspection committee empanelled"),
            ("UNDERTAKING_RECORDED", "UNDERTAKING", "1", None, {"status": "PENDING", "condition": "FSR_1:15"}, "Conditional undertaking bound to institute"),
            ("SLA_BREACH_DETECTED", "APPLICATION", "2", {"status": "IN_PROGRESS"}, {"status": "ESCALATED"}, "Automated background scheduler flagged SLA window violation"),
            ("ESCALATION_DISPATCHED", "ESCALATION", "1", None, {"level": 1, "to": "REGIONAL_OFFICER"}, "Escalation notification dispatched to regional head"),
            ("FINAL_APPROVAL_GRANTED", "APPLICATION", "11", {"stage": "BUREAU_DECISION"}, {"stage": "APPROVED", "status": "APPROVED"}, "Competent authority granted approval with speaking order")
        ]

        for idx, (act, etype, eid, old_v, new_v, rsn) in enumerate(audit_actions):
            actor = users_list[idx % len(users_list)]
            ts = now - timedelta(hours=35 - idx)
            ts_str = ts.isoformat()
            curr_hash = compute_audit_hash(prev_h, actor.id, act, etype, eid, ts_str)
            alog = AuditLog(
                actor_id=actor.id,
                action=act,
                entity_type=etype,
                entity_id=eid,
                old_value_json=json.dumps(old_v) if old_v else None,
                new_value_json=json.dumps(new_v) if new_v else None,
                reason=rsn,
                ip="10.0.4.15" if idx % 2 == 0 else "127.0.0.1",
                timestamp=ts,
                prev_hash=prev_h,
                hash=curr_hash
            )
            db.add(alog)
            db.flush()
            prev_h = curr_hash

        db.commit()

        # Seed APH Norm Rules
        try:
            from app.seed_aph_norms import seed_aph_norms
            seed_aph_norms()
        except Exception as aph_err:
            print(f"[Seed] Warning seeding APH norms: {aph_err}")

        # Final audit chain validation
        AuditService.recompute_chain(db)
        print("[Seed] Seeding completed successfully and SHA-256 audit chain verified!\n")

    except Exception as e:
        db.rollback()
        print(f"[Seed] ERROR seeding database: {e}")
        raise e
    finally:
        db.close()

def print_row_counts():
    """Print exact row counts for all tables and verify distributions."""
    db = SessionLocal()
    now = to_naive_dt(get_current_date())

    print("\n" + "=" * 68)
    print("      INTELLIAPPROVE DATABASE VERIFICATION (ROW COUNTS)      ")
    print("=" * 68)

    tables = [
        ("regions", Region),
        ("institutions", Institution),
        ("users", User),
        ("workflow_templates", WorkflowTemplate),
        ("applications", Application),
        ("stage_history", StageHistory),
        ("evc_schedules", EVCSchedule),
        ("undertakings", Undertaking),
        ("documents", Document),
        ("files", FileRecord),
        ("alert_rules", AlertRule),
        ("notifications", Notification),
        ("escalations", Escalation),
        ("audit_logs", AuditLog),
        ("system_clock", SystemClock),
        ("compliance_norm_rules", ComplianceNormRule),
        ("academic_programs", AcademicProgram),
        ("deficiency_records", DeficiencyRecord),
    ]

    total_records = 0
    for name, model in tables:
        count = db.query(model).count()
        total_records += count
        print(f"  • {name:<25} : {count:>5} rows")
    print("-" * 68)
    print(f"  Total Tables Checked     : {len(tables):>5}")
    print(f"  Total Database Records   : {total_records:>5}")
    print("=" * 68)

    # 1. Applications per Region
    print("\n" + "=" * 68)
    print("                 APPLICATIONS PER REGION                    ")
    print("=" * 68)
    regions = db.query(Region).all()
    for reg in regions:
        inst_count = db.query(Institution).filter(Institution.region_id == reg.id).count()
        app_count = db.query(Application).filter(Application.region_id == reg.id).count()
        print(f"  • {reg.name:<20} : {inst_count} Institutions | {app_count:>3} Applications")

    # 2. Applications per Stage
    print("\n" + "=" * 68)
    print("                 APPLICATIONS PER STAGE                     ")
    print("=" * 68)
    stg_labels = [
        ("SUBMITTED", "Submission"),
        ("SCRUTINY", "Scrutiny"),
        ("EVC", "EVC"),
        ("SAC_SHC", "SAC/SHC"),
        ("BUREAU_DECISION", "Bureau decision"),
        ("APPROVED", "Approved"),
        ("REJECTED", "Refused"),
        ("RETURNED", "Returned for clarification")
    ]
    for stg_val, label in stg_labels:
        count = db.query(Application).filter(Application.current_stage == stg_val).count()
        print(f"  • {label:<30} ({stg_val:<15}) : {count:>3}")

    # 3. Active Cases Ageing Buckets
    print("\n" + "=" * 68)
    print("           AGEING OF ACTIVE CASES (76 IN-PROGRESS)          ")
    print("=" * 68)
    active_apps = db.query(Application).filter(Application.status.notin_(["APPROVED", "REJECTED", "RETURNED"])).all()
    b_0_7 = sum(1 for a in active_apps if (now - to_naive_dt(a.submitted_at)).days <= 7)
    b_8_15 = sum(1 for a in active_apps if 8 <= (now - to_naive_dt(a.submitted_at)).days <= 15)
    b_16_30 = sum(1 for a in active_apps if 16 <= (now - to_naive_dt(a.submitted_at)).days <= 30)
    b_30_plus = sum(1 for a in active_apps if (now - to_naive_dt(a.submitted_at)).days > 30)

    print(f"  • 0-7 days   : {b_0_7:>3}")
    print(f"  • 8-15 days  : {b_8_15:>3}")
    print(f"  • 16-30 days : {b_16_30:>3}")
    print(f"  • 30+ days   : {b_30_plus:>3}")
    print(f"  Total Active : {len(active_apps):>3}")

    # 4. Overdue and Due this week
    overdue_count = db.query(Application).filter(
        Application.status.notin_(["APPROVED", "REJECTED"]),
        Application.due_date < now
    ).count()
    due_week_count = db.query(Application).filter(
        Application.status.notin_(["APPROVED", "REJECTED"]),
        Application.due_date >= now,
        Application.due_date <= now + timedelta(days=3)
    ).count()
    returned_once_count = db.query(StageHistory.application_id).filter(
        StageHistory.action == "RETURNED"
    ).distinct().count()

    print("\n" + "=" * 68)
    print("             STATUTORY SLA DEADLINE METRICS                 ")
    print("=" * 68)
    print(f"  • Overdue applications              : {overdue_count:>3} (Target: 14)")
    print(f"  • Due within 7 days (approaching)   : {due_week_count:>3} (Target: 9)")
    print(f"  • Returned at least once with reason: {returned_once_count:>3} (Target: 7)")

    # 5. Dashboard totals for Demo Users
    print("\n" + "=" * 68)
    print("         DASHBOARD STAT CARD TOTALS FOR DEMO USERS          ")
    print("=" * 68)
    from app.core.scoping import scope_applications_by_role

    demo_check_users = [
        ("principal@ditm.ac.in", "Dr. Arvind Narayanan (INSTITUTION)"),
        ("ro.nw@aicte.gov.in", "Er. Vikramaditya Rathore (REGIONAL_OFFICER - North-Western)"),
        ("head.w@aicte.gov.in", "Dr. Manoj Kumar (REGIONAL_HEAD - Western)"),
        ("member.secretary@aicte.gov.in", "Dr. Rajive Kumar (BUREAU_OFFICER)"),
        ("evc.expert7@aicte.gov.in", "Prof. Devang Khakhar (EVC_MEMBER)"),
        ("admin@aicte.gov.in", "Dr. Anil Sahasrabudhe (ADMIN)")
    ]

    for email, label in demo_check_users:
        u = db.query(User).filter(User.email == email).first()
        if not u:
            continue
        base_q = scope_applications_by_role(db.query(Application), u, db)
        tot = base_q.count()
        inp = base_q.filter(Application.status.notin_(["APPROVED", "REJECTED", "RETURNED"])).count()
        comp = base_q.filter(Application.status.in_(["APPROVED", "REJECTED"])).count()
        ret = base_q.filter(Application.status == "RETURNED").count()
        ovd = base_q.filter(Application.status.notin_(["APPROVED", "REJECTED"]), Application.due_date < now).count()
        due_w = base_q.filter(Application.status.notin_(["APPROVED", "REJECTED"]), Application.due_date >= now, Application.due_date <= now + timedelta(days=3)).count()

        assert inp + comp + ret == tot, f"Mismatch for {email}: {inp} + {comp} + {ret} != {tot}"
        assert ovd <= tot, f"Overdue {ovd} > {tot} for {email}"
        assert due_w <= tot, f"Due week {due_w} > {tot} for {email}"

        print(f"  [{label}]")
        print(f"     Total: {tot:>2} | In Progress: {inp:>2} | Completed: {comp:>2} | Returned: {ret:>2} | Overdue: {ovd:>2} | Due Soon: {due_w:>2}")

    print("=" * 68)
    db.close()

if __name__ == "__main__":
    reset_flag = "--reset" in sys.argv
    seed_database(reset=reset_flag)
    print_row_counts()
