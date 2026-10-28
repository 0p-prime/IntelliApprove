"""
Comprehensive Seed Script for IntelliApprove.
Populates:
- Configurable stages, routes, escalation ladders, and APH compliance rules (Rule #3)
- Realistic AICTE institutions
- Demo accounts for every role (Institute, Scrutiny, EVC, Regional Officer, Authority, Admin)
- Sample applications at various lifecycle stages
- Initial audit logs (Rule #1)
"""
from datetime import datetime, timezone, timedelta
from app.core.database import Base, engine, SessionLocal
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.institution import Institution
from app.models.workflow import StageConfig, WorkflowRoute, EscalationLadder
from app.models.compliance import ComplianceNormRule, DeficiencyRecord
from app.models.application import Application, AcademicProgram, ApplicationDocument, ApplicationStageHistory
from app.models.undertaking import Undertaking
from app.models.alert import Alert, EscalationEvent
from app.models.audit import AuditLog

def seed_database():
    """Create all tables and populate with rich seed data."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Check if already seeded
    if db.query(StageConfig).first():
        print("[Seed] Database already seeded. Skipping.")
        db.close()
        return

    print("[Seed] Seeding database with AICTE approval data...")
    now = datetime.now(timezone.utc)

    # 1. Configurable Stages (Rule #3)
    stages_data = [
        {"stage_key": "DRAFT", "name": "Application Drafting", "desc": "Institute prepares forms, documents, and programs", "seq": 1, "sla": 168, "role": "INSTITUTION", "terminal": False},
        {"stage_key": "UNDER_SCRUTINY", "name": "Document Scrutiny Committee", "desc": "AICTE Scrutiny Committee verifies legal documents and handbook norms", "seq": 2, "sla": 72, "role": "SCRUTINY_OFFICER", "terminal": False},
        {"stage_key": "SCRUTINY_DEFICIENT", "name": "Scrutiny Deficiency Rectification", "desc": "Institute rectifies shortfall flagged during initial scrutiny", "seq": 3, "sla": 96, "role": "INSTITUTION", "terminal": False},
        {"stage_key": "EVC_SCHEDULED", "name": "Expert Visit Committee (EVC)", "desc": "Physical / Virtual inspection of labs, land, and faculty", "seq": 4, "sla": 120, "role": "EVC_INSPECTOR", "terminal": False},
        {"stage_key": "SHC_REVIEW", "name": "Standing Hearing Committee (SHC)", "desc": "Hearing conducted for institutes with major non-compliances", "seq": 5, "sla": 72, "role": "REGIONAL_OFFICER", "terminal": False},
        {"stage_key": "PENDING_AUTHORITY_DECISION", "name": "Competent Authority Decision Panel", "desc": "Executive Committee / Member Secretary human review and approval issuance", "seq": 6, "sla": 48, "role": "COMPETENT_AUTHORITY", "terminal": False},
        {"stage_key": "APPROVED", "name": "Approval Granted (EoA Issued)", "desc": "Extension of Approval granted with digital signature", "seq": 7, "sla": 0, "role": "COMPETENT_AUTHORITY", "terminal": True},
        {"stage_key": "APPROVED_WITH_CONDITIONS", "name": "Conditional Approval (Undertakings Monitored)", "desc": "Approval issued with time-bound compliance undertakings", "seq": 8, "sla": 0, "role": "COMPETENT_AUTHORITY", "terminal": True},
        {"stage_key": "REJECTED", "name": "Approval Refused", "desc": "Application rejected with formal speaking order", "seq": 9, "sla": 0, "role": "COMPETENT_AUTHORITY", "terminal": True},
    ]

    stage_map = {}
    for s in stages_data:
        obj = StageConfig(
            stage_key=s["stage_key"],
            name=s["name"],
            description=s["desc"],
            order_sequence=s["seq"],
            sla_hours=s["sla"],
            assigned_role=s["role"],
            is_terminal=s["terminal"]
        )
        db.add(obj)
        db.flush()
        stage_map[s["stage_key"]] = obj

    # 2. Configurable Workflow Routes (Rule #3)
    routes_data = [
        # From Draft
        {"from": "DRAFT", "to": "UNDER_SCRUTINY", "action": "Submit Application for Scrutiny", "role": "INSTITUTION", "desc": "Formally submit application to AICTE"},
        # From Scrutiny
        {"from": "UNDER_SCRUTINY", "to": "EVC_SCHEDULED", "action": "Clear Scrutiny & Recommend EVC", "role": "SCRUTINY_OFFICER", "desc": "All documents verified; proceed to physical inspection"},
        {"from": "UNDER_SCRUTINY", "to": "SCRUTINY_DEFICIENT", "action": "Issue Scrutiny Deficiency Notice", "role": "SCRUTINY_OFFICER", "desc": "Documents missing or non-compliant"},
        {"from": "SCRUTINY_DEFICIENT", "to": "UNDER_SCRUTINY", "action": "Resubmit Rectified Documents", "role": "INSTITUTION", "desc": "Institute submits compliance proof"},
        # From EVC
        {"from": "EVC_SCHEDULED", "to": "PENDING_AUTHORITY_DECISION", "action": "Recommend for Executive Committee Approval", "role": "EVC_INSPECTOR", "desc": "Inspection successful, forward to authority"},
        {"from": "EVC_SCHEDULED", "to": "SHC_REVIEW", "action": "Refer to Standing Hearing Committee", "role": "EVC_INSPECTOR", "desc": "Deficiencies observed; require hearing"},
        # From SHC
        {"from": "SHC_REVIEW", "to": "PENDING_AUTHORITY_DECISION", "action": "Submit Hearing Report to Authority", "role": "REGIONAL_OFFICER", "desc": "Hearing concluded; forward recommendations"},
        # Competent Authority Decisions (Strict Rule #2 Human Oversight)
        {"from": "PENDING_AUTHORITY_DECISION", "to": "APPROVED", "action": "Grant Unconditional EoA Approval", "role": "COMPETENT_AUTHORITY", "desc": "Issue formal EoA digital order"},
        {"from": "PENDING_AUTHORITY_DECISION", "to": "APPROVED_WITH_CONDITIONS", "action": "Grant Conditional Approval with Undertakings", "role": "COMPETENT_AUTHORITY", "desc": "Issue EoA subject to undertakings"},
        {"from": "PENDING_AUTHORITY_DECISION", "to": "REJECTED", "action": "Refuse Approval (Speaking Order)", "role": "COMPETENT_AUTHORITY", "desc": "Refuse approval based on non-compliance"},
    ]

    for r in routes_data:
        route_obj = WorkflowRoute(
            from_stage_id=stage_map[r["from"]].id,
            to_stage_id=stage_map[r["to"]].id,
            action_name=r["action"],
            required_role=r["role"],
            requires_human_badge=True,
            description=r["desc"]
        )
        db.add(route_obj)

    # 3. Escalation Ladders (Rule #3)
    escalations_data = [
        {"stage": "UNDER_SCRUTINY", "sla": 72, "r1": 24, "r2": 6, "role": "REGIONAL_OFFICER", "action": "ESCALATE_TO_REGIONAL_DIRECTOR"},
        {"stage": "EVC_SCHEDULED", "sla": 120, "r1": 48, "r2": 12, "role": "REGIONAL_OFFICER", "action": "ESCALATE_TO_REGIONAL_DIRECTOR"},
        {"stage": "SHC_REVIEW", "sla": 72, "r1": 24, "r2": 6, "role": "COMPETENT_AUTHORITY", "action": "ESCALATE_TO_MEMBER_SECRETARY"},
        {"stage": "PENDING_AUTHORITY_DECISION", "sla": 48, "r1": 12, "r2": 4, "role": "ADMIN", "action": "NOTIFY_EXECUTIVE_COMMITTEE_CHAIRMAN"},
    ]

    for esc in escalations_data:
        stg = stage_map[esc["stage"]]
        ladder = EscalationLadder(
            stage_id=stg.id,
            stage_name=stg.name,
            sla_hours=esc["sla"],
            first_reminder_hours_before=esc["r1"],
            second_reminder_hours_before=esc["r2"],
            escalate_to_role=esc["role"],
            escalate_action=esc["action"]
        )
        db.add(ladder)

    # 4. Compliance Norm Rules (AICTE APH)
    rules_data = [
        {"code": "FSR_NORM", "name": "Faculty to Student Ratio (FSR)", "cat": "Faculty", "desc": "Prescribed FSR is 1:15 for UG Engineering & 1:20 for Diploma", "std": 15.0, "margin": 10.0, "unit": "Ratio", "sev": "CRITICAL"},
        {"code": "LAND_ACRES", "name": "Minimum Land Area Norm", "cat": "Land & Infrastructure", "desc": "Engineering institution in rural area must possess >= 7.5 contiguous acres (2.5 acres in Urban/Mega)", "std": 5.0, "margin": 0.0, "unit": "Acres", "sev": "CRITICAL"},
        {"code": "BUILTUP_AREA", "name": "Instructional Built-up Area per Student", "cat": "Land & Infrastructure", "desc": "Minimum 10 sqm instructional and administrative area per enrolled student", "std": 10.0, "margin": 5.0, "unit": "Sqm/Student", "sev": "MAJOR"},
        {"code": "COMPUTER_RATIO", "name": "Computing Terminal Ratio", "cat": "Computing", "desc": "Minimum 1 computer per 4 students (0.25 ratio) with licensed software", "std": 0.25, "margin": 10.0, "unit": "Ratio", "sev": "MAJOR"},
        {"code": "ANTI_RAGGING", "name": "Mandatory Anti-Ragging Committee", "cat": "Governance", "desc": "Constitution of Anti-Ragging Committee & 24x7 helpline under AICTE 2009 regulations", "std": 1.0, "margin": 0.0, "unit": "Yes/No", "sev": "CRITICAL"},
        {"code": "ICC_COMMITTEE", "name": "Internal Complaints Committee (ICC)", "cat": "Governance", "desc": "Statutory ICC for prevention of sexual harassment and gender equality", "std": 1.0, "margin": 0.0, "unit": "Yes/No", "sev": "CRITICAL"},
        {"code": "GRIEVANCE_COMMITTEE", "name": "Student Grievance Redressal Committee", "cat": "Governance", "desc": "SGRC with appointed independent Ombudsperson", "std": 1.0, "margin": 0.0, "unit": "Yes/No", "sev": "CRITICAL"},
        {"code": "BARRIER_FREE", "name": "Barrier-Free Divyangjan Accessibility", "cat": "Statutory", "desc": "Wheelchair ramps, tactile pavers, braille lifts, and accessible washrooms", "std": 1.0, "margin": 0.0, "unit": "Yes/No", "sev": "MAJOR"},
    ]

    for r in rules_data:
        rule_obj = ComplianceNormRule(
            rule_code=r["code"],
            name=r["name"],
            category=r["cat"],
            description=r["desc"],
            standard_value=r["std"],
            threshold_margin_percent=r["margin"],
            unit=r["unit"],
            severity=r["sev"]
        )
        db.add(rule_obj)

    # 5. Realistic Institutions
    inst1 = Institution(
        aicte_id="1-1029384751",
        name="Delhi Institute of Technology & Management",
        category="Engineering & Technology",
        state="Delhi",
        region="Northern",
        district="North Delhi",
        address="Sector 14, Institutional Area, Rohini, New Delhi - 110085",
        pin_code="110085",
        established_year=2008,
        trust_society_name="Shri Ram Education Trust",
        head_of_institution_name="Dr. Arvind Narayanan",
        head_email="principal@ditm.ac.in",
        head_phone="+91-9811092831",
        total_land_acres=7.5,
        total_builtup_sqm=14500.0,
        total_computers=380,
        broadband_bandwidth_mbps=1000,
        has_anti_ragging_committee=1,
        has_icc_committee=1,
        has_grievance_committee=1,
        has_sc_st_cell=1,
        has_barrier_free_environment=1
    )
    db.add(inst1)

    inst2 = Institution(
        aicte_id="1-4829104822",
        name="Maharashtra College of Engineering & Research",
        category="Engineering & Technology",
        state="Maharashtra",
        region="Western",
        district="Pune",
        address="Survey No. 42, Hinjewadi Phase 2, Pune - 411057",
        pin_code="411057",
        established_year=2012,
        trust_society_name="Savitribai Phule Knowledge Foundation",
        head_of_institution_name="Dr. Sunita Deshmukh",
        head_email="director@mcer.edu.in",
        head_phone="+91-9822019283",
        total_land_acres=4.2,  # Shortfall in rural land norm to demonstrate deficiency!
        total_builtup_sqm=9800.0,
        total_computers=180,  # Below recommended ratio
        broadband_bandwidth_mbps=500,
        has_anti_ragging_committee=1,
        has_icc_committee=0,  # Missing ICC to demonstrate statutory deficiency!
        has_grievance_committee=1,
        has_sc_st_cell=1,
        has_barrier_free_environment=0
    )
    db.add(inst2)

    inst3 = Institution(
        aicte_id="1-8930192843",
        name="Bangalore Institute of Advanced Computing & AI",
        category="Engineering & Technology",
        state="Karnataka",
        region="South-Western",
        district="Bengaluru Urban",
        address="Outer Ring Road, Electronic City Phase 1, Bengaluru - 560100",
        pin_code="560100",
        established_year=2015,
        trust_society_name="Kaveri Tech Foundation",
        head_of_institution_name="Prof. K. R. Venkatesh",
        head_email="principal@biaca.ac.in",
        head_phone="+91-9448012948",
        total_land_acres=6.0,
        total_builtup_sqm=16000.0,
        total_computers=450,
        broadband_bandwidth_mbps=1000,
        has_anti_ragging_committee=1,
        has_icc_committee=1,
        has_grievance_committee=1,
        has_sc_st_cell=1,
        has_barrier_free_environment=1
    )
    db.add(inst3)

    db.flush()

    # 6. Users across all roles
    pwd_hash = get_password_hash("aicte123")

    users_data = [
        {"email": "institute@ditm.ac.in", "name": "Dr. Arvind Narayanan", "role": "INSTITUTION", "desig": "Principal / Director", "phone": "+91-9811092831", "inst": inst1.id},
        {"email": "institute@mcer.edu.in", "name": "Dr. Sunita Deshmukh", "role": "INSTITUTION", "desig": "Principal / Director", "phone": "+91-9822019283", "inst": inst2.id},
        {"email": "scrutiny.officer@aicte.gov.in", "name": "Shri Rajesh Verma", "role": "SCRUTINY_OFFICER", "desig": "Senior Scrutiny Officer", "phone": "+91-9810011223", "inst": None},
        {"email": "evc.inspector@aicte.gov.in", "name": "Prof. Meenakshi Sundaram", "role": "EVC_INSPECTOR", "desig": "EVC Chairman & IIT Professor", "phone": "+91-9840022334", "inst": None},
        {"email": "ro.northern@aicte.gov.in", "name": "Dr. Sanjay Sharma", "role": "REGIONAL_OFFICER", "desig": "Regional Officer (North)", "phone": "+91-9810033445", "inst": None},
        {"email": "member.secretary@aicte.gov.in", "name": "Prof. Rajive Kumar", "role": "COMPETENT_AUTHORITY", "desig": "Member Secretary, AICTE", "phone": "+91-9810044556", "inst": None},
        {"email": "admin@aicte.gov.in", "name": "AICTE Systems Administrator", "role": "ADMIN", "desig": "Chief Technology Officer", "phone": "+91-9810000000", "inst": None},
    ]

    for u in users_data:
        usr = User(
            email=u["email"],
            hashed_password=pwd_hash,
            full_name=u["name"],
            role=u["role"],
            designation=u["desig"],
            phone=u["phone"],
            institution_id=u["inst"],
            is_active=True
        )
        db.add(usr)

    db.flush()

    # 7. Applications at various lifecycle stages
    # Application 1: Under Scrutiny (Healthy)
    app1 = Application(
        application_number="AICTE-2026-EOA-1001",
        institution_id=inst1.id,
        academic_year="2026-2027",
        application_type="Extension of Approval (EoA)",
        current_stage_id=stage_map["UNDER_SCRUTINY"].id,
        status="UNDER_SCRUTINY",
        submission_date=now - timedelta(hours=36),
        stage_entered_at=now - timedelta(hours=36),
        sla_deadline=now + timedelta(hours=36),
        is_escalated=False,
        deficiency_count=0,
        compliance_score=98.5,
        human_oversight_required=True
    )
    db.add(app1)
    db.flush()

    # Add programs for App 1
    prog1 = AcademicProgram(application_id=app1.id, program_name="Computer Science & Engineering", level="Undergraduate", approved_intake_prev_year=120, requested_intake=180, faculty_count=12, total_enrolled=480, cadre_ratio="1:2:9")
    prog2 = AcademicProgram(application_id=app1.id, program_name="Artificial Intelligence & Machine Learning", level="Undergraduate", approved_intake_prev_year=60, requested_intake=60, faculty_count=4, total_enrolled=240, cadre_ratio="1:1:2")
    prog3 = AcademicProgram(application_id=app1.id, program_name="Electronics & Communication Engineering", level="Undergraduate", approved_intake_prev_year=60, requested_intake=60, faculty_count=5, total_enrolled=240, cadre_ratio="1:1:3")
    db.add_all([prog1, prog2, prog3])

    # Add documents for App 1
    doc1 = ApplicationDocument(application_id=app1.id, doc_type="Land Ownership & Title Deed", file_name="land_registered_deed_2008.pdf", file_url="/documents/sample_land_deed.pdf", status="VERIFIED_COMPLIANT", verification_remarks="Verified by Land Revenue Authority.")
    doc2 = ApplicationDocument(application_id=app1.id, doc_type="Building Approval Plan (PVD/Municipal)", file_name="municipal_approved_plan.pdf", file_url="/documents/sample_building_plan.pdf", status="VERIFIED_COMPLIANT", verification_remarks="Municipal Corporation approval valid till 2030.")
    doc3 = ApplicationDocument(application_id=app1.id, doc_type="Fire Safety Certificate / NOC", file_name="fire_safety_noc_2026.pdf", file_url="/documents/sample_fire_noc.pdf", status="PENDING_VERIFICATION")
    doc4 = ApplicationDocument(application_id=app1.id, doc_type="Audited Financial Statement", file_name="audited_accounts_2025.pdf", file_url="/documents/sample_balance_sheet.pdf", status="PENDING_VERIFICATION")
    db.add_all([doc1, doc2, doc3, doc4])

    # Application 2: EVC Inspected with Deficiencies, escalated SLA breach to demonstrate ladder!
    app2 = Application(
        application_number="AICTE-2026-EOA-1002",
        institution_id=inst2.id,
        academic_year="2026-2027",
        application_type="Extension of Approval (EoA) + Intake Increase",
        current_stage_id=stage_map["EVC_SCHEDULED"].id,
        status="EVC_SCHEDULED",
        submission_date=now - timedelta(days=7),
        stage_entered_at=now - timedelta(days=6),
        sla_deadline=now - timedelta(hours=24),  # SLA BREACHED!
        is_escalated=True,
        escalation_level=1,
        deficiency_count=3,
        compliance_score=72.0,
        human_oversight_required=True,
        scrutiny_remarks="Recommended for EVC inspection with special focus on Land and ICC constitution."
    )
    db.add(app2)
    db.flush()

    prog4 = AcademicProgram(application_id=app2.id, program_name="Mechanical Engineering", level="Undergraduate", approved_intake_prev_year=60, requested_intake=60, faculty_count=3, total_enrolled=240, cadre_ratio="0:1:2")
    prog5 = AcademicProgram(application_id=app2.id, program_name="Computer Engineering", level="Undergraduate", approved_intake_prev_year=120, requested_intake=180, faculty_count=7, total_enrolled=480, cadre_ratio="1:2:4")
    db.add_all([prog4, prog5])

    # Deficiencies for App 2
    def1 = DeficiencyRecord(application_id=app2.id, rule_code="LAND_ACRES", title="Insufficient Land Area (4.2 Acres vs 5.0 Acres)", description="Campus land area of 4.2 acres does not meet rural minimum norm of 5.0 acres.", severity="CRITICAL", flagged_by="SYSTEM", is_rectified=False)
    def2 = DeficiencyRecord(application_id=app2.id, rule_code="ICC_COMMITTEE", title="Internal Complaints Committee (ICC) Missing", description="No proof of ICC constitution per POSH Act submitted.", severity="CRITICAL", flagged_by="SYSTEM", is_rectified=False)
    def3 = DeficiencyRecord(application_id=app2.id, rule_code="COMPUTER_RATIO", title="Computing Shortfall (180 PCs for 720 students)", description="Computer terminal ratio is 0.25 standard vs 0.25 actual shortfall of 20 terminals.", severity="MAJOR", flagged_by="SYSTEM", is_rectified=False)
    db.add_all([def1, def2, def3])

    # Escalation Event for App 2
    esc_event = EscalationEvent(
        application_id=app2.id,
        stage_id=stage_map["EVC_SCHEDULED"].id,
        from_role="EVC_INSPECTOR",
        escalated_to_role="REGIONAL_OFFICER",
        escalation_reason="SLA timeout in EVC Inspection scheduling (exceeded 120 hours).",
        escalation_level=1
    )
    db.add(esc_event)

    # Application 3: PENDING COMPETENT AUTHORITY DECISION (Ready for human approval / rejection demo!)
    app3 = Application(
        application_number="AICTE-2026-EOA-1003",
        institution_id=inst3.id,
        academic_year="2026-2027",
        application_type="Extension of Approval (EoA)",
        current_stage_id=stage_map["PENDING_AUTHORITY_DECISION"].id,
        status="PENDING_AUTHORITY_DECISION",
        submission_date=now - timedelta(days=10),
        stage_entered_at=now - timedelta(hours=14),
        sla_deadline=now + timedelta(hours=34),
        is_escalated=False,
        deficiency_count=1,
        compliance_score=94.0,
        human_oversight_required=True,  # STRICT RULE #2
        scrutiny_remarks="Documents verified. Clean track record.",
        evc_inspection_date=now - timedelta(days=2),
        evc_recommendation="RECOMMENDED",
        evc_remarks="Physical inspection verified high quality AI & Robotics labs, modern classrooms, and faculty credentials. Minor undertaking recommended for additional 15 PCs."
    )
    db.add(app3)
    db.flush()

    prog6 = AcademicProgram(application_id=app3.id, program_name="Computer Science & Engineering (AI & ML)", level="Undergraduate", approved_intake_prev_year=120, requested_intake=180, faculty_count=10, total_enrolled=480, cadre_ratio="1:2:7")
    prog7 = AcademicProgram(application_id=app3.id, program_name="Data Science", level="Undergraduate", approved_intake_prev_year=60, requested_intake=60, faculty_count=5, total_enrolled=240, cadre_ratio="1:1:3")
    db.add_all([prog6, prog7])

    # Sample undertaking for App 3
    undertaking1 = Undertaking(
        application_id=app3.id,
        title="Procurement of 15 High-Performance Computing Terminals",
        description="Institution will procure and install 15 additional Core-i7 / GPU workstations for the new batch before semester commencement.",
        category="Computing Infrastructure",
        due_date=now + timedelta(days=45),
        status="PENDING"
    )
    db.add(undertaking1)

    # 8. Seed Sample Audit Logs (Rule #1)
    sample_audits = [
        AuditLog(timestamp=now - timedelta(days=10), user_email="institute@biaca.ac.in", role="INSTITUTION", action="APPLICATION_CREATED", entity_type="application", entity_id=str(app3.id), details="New application AICTE-2026-EOA-1003 drafted by institute.", ip_address="10.0.1.20"),
        AuditLog(timestamp=now - timedelta(days=9), user_email="institute@biaca.ac.in", role="INSTITUTION", action="APPLICATION_SUBMITTED", entity_type="application", entity_id=str(app3.id), old_value='{"status": "DRAFT"}', new_value='{"status": "UNDER_SCRUTINY"}', details="Application formally submitted to AICTE.", ip_address="10.0.1.20"),
        AuditLog(timestamp=now - timedelta(days=5), user_email="scrutiny.officer@aicte.gov.in", role="SCRUTINY_OFFICER", action="APPLICATION_STAGE_TRANSITION", entity_type="application", entity_id=str(app3.id), old_value='{"status": "UNDER_SCRUTINY"}', new_value='{"status": "EVC_SCHEDULED"}', details="Scrutiny cleared. Forwarded for Expert Visit Committee inspection.", ip_address="14.139.60.10"),
        AuditLog(timestamp=now - timedelta(days=2), user_email="evc.inspector@aicte.gov.in", role="EVC_INSPECTOR", action="EVC_INSPECTION_REPORT_SUBMITTED", entity_type="application", entity_id=str(app3.id), new_value='{"recommendation": "RECOMMENDED"}', details="Physical inspection verified labs and faculty. Recommended for approval.", ip_address="14.139.60.15"),
        AuditLog(timestamp=now - timedelta(hours=14), user_email="ro.northern@aicte.gov.in", role="REGIONAL_OFFICER", action="APPLICATION_STAGE_TRANSITION", entity_type="application", entity_id=str(app3.id), old_value='{"status": "EVC_SCHEDULED"}', new_value='{"status": "PENDING_AUTHORITY_DECISION"}', details="Forwarded to Competent Authority for final human decision.", ip_address="14.139.60.25"),
    ]
    db.add_all(sample_audits)

    # Sample Alerts
    alert1 = Alert(
        application_id=app3.id,
        title="Human Oversight Required: AICTE-2026-EOA-1003 Awaiting Decision",
        message="Application from Bangalore Institute of Advanced Computing has completed all scrutiny and EVC steps. Awaiting Member Secretary review.",
        severity="WARNING",
        recipient_role="COMPETENT_AUTHORITY"
    )
    alert2 = Alert(
        application_id=app2.id,
        title="URGENT ESCALATION: SLA Breached for AICTE-2026-EOA-1002",
        message="Application exceeded EVC scheduling SLA of 120 hours. Escalated to Regional Directorate.",
        severity="ESCALATION",
        recipient_role="REGIONAL_OFFICER"
    )
    db.add_all([alert1, alert2])

    db.commit()
    db.close()
    print("[Seed] Successfully seeded IntelliApprove with all required data!")

if __name__ == "__main__":
    seed_database()
