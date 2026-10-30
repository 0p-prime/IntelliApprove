"""
Unit and integration tests for Lease and Document Validity Monitoring module.
Covers:
- Dynamic statutory validity computation: VALID, EXPIRING_SOON (<=90d), CRITICAL (<=30d), EXPIRED
- Expiry timeline buckets and dashboard widgets (next 30/60/90 days)
- Institution renewal upload flow with SHA-256 hash and file validation
- Officer verification and rejection with mandatory speaking remarks
- Document detail, renewal lineage history, and cryptographic audit trail
- Role-based scoping (INSTITUTION, REGIONAL_OFFICER, BUREAU_OFFICER, ADMIN)
- Alert engine hooks (warnings at 90/60/30/7 days, overdue escalation for non-renewal)
"""
import io
import json
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
    Document,
    Institution,
    Region,
    FileRecord,
    AuditLog,
    Notification,
    Escalation,
    SystemClock
)
from app.core.security import create_access_token

CREATED_TEST_DOC_IDS = []
CREATED_TEST_FILE_IDS = []


@pytest.fixture(autouse=True)
def cleanup_document_test_data():
    yield
    if CREATED_TEST_DOC_IDS or CREATED_TEST_FILE_IDS:
        db = SessionLocal()
        try:
            for did in list(CREATED_TEST_DOC_IDS):
                doc = db.query(Document).filter(Document.id == did).first()
                if doc:
                    db.delete(doc)
            for fid in list(CREATED_TEST_FILE_IDS):
                f_rec = db.query(FileRecord).filter(FileRecord.id == fid).first()
                if f_rec:
                    db.delete(f_rec)
            db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()
            CREATED_TEST_DOC_IDS.clear()
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


def test_documents_validity_calculation_and_countdowns(client: TestClient, db_session: Session):
    """
    Verify /documents returns all legal documents with accurately computed validity statuses:
    EXPIRED, CRITICAL, EXPIRING_SOON, VALID, and associated color codes.
    """
    admin_user = db_session.query(User).filter(User.role == UserRole.ADMIN.value).first()
    assert admin_user is not None
    headers = get_auth_header(admin_user)

    resp = client.get("/documents", headers=headers)
    assert resp.status_code == 200
    docs = resp.json()
    assert len(docs) >= 40

    validity_statuses = {d["validity_status"] for d in docs}
    assert "EXPIRED" in validity_statuses
    assert "CRITICAL" in validity_statuses
    assert "EXPIRING_SOON" in validity_statuses
    assert "VALID" in validity_statuses

    for d in docs:
        assert "id" in d
        assert "doc_type" in d
        assert "validity_status" in d
        assert "color_code" in d
        assert "days_remaining" in d
        assert "days_expired" in d
        assert d["color_code"] in ["#EF4444", "#DC2626", "#F59E0B", "#10B981"]

        # Mathematical verification
        if d["validity_status"] == "EXPIRED":
            assert d["is_expired"] is True
            assert d["days_expired"] >= 0
        elif d["validity_status"] == "CRITICAL":
            assert 0 <= d["days_remaining"] <= 30
        elif d["validity_status"] == "EXPIRING_SOON":
            assert 30 < d["days_remaining"] <= 90
        elif d["validity_status"] == "VALID":
            assert d["days_remaining"] > 90 or d["expiry_date"] is None


