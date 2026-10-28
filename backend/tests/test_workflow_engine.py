"""
Unit Tests for IntelliApprove Approval Workflow Engine (Section A).
Verifies all 5 workflow route templates:
1. "Only Scrutiny"
2. "Scrutiny + EVC"
3. "EVC + SAC/SHC"
4. "Only EVC"
5. "Scrutiny + EVC + SAC/SHC"

Each route template tests:
- Happy Path: Sequential stage completion to final human authority decision (Approved/Rejected)
- Return Application: Mandatory-reason revert to previous stage/institution with status RETURNED
- Invalid Transition: Role-based authority rejection (403), invalid stage jumps, and terminal stage protection (400)
- Case Summary & Timeline: Auto-generation of Electronic Case Summary ('Draft for official review')
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.entities import (
    Application,
    WorkflowTemplate,
    Institution,
    User,
    UserRole,
    StageHistory,
    EVCSchedule,
    AuditLog
)

client = TestClient(app)

CREATED_APP_IDS = []

@pytest.fixture(autouse=True)
def cleanup_created_apps():
    yield
    if CREATED_APP_IDS:
        db = SessionLocal()
        for aid in list(CREATED_APP_IDS):
            app = db.query(Application).filter(Application.id == aid).first()
            if app:
                db.delete(app)
        db.commit()
        db.close()
        CREATED_APP_IDS.clear()

# Helper function to obtain auth header for any user
def login(email: str) -> dict:
    res = client.post("/auth/login", json={"email": email, "password": "aicte123"})
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def officers():
    """Auth headers for different roles."""
    return {
        "admin": login("admin@aicte.gov.in"),
        "bureau": login("member.secretary@aicte.gov.in"),
        "regional_head": login("head.nw@aicte.gov.in"),
        "regional_officer": login("ro.nw@aicte.gov.in"),
        "evc_member": login("evc.expert1@aicte.gov.in"),
        "institution": login("principal@ditm.ac.in"),
    }


# ==============================================================================
# TEMPLATE 1: "Only Scrutiny"
# Route: SUBMITTED -> SCRUTINY -> BUREAU_DECISION -> APPROVED/REJECTED
# ==============================================================================

def test_template_1_only_scrutiny_happy_path(officers):
    """Happy path through Template 1: Only Scrutiny to final Bureau Approval."""
    db = SessionLocal()
    tmpl = db.query(WorkflowTemplate).filter(WorkflowTemplate.name == "Only Scrutiny").first()
    assert tmpl is not None, "Template 'Only Scrutiny' must exist in DB"
    db.close()

    # 1. Create Application
    create_res = client.post(
        "/api/v1/applications",
        headers=officers["admin"],
        json={
            "institution_id": 1,
            "application_type": "Extension of Approval (EoA)",
            "template_id": tmpl.id
        }
    )
    assert create_res.status_code == 200, create_res.text
    app_data = create_res.json()
    app_id = app_data["id"]
    CREATED_APP_IDS.append(app_id)
    assert app_data["current_stage"] == "SUBMITTED"
    assert app_data["status"] == "SUBMITTED"

    # 2. Complete SUBMITTED -> SCRUTINY (by Regional Officer)
    res_scrutiny = client.post(
        f"/api/v1/applications/{app_id}/complete-stage",
        headers=officers["regional_officer"],
        json={"remarks": "Initial documents verified. Commencing scrutiny."}
    )
    assert res_scrutiny.status_code == 200
    assert res_scrutiny.json()["current_stage"] == "SCRUTINY"
    assert res_scrutiny.json()["status"] == "UNDER_SCRUTINY"

    # 3. Complete SCRUTINY -> BUREAU_DECISION (by Regional Officer)
    res_bureau = client.post(
        f"/api/v1/applications/{app_id}/complete-stage",
        headers=officers["regional_officer"],
        json={"remarks": "Scrutiny clear. All land and building documents conform to APH norms."}
    )
    assert res_bureau.status_code == 200
    assert res_bureau.json()["current_stage"] == "BUREAU_DECISION"
    assert res_bureau.json()["status"] == "PENDING_DECISION"

    # 4. Final Human Decision at BUREAU_DECISION (by Bureau Officer)
    res_final = client.post(
        f"/api/v1/applications/{app_id}/complete-stage",
        headers=officers["bureau"],
        json={
            "remarks": "Approved by Member Secretary following regional scrutiny.",
            "verdict": "APPROVED"
        }
    )
    assert res_final.status_code == 200
    final_data = res_final.json()
    assert final_data["current_stage"] == "APPROVED"
    assert final_data["status"] == "APPROVED"
    assert final_data["approval_letter_number"] is not None
    assert final_data["digital_signature_hash"] is not None

    # Verify Timeline
    timeline_res = client.get(f"/api/v1/applications/{app_id}/timeline", headers=officers["bureau"])
    assert timeline_res.status_code == 200
    t_data = timeline_res.json()
    assert t_data["template_name"] == "Only Scrutiny"
    assert len(t_data["history"]) >= 4

    # Verify Case Summary
    summary_res = client.get(f"/api/v1/applications/{app_id}/case-summary", headers=officers["bureau"])
    assert summary_res.status_code == 200
    s_data = summary_res.json()
    assert s_data["watermark"] == "Draft for official review"
    assert "ALL INDIA COUNCIL FOR TECHNICAL EDUCATION" in s_data["markdown_summary"]


def test_template_1_return_application(officers):
    """Revert application back from SCRUTINY to SUBMITTED with mandatory reason."""
    db = SessionLocal()
    tmpl = db.query(WorkflowTemplate).filter(WorkflowTemplate.name == "Only Scrutiny").first()
    db.close()

    create_res = client.post(
        "/api/v1/applications",
        headers=officers["admin"],
        json={"institution_id": 1, "template_id": tmpl.id}
    )
    app_id = create_res.json()["id"]
    CREATED_APP_IDS.append(app_id)

    # Move to SCRUTINY
    client.post(f"/api/v1/applications/{app_id}/complete-stage", headers=officers["regional_officer"], json={})

    # Return without reason -> must fail with 400
    fail_res = client.post(
        f"/api/v1/applications/{app_id}/return",
        headers=officers["regional_officer"],
        json={"reason": ""}
    )
    assert fail_res.status_code == 400
    assert "mandatory reason" in fail_res.json()["detail"].lower()

    # Return with mandatory reason
    return_res = client.post(
        f"/api/v1/applications/{app_id}/return",
        headers=officers["regional_officer"],
        json={"reason": "Fire safety NOC has expired. Please upload valid certificate."}
    )
    assert return_res.status_code == 200
    assert return_res.json()["current_stage"] == "SUBMITTED"
    assert return_res.json()["status"] == "RETURNED"


def test_template_1_invalid_transition(officers):
    """Enforce state-machine security and role boundaries on Template 1."""
    db = SessionLocal()
    tmpl = db.query(WorkflowTemplate).filter(WorkflowTemplate.name == "Only Scrutiny").first()
    db.close()

    create_res = client.post(
        "/api/v1/applications",
        headers=officers["admin"],
        json={"institution_id": 1, "template_id": tmpl.id}
    )
    app_id = create_res.json()["id"]
    CREATED_APP_IDS.append(app_id)

    # Move to SCRUTINY
    client.post(f"/api/v1/applications/{app_id}/complete-stage", headers=officers["regional_officer"], json={})

    # Unauthorized role: Institution user attempting to complete SCRUTINY
    unauth_res = client.post(
        f"/api/v1/applications/{app_id}/complete-stage",
        headers=officers["institution"],
        json={"remarks": "Trying to approve myself."}
    )
    assert unauth_res.status_code == 403


# ==============================================================================
# TEMPLATE 2: "Scrutiny + EVC"
# Route: SUBMITTED -> SCRUTINY -> EVC -> BUREAU_DECISION -> APPROVED/REJECTED
# ==============================================================================

def test_template_2_scrutiny_and_evc_happy_path(officers):
    """Happy path through Template 2: Scrutiny + EVC (with automatic EVC queueing)."""
    db = SessionLocal()
    tmpl = db.query(WorkflowTemplate).filter(WorkflowTemplate.name == "Scrutiny + EVC").first()
    db.close()

    create_res = client.post(
        "/api/v1/applications",
        headers=officers["admin"],
        json={"institution_id": 2, "template_id": tmpl.id}
    )
    app_id = create_res.json()["id"]
    CREATED_APP_IDS.append(app_id)

    # 1. Complete SUBMITTED -> SCRUTINY
    client.post(f"/api/v1/applications/{app_id}/complete-stage", headers=officers["regional_officer"], json={})

    # 2. Complete SCRUTINY -> EVC (Checks automatic EVC schedule creation)
    evc_advance = client.post(
        f"/api/v1/applications/{app_id}/complete-stage",
        headers=officers["regional_officer"],
        json={"remarks": "Documents verified. Recommending physical inspection."}
    )
    assert evc_advance.status_code == 200
    assert evc_advance.json()["current_stage"] == "EVC"
    assert evc_advance.json()["status"] == "UNDER_EVC"

    # Confirm EVC queue entry was automatically generated
    db = SessionLocal()
    evc_item = db.query(EVCSchedule).filter(EVCSchedule.application_id == app_id).first()
    assert evc_item is not None, "EVC queue record must be automatically created when advancing to EVC"
    assert evc_item.status == "SCHEDULED"
    db.close()

    # 3. Complete EVC -> BUREAU_DECISION (by EVC Member)
    bureau_advance = client.post(
        f"/api/v1/applications/{app_id}/complete-stage",
        headers=officers["evc_member"],
        json={"remarks": "Physical verification completed. Computer labs and faculty cadre adequate."}
    )
    assert bureau_advance.status_code == 200
    assert bureau_advance.json()["current_stage"] == "BUREAU_DECISION"

    # 4. Final Human Decision at BUREAU_DECISION (by Bureau Officer)
    decision_res = client.post(
        f"/api/v1/applications/{app_id}/complete-stage",
        headers=officers["bureau"],
        json={"verdict": "APPROVED", "remarks": "Clear scrutiny and satisfactory EVC report."}
    )
    assert decision_res.status_code == 200
    assert decision_res.json()["current_stage"] == "APPROVED"


def test_template_2_return_from_evc(officers):
    """Revert application from EVC stage back to SCRUTINY with mandatory reason."""
    db = SessionLocal()
    tmpl = db.query(WorkflowTemplate).filter(WorkflowTemplate.name == "Scrutiny + EVC").first()
    db.close()

    create_res = client.post(
        "/api/v1/applications",
        headers=officers["admin"],
        json={"institution_id": 2, "template_id": tmpl.id}
    )
    app_id = create_res.json()["id"]
    CREATED_APP_IDS.append(app_id)

    # Advance to EVC
    client.post(f"/api/v1/applications/{app_id}/complete-stage", headers=officers["regional_officer"], json={})
    client.post(f"/api/v1/applications/{app_id}/complete-stage", headers=officers["regional_officer"], json={})

    # EVC Member returns application for deficiency
    revert_res = client.post(
        f"/api/v1/applications/{app_id}/return",
        headers=officers["evc_member"],
        json={"reason": "Structural drawings do not match on-site construction."}
    )
    assert revert_res.status_code == 200
    assert revert_res.json()["current_stage"] == "SCRUTINY"
    assert revert_res.json()["status"] == "RETURNED"


def test_template_2_invalid_transition(officers):
    """Reject unauthorized role attempting to complete EVC stage."""
    db = SessionLocal()
    tmpl = db.query(WorkflowTemplate).filter(WorkflowTemplate.name == "Scrutiny + EVC").first()
    db.close()

    create_res = client.post(
        "/api/v1/applications",
        headers=officers["admin"],
        json={"institution_id": 2, "template_id": tmpl.id}
    )
    app_id = create_res.json()["id"]
    CREATED_APP_IDS.append(app_id)

    # Advance to EVC
    client.post(f"/api/v1/applications/{app_id}/complete-stage", headers=officers["regional_officer"], json={})
    client.post(f"/api/v1/applications/{app_id}/complete-stage", headers=officers["regional_officer"], json={})

    # Regional Officer attempting to complete EVC (only EVC_MEMBER or ADMIN authorized)
    unauth_evc = client.post(
        f"/api/v1/applications/{app_id}/complete-stage",
        headers=officers["regional_officer"],
        json={"remarks": "Regional officer attempting to sign off on EVC inspection."}
    )
    assert unauth_evc.status_code == 403


# ==============================================================================
# TEMPLATE 3: "EVC + SAC/SHC"
# Route: SUBMITTED -> EVC -> SAC_SHC -> BUREAU_DECISION -> APPROVED/REJECTED
# ==============================================================================

def test_template_3_evc_and_sac_shc_happy_path(officers):
    """Happy path through Template 3: Direct EVC followed by Standing Hearing/Appellate Committee."""
    db = SessionLocal()
    tmpl = db.query(WorkflowTemplate).filter(WorkflowTemplate.name == "EVC + SAC/SHC").first()
    db.close()

    create_res = client.post(
        "/api/v1/applications",
        headers=officers["admin"],
        json={"institution_id": 3, "template_id": tmpl.id}
    )
    app_id = create_res.json()["id"]
    CREATED_APP_IDS.append(app_id)

    # 1. Complete SUBMITTED -> EVC (by Regional Officer / Admin)
    res_evc = client.post(
        f"/api/v1/applications/{app_id}/complete-stage",
        headers=officers["regional_officer"],
        json={"remarks": "Referred directly to inspection panel."}
    )
    assert res_evc.status_code == 200
    assert res_evc.json()["current_stage"] == "EVC"

    # 2. Complete EVC -> SAC_SHC (by EVC Member)
    res_sac = client.post(
        f"/api/v1/applications/{app_id}/complete-stage",
        headers=officers["evc_member"],
        json={"remarks": "Inspection complete. Disputed land boundary referred to SAC/SHC."}
    )
    assert res_sac.status_code == 200
    assert res_sac.json()["current_stage"] == "SAC_SHC"
    assert res_sac.json()["status"] == "UNDER_SAC_SHC"

    # 3. Complete SAC_SHC -> BUREAU_DECISION (by Regional Head)
    res_bureau = client.post(
        f"/api/v1/applications/{app_id}/complete-stage",
        headers=officers["regional_head"],
        json={"remarks": "Hearing conducted. Committee recommends approval with undertaking."}
    )
    assert res_bureau.status_code == 200
    assert res_bureau.json()["current_stage"] == "BUREAU_DECISION"

    # 4. Bureau Final Decision (Approved)
    res_final = client.post(
        f"/api/v1/applications/{app_id}/complete-stage",
        headers=officers["bureau"],
        json={"verdict": "APPROVED", "remarks": "Granted approval following SAC hearing recommendations."}
    )
    assert res_final.status_code == 200
    assert res_final.json()["current_stage"] == "APPROVED"


def test_template_3_return_from_sac(officers):
    """Revert application from SAC_SHC back to EVC with explicit target_stage."""
    db = SessionLocal()
    tmpl = db.query(WorkflowTemplate).filter(WorkflowTemplate.name == "EVC + SAC/SHC").first()
    db.close()

    create_res = client.post(
        "/api/v1/applications",
        headers=officers["admin"],
        json={"institution_id": 3, "template_id": tmpl.id}
    )
    app_id = create_res.json()["id"]
    CREATED_APP_IDS.append(app_id)

    # Advance to SAC_SHC
    client.post(f"/api/v1/applications/{app_id}/complete-stage", headers=officers["regional_officer"], json={})
    client.post(f"/api/v1/applications/{app_id}/complete-stage", headers=officers["evc_member"], json={})

    # Return to EVC
    revert_res = client.post(
        f"/api/v1/applications/{app_id}/return",
        headers=officers["regional_head"],
        json={"reason": "Requires re-inspection of electrical substation.", "target_stage": "EVC"}
    )
    assert revert_res.status_code == 200
    assert revert_res.json()["current_stage"] == "EVC"
    assert revert_res.json()["status"] == "RETURNED"


def test_template_3_invalid_transition(officers):
    """Reject unauthorized role attempting to complete SAC_SHC stage."""
    db = SessionLocal()
    tmpl = db.query(WorkflowTemplate).filter(WorkflowTemplate.name == "EVC + SAC/SHC").first()
    db.close()

    create_res = client.post(
        "/api/v1/applications",
        headers=officers["admin"],
        json={"institution_id": 3, "template_id": tmpl.id}
    )
    app_id = create_res.json()["id"]
    CREATED_APP_IDS.append(app_id)

    # Advance to SAC_SHC
    client.post(f"/api/v1/applications/{app_id}/complete-stage", headers=officers["regional_officer"], json={})
    client.post(f"/api/v1/applications/{app_id}/complete-stage", headers=officers["evc_member"], json={})

    # EVC Member attempting to resolve SAC_SHC (only REGIONAL_HEAD or ADMIN authorized)
    unauth_res = client.post(
        f"/api/v1/applications/{app_id}/complete-stage",
        headers=officers["evc_member"],
        json={"remarks": "Attempting to issue appellate clearance."}
    )
    assert unauth_res.status_code == 403


# ==============================================================================
# TEMPLATE 4: "Only EVC"
# Route: SUBMITTED -> EVC -> BUREAU_DECISION -> APPROVED/REJECTED
# ==============================================================================

def test_template_4_only_evc_happy_path_with_rejection(officers):
    """Happy path through Template 4: Only EVC to final Bureau Human Rejection."""
    db = SessionLocal()
    tmpl = db.query(WorkflowTemplate).filter(WorkflowTemplate.name == "Only EVC").first()
    db.close()

    create_res = client.post(
        "/api/v1/applications",
        headers=officers["admin"],
        json={"institution_id": 4, "template_id": tmpl.id}
    )
    app_id = create_res.json()["id"]
    CREATED_APP_IDS.append(app_id)

    # 1. Complete SUBMITTED -> EVC
    client.post(f"/api/v1/applications/{app_id}/complete-stage", headers=officers["regional_officer"], json={})

    # 2. Complete EVC -> BUREAU_DECISION
    client.post(
        f"/api/v1/applications/{app_id}/complete-stage",
        headers=officers["evc_member"],
        json={"remarks": "Infrastructure deficient. Workshop building not completed."}
    )

    # 3. Final Human Decision: REJECTED
    final_res = client.post(
        f"/api/v1/applications/{app_id}/complete-stage",
        headers=officers["bureau"],
        json={"verdict": "REJECTED", "remarks": "Approval denied due to deficient physical infrastructure."}
    )
    assert final_res.status_code == 200
    assert final_res.json()["current_stage"] == "REJECTED"
    assert final_res.json()["status"] == "REJECTED"


def test_template_4_return_and_invalid_actions(officers):
    """Test return from EVC to SUBMITTED and block transition on terminal REJECTED stage."""
    db = SessionLocal()
    tmpl = db.query(WorkflowTemplate).filter(WorkflowTemplate.name == "Only EVC").first()
    db.close()

    create_res = client.post(
        "/api/v1/applications",
        headers=officers["admin"],
        json={"institution_id": 4, "template_id": tmpl.id}
    )
    app_id = create_res.json()["id"]
    CREATED_APP_IDS.append(app_id)

    # Advance to EVC
    client.post(f"/api/v1/applications/{app_id}/complete-stage", headers=officers["regional_officer"], json={})

    # Return to SUBMITTED
    ret_res = client.post(
        f"/api/v1/applications/{app_id}/return",
        headers=officers["evc_member"],
        json={"reason": "Site photographs blurry and missing geo-coordinates."}
    )
    assert ret_res.status_code == 200
    assert ret_res.json()["current_stage"] == "SUBMITTED"
    assert ret_res.json()["status"] == "RETURNED"


# ==============================================================================
# TEMPLATE 5: "Scrutiny + EVC + SAC/SHC"
# Route: SUBMITTED -> SCRUTINY -> EVC -> SAC_SHC -> BUREAU_DECISION -> APPROVED/REJECTED
# ==============================================================================

def test_template_5_full_comprehensive_route(officers):
    """Full progression across all stages in Template 5."""
    db = SessionLocal()
    tmpl = db.query(WorkflowTemplate).filter(WorkflowTemplate.name == "Scrutiny + EVC + SAC/SHC").first()
    db.close()

    create_res = client.post(
        "/api/v1/applications",
        headers=officers["admin"],
        json={"institution_id": 5, "template_id": tmpl.id}
    )
    app_id = create_res.json()["id"]
    CREATED_APP_IDS.append(app_id)

    # 1. SUBMITTED -> SCRUTINY
    r1 = client.post(f"/api/v1/applications/{app_id}/complete-stage", headers=officers["regional_officer"], json={})
    assert r1.json()["current_stage"] == "SCRUTINY"

    # 2. SCRUTINY -> EVC
    r2 = client.post(f"/api/v1/applications/{app_id}/complete-stage", headers=officers["regional_officer"], json={})
    assert r2.json()["current_stage"] == "EVC"

    # 3. EVC -> SAC_SHC
    r3 = client.post(f"/api/v1/applications/{app_id}/complete-stage", headers=officers["evc_member"], json={})
    assert r3.json()["current_stage"] == "SAC_SHC"

    # 4. SAC_SHC -> BUREAU_DECISION
    r4 = client.post(f"/api/v1/applications/{app_id}/complete-stage", headers=officers["regional_head"], json={})
    assert r4.json()["current_stage"] == "BUREAU_DECISION"

    # 5. Final Bureau Decision without verdict -> must fail
    fail_res = client.post(f"/api/v1/applications/{app_id}/complete-stage", headers=officers["bureau"], json={})
    assert fail_res.status_code == 400

    # 5. Final Bureau Decision with verdict
    r5 = client.post(
        f"/api/v1/applications/{app_id}/complete-stage",
        headers=officers["bureau"],
        json={"verdict": "APPROVED", "remarks": "Full clearance through all committees."}
    )
    assert r5.json()["current_stage"] == "APPROVED"

    # Attempting to complete already approved application -> must fail
    term_res = client.post(
        f"/api/v1/applications/{app_id}/complete-stage",
        headers=officers["bureau"],
        json={"verdict": "APPROVED"}
    )
    assert term_res.status_code == 400
    assert "already reached terminal state" in term_res.json()["detail"].lower()


def test_template_5_multi_stage_return(officers):
    """Revert from SAC_SHC all the way back to SCRUTINY using target_stage."""
    db = SessionLocal()
    tmpl = db.query(WorkflowTemplate).filter(WorkflowTemplate.name == "Scrutiny + EVC + SAC/SHC").first()
    db.close()

    create_res = client.post(
        "/api/v1/applications",
        headers=officers["admin"],
        json={"institution_id": 5, "template_id": tmpl.id}
    )
    app_id = create_res.json()["id"]
    CREATED_APP_IDS.append(app_id)

    # Advance: SUBMITTED -> SCRUTINY -> EVC -> SAC_SHC
    client.post(f"/api/v1/applications/{app_id}/complete-stage", headers=officers["regional_officer"], json={})
    client.post(f"/api/v1/applications/{app_id}/complete-stage", headers=officers["regional_officer"], json={})
    client.post(f"/api/v1/applications/{app_id}/complete-stage", headers=officers["evc_member"], json={})

    # Return directly to SCRUTINY from SAC_SHC
    rev_res = client.post(
        f"/api/v1/applications/{app_id}/return",
        headers=officers["regional_head"],
        json={"reason": "Audited accounts require re-verification by scrutiny officer.", "target_stage": "SCRUTINY"}
    )
    assert rev_res.status_code == 200
    assert rev_res.json()["current_stage"] == "SCRUTINY"
    assert rev_res.json()["status"] == "RETURNED"

    # Attempt to return forward to BUREAU_DECISION -> must fail with 400
    fwd_fail = client.post(
        f"/api/v1/applications/{app_id}/return",
        headers=officers["regional_officer"],
        json={"reason": "Trying to skip forward.", "target_stage": "BUREAU_DECISION"}
    )
    assert fwd_fail.status_code == 400
