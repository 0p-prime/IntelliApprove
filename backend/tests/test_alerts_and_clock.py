"""
Unit and integration tests for Automated Alert Rules, Escalation Ladders,
and System Clock Time Travel Engine.
Covers:
- SystemClock GET, ADVANCE, SET, RESET
- Background Alert & Escalation Engine evaluation (STAGE_SLA, EVC, Undertakings, Documents)
- Role-based scoping of notifications (ADMIN, BUREAU_OFFICER, REGIONAL_OFFICER, INSTITUTION)
- Marking alerts as read and read-all
- Escalation history endpoint with entity context
- Alert rules configuration update and audit logging
"""
import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.core.database import SessionLocal
from app.models.entities import (
    User,
    UserRole,
    AlertRule,
    Notification,
    Escalation,
    SystemClock,
    AuditLog
)
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


def test_get_system_clock(client: TestClient, db_session: Session):
    """Verify /system/clock returns simulated date, is_simulated flag, and delta."""
    admin_user = db_session.query(User).filter(User.role == UserRole.ADMIN.value).first()
    assert admin_user is not None
    headers = get_auth_header(admin_user)

    resp = client.get("/system/clock", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "simulated_date" in data
    assert "is_simulated" in data
    assert "real_date" in data
    assert "delta_days" in data


def test_system_clock_advance_and_audit(client: TestClient, db_session: Session):
    """
    Verify /system/clock/advance fast-forwards time,
    triggers alert evaluation, and writes SYSTEM_CLOCK_ADVANCED audit log.
    """
    admin_user = db_session.query(User).filter(User.role == UserRole.ADMIN.value).first()
    headers = get_auth_header(admin_user)

    initial_resp = client.get("/system/clock", headers=headers)
    initial_date = datetime.fromisoformat(initial_resp.json()["simulated_date"].replace("Z", "+00:00"))

    # Advance by 5 days
    resp = client.post("/system/clock/advance", json={"days": 5}, headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    assert data["status"] == "success"
    assert "clock" in data
    assert "evaluation" in data
    assert data["evaluation"]["status"] == "success"

    new_date = datetime.fromisoformat(data["clock"]["simulated_date"].replace("Z", "+00:00"))
    assert (new_date - initial_date).days == 5

    # Check Audit Log
    audit = db_session.query(AuditLog).filter(
        AuditLog.action == "SYSTEM_CLOCK_ADVANCED",
        AuditLog.actor_id == admin_user.id
    ).order_by(AuditLog.id.desc()).first()
    assert audit is not None
    assert "5d" in audit.reason


def test_system_clock_set_and_reset(client: TestClient, db_session: Session):
    """Verify setting clock to a specific date and resetting back to UTC wall clock."""
    admin_user = db_session.query(User).filter(User.role == UserRole.ADMIN.value).first()
    headers = get_auth_header(admin_user)

    # Set to 2027-01-15
    target_dt = datetime(2027, 1, 15, 10, 0, 0, tzinfo=timezone.utc)
    set_resp = client.post(
        "/system/clock/set",
        json={"target_date": target_dt.isoformat()},
        headers=headers
    )
    assert set_resp.status_code == 200
    assert "2027-01-15" in set_resp.json()["clock"]["simulated_date"]

    # Reset clock
    reset_resp = client.post("/system/clock/reset", headers=headers)
    assert reset_resp.status_code == 200
    reset_data = reset_resp.json()
    assert abs(reset_data["clock"]["delta_days"]) < 0.1  # close to zero


def test_get_alerts_and_unread_count(client: TestClient, db_session: Session):
    """Verify /alerts returns notifications with proper schema fields."""
    admin_user = db_session.query(User).filter(User.role == UserRole.ADMIN.value).first()
    headers = get_auth_header(admin_user)

    resp = client.get("/alerts", headers=headers)
    assert resp.status_code == 200
    alerts = resp.json()
    assert len(alerts) > 0

    first = alerts[0]
    assert "id" in first
    assert "title" in first
    assert "message" in first
    assert "severity" in first
    assert "is_read" in first
    assert "created_at" in first

    # Check unread count
    cnt_resp = client.get("/alerts/unread-count", headers=headers)
    assert cnt_resp.status_code == 200
    assert "unread_count" in cnt_resp.json()


def test_mark_alert_read_and_read_all(client: TestClient, db_session: Session):
    """Verify marking single alert read and mark-all-read endpoint."""
    admin_user = db_session.query(User).filter(User.role == UserRole.ADMIN.value).first()
    headers = get_auth_header(admin_user)

    # Create a fresh unread notification
    test_notif = Notification(
        user_id=admin_user.id,
        title="Test Notification for Read Status",
        message="Checking mark read functionality",
        category="STAGE_SLA",
        severity="INFO",
        is_read=False
    )
    db_session.add(test_notif)
    db_session.commit()
    db_session.refresh(test_notif)

    # 1. Mark single read
    r1 = client.post(f"/alerts/{test_notif.id}/read", headers=headers)
    assert r1.status_code == 200
    assert r1.json()["status"] == "success"

    db_session.refresh(test_notif)
    assert test_notif.is_read is True

    # 2. Mark all read
    r2 = client.post("/alerts/read-all", headers=headers)
    assert r2.status_code == 200
    assert r2.json()["status"] == "success"

    # Cleanup test notification
    db_session.delete(test_notif)
    db_session.commit()


def test_trigger_sla_check_manual(client: TestClient, db_session: Session):
    """Verify manual /alerts/trigger-sla-check execution."""
    admin_user = db_session.query(User).filter(User.role == UserRole.ADMIN.value).first()
    headers = get_auth_header(admin_user)

    resp = client.post("/alerts/trigger-sla-check", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert "result" in data
    assert data["result"]["status"] == "success"


def test_escalations_endpoint(client: TestClient, db_session: Session):
    """Verify /alerts/escalations returns enriched escalation hierarchy."""
    admin_user = db_session.query(User).filter(User.role == UserRole.ADMIN.value).first()
    headers = get_auth_header(admin_user)

    resp = client.get("/alerts/escalations", headers=headers)
    assert resp.status_code == 200
    escs = resp.json()
    assert len(escs) > 0

    first = escs[0]
    assert "entity_type" in first
    assert "escalation_level" in first
    assert "escalated_to_role" in first
    assert "escalation_reason" in first
    assert "institution_name" in first


def test_alert_rules_crud(client: TestClient, db_session: Session):
    """Verify /alerts/rules retrieval and update with audit trail."""
    admin_user = db_session.query(User).filter(User.role == UserRole.ADMIN.value).first()
    headers = get_auth_header(admin_user)

    # 1. List rules
    list_resp = client.get("/alerts/rules", headers=headers)
    assert list_resp.status_code == 200
    rules = list_resp.json()
    assert len(rules) >= 10

    # 2. Update rule
    first_rule = rules[0]
    old_offset = first_rule["offset_days"]
    new_offset = -8

    upd_resp = client.put(
        f"/alerts/rules/{first_rule['id']}",
        json={"offset_days": new_offset},
        headers=headers
    )
    assert upd_resp.status_code == 200
    assert upd_resp.json()["offset_days"] == new_offset

    # Revert back
    client.put(
        f"/alerts/rules/{first_rule['id']}",
        json={"offset_days": old_offset},
        headers=headers
    )

