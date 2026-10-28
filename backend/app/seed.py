"""
Seed script for IntelliApprove AICTE Approval Platform.
Populates realistic, India-specific data matching the exact 15-table architecture.
"""
import sys
import json
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any

# Ensure backend directory is in python path
from pathlib import Path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.core.database import SessionLocal, engine, Base
from app.core.security import get_password_hash
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

def seed_database(reset: bool = False):
    """Seed the database with complete, realistic AICTE approval dataset."""
    db = SessionLocal()
    now = datetime.now(timezone.utc)

    # If not reset and already populated, skip
    if not reset and db.query(Region).first() is not None:
        print("[Seed] Database already seeded. Skipping.")
        db.close()
        return

    try:
        if reset:
            print("[Seed] Clearing existing data across tables...")
            # Delete in reverse foreign-key dependency order
            db.query(AuditLog).delete()
            db.query(Escalation).delete()
            db.query(Notification).delete()
            db.query(AlertRule).delete()
            db.query(Undertaking).delete()
            db.query(Document).delete()
            db.query(FileRecord).delete()
            db.query(EVCSchedule).delete()
            db.query(DeficiencyRecord).delete()
            db.query(AcademicProgram).delete()
            db.query(StageHistory).delete()
            db.query(Application).delete()
            db.query(WorkflowTemplate).delete()
            db.query(ComplianceNormRule).delete()
            db.query(Institution).delete()
            db.query(User).delete()
            db.query(Region).delete()
            db.query(SystemClock).delete()
            db.commit()

        # 1. System Clock (1 record)
        print("[Seed] 1/15 Seeding System Clock...")
        clock = SystemClock(id=1, simulated_date=now)
        db.add(clock)
        db.flush()

        # 2. Regions (8 AICTE regions)
        print("[Seed] 2/15 Seeding 8 AICTE Regions...")
        region_names = [
            "Northern",        # UP, Uttarakhand, Bihar
            "Southern",        # Tamil Nadu, Puducherry
            "Western",         # Maharashtra, Goa
            "Eastern",         # West Bengal, Odisha, Assam, Jharkhand, NE states
            "Central",         # Madhya Pradesh, Chhattisgarh, Gujarat
            "South-Western",   # Karnataka, Kerala
            "North-Western",   # Delhi, Haryana, Punjab, Rajasthan, HP, J&K, Chandigarh
            "South-Central"    # Andhra Pradesh, Telangana
        ]
        region_map: Dict[str, Region] = {}
        for r_name in region_names:
            reg = Region(name=r_name)
            db.add(reg)
            db.flush()
            region_map[r_name] = reg

        # 3. Users (25 users covering every role)
        print("[Seed] 3/15 Seeding 25 Users across all 6 roles...")
        hashed_pw = get_password_hash(DEMO_DEFAULT_PASSWORD)
        
        users_meta = [
            # 2 ADMIN
            ("Dr. Anil Sahasrabudhe", "admin@aicte.gov.in", UserRole.ADMIN.value, None),
            ("Prof. T. G. Sitharam", "system.admin@aicte.gov.in", UserRole.ADMIN.value, None),
            
            # 3 BUREAU_OFFICER (Headquarters / Approving Authorities)
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
            
            # 6 REGIONAL_OFFICER (Scrutiny & field liaison officers)
            ("Er. Vikramaditya Rathore", "ro.nw@aicte.gov.in", UserRole.REGIONAL_OFFICER.value, region_map["North-Western"].id),
            ("Er. Sneha Kulkarni", "ro.w@aicte.gov.in", UserRole.REGIONAL_OFFICER.value, region_map["Western"].id),
            ("Er. K. Venkatasubramanian", "ro.s@aicte.gov.in", UserRole.REGIONAL_OFFICER.value, region_map["Southern"].id),
            ("Er. Ananya Mukherjee", "ro.e@aicte.gov.in", UserRole.REGIONAL_OFFICER.value, region_map["Eastern"].id),
            ("Er. Rajesh Verma", "ro.n@aicte.gov.in", UserRole.REGIONAL_OFFICER.value, region_map["Northern"].id),
            ("Er. K. S. Manjunatha", "ro.sw@aicte.gov.in", UserRole.REGIONAL_OFFICER.value, region_map["South-Western"].id),
            
            # 4 EVC_MEMBER (Expert Visit Committee field inspectators)
            ("Prof. D. K. Pratihar", "evc.expert1@aicte.gov.in", UserRole.EVC_MEMBER.value, region_map["Eastern"].id),
            ("Prof. B. M. Murari", "evc.expert2@aicte.gov.in", UserRole.EVC_MEMBER.value, region_map["South-Western"].id),
            ("Prof. S. R. Chawathe", "evc.expert3@aicte.gov.in", UserRole.EVC_MEMBER.value, region_map["Western"].id),
            ("Prof. G. K. Ananthasuresh", "evc.expert4@aicte.gov.in", UserRole.EVC_MEMBER.value, region_map["Southern"].id),
            
            # 2 INSTITUTION (Institute Nodal Officers / Principals)
            ("Dr. Arvind Narayanan", "principal@ditm.ac.in", UserRole.INSTITUTION.value, region_map["North-Western"].id),
            ("Dr. Sunita Deshmukh", "director@mcer.edu.in", UserRole.INSTITUTION.value, region_map["Western"].id),
        ]
        
        users_list: List[User] = []
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

        regional_officers = [u for u in users_list if u.role == UserRole.REGIONAL_OFFICER.value]
        evc_members = [u for u in users_list if u.role == UserRole.EVC_MEMBER.value]
        bureau_officers = [u for u in users_list if u.role == UserRole.BUREAU_OFFICER.value]

        # 4. Workflow Templates (5 routes)
        print("[Seed] 4/15 Seeding 5 AICTE Approval Workflow Templates...")
        templates_meta = [
            {
                "name": "Only Scrutiny",
                "stages": ["SUBMITTED", "SCRUTINY", "BUREAU_DECISION", "APPROVED", "REJECTED"],
                "transitions": [
                    {"from": "SUBMITTED", "to": "SCRUTINY", "action": "Assign Scrutiny Officer"},
                    {"from": "SCRUTINY", "to": "BUREAU_DECISION", "action": "Recommend to Bureau"},
                    {"from": "SCRUTINY", "to": "DEFICIENT", "action": "Issue Deficiency Notice"},
                    {"from": "DEFICIENT", "to": "SCRUTINY", "action": "Resubmit Scrutiny Proof"},
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
                    {"from": "SCRUTINY", "to": "DEFICIENT", "action": "Issue Scrutiny Shortfall"},
                    {"from": "DEFICIENT", "to": "SCRUTINY", "action": "Resubmit Documents"},
                    {"from": "EVC", "to": "BUREAU_DECISION", "action": "Submit Positive EVC Report"},
                    {"from": "EVC", "to": "DEFICIENT", "action": "Flag Infrastructure Deficiencies"},
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

        templates_list: List[WorkflowTemplate] = []
        for t in templates_meta:
            tmpl = WorkflowTemplate(
                name=t["name"],
                stages_json=json.dumps(t["stages"]),
                transitions_json=json.dumps(t["transitions"])
            )
            db.add(tmpl)
            db.flush()
            templates_list.append(tmpl)

        # 5. Institutions (60 institutions across India)
        print("[Seed] 5/15 Seeding 60 Institutions across all 8 regions & states...")
        institutions_raw = [
            ("Delhi Institute of Technology & Management", "Engineering", "Delhi", "North-Western", False, "principal@ditm.ac.in"),
            ("Maharashtra College of Engineering & Research", "Engineering", "Maharashtra", "Western", False, "director@mcer.edu.in"),
            ("Bangalore Institute of Advanced Computing & AI", "Engineering", "Karnataka", "South-Western", True, "contact@biac-ai.edu.in"),
            ("Tamil Nadu Academy of Technical Education", "Engineering", "Tamil Nadu", "Southern", False, "admin@tnate.edu.in"),
            ("Kolkata Institute of Information Technology", "Engineering", "West Bengal", "Eastern", False, "registrar@kiit-kol.edu.in"),
            ("Madhya Pradesh Technological College", "Engineering", "Madhya Pradesh", "Central", False, "info@mptc.ac.in"),
            ("Hyderabad School of Management & Technology", "Management", "Telangana", "South-Central", False, "director@hsmt.ac.in"),
            ("Uttar Pradesh Institute of Pharmaceutical Sciences", "Pharmacy", "Uttar Pradesh", "Northern", False, "dean@upips.org"),
            ("Pune Institute of Computer Technology", "Engineering", "Maharashtra", "Western", False, "principal@pict.edu.in"),
            ("Chandigarh College of Architecture", "Architecture", "Chandigarh", "North-Western", False, "cca@chd.nic.in"),
            ("Gujarat Technological Institute", "Engineering", "Gujarat", "Central", False, "registrar@gti.ac.in"),
            ("Kerala Polytechnic College", "Polytechnic", "Kerala", "South-Western", False, "principal@kpc.edu.in"),
            ("Rajasthan Engineering & Management Institute", "Engineering", "Rajasthan", "North-Western", True, "office@remi.org"),
            ("Andhra College of Pharmacy", "Pharmacy", "Andhra Pradesh", "South-Central", False, "principal@acp.edu.in"),
            ("Bhubaneswar Institute of Technology", "Engineering", "Odisha", "Eastern", False, "admissions@bit-bbsr.edu.in"),
            ("Lucknow Management Academy", "Management", "Uttar Pradesh", "Northern", False, "contact@lma.ac.in"),
            ("Chennai Institute of Technology & Science", "Engineering", "Tamil Nadu", "Southern", False, "principal@cits.edu.in"),
            ("Goa College of Architecture & Design", "Architecture", "Goa", "Western", True, "dean@gcad.edu.in"),
            ("Mysore Polytechnic Institute", "Polytechnic", "Karnataka", "South-Western", False, "info@mpi-mysore.edu.in"),
            ("Bhopal School of Business & Analytics", "Management", "Madhya Pradesh", "Central", False, "info@bsba.ac.in"),
            ("Guwahati Institute of Technology", "Engineering", "Assam", "Eastern", True, "contact@git-ghy.edu.in"),
            ("Dehradun Institute of Engineering & Applied Sciences", "Engineering", "Uttarakhand", "Northern", False, "principal@dieas.edu.in"),
            ("Patna Institute of Technology", "Engineering", "Bihar", "Northern", True, "registrar@pit-patna.org"),
            ("Coimbatore College of Pharmacy", "Pharmacy", "Tamil Nadu", "Southern", False, "dean@ccp-cbe.edu.in"),
            ("Nagpur Institute of Management Studies", "Management", "Maharashtra", "Western", False, "info@nims-ngp.ac.in"),
            ("Visakhapatnam Institute of Technology", "Engineering", "Andhra Pradesh", "South-Central", False, "principal@vit-vizag.edu.in"),
            ("Ranchi Institute of Technology", "Engineering", "Jharkhand", "Eastern", False, "contact@rit-ranchi.edu.in"),
            ("Raipur Polytechnic Institute", "Polytechnic", "Chhattisgarh", "Central", False, "office@rpi-raipur.org"),
            ("Shimla College of Architecture", "Architecture", "Himachal Pradesh", "North-Western", True, "admin@sca-shimla.edu.in"),
            ("Mangalore Institute of Engineering & Management", "Engineering", "Karnataka", "South-Western", False, "principal@miem.edu.in"),
            ("Warangal Institute of Pharmaceutical Sciences", "Pharmacy", "Telangana", "South-Central", False, "info@wips.ac.in"),
            ("Ludhiana College of Engineering", "Engineering", "Punjab", "North-Western", False, "director@lce.edu.in"),
            ("Agra Institute of Technical Education", "Engineering", "Uttar Pradesh", "Northern", False, "admin@aite-agra.org"),
            ("Madurai Institute of Science and Technology", "Engineering", "Tamil Nadu", "Southern", False, "principal@mist-mdu.edu.in"),
            ("Nashik Institute of Pharmaceutical Education", "Pharmacy", "Maharashtra", "Western", False, "dean@nipe.ac.in"),
            ("Ahmedabad Management & IT Institute", "Management", "Gujarat", "Central", False, "contact@amiti.ac.in"),
            ("Kochi Institute of Marine & Naval Architecture", "Architecture", "Kerala", "South-Western", True, "registrar@kimna.edu.in"),
            ("Cuttack Polytechnic Academy", "Polytechnic", "Odisha", "Eastern", False, "info@cpa-cuttack.org"),
            ("Jaipur Institute of Advanced Studies", "Management", "Rajasthan", "North-Western", False, "director@jias.ac.in"),
            ("Vijayawada Institute of Technology", "Engineering", "Andhra Pradesh", "South-Central", False, "principal@vit-vja.edu.in"),
            ("Jabalpur College of Engineering", "Engineering", "Madhya Pradesh", "Central", False, "dean@jce-jbp.ac.in"),
            ("Thiruvananthapuram Business School", "Management", "Kerala", "South-Western", False, "info@tbs-tvm.edu.in"),
            ("Varanasi Institute of Technology", "Engineering", "Uttar Pradesh", "Northern", True, "office@vit-vns.ac.in"),
            ("Salem College of Engineering", "Engineering", "Tamil Nadu", "Southern", False, "principal@sce-salem.edu.in"),
            ("Aurangabad College of Pharmacy", "Pharmacy", "Maharashtra", "Western", False, "admin@acp-abad.edu.in"),
            ("Siliguri Institute of Technology", "Engineering", "West Bengal", "Eastern", False, "registrar@sit-slg.ac.in"),
            ("Vadodara Design & Architecture Academy", "Architecture", "Gujarat", "Central", True, "dean@vdaa.edu.in"),
            ("Belgaum Polytechnic College", "Polytechnic", "Karnataka", "South-Western", False, "info@bpc-bgm.org"),
            ("Jodhpur Engineering & Technology College", "Engineering", "Rajasthan", "North-Western", False, "principal@jetc.ac.in"),
            ("Tirupati Institute of Sciences", "Engineering", "Andhra Pradesh", "South-Central", True, "admissions@tis-tpt.edu.in"),
            ("Gwalior Institute of Computer Applications", "Management", "Madhya Pradesh", "Central", False, "info@gica.edu.in"),
            ("Kozhikode College of Pharmacy", "Pharmacy", "Kerala", "South-Western", False, "principal@kcp-clt.edu.in"),
            ("Kanpur Institute of Technology & Management", "Engineering", "Uttar Pradesh", "Northern", False, "director@kitm.ac.in"),
            ("Tiruchirappalli Institute of Architecture", "Architecture", "Tamil Nadu", "Southern", False, "dean@tia-trichy.edu.in"),
            ("Kolhapur Institute of Technology", "Engineering", "Maharashtra", "Western", False, "office@kit-kop.ac.in"),
            ("Rourkela College of Management", "Management", "Odisha", "Eastern", False, "director@rcm-rkl.edu.in"),
            ("Surat Polytechnic Institute", "Polytechnic", "Gujarat", "Central", False, "principal@spi-surat.org"),
            ("Hubli Institute of Technology", "Engineering", "Karnataka", "South-Western", False, "info@hit-hubli.edu.in"),
            ("Amritsar College of Engineering & Technology", "Engineering", "Punjab", "North-Western", True, "admissions@acet-asr.ac.in"),
            ("Nizamabad Institute of Pharmacy", "Pharmacy", "Telangana", "South-Central", False, "dean@nip-nzb.ac.in")
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

        # 6. Files (Create 70 realistic file records)
        print("[Seed] 6/15 Seeding Files for documents & undertakings...")
        files_list: List[FileRecord] = []
        doc_categories = ["lease_deed", "building_plan", "fire_noc", "audited_accounts", "undertaking_proof", "lab_report"]
        for idx in range(1, 71):
            cat = doc_categories[idx % len(doc_categories)]
            fname = f"{cat}_doc_2026_{idx:03d}.pdf"
            fpath = f"/storage/evidence/2026/{fname}"
            fhash = hashlib.sha256(f"{fname}_{idx}".encode("utf-8")).hexdigest()
            uploader = users_list[idx % len(users_list)]
            f_rec = FileRecord(
                filename=fname,
                path=fpath,
                sha256_hash=fhash,
                uploaded_by=uploader.id,
                uploaded_at=now - timedelta(days=(idx % 60) + 1)
            )
            db.add(f_rec)
            db.flush()
            files_list.append(f_rec)

        # 7. Applications (150 applications spread across stages, regions, ages)
        print("[Seed] 7/15 Seeding 150 Applications (with overdue & near-deadline)...")
        app_stages = [
            ("SUBMITTED", "IN_PROGRESS"),
            ("SCRUTINY", "IN_PROGRESS"),
            ("SCRUTINY", "PENDING_REVIEW"),
            ("DEFICIENT", "DEFICIENT"),
            ("EVC", "IN_PROGRESS"),
            ("EVC", "ESCALATED"),
            ("SAC_SHC", "PENDING_REVIEW"),
            ("BUREAU_DECISION", "PENDING_REVIEW"),
            ("APPROVED", "APPROVED"),
            ("REJECTED", "REJECTED")
        ]
        
        app_types = [
            "Extension of Approval (EoA)",
            "New Institution Approval",
            "Increase in Intake / Additional Division",
            "Introduction of New Program / Course",
            "Closure of Program / Institution"
        ]

        applications_list: List[Application] = []
        stage_history_list: List[StageHistory] = []

        # We will create exactly 150 applications:
        # - 20 Overdue (due_date in past, e.g. -14 to -2 days)
        # - 25 Near Deadline (due_date in next 1 to 3 days, at T-1 to T-3)
        # - 65 Healthy in-progress (due_date in next 5 to 30 days)
        # - 40 Finalized (Approved/Rejected, completed within past)
        for i in range(1, 151):
            inst = institutions_list[(i - 1) % len(institutions_list)]
            tmpl = templates_list[(i - 1) % len(templates_list)]
            app_type = app_types[(i - 1) % len(app_types)]
            ro = regional_officers[(i - 1) % len(regional_officers)]
            
            # Category of timeline
            if i <= 20:
                # Overdue!
                stage, status = ("SCRUTINY" if i % 2 == 0 else "EVC", "ESCALATED" if i % 3 == 0 else "IN_PROGRESS")
                sub_days = 40 + (i * 2)
                entered_days = 15 + (i % 10)
                due_offset = - (2 + (i % 12))  # overdue by 2 to 14 days
                risk = round(65.0 + (i % 30) * 0.9, 1)
            elif i <= 45:
                # Near deadline (T-1 to T-3)
                stage, status = ("SCRUTINY" if i % 3 == 0 else "EVC" if i % 3 == 1 else "BUREAU_DECISION", "IN_PROGRESS")
                sub_days = 20 + (i % 15)
                entered_days = 5 + (i % 5)
                due_offset = 1 if (i % 2 == 0) else (2 if i % 3 == 0 else 3) # near deadline!
                risk = round(40.0 + (i % 25) * 1.1, 1)
            elif i <= 110:
                # Healthy In Progress
                stage_idx = i % 8
                stage, status = app_stages[stage_idx]
                sub_days = 10 + (i % 45)
                entered_days = 2 + (i % 12)
                due_offset = 7 + (i % 25) # ample time
                risk = round(10.0 + (i % 40) * 0.8, 1)
            else:
                # Finalized (Approved / Rejected)
                is_approved = (i % 5 != 0)
                stage = "APPROVED" if is_approved else "REJECTED"
                status = "APPROVED" if is_approved else "REJECTED"
                sub_days = 60 + (i % 30)
                entered_days = 10 + (i % 15)
                due_offset = - (15 + (i % 20))
                risk = 5.0 if is_approved else 85.0

            submitted_at = now - timedelta(days=sub_days)
            stage_entered = now - timedelta(days=entered_days)
            due_dt = now + timedelta(days=due_offset)
            ref_no = f"AICTE/2026-27/RO-{inst.region.name[:2].upper()}-{i:04d}"

            app = Application(
                ref_no=ref_no,
                institution_id=inst.id,
                application_type=app_type,
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

            # Add StageHistory trail
            # 1. Submission entry
            h1 = StageHistory(
                application_id=app.id,
                stage="SUBMITTED",
                entered_at=submitted_at,
                completed_at=submitted_at + timedelta(hours=4),
                officer_id=None,
                action="ONLINE_APPLICATION_SUBMITTED",
                remarks="Application submitted via AICTE institutional portal with digital sign-off."
            )
            db.add(h1)

            # 2. Intermediate or current stage entry
            if stage != "SUBMITTED":
                h2 = StageHistory(
                    application_id=app.id,
                    stage="SCRUTINY",
                    entered_at=submitted_at + timedelta(days=2),
                    completed_at=stage_entered if stage not in ["SCRUTINY", "DEFICIENT"] else None,
                    officer_id=ro.id,
                    action="SCRUTINY_EVALUATION",
                    remarks=f"Scrutiny processed by Regional Officer {ro.name}."
                )
                db.add(h2)

            if stage in ["APPROVED", "REJECTED"]:
                h_final = StageHistory(
                    application_id=app.id,
                    stage="BUREAU_DECISION",
                    entered_at=stage_entered,
                    completed_at=stage_entered + timedelta(days=1),
                    officer_id=bureau_officers[0].id,
                    action="FINAL_AUTHORITY_DECISION",
                    remarks=f"Final order issued: {stage}. Speaking order uploaded."
                )
                db.add(h_final)

        # 8. EVC Schedules (25 schedules: upcoming, due, overdue, completed)
        print("[Seed] 8/15 Seeding 25 EVC Schedules (upcoming, due, overdue, completed)...")
        evc_list: List[EVCSchedule] = []
        # pick applications in EVC, SAC_SHC, or bureau stages
        evc_candidate_apps = [a for a in applications_list if a.current_stage in ["EVC", "SAC_SHC", "BUREAU_DECISION", "APPROVED", "REJECTED"]]
        
        for idx in range(1, 26):
            target_app = evc_candidate_apps[(idx - 1) % len(evc_candidate_apps)]
            c_members = [evc_members[(idx) % len(evc_members)].id, evc_members[(idx + 1) % len(evc_members)].id]
            is_new_inst = target_app.institution.is_new
            
            if idx <= 7:
                # Upcoming (SCHEDULED)
                status = "SCHEDULED"
                sched_dt = now + timedelta(days=4 + (idx * 2))
                due_dt = sched_dt + timedelta(days=5)
                comp_dt = None
            elif idx <= 13:
                # Due soon / In Progress
                status = "IN_PROGRESS"
                sched_dt = now - timedelta(days=1)
                due_dt = now + timedelta(days=2)
                comp_dt = None
            elif idx <= 19:
                # Overdue
                status = "OVERDUE"
                sched_dt = now - timedelta(days=12 + idx)
                due_dt = now - timedelta(days=4 + (idx % 3))
                comp_dt = None
            else:
                # Completed
                status = "COMPLETED"
                sched_dt = now - timedelta(days=20 + idx)
                due_dt = sched_dt + timedelta(days=7)
                comp_dt = sched_dt + timedelta(days=2)

            evc_item = EVCSchedule(
                application_id=target_app.id,
                scheduled_date=sched_dt,
                status=status,
                committee_ids=json.dumps(c_members),
                due_date=due_dt,
                completed_at=comp_dt,
                is_new_institution=is_new_inst
            )
            db.add(evc_item)
            db.flush()
            evc_list.append(evc_item)

        # 9. Undertakings (40 undertakings: pending, due soon, overdue, verified)
        print("[Seed] 9/15 Seeding 40 Undertakings (pending, due soon, overdue, verified)...")
        conditions = [
            "Construct permanent boundary wall around entire 7.5 acres perimeter within 90 days.",
            "Recruit 4 regular Ph.D. Associate Professors in Computer Engineering before next academic cycle.",
            "Upgrade campus leased line Internet connectivity from 100 Mbps to 1 Gbps fiber optic link.",
            "Set up dedicated Innovation and Entrepreneurship Development Centre (IEDC) lab facility.",
            "Complete installation of wheelchair ramps and braille elevators across all academic blocks.",
            "Submit renewed structural safety certificate from State Public Works Department.",
            "Deposit statutory FDR of ₹50,00,000 for Corpus Fund under AICTE joint account.",
            "Establish language laboratory with 30 high-spec computing terminals and licensed software.",
            "Procure mandatory subscription to IEEE / ASME / Springer digital technical journals.",
            "Implement rooftop solar power installation of 50 kW capacity as green campus initiative."
        ]

        undertakings_list: List[Undertaking] = []
        for u_idx in range(1, 41):
            target_app = applications_list[(u_idx * 3) % len(applications_list)]
            cond = conditions[(u_idx - 1) % len(conditions)]
            ev_file = files_list[u_idx % len(files_list)]
            ro = regional_officers[u_idx % len(regional_officers)]

            if u_idx <= 10:
                # PENDING (due in 20-60 days)
                status = "PENDING"
                due_dt = now + timedelta(days=15 + u_idx * 4)
                v_file = None
                v_by = None
                v_at = None
            elif u_idx <= 20:
                # DUE_SOON (due in 2-7 days)
                status = "DUE_SOON"
                due_dt = now + timedelta(days=1 + (u_idx % 6))
                v_file = ev_file.id if u_idx % 2 == 0 else None
                v_by = None
                v_at = None
            elif u_idx <= 30:
                # OVERDUE (past due)
                status = "OVERDUE"
                due_dt = now - timedelta(days=3 + (u_idx % 14))
                v_file = None
                v_by = None
                v_at = None
            else:
                # VERIFIED
                status = "VERIFIED"
                due_dt = now - timedelta(days=10 + u_idx)
                v_file = ev_file.id
                v_by = ro.id
                v_at = now - timedelta(days=2 + (u_idx % 5))

            und = Undertaking(
                institution_id=target_app.institution_id,
                application_id=target_app.id,
                condition_text=cond,
                due_date=due_dt,
                status=status,
                evidence_file_id=v_file,
                verified_by=v_by,
                verified_at=v_at
            )
            db.add(und)
            db.flush()
            undertakings_list.append(und)

        # 10. Documents (60 documents with lease expiry dates spread from -30 to +365 days)
        print("[Seed] 10/15 Seeding 60 Documents (lease expiry from -30 to +365 days)...")
        doc_types = ["LEASE", "BUILDING_PLAN", "NOC", "FIRE_SAFETY", "AUDITED_ACCOUNTS", "LEASE", "AFFILIATION_ORDER"]
        documents_list: List[Document] = []

        # We will spread expiry dates from -30 to +365 days from today
        # Items 1-12: Expired (-30 to -1 days)
        # Items 13-25: Expiring critical (1 to 30 days)
        # Items 26-40: Medium term (31 to 90 days)
        # Items 41-60: Long term safe (91 to 365 days)
        for d_idx in range(1, 61):
            inst = institutions_list[(d_idx - 1) % len(institutions_list)]
            dtype = doc_types[(d_idx - 1) % len(doc_types)]
            f_record = files_list[d_idx % len(files_list)]
            issue_dt = now - timedelta(days=365 + (d_idx * 10))

            if d_idx <= 12:
                # Expired (-30 to -1 days)
                offset = - (2 + (d_idx * 2))
                v_status = "EXPIRED" if dtype == "LEASE" else "REJECTED"
            elif d_idx <= 25:
                # Expiring soon (+1 to +30 days)
                offset = 3 + (d_idx * 2)
                v_status = "VERIFIED" if d_idx % 2 == 0 else "PENDING"
            elif d_idx <= 40:
                # Expiring medium (+31 to +90 days)
                offset = 35 + ((d_idx - 25) * 3)
                v_status = "VERIFIED"
            else:
                # Long term safe (+91 to +365 days)
                offset = 100 + ((d_idx - 40) * 13)
                v_status = "VERIFIED"

            exp_dt = now + timedelta(days=offset)
            renewal_id = documents_list[d_idx - 2].id if (d_idx > 1 and d_idx % 7 == 0) else None

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

        # 11. Alert Rules (Default alert_rules: reminders at T-7, T-3, T-1, overdue; lease alerts at 90/60/30/7 days; escalation ladder)
        print("[Seed] 11/15 Seeding Default Alert Rules & Escalation Ladder...")
        alert_rules_data = [
            # Application SLA Reminders
            ("STAGE_SLA", "REMINDER", -7, "INFO", 0, ["INSTITUTION", "REGIONAL_OFFICER"]),
            ("STAGE_SLA", "REMINDER", -3, "WARNING", 0, ["INSTITUTION", "REGIONAL_OFFICER"]),
            ("STAGE_SLA", "REMINDER", -1, "CRITICAL", 0, ["INSTITUTION", "REGIONAL_OFFICER"]),
            ("STAGE_SLA", "OVERDUE", 0, "ESCALATION", 1, ["REGIONAL_OFFICER", "REGIONAL_HEAD"]),
            ("STAGE_SLA", "ESCALATION", 2, "ESCALATION", 2, ["REGIONAL_HEAD"]),
            ("STAGE_SLA", "ESCALATION", 5, "ESCALATION", 3, ["BUREAU_OFFICER"]),

            # Lease Expiry Alerts
            ("LEASE_EXPIRY", "EXPIRY_WARNING", 90, "INFO", 0, ["INSTITUTION", "REGIONAL_OFFICER"]),
            ("LEASE_EXPIRY", "EXPIRY_WARNING", 60, "WARNING", 0, ["INSTITUTION", "REGIONAL_OFFICER"]),
            ("LEASE_EXPIRY", "EXPIRY_WARNING", 30, "CRITICAL", 1, ["INSTITUTION", "REGIONAL_OFFICER", "REGIONAL_HEAD"]),
            ("LEASE_EXPIRY", "EXPIRY_WARNING", 7, "CRITICAL", 2, ["INSTITUTION", "REGIONAL_OFFICER", "REGIONAL_HEAD", "BUREAU_OFFICER"]),

            # Undertaking Deadlines
            ("UNDERTAKING_DEADLINE", "REMINDER", -7, "INFO", 0, ["INSTITUTION"]),
            ("UNDERTAKING_DEADLINE", "REMINDER", -3, "WARNING", 0, ["INSTITUTION", "REGIONAL_OFFICER"]),
            ("UNDERTAKING_DEADLINE", "OVERDUE", 0, "CRITICAL", 1, ["REGIONAL_OFFICER", "REGIONAL_HEAD"]),
            ("UNDERTAKING_DEADLINE", "ESCALATION", 3, "ESCALATION", 2, ["REGIONAL_HEAD", "BUREAU_OFFICER"])
        ]

        alert_rules_list: List[AlertRule] = []
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
            alert_rules_list.append(ar)

        # 12. Notifications (Realistic sample notifications)
        print("[Seed] 12/15 Seeding Notifications...")
        notifs_data = [
            ("SLA Alert: Application Due Tomorrow", "Application AICTE/2026-27/RO-NW-0021 reaches Scrutiny deadline in 24 hours.", "STAGE_SLA", "CRITICAL", False),
            ("SLA Breach: Application Overdue", "Application AICTE/2026-27/RO-W-0004 has exceeded its SLA window by 4 days. Escalated to Regional Head.", "STAGE_SLA", "ESCALATION", False),
            ("Lease Agreement Expiring in 30 Days", "Registered lease deed for Maharashtra College of Engineering & Research expires on 2026-11-27.", "LEASE_EXPIRY", "WARNING", False),
            ("Lease Agreement EXPIRED", "Registered lease for Agra Institute of Technical Education expired 14 days ago. Urgent compliance needed.", "LEASE_EXPIRY", "CRITICAL", True),
            ("Compliance Undertaking Overdue", "Undertaking for installation of Divyangjan barrier-free access is 5 days overdue.", "UNDERTAKING_DEADLINE", "CRITICAL", False),
            ("EVC Inspection Scheduled", "Field inspection for Bangalore Institute of Advanced Computing & AI confirmed for next Tuesday.", "EVC_INSPECTION", "INFO", True),
            ("Approval Order Dispatched", "Extension of Approval (EoA) 2026-2027 digitally issued for Delhi Institute of Technology & Management.", "APPROVAL", "INFO", True)
        ]

        for idx, (title, msg, cat, sev, read) in enumerate(notifs_data * 5):
            u_target = users_list[idx % len(users_list)]
            notif = Notification(
                user_id=u_target.id,
                title=title,
                message=msg,
                category=cat,
                severity=sev,
                link=f"/applications/{((idx % 150) + 1)}",
                is_read=read,
                created_at=now - timedelta(hours=(idx * 3) + 1),
                channel="IN_APP"
            )
            db.add(notif)
        db.flush()

        # 13. Escalations (Hierarchy: Level 1 -> Level 2 -> Level 3)
        print("[Seed] 13/15 Seeding Escalations...")
        escalations_meta = [
            ("APPLICATION", applications_list[0].id, 1, "Regional Officer (Er. Vikramaditya Rathore)", "Scrutiny timeline exceeded 72 hours SLA window without action."),
            ("APPLICATION", applications_list[1].id, 2, "Regional Head (Dr. Sanjay Sharma)", "Application pending beyond 5 days after initial SLA breach; regional escalation triggered."),
            ("APPLICATION", applications_list[2].id, 3, "Bureau Officer (Dr. Rajive Kumar)", "Critical delay: application pending over 10 days in Scrutiny. Referred to Headquarters Bureau."),
            ("UNDERTAKING", undertakings_list[20].id, 1, "Regional Officer (Er. Sneha Kulkarni)", "Institute failed to submit bank guarantee evidence by stipulated due date."),
            ("UNDERTAKING", undertakings_list[21].id, 2, "Regional Head (Dr. Manoj Kumar)", "Statutory faculty recruitment undertaking lapsed for over 15 days."),
            ("EVC", evc_list[13].id, 1, "Regional Officer (Er. Ananya Mukherjee)", "Inspection team report submission delayed past committee due date.")
        ]

        for etype, eid, lvl, to_role, rsn in escalations_meta * 3:
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
        print("[Seed] 14/15 Seeding Tamper-Evident Cryptographic Audit Trail...")
        genesis_hash = hashlib.sha256("INTELLIAPPROVE_AICTE_GENESIS_STATE_2026".encode("utf-8")).hexdigest()
        prev_h = genesis_hash

        audit_actions = [
            ("SYSTEM_INIT", "CONFIG", "1", None, {"status": "INITIALIZED", "system": "AICTE_APPROVAL_SUITE"}, "System baseline bootstrap & schema validation"),
            ("USER_LOGIN_SUCCESS", "USER", "1", None, {"auth": "SUCCESS", "role": "ADMIN"}, "Administrator authenticated successfully"),
            ("APPLICATION_SUBMIT", "APPLICATION", "1", None, {"stage": "SUBMITTED", "status": "IN_PROGRESS"}, "Institutional nodal officer submitted EoA application"),
            ("DOCUMENT_UPLOAD", "DOCUMENT", "1", None, {"doc_type": "LEASE", "status": "PENDING"}, "Registered deed proof uploaded by institution"),
            ("DOCUMENT_VERIFY", "DOCUMENT", "1", {"status": "PENDING"}, {"status": "VERIFIED"}, "Scrutiny officer stamped document as verified compliant"),
            ("EVC_SCHEDULED", "EVC_SCHEDULE", "1", None, {"status": "SCHEDULED", "members": [20, 21]}, "Field inspection committee empanelled"),
            ("UNDERTAKING_RECORDED", "UNDERTAKING", "1", None, {"status": "PENDING", "condition": "FSR_1:15"}, "Conditional undertaking bound to institute"),
            ("SLA_BREACH_DETECTED", "APPLICATION", "4", {"status": "IN_PROGRESS"}, {"status": "ESCALATED"}, "Automated background scheduler flagged SLA window violation"),
            ("ESCALATION_DISPATCHED", "ESCALATION", "1", None, {"level": 1, "to": "REGIONAL_OFFICER"}, "Escalation notification dispatched to regional head"),
            ("FINAL_APPROVAL_GRANTED", "APPLICATION", "111", {"stage": "BUREAU_DECISION"}, {"stage": "APPROVED", "status": "APPROVED"}, "Competent authority granted approval with speaking order")
        ]

        for idx, (act, etype, eid, old_v, new_v, rsn) in enumerate(audit_actions * 3):
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
        print("[Seed] Seeding completed successfully!\n")

    except Exception as e:
        db.rollback()
        print(f"[Seed] ERROR seeding database: {e}")
        raise e
    finally:
        db.close()

def print_row_counts():
    """Print exact row counts for all 15 tables to confirm."""
    db = SessionLocal()
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

    print("=" * 60)
    print("      INTELLIAPPROVE DATABASE VERIFICATION (ROW COUNTS)      ")
    print("=" * 60)
    total_records = 0
    for name, model in tables:
        count = db.query(model).count()
        total_records += count
        print(f"  • {name:<25} : {count:>5} rows")
    print("-" * 60)
    print(f"  Total Tables Checked     : {len(tables):>5}")
    print(f"  Total Database Records   : {total_records:>5}")
    print("=" * 60)
    db.close()

if __name__ == "__main__":
    seed_database(reset=True)
    print_row_counts()