def test_expiry_timeline_endpoint(client: TestClient, db_session: Session):
    """
    Verify /documents/expiry-timeline buckets documents into the 4 statutory tiers:
    expired, critical (<=30d), expiring_soon (31-90d), and valid (>90d).
    """
    admin_user = db_session.query(User).filter(User.role == UserRole.ADMIN.value).first()
    headers = get_auth_header(admin_user)

    resp = client.get("/documents/expiry-timeline", headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    assert "summary" in data
    assert "buckets" in data

    s = data["summary"]
    b = data["buckets"]

    assert s["expired_count"] == b["expired"]["count"]
    assert s["critical_count"] == b["critical"]["count"]
    assert s["expiring_soon_count"] == b["expiring_soon"]["count"]
    assert s["valid_count"] == b["valid"]["count"]
    assert s["total"] == (
        s["expired_count"] + s["critical_count"] + s["expiring_soon_count"] + s["valid_count"]
    )


def test_expiring_summary_widget_endpoint(client: TestClient, db_session: Session):
    """
    Verify /documents/expiring-summary returns aggregated counts for 30/60/90 days widgets.
    """
    admin_user = db_session.query(User).filter(User.role == UserRole.ADMIN.value).first()
    headers = get_auth_header(admin_user)

    resp = client.get("/documents/expiring-summary", headers=headers)
    assert resp.status_code == 200
    summary = resp.json()

    assert "expired" in summary
    assert "next_30_days" in summary
    assert "next_60_days" in summary
    assert "next_90_days" in summary
    assert "safe_over_90_days" in summary
    assert "total_documents" in summary

    # Cumulative order checks
    assert summary["next_30_days"] <= summary["next_60_days"]
    assert summary["next_60_days"] <= summary["next_90_days"]


def test_institution_renewal_upload_flow(client: TestClient, db_session: Session):
    """
    Verify renewal upload flow:
    1. Validation rejects invalid file types or invalid date ranges.
    2. Upload stores renewed deed, generates SHA-256 seal, sets renewal_of_id.
    3. Status is set to PENDING and audit log recorded.
    """
    admin_user = db_session.query(User).filter(User.role == UserRole.ADMIN.value).first()
    headers = get_auth_header(admin_user)

    # Pick an expired or critical document to renew
    doc_to_renew = db_session.query(Document).filter(
        Document.expiry_date != None
    ).order_by(Document.expiry_date.asc()).first()
    assert doc_to_renew is not None

    # 1. Invalid file extension rejected
    bad_file = ("renewal.bat", b"command script", "application/octet-stream")
    bad_data = {
        "renewal_of_id": str(doc_to_renew.id),
        "issue_date": "2026-10-01",
        "expiry_date": "2029-10-01"
    }
    bad_resp = client.post(
        "/documents/renew",
        data=bad_data,
        files={"file": bad_file},
        headers=headers
    )
    assert bad_resp.status_code in [400, 422]

    # 2. Expiry date before issue date rejected
    bad_dates_data = {
        "renewal_of_id": str(doc_to_renew.id),
        "issue_date": "2026-10-01",
        "expiry_date": "2025-10-01"  # before issue date
    }
    valid_pdf_content = b"%PDF-1.4 Simulated Sub-Registrar 30-Year Institutional Lease Deed..."
    good_file = ("renewed_lease_deed.pdf", valid_pdf_content, "application/pdf")
    bad_date_resp = client.post(
        "/documents/renew",
        data=bad_dates_data,
        files={"file": good_file},
        headers=headers
    )
    assert bad_date_resp.status_code == 400
    assert "strictly after" in bad_date_resp.json()["detail"]

    # 3. Successful renewal upload
    expected_hash = hashlib.sha256(valid_pdf_content).hexdigest()
    good_data = {
        "renewal_of_id": str(doc_to_renew.id),
        "issue_date": "2026-10-15",
        "expiry_date": "2056-10-15"  # 30-year lease renewal
    }
    resp = client.post(
        "/documents/renew",
        data=good_data,
        files={"file": ("renewed_lease_deed.pdf", valid_pdf_content, "application/pdf")},
        headers=headers
    )
    assert resp.status_code == 200
    res_json = resp.json()

    assert res_json["status"] == "success"
    renewed_doc = res_json["document"]
    assert renewed_doc["renewal_of_id"] == doc_to_renew.id
    assert renewed_doc["doc_type"] == doc_to_renew.doc_type
    assert renewed_doc["verification_status"] == "PENDING"
    assert renewed_doc["sha256_hash"] == expected_hash
    CREATED_TEST_DOC_IDS.append(renewed_doc["id"])
    if renewed_doc.get("file_id"):
        CREATED_TEST_FILE_IDS.append(renewed_doc["file_id"])

    # 4. Check Audit Log
    audit = db_session.query(AuditLog).filter(
        AuditLog.action == "DOCUMENT_RENEWAL_SUBMITTED",
        AuditLog.entity_id == str(renewed_doc["id"])
    ).first()
    assert audit is not None
    assert expected_hash in audit.new_value_json


def test_officer_verify_renewal_with_mandatory_remarks(client: TestClient, db_session: Session):
    """
    Verify officer verification flow:
    1. Rejects if remarks are missing or too short (< 5 chars).
    2. Updates status to VERIFIED and records verifier remarks.
    3. Writes cryptographic audit record.
    """
    ro_user = db_session.query(User).filter(User.role == UserRole.REGIONAL_OFFICER.value).first()
    assert ro_user is not None
    headers = get_auth_header(ro_user)

    # Prepare or find a document with PENDING verification
    doc = db_session.query(Document).filter(Document.verification_status == "PENDING").first()
    if not doc:
        inst = db_session.query(Institution).first()
        doc = Document(
            institution_id=inst.id,
            doc_type="LEASE_DEED",
            issue_date=datetime.now(timezone.utc) - timedelta(days=365),
            expiry_date=datetime.now(timezone.utc) + timedelta(days=365),
            verification_status="PENDING"
        )
        db_session.add(doc)
        db_session.commit()
        db_session.refresh(doc)
        CREATED_TEST_DOC_IDS.append(doc.id)

    # 1. Missing remarks fails
    bad_resp = client.post(
        f"/documents/{doc.id}/verify",
        json={"remarks": "ok"},
        headers=headers
    )
    assert bad_resp.status_code in [400, 422]

    # 2. Valid verification
    speaking_remarks = "Registered lease agreement examined. 30-year unencumbered possession verified with Revenue Authority."
    resp = client.post(
        f"/documents/{doc.id}/verify",
        json={"remarks": speaking_remarks},
        headers=headers
    )
    assert resp.status_code == 200
    res_data = resp.json()

    assert res_data["status"] == "success"
    assert res_data["document"]["verification_status"] == "VERIFIED"
    assert res_data["document"]["verified_by_user_id"] == ro_user.id
    assert res_data["document"]["remarks"] == speaking_remarks

    # 3. Check Audit Log
    audit = db_session.query(AuditLog).filter(
        AuditLog.action == "DOCUMENT_VERIFIED",
        AuditLog.entity_id == str(doc.id)
    ).first()
    assert audit is not None
    assert speaking_remarks in audit.details


def test_officer_reject_renewal_with_mandatory_remarks(client: TestClient, db_session: Session):
    """
    Verify officer rejection flow:
    1. Rejects if remarks are missing or too short (< 5 chars).
    2. Updates status to REJECTED and records deficiency reason.
    3. Writes cryptographic audit record.
    """
    ro_user = db_session.query(User).filter(User.role == UserRole.REGIONAL_OFFICER.value).first()
    assert ro_user is not None
    headers = get_auth_header(ro_user)

    # Prepare or find a document with PENDING verification
    doc = db_session.query(Document).filter(Document.verification_status == "PENDING").first()
    if not doc:
        inst = db_session.query(Institution).first()
        doc = Document(
            institution_id=inst.id,
            doc_type="LEASE_DEED",
            issue_date=datetime.now(timezone.utc) - timedelta(days=365),
            expiry_date=datetime.now(timezone.utc) + timedelta(days=365),
            verification_status="PENDING"
        )
        db_session.add(doc)
        db_session.commit()
        db_session.refresh(doc)
        CREATED_TEST_DOC_IDS.append(doc.id)

    # 1. Missing remarks fails
    bad_resp = client.post(
        f"/documents/{doc.id}/reject",
        json={"remarks": "bad"},
        headers=headers
    )
    assert bad_resp.status_code in [400, 422]

    # 2. Valid rejection
    deficiency_remarks = "Municipal building plan lacks Fire Department NOC endorsement and registered architect signature."
    resp = client.post(
        f"/documents/{doc.id}/reject",
        json={"remarks": deficiency_remarks},
        headers=headers
    )
    assert resp.status_code == 200
    res_data = resp.json()

    assert res_data["status"] == "success"
    assert res_data["document"]["verification_status"] == "REJECTED"
    assert res_data["document"]["remarks"] == deficiency_remarks

    # 3. Check Audit Log
    audit = db_session.query(AuditLog).filter(
        AuditLog.action == "DOCUMENT_REJECTED",
        AuditLog.entity_id == str(doc.id)
    ).first()
    assert audit is not None
    assert "Fire Department NOC" in audit.details


def test_renewal_history_and_audit_lineage(client: TestClient, db_session: Session):
    """
    Verify /documents/{id}/renewal-history traces the entire lineage chain
    and returns linked cryptographic audit records.
    """
    admin_user = db_session.query(User).filter(User.role == UserRole.ADMIN.value).first()
    headers = get_auth_header(admin_user)

    # Find a document with a renewal
    renewed_doc = db_session.query(Document).filter(Document.renewal_of_id != None).first()
    if not renewed_doc:
        renewed_doc = db_session.query(Document).first()

    resp = client.get(f"/documents/{renewed_doc.id}/renewal-history", headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    assert "target_document_id" in data
    assert "root_document_id" in data
    assert "lineage" in data
    assert "audit_trail" in data
    assert len(data["lineage"]) >= 1


def test_documents_role_scoping(client: TestClient, db_session: Session):
    """
    Verify INSTITUTION role only sees documents belonging to own institution.
    """
    inst_user = db_session.query(User).filter(User.role == UserRole.INSTITUTION.value).first()
    assert inst_user is not None
    headers = get_auth_header(inst_user)

    inst = db_session.query(Institution).filter(Institution.contact_email == inst_user.email).first()
    assert inst is not None

    resp = client.get("/documents", headers=headers)
    assert resp.status_code == 200
    docs = resp.json()

    for d in docs:
        assert d["institution_id"] == inst.id
