"""
Test Suite for 6 Differentiating Features:
1. DELAY RISK SCORE (Explainable 0-100 score with transparent 5-factor breakdown)
2. NATURAL-LANGUAGE STATUTORY ASSISTANT (Role-scoped, RBAC-enforced, NO raw SQL, watermarked drafts)
3. LEASE OCR ASSIST (Automated expiry date extraction with mandatory human verification)
4. INTEGRATION ADAPTER (Legacy AICTE portal pull/push & HMAC-signed webhooks)
5. SECURITY HARDENING (Rate limiting 5-strike window, refresh token rotation, AES-256 Fernet storage & file validation)
"""
import hmac
import hashlib
import json
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from app.main import app
from app.models.entities import Application, User, AuditLog
from app.services.storage_service import StorageService
from app.services.ocr_service import OCRService
from app.services.risk_service import RiskService
from app.services.integration_service import IntegrationService, AICTE_WEBHOOK_SECRET
from app.api.v1.auth import clear_failed_attempts, FAILED_ATTEMPTS_STORE


@pytest.fixture
def client():
    return TestClient(app)


def get_auth_token(client: TestClient, email: str = "admin@aicte.gov.in", password: str = "aicte123") -> str:
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    if res.status_code != 200:
        res = client.post("/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return res.json()["access_token"]


# ==============================================================================
# FEATURE 1: DELAY RISK SCORE ENGINE
# ==============================================================================

def test_delay_risk_score_calculation(client: TestClient):
    token = get_auth_token(client, "admin@aicte.gov.in")
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch an application ID
    apps_res = client.get("/api/v1/applications?limit=5", headers=headers)
    assert apps_res.status_code == 200
    apps = apps_res.json()
    assert len(apps) > 0
    app_id = apps[0]["id"]

    # Call /applications/{id}/risk-score
    res = client.get(f"/api/v1/applications/{app_id}/risk-score", headers=headers)
    assert res.status_code == 200, res.text
    data = res.json()

    # Validate score schema and bounds
    assert "risk_score" in data
    assert 0.0 <= data["risk_score"] <= 100.0
    assert data["risk_level"] in ["LOW", "MEDIUM", "HIGH"]
    assert "primary_driver" in data
    assert "formula" in data
    assert "0.30" in data["formula"] and "StageSLA" in data["formula"]

    # Validate all 5 transparent contributing factors
    factors = data["factors"]
    assert len(factors) == 5
    factor_names = [f["name"] for f in factors]
    assert "Stage SLA Consumption" in factor_names
    assert "Regional Historical Dwell Benchmark" in factor_names
    assert "Assigned Officer Workload" in factor_names
    assert "Deficiency Return Frequency" in factor_names
    assert "Institutional Complexity (New vs Existing)" in factor_names

    for factor in factors:
        assert 0.0 <= factor["score"] <= 100.0
        assert 0.0 <= factor["weight"] <= 100.0
        assert factor["severity"] in ["LOW", "MEDIUM", "HIGH"]
        assert len(factor["details"]) > 0


def test_high_risk_cases_dashboard_endpoints(client: TestClient):
    token = get_auth_token(client, "admin@aicte.gov.in")
    headers = {"Authorization": f"Bearer {token}"}

    # Test /analytics/high-risk
    res = client.get("/api/v1/analytics/high-risk?threshold=0&limit=10", headers=headers)
    assert res.status_code == 200, res.text
    high_risk_list = res.json()
    assert isinstance(high_risk_list, list)

    if len(high_risk_list) > 1:
        # Check sorted descending by risk_score
        scores = [item["risk_score"] for item in high_risk_list]
        assert scores == sorted(scores, reverse=True)

    # Test /dashboard/high-risk widget
    res_widget = client.get("/api/v1/dashboard/high-risk?limit=5", headers=headers)
    assert res_widget.status_code == 200
    widget_data = res_widget.json()
    assert isinstance(widget_data, list)


# ==============================================================================
# FEATURE 2: NATURAL-LANGUAGE STATUTORY ASSISTANT
# ==============================================================================

def test_assistant_overdue_evc_query(client: TestClient):
    token = get_auth_token(client, "member.secretary@aicte.gov.in")
    headers = {"Authorization": f"Bearer {token}"}

    req_body = {
        "message": "Show overdue EVCs in Western region"
    }
    res = client.post("/api/v1/assistant/chat", json=req_body, headers=headers)
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["intent"] == "QUERY_OVERDUE_EVCS"
    assert "EVC" in data["response_text"]
    assert "data" in data


def test_assistant_expiring_leases_query(client: TestClient):
    token = get_auth_token(client, "ro.w@aicte.gov.in")
    headers = {"Authorization": f"Bearer {token}"}

    req_body = {
        "message": "Which institutions have leases expiring in 30 days?"
    }
    res = client.post("/api/v1/assistant/chat", json=req_body, headers=headers)
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["intent"] == "QUERY_EXPIRING_DOCUMENTS"
    assert "data" in data
    assert "lease" in data["response_text"].lower() or "document" in data["response_text"].lower()


def test_assistant_notice_drafting_with_mandatory_watermark(client: TestClient):
    token = get_auth_token(client, "member.secretary@aicte.gov.in")
    headers = {"Authorization": f"Bearer {token}"}

    req_body = {
        "message": "Draft deficiency notice for lack of registered 30-year lease deed"
    }
    res = client.post("/api/v1/assistant/chat", json=req_body, headers=headers)
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["is_ai_draft"] is True
    # Rule #2: Mandatory watermark
    assert "AI DRAFT" in data["draft_content"]
    assert "HUMAN REVIEW" in data["draft_content"]


# ==============================================================================
# FEATURE 3: LEASE OCR ASSIST
# ==============================================================================

def test_ocr_extract_expiry_date_from_deed_text(client: TestClient):
    token = get_auth_token(client, "principal@ditm.ac.in")
    headers = {"Authorization": f"Bearer {token}"}

    # Mock lease deed document content with explicit tenure clauses
    mock_deed_content = (
        b"GOVERNMENT OF MAHARASHTRA - REGISTRATION AND STAMPS DEPARTMENT\n"
        b"REGISTERED PERPETUAL LEASE DEED\n"
        b"This lease is granted for an initial term of 30 years.\n"
        b"The lease period commences on 01/08/2024 and valid up to 31/07/2054.\n"
        b"The deed shall strictly expire on 31/07/2054.\n"
        b"Signed and sealed by Sub-Registrar Haveli, Pune."
    )

    files = {
        "file": ("lease_deed_2054.txt", mock_deed_content, "text/plain")
    }

    res = client.post("/api/v1/documents/ocr-extract-expiry", files=files, headers=headers)
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["found"] is True
    assert data["extracted_expiry_date"] == "2054-07-31"
    assert data["confidence"] > 0.6
    assert data["requires_human_confirmation"] is True
    assert "human" in data["disclaimer"].lower()


def test_ocr_service_unit_extraction():
    ocr_service = OCRService()
    text_sample = "Lease agreement commencing on 12-05-2020 and expiry date: 12-05-2050 for campus grounds."
    res = ocr_service.extract_from_text(text_sample)

    assert res["found"] is True
    assert res["extracted_expiry_date"] == "2050-05-12"
    assert res["requires_human_confirmation"] is True


# ==============================================================================
# FEATURE 4: INTEGRATION ADAPTER (LEGACY PORTAL & WEBHOOKS)
# ==============================================================================

def test_integration_status_and_sync(client: TestClient):
    token = get_auth_token(client, "admin@aicte.gov.in")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Check adapter telemetry
    status_res = client.get("/api/v1/integration/status", headers=headers)
    assert status_res.status_code == 200
    telemetry = status_res.json()
    assert "National AICTE" in telemetry["portal_name"]
    assert telemetry["status"] == "ONLINE"
    assert telemetry["is_connected"] is True

    # 2. Sync / Pull applications from legacy portal
    sync_res = client.post(
        "/api/v1/integration/aicte-portal/sync-applications",
        json={"academic_year": "2026-2027", "limit": 2},
        headers=headers,
    )
    assert sync_res.status_code == 200, sync_res.text
    sync_data = sync_res.json()
    assert sync_data["count"] >= 1
    assert len(sync_data["applications"]) >= 1


def test_integration_push_status_update(client: TestClient):
    token = get_auth_token(client, "admin@aicte.gov.in")
    headers = {"Authorization": f"Bearer {token}"}

    # Get an application
    apps_res = client.get("/api/v1/applications?limit=1", headers=headers)
    app = apps_res.json()[0]

    push_res = client.post(
        "/api/v1/integration/aicte-portal/push-status",
        json={"application_id": app["id"]},
        headers=headers,
    )
    assert push_res.status_code == 200, push_res.text
    push_data = push_res.json()
    assert push_data["success"] is True
    assert push_data["target_portal"] is not None


def test_integration_incoming_hmac_webhook(client: TestClient):
    # Prepare payload
    payload = {
        "event_type": "AFFILIATION_FEE_PAID",
        "ref_no": "AICTE-2026-WR-101",
        "amount": 250000,
        "details": "Affiliation fee cleared via State Treasury Gateway"
    }
    raw_body = json.dumps(payload, sort_keys=True)

    # Compute valid HMAC-SHA256 signature
    valid_sig = hmac.new(AICTE_WEBHOOK_SECRET.encode("utf-8"), raw_body.encode(), hashlib.sha256).hexdigest()

    # 1. Post with valid signature
    res = client.post(
        "/api/v1/integration/webhooks/aicte-event",
        json=payload,
        headers={
            "X-AICTE-Signature": valid_sig,
        }
    )
    assert res.status_code == 200, res.text
    res_data = res.json()
    assert res_data["status"] == "ACCEPTED"
    assert res_data["event_type"] == "AFFILIATION_FEE_PAID"
    assert res_data["signature_verified"] is True

    # 2. Post with forged / invalid signature -> Must reject 401
    bad_res = client.post(
        "/api/v1/integration/webhooks/aicte-event",
        json=payload,
        headers={
            "X-AICTE-Signature": "forged_sha256_signature_abc123",
        }
    )
    assert bad_res.status_code == 401
    assert "Invalid HMAC signature" in bad_res.json()["detail"]


# ==============================================================================
# FEATURE 6: SECURITY HARDENING
# ==============================================================================

def test_auth_rate_limiting_5_strike_window(client: TestClient):
    # Clear any leftover attempts for our test account
    test_email = "ratelimit.test@aicte.gov.in"
    FAILED_ATTEMPTS_STORE.clear()

    # Perform 5 failed attempts
    for i in range(5):
        res = client.post("/api/v1/auth/login", json={"email": test_email, "password": "WrongPassword!"})
        assert res.status_code == 401, f"Attempt {i+1} should fail with 401"

    # 6th attempt must trigger HTTP 429
    res_blocked = client.post("/api/v1/auth/login", json={"email": test_email, "password": "WrongPassword!"})
    assert res_blocked.status_code == 429, res_blocked.text
    assert "Security lockout" in res_blocked.json()["detail"]

    # Cleanup
    FAILED_ATTEMPTS_STORE.clear()


def test_auth_refresh_token_rotation(client: TestClient):
    # Login and obtain tokens
    login_res = client.post("/api/v1/auth/login", json={"email": "admin@aicte.gov.in", "password": "aicte123"})
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert "refresh_token" in login_data
    refresh_token = login_data["refresh_token"]

    # Call /auth/refresh
    refresh_res = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert refresh_res.status_code == 200, refresh_res.text
    refreshed_data = refresh_res.json()

    assert "access_token" in refreshed_data
    new_access_token = refreshed_data["access_token"]

    # Verify that the new access token is functional
    check_res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {new_access_token}"})
    assert check_res.status_code == 200
    assert check_res.json()["email"] == "admin@aicte.gov.in"


def test_storage_service_validation_and_fernet_encryption():
    from fastapi import HTTPException
    # 1. Validation tests
    # Valid file
    valid_bytes = b"%PDF-1.4 Mock valid AICTE PDF document header"
    StorageService.validate_file("affidavit.pdf", valid_bytes)

    # Oversized file (>10MB)
    with pytest.raises(HTTPException) as exc_info:
        oversized = b"X" * (11 * 1024 * 1024)
        StorageService.validate_file("huge.pdf", oversized)
    assert exc_info.value.status_code == 400

    # Disallowed executable extension
    with pytest.raises(HTTPException) as exc_info:
        StorageService.validate_file("malicious.exe", b"MZ\x90\x00")
    assert exc_info.value.status_code == 400

    # 2. AES-256 Fernet Encryption round-trip
    secret_text = b"Confidential AICTE Inspection Notes: EVC Committee Report 2026"
    encrypted_blob = StorageService.encrypt_file_data(secret_text)
    assert encrypted_blob != secret_text
    assert len(encrypted_blob) > len(secret_text)

    decrypted_text = StorageService.decrypt_file_data(encrypted_blob)
    assert decrypted_text == secret_text
