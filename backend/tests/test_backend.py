"""
Comprehensive test suite verifying IntelliApprove Non-Negotiable Rules:
1. Every state change writes an audit_logs entry.
2. The system NEVER auto-approves or auto-rejects; final decisions require human competent authority with checklist.
3. Timelines, routes, reminder offsets and escalation ladders are configurable in DB.
4. Role-based permissions enforced.
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.audit import AuditLog
from app.models.application import Application
from app.models.workflow import StageConfig, WorkflowRoute
from app.core.security import create_access_token

client = TestClient(app)

def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"

def test_rule_1_audit_log_on_login():
    """Verify that logging in writes an audit_logs entry."""
    db = SessionLocal()
    audit_count_before = db.query(AuditLog).filter(AuditLog.action == "USER_LOGIN_SUCCESS").count()
    db.close()

    res = client.post("/api/v1/auth/login", json={
        "email": "member.secretary@aicte.gov.in",
        "password": "aicte123"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["role"] in ["BUREAU_OFFICER", "COMPETENT_AUTHORITY"]

    db = SessionLocal()
    audit_count_after = db.query(AuditLog).filter(AuditLog.action == "USER_LOGIN_SUCCESS").count()
    db.close()
    assert audit_count_after > audit_count_before

def test_rule_2_human_oversight_required_on_decision():
    """Verify that decisions require human authority and checklist verification."""
    # Login as Competent Authority (User 3 = member.secretary@aicte.gov.in, BUREAU_OFFICER)
    token = create_access_token(data={"sub": "3", "role": "COMPETENT_AUTHORITY", "email": "member.secretary@aicte.gov.in"})
    headers = {"Authorization": f"Bearer {token}"}

    # Attempt decision WITHOUT complete checklist
    res = client.post("/api/v1/workflow/authority-decision/3", headers=headers, json={
        "verdict": "APPROVED",
        "notes": "Approved by human authority after committee review.",
        "checklist_acknowledgement": {
            "physical_infrastructure_verified": True,
            "vigilance_clearance_confirmed": False  # Not all checked
        }
    })
    assert res.status_code == 400
    assert "Human Oversight Checklist" in res.json()["detail"]

    # Now with full checklist confirmed
    res_success = client.post("/api/v1/workflow/authority-decision/3", headers=headers, json={
        "verdict": "APPROVED",
        "notes": "Approved by human authority after committee review.",
        "checklist_acknowledgement": {
            "physical_infrastructure_verified": True,
            "vigilance_clearance_confirmed": True,
            "cadre_ratio_adherence": True
        }
    })
    assert res_success.status_code == 200
    app_data = res_success.json()
    assert app_data["decision_verdict"] == "APPROVED"
    assert app_data["approval_letter_number"] is not None
    assert app_data["digital_signature_hash"] is not None

    # Check audit log written for this decision
    db = SessionLocal()
    decision_audit = db.query(AuditLog).filter(
        AuditLog.action == "COMPETENT_AUTHORITY_DECISION_RECORDED",
        AuditLog.entity_id == "3"
    ).first()
    db.close()
    assert decision_audit is not None

def test_rule_3_configurable_routes_and_slas():
    """Verify that stage routes and SLAs are read dynamically from DB and configurable."""
    # User 1 is admin@aicte.gov.in
    token = create_access_token(data={"sub": "1", "role": "ADMIN", "email": "admin@aicte.gov.in"})
    headers = {"Authorization": f"Bearer {token}"}

    # Get stages
    res = client.get("/api/v1/config/stages", headers=headers)
    assert res.status_code == 200
    stages = res.json()
    assert len(stages) >= 7

    # Update a stage SLA hours dynamically
    target_stage = stages[1]
    res_update = client.put(f"/api/v1/config/stages/{target_stage['id']}", headers=headers, json={
        "sla_hours": 96
    })
    assert res_update.status_code == 200
    assert res_update.json()["sla_hours"] == 96

    # Verify audit log written for config change
    db = SessionLocal()
    config_audit = db.query(AuditLog).filter(
        AuditLog.action == "CONFIG_STAGE_UPDATED",
        AuditLog.entity_id == str(target_stage["id"])
    ).first()
    db.close()
    assert config_audit is not None

def test_rule_5_rbac_enforcement():
    """Verify that unauthorized roles are blocked."""
    # Login as Institution (User 24 is principal@ditm.ac.in)
    token = create_access_token(data={"sub": "24", "role": "INSTITUTION", "email": "principal@ditm.ac.in"})
    headers = {"Authorization": f"Bearer {token}"}

    # Attempt to access competent authority decision endpoint as Institution
    res = client.post("/api/v1/workflow/authority-decision/1", headers=headers, json={
        "verdict": "APPROVED",
        "notes": "Trying to self-approve",
        "checklist_acknowledgement": {"all": True}
    })
    assert res.status_code == 403
