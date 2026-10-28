"""
Integration and Statutory Verification Tests for:
1. Tamper-Evident SHA-256 Audit Chain Verification
2. Per-Application Full History Multi-Stream Event Consolidation
3. 6 Statutory AICTE Reports (Pendency, EVC, Undertakings, Documents, Escalations, Regional Performance)
4. Audit Trail Generation Invariant (Rule #1: Every report generation and export is logged)
"""
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from app.main import app
from app.models.entities import AuditLog, User, Application, Region
from app.services.audit_service import AuditService, GENESIS_HASH


@pytest.fixture
def client():
    return TestClient(app)


def get_token(client: TestClient, email: str = "admin@aicte.gov.in", password: str = "aicte123") -> str:
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    if res.status_code != 200:
        # Fallback to /auth/login
        res = client.post("/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return res.json()["access_token"]


def test_audit_verify_chain_endpoint(client: TestClient):
    token = get_token(client, "admin@aicte.gov.in")
    res = client.get("/audit/verify-chain", headers={"Authorization": f"Bearer {token}"})
    if res.status_code == 404:
        res = client.get("/api/v1/audit/verify-chain", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["is_valid"] is True
    assert data["total_blocks"] > 0
    assert data["broken_links_count"] == 0
    assert data["genesis_hash"] == GENESIS_HASH
    assert data["status"] == "CHAIN_INTEGRITY_VERIFIED"
    assert "SHA-256" in data["algorithm"]


def test_audit_explorer_filtering(client: TestClient):
    token = get_token(client, "admin@aicte.gov.in")
    
    # 1. Filter by entity_type
    res = client.get("/audit?entity_type=application&limit=10", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    logs = res.json()
    assert isinstance(logs, list)
    for l in logs:
        assert l["entity_type"] == "application"

    # 2. Filter by actor_email
    res = client.get("/audit?actor_email=admin@aicte.gov.in&limit=10", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    for l in res.json():
        assert "admin@aicte.gov.in" in l["user_email"]


def test_application_full_history_endpoint(client: TestClient):
    token = get_token(client, "admin@aicte.gov.in")
    
    # Fetch application 1 full history
    res = client.get("/applications/1/full-history", headers={"Authorization": f"Bearer {token}"})
    if res.status_code == 404:
        res = client.get("/api/v1/applications/1/full-history", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["application_id"] == 1
    assert "ref_no" in data
    assert "total_events" in data
    assert "events" in data
    assert data["total_events"] == len(data["events"])
    assert data["total_events"] > 0

    # Ensure event structure adheres to FullHistoryEvent specification
    first_event = data["events"][0]
    for required_key in ["id", "event_type", "category", "title", "timestamp", "actor_name", "action", "details"]:
        assert required_key in first_event, f"Missing key: {required_key}"


def test_statutory_report_types(client: TestClient):
    token = get_token(client, "admin@aicte.gov.in")
    res = client.get("/reports/types", headers={"Authorization": f"Bearer {token}"})
    if res.status_code == 404:
        res = client.get("/api/v1/reports/types", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200, res.text
    types = res.json()
    assert len(types) == 6

    expected_ids = {
        "application-pendency",
        "evc-status",
        "undertaking-compliance",
        "document-validity",
        "overdue-escalations",
        "region-performance"
    }
    returned_ids = {t["id"] for t in types}
    assert returned_ids == expected_ids


@pytest.mark.parametrize("report_id", [
    "application-pendency",
    "evc-status",
    "undertaking-compliance",
    "document-validity",
    "overdue-escalations",
    "region-performance"
])
def test_all_6_statutory_reports_and_audit_logging(client: TestClient, report_id: str):
    token = get_token(client, "admin@aicte.gov.in")

    # 1. Fetch JSON Report
    res = client.get(f"/reports/{report_id}", headers={"Authorization": f"Bearer {token}"})
    if res.status_code == 404:
        res = client.get(f"/api/v1/reports/{report_id}", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200, f"Report {report_id} failed: {res.text}"
    report = res.json()

    assert report["report_id"] == report_id
    assert "summary_kpis" in report and len(report["summary_kpis"]) > 0
    assert "chart_type" in report
    assert "chart_data" in report
    assert "table_columns" in report and len(report["table_columns"]) > 0
    assert "table_data" in report

    # 2. Verify Rule #1: REPORT_GENERATED logged in audit trail
    audit_res = client.get(f"/audit?action=REPORT_GENERATED&entity_id={report_id}&limit=5", headers={"Authorization": f"Bearer {token}"})
    assert audit_res.status_code == 200
    matching_logs = audit_res.json()
    assert len(matching_logs) > 0, f"No REPORT_GENERATED audit log found for {report_id}"
    assert matching_logs[0]["action"] == "REPORT_GENERATED"
    assert matching_logs[0]["entity_id"] == report_id


def test_statutory_report_csv_export_and_audit_logging(client: TestClient):
    token = get_token(client, "admin@aicte.gov.in")
    report_id = "application-pendency"

    # Export CSV
    res = client.get(f"/reports/{report_id}/export-csv", headers={"Authorization": f"Bearer {token}"})
    if res.status_code == 404:
        res = client.get(f"/api/v1/reports/{report_id}/export-csv", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200, res.text
    assert "text/csv" in res.headers.get("content-type", "")
    assert "AICTE" in res.text
    assert "attachment;" in res.headers.get("content-disposition", "")

    # Verify Rule #1: REPORT_EXPORTED_CSV logged in audit trail
    audit_res = client.get(f"/audit?action=REPORT_EXPORTED_CSV&entity_id={report_id}&limit=5", headers={"Authorization": f"Bearer {token}"})
    assert audit_res.status_code == 200
    matching_logs = audit_res.json()
    assert len(matching_logs) > 0, f"No REPORT_EXPORTED_CSV audit log found for {report_id}"
    assert matching_logs[0]["action"] == "REPORT_EXPORTED_CSV"
