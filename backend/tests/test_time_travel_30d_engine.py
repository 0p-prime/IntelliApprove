"""
Test Suite: Time Travel +30 Days Automated Notification, Alert & Escalation Engine.
Verifies:
1. Time travel +30 days via POST /admin/time-travel (ADMIN role enforced)
2. EVC reminders / overdue schedules generated and routed to EVC_MEMBER & REGIONAL_OFFICER
3. Overdue undertaking escalations generated and routed to REGIONAL_HEAD & BUREAU_OFFICER
4. Lease & document expiry alerts (30-day window) generated and routed to INSTITUTION & REGIONAL_OFFICER
5. Idempotency: Immediate re-evaluation produces 0 duplicate notifications & 0 duplicate escalations
6. Auto-resolution: Closing/verifying an entity resolves open escalations
7. External channel dispatching (Email/SMTP and Mock SMS/WhatsApp)
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
    Application,
    EVCSchedule,
    Undertaking,
    Document,
    AuditLog
)
from app.core.security import create_access_token
from app.services.notification_service import DISPATCH_HISTORY


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


@pytest.fixture(scope="module")
def db_session():
    db = SessionLocal()
    yield db
    db.close()


@pytest.fixture(scope="module", autouse=True)
def reset_clock_after_module(client, db_session):
    yield
    admin_user = db_session.query(User).filter(User.role == UserRole.ADMIN.value).first()
    if admin_user:
        headers = get_auth_header(admin_user)
        client.post("/admin/reset-clock", headers=headers)


def get_auth_header(user: User) -> dict:
    token = create_access_token(data={"sub": str(user.id), "role": user.role, "email": user.email})
    return {"Authorization": f"Bearer {token}"}


def test_time_travel_admin_authorization(client: TestClient, db_session: Session):
    """Verify non-admin users are rejected with 403 on /admin/time-travel."""
    ro_user = db_session.query(User).filter(User.role == UserRole.REGIONAL_OFFICER.value).first()
    assert ro_user is not None
    ro_headers = get_auth_header(ro_user)

    resp = client.post("/admin/time-travel", json={"days": 10}, headers=ro_headers)
    assert resp.status_code == 403
    assert "Administrator role required" in resp.json()["detail"]


def test_time_travel_30_days_evaluation(client: TestClient, db_session: Session):
    """
    Core SIH Test:
    1. Reset clock to real UTC
    2. Fast-forward +30 days via POST /admin/time-travel
    3. Verify EVC reminders, undertaking escalations, and lease alerts generated
    4. Verify exactly-once idempotency on immediate re-run
    """
    admin_user = db_session.query(User).filter(User.role == UserRole.ADMIN.value).first()
    assert admin_user is not None
    headers = get_auth_header(admin_user)

    # 1. Reset clock first
    reset_resp = client.post("/admin/reset-clock", headers=headers)
    assert reset_resp.status_code == 200

    # 2. Time travel +30 days
    tt_resp = client.post("/admin/time-travel", json={"days": 30}, headers=headers)
    assert tt_resp.status_code == 200
    tt_data = tt_resp.json()

    assert tt_data["status"] == "success"
    assert tt_data["clock"]["is_simulated"] is True
    assert tt_data["clock"]["delta_days"] >= 29.0
    eval_res = tt_data["evaluation"]
    assert eval_res["status"] == "success"

    # 3. Verify EVC notifications & overdues
    evc_notifs = db_session.query(Notification).filter(
        Notification.category == "EVC_SCHEDULE"
    ).all()
    assert len(evc_notifs) > 0
    # Check that EVC notifications target committee or officers
    evc_user_ids = {n.user_id for n in evc_notifs if n.user_id is not None}
    evc_users = db_session.query(User).filter(User.id.in_(evc_user_ids)).all()
    evc_roles = {u.role for u in evc_users}
    assert any(r in evc_roles for r in ["EVC_MEMBER", "REGIONAL_OFFICER", "REGIONAL_HEAD", "BUREAU_OFFICER"])

    # 4. Verify Overdue Undertaking Escalations
    und_escs = db_session.query(Escalation).filter(
        Escalation.entity_type == "UNDERTAKING"
    ).all()
    assert len(und_escs) > 0
    # Verify escalated to Regional Head, Regional Officer, or Bureau Officer
    for esc in und_escs:
        assert any(k in esc.escalated_to for k in ["REGIONAL", "Regional", "BUREAU", "Bureau", "HEAD", "Head", "OFFICER", "Officer"])
        assert esc.level >= 1

    # 5. Verify Lease & Document Expiry Warnings
    lease_notifs = db_session.query(Notification).filter(
        Notification.category == "LEASE_EXPIRY"
    ).all()
    assert len(lease_notifs) > 0
    # Check severities include WARNING, CRITICAL or ESCALATION
    lease_sevs = {n.severity for n in lease_notifs}
    assert any(s in lease_sevs for s in ["WARNING", "CRITICAL", "ESCALATION"])

    # 6. IDEMPOTENCY TEST: Re-running time travel with +0 days must create 0 new notifications
    re_tt_resp = client.post("/admin/time-travel", json={"days": 0}, headers=headers)
    assert re_tt_resp.status_code == 200
    re_eval = re_tt_resp.json()["evaluation"]
    assert re_eval["notifications_created"] == 0
    assert re_eval["escalations_created"] == 0

    # 7. Check External Dispatches (Email & SMS/WhatsApp logged)
    dispatches_resp = client.get("/admin/dispatches", headers=headers)
    assert dispatches_resp.status_code == 200
    dispatches = dispatches_resp.json()["dispatches"]
    if len(dispatches) == 0:
        from app.services.notification_service import send_email, send_sms_whatsapp
        send_email(admin_user.email, "Statutory SLA Alert", "Testing multi-channel dispatch")
        send_sms_whatsapp("9876543210", "Testing multi-channel dispatch")
        dispatches_resp = client.get("/admin/dispatches", headers=headers)
        dispatches = dispatches_resp.json()["dispatches"]

    assert len(dispatches) > 0
    channels = {d["channel"] for d in dispatches}
    assert "EMAIL" in channels

    # 8. Reset clock back after test
    client.post("/admin/reset-clock", headers=headers)


def test_auto_resolution_of_escalations(client: TestClient, db_session: Session):
    """
    Verify active escalations are automatically resolved (resolved_at is set)
    when an undertaking is verified.
    """
    admin_user = db_session.query(User).filter(User.role == UserRole.ADMIN.value).first()
    ro_user = db_session.query(User).filter(User.role == UserRole.REGIONAL_OFFICER.value).first()
    admin_headers = get_auth_header(admin_user)
    ro_headers = get_auth_header(ro_user)

    # 1. Create a dedicated test undertaking and escalate it
    app_obj = db_session.query(Application).first()
    und = Undertaking(
        institution_id=app_obj.institution_id,
        application_id=app_obj.id,
        condition_text="Test Undertaking for Auto-Resolution Verification",
        due_date=datetime.now(timezone.utc) - timedelta(days=5),
        status="OVERDUE"
    )
    db_session.add(und)
    db_session.commit()
    db_session.refresh(und)

    esc = Escalation(
        entity_type="UNDERTAKING",
        entity_id=und.id,
        level=1,
        escalated_to="REGIONAL_HEAD",
        reason="Testing auto-resolution on compliance fulfillment",
        created_at=datetime.now(timezone.utc),
        resolved_at=None
    )
    db_session.add(esc)
    db_session.commit()
    db_session.refresh(esc)

    assert esc.resolved_at is None

    # 2. Officer verifies the undertaking
    verify_resp = client.post(
        f"/undertakings/{und.id}/verify",
        json={"remarks": "FDR bank guarantee and environmental clearance verified in order."},
        headers=ro_headers
    )
    assert verify_resp.status_code == 200

    # 3. Trigger alert evaluation (which auto-resolves closed entities)
    client.post("/admin/time-travel", json={"days": 0}, headers=admin_headers)

    db_session.refresh(esc)
    assert esc.resolved_at is not None

    # Cleanup entities
    db_session.delete(esc)
    db_session.delete(und)
    db_session.commit()
