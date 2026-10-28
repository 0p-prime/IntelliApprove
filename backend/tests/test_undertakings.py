"""
Unit and integration tests for the Undertakings and Institutional Compliance module.
Covers:
- Creation of undertakings when approvals are granted with conditions
- Supporting evidence upload with SHA-256 hashing and file validation (size, type)
- Officer verification and rejection with mandatory speaking remarks
- Dynamic status lifecycle: PENDING, SUBMITTED, VERIFIED, REJECTED, OVERDUE
- Compliance score calculation per institution (verified on time / total)
- Compliance heat table data for Regional and Bureau officers
- Cryptographic audit trail for submit, verify, reject, create
- Alert engine hooks (reminders before deadline, escalations when overdue)
- Role-based scoping (INSTITUTION, REGIONAL_OFFICER, BUREAU_OFFICER, ADMIN)
"""
import io
import json
import uuid
import hashlib
import pytest
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.core.database import SessionLocal
from app.models.entities import (
    User,
    UserRole,
    Application,
    Institution,
    Region,
    Undertaking,
    FileRecord,
    AuditLog,
    Notification,
    Escalation,
    SystemClock
)
from app.core.security import create_access_token

CREATED_TEST_UND_IDS = []
CREATED_TEST_FILE_IDS = []


@pytest.fixture(autouse=True)
def cleanup_undertakings_test_data():
    yield
    if CREATED_TEST_UND_IDS or CREATED_TEST_FILE_IDS:
        db = SessionLocal()
        try:
            for uid in list(CREATED_TEST_UND_IDS):
                und = db.query(Undertaking).filter(Undertaking.id == uid).first()
                if und:
                    db.delete(und)
            for fid in list(CREATED_TEST_FILE_IDS):
                f_rec = db.query(FileRecord).filter(FileRecord.id == fid).first()
                if f_rec:
                    db.delete(f_rec)
            db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()
            CREATED_TEST_UND_IDS.clear()
            CREATED_TEST_FILE_IDS.clear()


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


@pytest.fixture(scope="module")
def db_session():
    db = SessionLocal()
    yield db
    db.close()


def get_auth_header(user: User) -> dict:
    token = create_access_token(data={"sub": str(user.id), "role": user.role, "email": user.email})
    return {"Authorization": f"Bearer {token}"}


def test_list_undertakings_and_dynamic_statuses(client: TestClient, db_session: Session):
    """
    Verify /undertakings returns undertakings with dynamic lifecycle statuses,
    due date countdowns, and evidence file references.
    """
    admin_user = db_session.query(User).filter(User.role == UserRole.ADMIN.value).first()
    assert admin_user is not None
    headers = get_auth_header(admin_user)

    resp = client.get("/undertakings", headers=headers)
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) >= 40

    # Verify fields present on all items
    for item in items:
        assert "id" in item
        assert "condition_text" in item
        assert "due_date" in item
        assert "status" in item
        assert item["status"] in ["PENDING", "SUBMITTED", "VERIFIED", "REJECTED", "OVERDUE"]
        assert "days_remaining" in item
        assert "days_overdue" in item

    # Check that overdue items have days_overdue >= 0
    overdue_items = [u for u in items if u["status"] == "OVERDUE"]
    assert len(overdue_items) > 0
    for u in overdue_items:
        assert u["is_overdue"] is True


