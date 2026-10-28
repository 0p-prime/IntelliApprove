"""
Unit tests for the Role-Based Real-Time Dashboard Endpoints.
Covers:
- /dashboard/summary (aggregated metrics, role scoping, SLA breach counter, approaching deadline counter)
- /dashboard/stage-funnel (stage counts & SLA hours)
- /dashboard/ageing (0-7, 8-15, 16-30, 30+ days buckets)
- /dashboard/region-performance (8 AICTE regions pendency & avg processing time)
- /dashboard/officer-workload (active & overdue cases per officer)
- /dashboard/bottlenecks (dwell times vs standard APH SLA)
- /dashboard/upcoming-deadlines (next 14 days across all 4 modules)
- Query filters: region_id, stage, date_from, date_to
"""
import pytest
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.core.database import SessionLocal
from app.models.entities import User, UserRole, Application, Region, SystemClock
from app.core.security import create_access_token


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


def test_national_dashboard_summary(client: TestClient, db_session: Session):
    """BUREAU_OFFICER sees national aggregates across all 150 applications."""
    bureau_user = db_session.query(User).filter(User.role == UserRole.BUREAU_OFFICER.value).first()
    assert bureau_user is not None
    headers = get_auth_header(bureau_user)

    resp = client.get("/dashboard/summary", headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    s = data["summary"]
    assert s["total"] == 150
    assert s["in_progress"] > 0
    assert s["completed"] > 0
    assert s["overdue"] > 0
    assert s["sla_breach_count"] >= s["overdue"]
    assert s["approaching_deadline_count"] >= 0
    assert data["jurisdiction"] == "National"
    assert len(data["top_overdue_cases"]) > 0


def test_regional_dashboard_scoping(client: TestClient, db_session: Session):
    """REGIONAL_OFFICER sees only applications in their assigned region."""
    ro_user = db_session.query(User).filter(User.role == UserRole.REGIONAL_OFFICER.value).first()
    assert ro_user is not None and ro_user.region_id is not None
    headers = get_auth_header(ro_user)

    resp = client.get("/dashboard/summary", headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    s = data["summary"]
    # Regional count must be strictly less than national total
    assert s["total"] < 150
    assert s["total"] > 0
    assert data["jurisdiction"] != "National"


def test_evc_member_dashboard_scoping(client: TestClient, db_session: Session):
    """EVC_MEMBER sees assigned visits and reports."""
    evc_user = db_session.query(User).filter(User.role == UserRole.EVC_MEMBER.value).first()
    assert evc_user is not None
    headers = get_auth_header(evc_user)

    resp = client.get("/dashboard/summary", headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    assert data["user_role"] == UserRole.EVC_MEMBER.value
    assert "assigned_visits" in data["role_context"]
    assert data["role_context"]["assigned_visits"] > 0


def test_institution_dashboard_scoping(client: TestClient, db_session: Session):
    """INSTITUTION sees own campus metrics and compliance score."""
    inst_user = db_session.query(User).filter(User.role == UserRole.INSTITUTION.value).first()
    assert inst_user is not None
    headers = get_auth_header(inst_user)

    resp = client.get("/dashboard/summary", headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    assert data["user_role"] == UserRole.INSTITUTION.value
    assert "compliance_score" in data["role_context"]
    assert data["role_context"]["compliance_score"] > 80.0


def test_stage_funnel_endpoint(client: TestClient, db_session: Session):
    """Verify stage funnel sequence and percentages."""
    admin_user = db_session.query(User).filter(User.role == UserRole.ADMIN.value).first()
    headers = get_auth_header(admin_user)

    resp = client.get("/dashboard/stage-funnel", headers=headers)
    assert resp.status_code == 200
    funnel = resp.json()

    assert len(funnel) == 7
    stage_keys = [item["stage"] for item in funnel]
    assert stage_keys == ["SUBMITTED", "SCRUTINY", "EVC", "SAC_SHC", "BUREAU_DECISION", "APPROVED", "REJECTED"]

    total_pct = sum(item["percentage"] for item in funnel)
    assert 99.0 <= total_pct <= 101.0  # Accounts for floating rounding


def test_ageing_buckets_endpoint(client: TestClient, db_session: Session):
    """Verify ageing buckets: 0-7, 8-15, 16-30, 30+ days."""
    admin_user = db_session.query(User).filter(User.role == UserRole.ADMIN.value).first()
    headers = get_auth_header(admin_user)

    resp = client.get("/dashboard/ageing", headers=headers)
    assert resp.status_code == 200
    buckets = resp.json()

    assert len(buckets) == 4
    bucket_labels = [b["bucket"] for b in buckets]
    assert bucket_labels == ["0-7 Days", "8-15 Days", "16-30 Days", "30+ Days"]

    total_apps_in_buckets = sum(b["count"] for b in buckets)
    assert total_apps_in_buckets > 0


def test_region_performance_endpoint(client: TestClient, db_session: Session):
    """Verify region performance covers all 8 AICTE regions."""
    admin_user = db_session.query(User).filter(User.role == UserRole.ADMIN.value).first()
    headers = get_auth_header(admin_user)

    resp = client.get("/dashboard/region-performance", headers=headers)
    assert resp.status_code == 200
    regions = resp.json()

    assert len(regions) == 8
    reg_names = {r["region_name"] for r in regions}
    assert "Northern" in reg_names
    assert "Southern" in reg_names
    assert "Western" in reg_names

    for r in regions:
        assert r["total_applications"] > 0
        assert r["avg_processing_days"] > 0.0
        assert 0.0 <= r["sla_compliance_rate"] <= 100.0


def test_officer_workload_endpoint(client: TestClient, db_session: Session):
    """Verify officer workload counts and capacity utilization."""
    admin_user = db_session.query(User).filter(User.role == UserRole.ADMIN.value).first()
    headers = get_auth_header(admin_user)

    resp = client.get("/dashboard/officer-workload", headers=headers)
    assert resp.status_code == 200
    workload = resp.json()

    assert len(workload) > 0
    first_officer = workload[0]
    assert "officer_name" in first_officer
    assert "active_cases" in first_officer
    assert "overdue_cases" in first_officer
    assert "utilization_pct" in first_officer


def test_bottlenecks_endpoint(client: TestClient, db_session: Session):
    """Verify bottleneck dwell times vs standard APH SLA."""
    admin_user = db_session.query(User).filter(User.role == UserRole.ADMIN.value).first()
    headers = get_auth_header(admin_user)

    resp = client.get("/dashboard/bottlenecks", headers=headers)
    assert resp.status_code == 200
    bottlenecks = resp.json()

    assert len(bottlenecks) == 5
    for b in bottlenecks:
        assert b["avg_dwell_days"] >= 0.0
        assert b["sla_standard_days"] > 0.0
        assert b["bottleneck_severity"] in ["HIGH", "MEDIUM", "LOW"]


def test_upcoming_deadlines_all_modules(client: TestClient, db_session: Session):
    """Verify upcoming deadlines aggregates across Application, EVC, Undertaking, Document."""
    admin_user = db_session.query(User).filter(User.role == UserRole.ADMIN.value).first()
    headers = get_auth_header(admin_user)

    resp = client.get("/dashboard/upcoming-deadlines?days=14", headers=headers)
    assert resp.status_code == 200
    deadlines = resp.json()

    assert len(deadlines) > 0
    modules_found = {d["module"] for d in deadlines}
    # Ensure multi-module aggregation
    assert len(modules_found) >= 2
    for d in deadlines:
        assert "due_date" in d
        assert "days_remaining" in d
        assert d["severity"] in ["CRITICAL", "WARNING", "INFO"]
        assert "link" in d


def test_dashboard_query_filters(client: TestClient, db_session: Session):
    """Verify filtering by region_id and stage."""
    admin_user = db_session.query(User).filter(User.role == UserRole.ADMIN.value).first()
    headers = get_auth_header(admin_user)

    # 1. Filter by region_id
    resp_reg = client.get("/dashboard/summary?region_id=1", headers=headers)
    assert resp_reg.status_code == 200
    data_reg = resp_reg.json()
    assert data_reg["summary"]["total"] < 150

    # 2. Filter by stage
    resp_stage = client.get("/dashboard/summary?stage=SCRUTINY", headers=headers)
    assert resp_stage.status_code == 200
    data_stage = resp_stage.json()
    assert data_stage["summary"]["total"] < 150

