"""
Comprehensive Verification Test Suite for Authentication and Role-Based Access Control (RBAC).

Tests:
1. POST /auth/login returns JWT and full user profile.
2. Login events are recorded in audit_logs with cryptographic SHA-256 hash.
3. Role-based scoping of data across all 6 roles:
   - INSTITUTION sees only own institution's data
   - REGIONAL_OFFICER and REGIONAL_HEAD see only own region
   - BUREAU_OFFICER and ADMIN see all data nationwide
   - EVC_MEMBER sees assigned EVCs and corresponding applications
4. Permission boundaries and 403 Forbidden enforcement via require_roles.
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.entities import AuditLog, User, Institution, Application

client = TestClient(app)

PERSONAS = {
    "ADMIN": {
        "email": "admin@aicte.gov.in",
        "expected_role": "ADMIN",
        "total_apps": 150,
        "total_insts": 60,
        "total_docs": 60,
        "total_undertakings": 40,
        "total_evcs": 25,
    },
    "BUREAU_OFFICER": {
        "email": "member.secretary@aicte.gov.in",
        "expected_role": "BUREAU_OFFICER",
        "total_apps": 150,
        "total_insts": 60,
        "total_docs": 60,
        "total_undertakings": 40,
        "total_evcs": 25,
    },
    "REGIONAL_HEAD": {
        "email": "head.nw@aicte.gov.in",
        "expected_role": "REGIONAL_HEAD",
        "expected_region_id": 7,  # North-Western
        "total_apps": 20,
        "total_insts": 8,
        "total_docs": 8,
        "total_undertakings": 8,
        "total_evcs": 4,
    },
    "REGIONAL_OFFICER": {
        "email": "ro.w@aicte.gov.in",
        "expected_role": "REGIONAL_OFFICER",
        "expected_region_id": 3,  # Western
        "total_apps": 18,
        "total_insts": 7,
        "total_docs": 7,
        "total_undertakings": 4,
        "total_evcs": 3,
    },
    "EVC_MEMBER": {
        "email": "evc.expert1@aicte.gov.in",
        "expected_role": "EVC_MEMBER",
        "total_apps": 12,
        "total_insts": 12,
        "total_docs": 12,
        "total_undertakings": 6,
        "total_evcs": 12,
    },
    "INSTITUTION": {
        "email": "principal@ditm.ac.in",
        "expected_role": "INSTITUTION",
        "expected_institution_id": 1,  # Delhi Institute of Technology & Management
        "total_apps": 3,
        "total_insts": 1,
        "total_docs": 1,
        "total_undertakings": 2,
        "total_evcs": 1,
    },
}

def test_login_returns_jwt_and_profile():
    """Verify POST /auth/login returns JWT token and complete user profile."""
    res = client.post("/auth/login", json={
        "email": "admin@aicte.gov.in",
        "password": "aicte123"
    })
    assert res.status_code == 200, res.text
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert "user" in data
    user_prof = data["user"]
    assert user_prof["email"] == "admin@aicte.gov.in"
    assert user_prof["role"] == "ADMIN"
    assert "id" in user_prof
    assert user_prof["is_active"] is True

def test_login_audited():
    """Verify every login creates an audit_logs entry with SHA-256 hash."""
    db = SessionLocal()
    before_count = db.query(AuditLog).filter(AuditLog.action == "USER_LOGIN_SUCCESS").count()
    db.close()

    res = client.post("/auth/login", json={
        "email": "principal@ditm.ac.in",
        "password": "aicte123"
    })
    assert res.status_code == 200

    db = SessionLocal()
    after_count = db.query(AuditLog).filter(AuditLog.action == "USER_LOGIN_SUCCESS").count()
    latest_log = db.query(AuditLog).filter(AuditLog.action == "USER_LOGIN_SUCCESS").order_by(AuditLog.id.desc()).first()
    db.close()

    assert after_count > before_count
    assert latest_log is not None
    assert latest_log.hash is not None
    assert len(latest_log.hash) == 64  # SHA-256 hex string

@pytest.mark.parametrize("role_name,info", PERSONAS.items())
def test_role_scoped_data(role_name, info):
    """Log in as each role and verify they only see permitted data."""
    # 1. Login
    login_res = client.post("/auth/login", json={
        "email": info["email"],
        "password": "aicte123"
    })
    assert login_res.status_code == 200, f"Failed login for {role_name}: {login_res.text}"
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Verify User Profile
    user_data = login_res.json()["user"]
    assert user_data["role"] == info["expected_role"]
    if "expected_region_id" in info:
        assert user_data["region_id"] == info["expected_region_id"]
    if "expected_institution_id" in info:
        assert user_data["institution_id"] == info["expected_institution_id"]

    # 3. Test Applications Scoping
    app_res = client.get("/api/v1/applications", headers=headers)
    assert app_res.status_code == 200
    apps = app_res.json()
    assert len(apps) == info["total_apps"], (
        f"{role_name} expected {info['total_apps']} applications, got {len(apps)}"
    )

    # 4. Test Institutions Scoping
    inst_res = client.get("/api/v1/institutions", headers=headers)
    assert inst_res.status_code == 200
    insts = inst_res.json()
    assert len(insts) == info["total_insts"], (
        f"{role_name} expected {info['total_insts']} institutions, got {len(insts)}"
    )

    # 5. Test Documents Scoping
    doc_res = client.get("/api/v1/documents", headers=headers)
    assert doc_res.status_code == 200
    docs = doc_res.json()
    assert len(docs) == info["total_docs"], (
        f"{role_name} expected {info['total_docs']} documents, got {len(docs)}"
    )

    # 6. Test Undertakings Scoping
    und_res = client.get("/api/v1/undertakings", headers=headers)
    assert und_res.status_code == 200
    unds = und_res.json()
    assert len(unds) == info["total_undertakings"], (
        f"{role_name} expected {info['total_undertakings']} undertakings, got {len(unds)}"
    )

    # 7. Test EVC Schedules Scoping
    evc_res = client.get("/api/v1/applications/evc-schedules/list", headers=headers)
    assert evc_res.status_code == 200
    evcs = evc_res.json()
    assert len(evcs) == info["total_evcs"], (
        f"{role_name} expected {info['total_evcs']} EVC schedules, got {len(evcs)}"
    )

def test_require_roles_enforcement():
    """Verify unauthorized roles receive 403 Forbidden."""
    # Institution login
    inst_login = client.post("/auth/login", json={
        "email": "principal@ditm.ac.in",
        "password": "aicte123"
    })
    inst_token = inst_login.json()["access_token"]
    inst_headers = {"Authorization": f"Bearer {inst_token}"}

    # Attempt to access audit explorer (restricted to ADMIN, BUREAU_OFFICER, REGIONAL_HEAD)
    audit_res = client.get("/api/v1/audit", headers=inst_headers)
    assert audit_res.status_code == 403, "Institution user must be denied access to audit logs"

    # Admin login
    admin_login = client.post("/auth/login", json={
        "email": "admin@aicte.gov.in",
        "password": "aicte123"
    })
    admin_token = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Admin should have full access
    admin_audit = client.get("/api/v1/audit", headers=admin_headers)
    assert admin_audit.status_code == 200, "Admin must be granted access to audit logs"