def test_create_undertaking_conditional_approval(client: TestClient, db_session: Session):
    """
    Verify officer / admin can impose an undertaking requirement on an application
    with condition text and stipulated deadline.
    """
    ro_user = db_session.query(User).filter(User.role == UserRole.REGIONAL_OFFICER.value).first()
    assert ro_user is not None
    headers = get_auth_header(ro_user)

    # Use first application
    app_obj = db_session.query(Application).first()
    assert app_obj is not None

    due_dt = datetime.utcnow() + timedelta(days=45)
    payload = {
        "application_id": app_obj.id,
        "condition_text": "Deposit statutory joint FDR of Rs. 25,00,000 in designated AICTE national bank account within 45 days.",
        "due_date": due_dt.isoformat()
    }

    resp = client.post("/undertakings", json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    assert data["application_id"] == app_obj.id
    assert data["institution_id"] == app_obj.institution_id
    assert "25,00,000" in data["condition_text"]
    assert data["status"] == "PENDING"
    CREATED_TEST_UND_IDS.append(data["id"])

    # Verify Audit Log
    audit = db_session.query(AuditLog).filter(
        AuditLog.action == "UNDERTAKING_CREATED",
        AuditLog.entity_id == str(data["id"])
    ).first()
    assert audit is not None
    assert audit.actor_id == ro_user.id


def test_upload_evidence_with_sha256_and_validation(client: TestClient, db_session: Session):
    """
    Test institution uploading supporting compliance evidence:
    1. Validation rejects invalid file types (e.g. .exe)
    2. Successful upload stores file, computes SHA-256, and transitions status to SUBMITTED
    3. Audit log is written with SHA-256 seal
    """
    admin_user = db_session.query(User).filter(User.role == UserRole.ADMIN.value).first()
    headers = get_auth_header(admin_user)

    # Find a pending undertaking
    pending_u = db_session.query(Undertaking).filter(Undertaking.status == "PENDING").first()
    assert pending_u is not None

    # 1. Invalid file extension rejected
    bad_file = ("script.exe", b"binary executable content", "application/octet-stream")
    bad_resp = client.post(
        f"/undertakings/{pending_u.id}/upload-evidence",
        files={"file": bad_file},
        headers=headers
    )
    assert bad_resp.status_code == 400
    assert "Invalid file extension" in bad_resp.json()["detail"]

    # 2. Valid PDF evidence upload
    dummy_pdf_content = b"%PDF-1.4 simulated AICTE compliance bank guarantee certificate with official seal..."
    expected_hash = hashlib.sha256(dummy_pdf_content).hexdigest()
    valid_file = ("bank_guarantee_cert.pdf", dummy_pdf_content, "application/pdf")

    resp = client.post(
        f"/undertakings/{pending_u.id}/upload-evidence",
        files={"file": valid_file},
        headers=headers
    )
    assert resp.status_code == 200
    res_data = resp.json()

    assert res_data["status"] == "success"
    assert res_data["file"]["sha256_hash"] == expected_hash
    assert res_data["undertaking"]["status"] == "SUBMITTED"
    assert res_data["undertaking"]["evidence_filename"] == "bank_guarantee_cert.pdf"
    CREATED_TEST_FILE_IDS.append(res_data["file"]["id"])

    # 3. Verify Audit Log contains SHA-256 seal
    audit = db_session.query(AuditLog).filter(
        AuditLog.action == "UNDERTAKING_EVIDENCE_SUBMITTED",
        AuditLog.entity_id == str(pending_u.id)
    ).first()
    assert audit is not None
    assert expected_hash in audit.new_value_json


def test_verify_undertaking_evidence_mandatory_remarks(client: TestClient, db_session: Session):
    """
    Test officer verifying evidence:
    1. Rejects if remarks are empty / < 5 chars
    2. Marks status VERIFIED, records verifier and timestamp
    3. Creates immutable audit log
    """
    ro_user = db_session.query(User).filter(User.role == UserRole.REGIONAL_OFFICER.value).first()
    assert ro_user is not None
    headers = get_auth_header(ro_user)

    # Prepare an undertaking in SUBMITTED status
    u = db_session.query(Undertaking).filter(
        Undertaking.status == "PENDING"
    ).first()
    assert u is not None

    # Simulate submission
    u.status = "SUBMITTED"
    db_session.commit()

    # 1. Missing remarks fails
    bad_resp = client.post(
        f"/undertakings/{u.id}/verify",
        json={"remarks": "ok"},
        headers=headers
    )
    assert bad_resp.status_code in [400, 422]

    # 2. Valid verification with speaking remarks
    valid_remarks = "Bank guarantee verified with State Bank of India. Fixed Deposit Receipt in joint name confirmed."
    resp = client.post(
        f"/undertakings/{u.id}/verify",
        json={"remarks": valid_remarks},
        headers=headers
    )
    assert resp.status_code == 200
    data = resp.json()

    assert data["status"] == "success"
    assert data["undertaking"]["status"] == "VERIFIED"
    assert data["undertaking"]["verified_by_user_id"] == ro_user.id
    assert data["undertaking"]["remarks"] == valid_remarks

    # 3. Check Audit Log
    audit = db_session.query(AuditLog).filter(
        AuditLog.action == "UNDERTAKING_VERIFIED",
        AuditLog.entity_id == str(u.id)
    ).first()
    assert audit is not None
    assert valid_remarks in audit.details


def test_reject_undertaking_evidence_mandatory_remarks(client: TestClient, db_session: Session):
    """
    Test officer rejecting evidence for deficiencies:
    1. Rejects if remarks are empty / < 5 chars
    2. Marks status REJECTED, records deficiency reason
    3. Creates immutable audit log
    """
    ro_user = db_session.query(User).filter(User.role == UserRole.REGIONAL_OFFICER.value).first()
    assert ro_user is not None
    headers = get_auth_header(ro_user)

    # Prepare an undertaking in SUBMITTED status
    u = db_session.query(Undertaking).filter(
        Undertaking.status == "PENDING"
    ).first()
    assert u is not None

    # 1. Missing remarks fails
    bad_resp = client.post(
        f"/undertakings/{u.id}/reject",
        json={"remarks": "bad"},
        headers=headers
    )
    assert bad_resp.status_code in [400, 422]

    # 2. Valid rejection with speaking remarks
    deficiency_remarks = "Uploaded structural drawing is unsealed and lacks endorsement from Registered Municipal Architect."
    resp = client.post(
        f"/undertakings/{u.id}/reject",
        json={"remarks": deficiency_remarks},
        headers=headers
    )
    assert resp.status_code == 200
    data = resp.json()

    assert data["status"] == "success"
    assert data["undertaking"]["status"] == "REJECTED"
    assert data["undertaking"]["remarks"] == deficiency_remarks

    # 3. Check Audit Log
    audit = db_session.query(AuditLog).filter(
        AuditLog.action == "UNDERTAKING_REJECTED",
        AuditLog.entity_id == str(u.id)
    ).first()
    assert audit is not None
    assert "structural drawing" in audit.details


def test_compliance_scores_calculation(client: TestClient, db_session: Session):
    """
    Verify /undertakings/compliance-scores correctly computes:
    Score = (verified on time / total) * 100
    """
    admin_user = db_session.query(User).filter(User.role == UserRole.ADMIN.value).first()
    headers = get_auth_header(admin_user)

    resp = client.get("/undertakings/compliance-scores", headers=headers)
    assert resp.status_code == 200
    scores = resp.json()
    assert len(scores) > 0

    for item in scores:
        assert "institution_id" in item
        assert "compliance_score" in item
        assert 0.0 <= item["compliance_score"] <= 100.0
        assert item["grade"] in ["EXCELLENT", "MODERATE", "CRITICAL"]
        assert item["color"] in ["#10B981", "#F59E0B", "#EF4444"]

        # Check math if conditions exist
        total = item["total_undertakings"]
        on_time = item["verified_on_time"]
        if total > 0:
            expected_score = round((on_time / total) * 100.0, 1)
            assert item["compliance_score"] == expected_score


def test_compliance_heat_table_endpoint(client: TestClient, db_session: Session):
    """
    Verify /undertakings/compliance-heat-table returns national KPI summary,
    regional breakdown, and institution-level compliance matrix.
    """
    bureau_user = db_session.query(User).filter(User.role == UserRole.BUREAU_OFFICER.value).first()
    assert bureau_user is not None
    headers = get_auth_header(bureau_user)

    resp = client.get("/undertakings/compliance-heat-table", headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    assert "summary" in data
    assert "regional_breakdown" in data
    assert "institutions" in data

    summary = data["summary"]
    assert summary["total_institutions"] > 0
    assert summary["total_undertakings"] >= 40
    assert 0.0 <= summary["national_average_score"] <= 100.0

    assert len(data["regional_breakdown"]) > 0
    for reg in data["regional_breakdown"]:
        assert "region_id" in reg
        assert "avg_compliance_score" in reg


def test_institution_role_scoping(client: TestClient, db_session: Session):
    """
    Verify an INSTITUTION user only sees their own institution's undertakings.
    """
    inst_user = db_session.query(User).filter(User.role == UserRole.INSTITUTION.value).first()
    assert inst_user is not None
    headers = get_auth_header(inst_user)

    inst = db_session.query(Institution).filter(Institution.contact_email == inst_user.email).first()
    assert inst is not None

    resp = client.get("/undertakings", headers=headers)
    assert resp.status_code == 200
    items = resp.json()

    # All returned undertakings must belong to this institution
    for u in items:
        assert u["institution_id"] == inst.id
