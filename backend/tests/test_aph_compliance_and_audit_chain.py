"""
Unit and integration tests for AICTE APH Norms Compliance Engine,
Deficiency Lifecycle, Cryptographic Audit Trail Verification, and Reporting.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.main import app
from app.core.database import SessionLocal
from app.core.security import create_access_token
from app.models.entities import (
    User,
    Application,
    ComplianceNormRule,
    DeficiencyRecord,
    AuditLog
)
from app.services.audit_service import AuditService, GENESIS_HASH

client = TestClient(app)

@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture
def admin_headers():
    token = create_access_token(data={"sub": "1", "role": "ADMIN", "email": "admin@aicte.gov.in"})
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def officer_headers():
    token = create_access_token(data={"sub": "6", "role": "REGIONAL_OFFICER", "email": "ro.nw@aicte.gov.in"})
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def institution_headers():
    token = create_access_token(data={"sub": "24", "role": "INSTITUTION", "email": "principal@ditm.ac.in"})
    return {"Authorization": f"Bearer {token}"}

# --- 1. APH Norms & Compliance Tests ---

def test_aph_norm_rules_listing(admin_headers):
    """Verify that all active AICTE Approval Process Handbook norm rules are loaded."""
    res = client.get("/api/v1/compliance/rules", headers=admin_headers)
    assert res.status_code == 200
    rules = res.json()
    assert len(rules) >= 9
    rule_codes = [r["rule_code"] for r in rules]
    assert "FSR_NORM" in rule_codes
    assert "LAND_ACRES" in rule_codes
    assert "BUILTUP_AREA" in rule_codes
    assert "COMPUTER_RATIO" in rule_codes
    assert "ANTI_RAGGING" in rule_codes

def test_aph_norm_rule_update_and_audit(admin_headers, db_session: Session):
    """Verify dynamic update of a compliance norm rule and immutable audit trail."""
    rule = db_session.query(ComplianceNormRule).filter(ComplianceNormRule.rule_code == "FSR_NORM").first()
    assert rule is not None

    orig_standard = rule.standard_value
    new_standard = 18.0

    res = client.put(f"/api/v1/config/compliance-rules/{rule.id}", headers=admin_headers, json={
        "standard_value": new_standard,
        "severity": "CRITICAL"
    })
    assert res.status_code == 200
    assert res.json()["standard_value"] == new_standard

    # Verify audit log was recorded
    audit = db_session.query(AuditLog).filter(
        AuditLog.action == "CONFIG_COMPLIANCE_NORM_UPDATED",
        AuditLog.entity_id == str(rule.id)
    ).order_by(AuditLog.id.desc()).first()
    assert audit is not None
    assert "FSR_NORM" in audit.reason

    # Revert back to original
    client.put(f"/api/v1/config/compliance-rules/{rule.id}", headers=admin_headers, json={
        "standard_value": orig_standard,
        "severity": "CRITICAL"
    })

def test_run_compliance_evaluation(officer_headers, db_session: Session):
    """Verify automated evaluation of an application against APH handbook norms."""
    app_obj = db_session.query(Application).first()
    assert app_obj is not None

    res = client.post(f"/api/v1/compliance/{app_obj.id}/evaluate", headers=officer_headers)
    assert res.status_code == 200
    data = res.json()

    assert "compliance_score" in data
    assert "checks_evaluated" in data
    assert data["checks_evaluated"] >= 9
    assert "checklist" in data
    assert len(data["checklist"]) >= 9
    assert 0.0 <= data["compliance_score"] <= 100.0

    # Verify application updated in DB
    db_session.refresh(app_obj)
    assert app_obj.compliance_score == data["compliance_score"]
    assert app_obj.deficiency_count == data["deficiencies_count"]

def test_deficiency_rectification_flow(institution_headers, db_session: Session):
    """Verify institutional submission of deficiency rectification proof."""
    def_record = db_session.query(DeficiencyRecord).filter(DeficiencyRecord.is_rectified == False).first()
    assert def_record is not None

    res = client.post(
        f"/api/v1/compliance/deficiencies/{def_record.id}/rectify",
        headers=institution_headers,
        json={"rectification_proof": "Appointed 4 Assistant Professors via AICTE Selection Committee."}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["is_rectified"] is True
    assert "AICTE Selection Committee" in data["rectification_proof"]

def test_deficiency_officer_verification(officer_headers, db_session: Session):
    """Verify regional officer verification of deficiency rectification proof."""
    def_record = db_session.query(DeficiencyRecord).filter(DeficiencyRecord.is_rectified == True).first()
    assert def_record is not None

    res = client.post(
        f"/api/v1/compliance/deficiencies/{def_record.id}/verify",
        headers=officer_headers,
        json={"is_verified": True, "remarks": "Selection committee minutes verified compliant."}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "VERIFIED_COMPLIANT"

def test_deficiencies_summary_endpoint(admin_headers):
    """Verify aggregated deficiency metrics and rule ranking."""
    res = client.get("/api/v1/compliance/deficiencies/summary", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert "total_deficiencies" in data
    assert "rectified_count" in data
    assert "by_severity" in data
    assert "by_rule" in data
    assert data["total_deficiencies"] > 0

# --- 2. Cryptographic Audit Chain Verification Tests ---

def test_cryptographic_audit_chain_verification(admin_headers, db_session: Session):
    """Verify the SHA-256 tamper-evident cryptographic hash chain across all audit blocks."""
    res = client.get("/api/v1/audit/verify-chain", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()

    assert data["is_valid"] is True
    assert data["broken_links_count"] == 0
    assert data["total_blocks"] > 1000
    assert data["genesis_hash"] == GENESIS_HASH
    assert data["head_hash"] is not None
    assert data["status"] == "CHAIN_INTEGRITY_VERIFIED"

def test_audit_chain_tamper_detection(db_session: Session):
    """Verify that tampering with an audit block immediately breaks the cryptographic chain."""
    # Find a middle block
    target_block = db_session.query(AuditLog).filter(AuditLog.id == 500).first()
    if not target_block:
        target_block = db_session.query(AuditLog).order_by(AuditLog.id.desc()).first()

    orig_prev_hash = target_block.prev_hash
    # Corrupt the prev_hash
    target_block.prev_hash = "0000000000000000000000000000000000000000000000000000000000000000"
    db_session.commit()

    # Verify detection
    diag = AuditService.verify_chain(db=db_session)
    assert diag["is_valid"] is False
    assert diag["tampered_block_id"] == target_block.id
    assert diag["broken_links_count"] >= 1
    assert diag["status"] == "TAMPER_DETECTED"

    # Restore the chain
    target_block.prev_hash = orig_prev_hash
    db_session.commit()

    # Re-verify clean status
    diag_restored = AuditService.verify_chain(db=db_session)
    assert diag_restored["is_valid"] is True

# --- 3. Reports & CSV Export Tests ---

def test_deficiency_national_report(admin_headers):
    """Verify the executive deficiency report endpoint."""
    res = client.get("/api/v1/analytics/deficiency-report", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert "summary" in data
    assert "rule_rankings" in data
    assert "category_breakdown" in data
    assert "regional_deficiencies" in data
    assert "top_deficient_institutions" in data
    assert len(data["top_deficient_institutions"]) > 0

def test_analytics_csv_export(admin_headers):
    """Verify CSV export of applications dataset."""
    res = client.get("/api/v1/analytics/export-csv", headers=admin_headers)
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    content = res.text
    assert "Ref No" in content
    assert "Compliance Score (%)" in content
    assert "Deficiencies Count" in content
    assert len(content.splitlines()) > 100
