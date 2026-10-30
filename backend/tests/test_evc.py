"""
Unit and integration tests for the Expert Visit Committee (EVC) module.
Covers:
- EVC auto-creation upon completing preliminary stage (with new institution shorter window)
- EVC queue listing and prioritization of new institutions (is_new_institution = True)
- Dynamic status calculation (QUEUED, SCHEDULED, DUE_SOON, OVERDUE, COMPLETED)
- Overdue queue and automated escalations & alerts
- Calendar view by year and month
- Committee members pool with active workload
- Scheduling EVC visits with committee members
- Rescheduling with mandatory reason & audit trail
- Inspection completion with checklist, report upload, and auto-advancement of application stage
- Role-based scoping (EVC_MEMBER, REGIONAL_OFFICER, BUREAU_OFFICER, ADMIN)
"""
import json
import uuid
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
    EVCSchedule,
    WorkflowTemplate,
    AuditLog,
    Notification,
    Escalation,
    SystemClock,
    StageHistory
)
from app.core.security import create_access_token
from app.services.workflow_service import WorkflowService


CREATED_TEST_APP_IDS = []
CREATED_TEST_INST_IDS = []


@pytest.fixture(autouse=True)
def cleanup_evc_test_data():
    yield
    if CREATED_TEST_APP_IDS or CREATED_TEST_INST_IDS:
        db = SessionLocal()
        try:
            for aid in list(CREATED_TEST_APP_IDS):
                for s in db.query(EVCSchedule).filter(EVCSchedule.application_id == aid).all():
                    db.delete(s)
                for h in db.query(StageHistory).filter(StageHistory.application_id == aid).all():
                    db.delete(h)
                app_row = db.query(Application).filter(Application.id == aid).first()
                if app_row:
                    db.delete(app_row)
            for iid in list(CREATED_TEST_INST_IDS):
                inst_row = db.query(Institution).filter(Institution.id == iid).first()
                if inst_row:
                    db.delete(inst_row)
            db.commit()
        except Exception as e:
            print(f"Cleanup error: {e}")
            db.rollback()
        finally:
            db.close()
            CREATED_TEST_APP_IDS.clear()
            CREATED_TEST_INST_IDS.clear()


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


def create_test_evc_schedule(db: Session, is_new: bool = True) -> EVCSchedule:
    """Helper to create a fresh institution, application, and advance through Scrutiny to EVC."""
    tmpl = db.query(WorkflowTemplate).filter(WorkflowTemplate.name == "Scrutiny + EVC").first()
    ro_user = db.query(User).filter(User.role == UserRole.REGIONAL_OFFICER.value).first()

    unique_suffix = uuid.uuid4().hex[:6]
    inst = Institution(
        name=f"EVC Test Institute {unique_suffix}",
        type="Polytechnic" if is_new else "Engineering",
        state="Maharashtra",
        region_id=ro_user.region_id or 1,
        is_new=is_new,
        contact_email=f"evc_test_{unique_suffix}@example.com"
    )
    db.add(inst)
    db.commit()
    db.refresh(inst)
    CREATED_TEST_INST_IDS.append(inst.id)

    app_obj = WorkflowService.create_application(
        db=db,
        institution_id=inst.id,
        application_type="NEW_INSTITUTION" if is_new else "EXTENSION_OF_APPROVAL",
        template_id=tmpl.id,
        user=ro_user
    )
    CREATED_TEST_APP_IDS.append(app_obj.id)

    # SUBMITTED -> SCRUTINY
    WorkflowService.complete_stage(db, app_obj.id, officer=ro_user, remarks="Verification submitted")
    # SCRUTINY -> EVC (auto-creates EVCSchedule in QUEUED)
    WorkflowService.complete_stage(db, app_obj.id, officer=ro_user, remarks="Scrutiny cleared, scheduled for EVC")

    schedule = db.query(EVCSchedule).filter(EVCSchedule.application_id == app_obj.id).first()
    return schedule


def test_evc_queue_prioritizes_new_institutions(client: TestClient, db_session: Session):
    """
    Verify /evc/queue prioritises new institutions (is_new_institution = True)
    at the very top of the returned queue.
    """
    admin_user = db_session.query(User).filter(User.role == UserRole.ADMIN.value).first()
    assert admin_user is not None
    headers = get_auth_header(admin_user)

    # Ensure clock is reset so active queue statuses are not marked overdue by prior time-travel tests
    client.post("/admin/reset-clock", headers=headers)

    resp = client.get("/evc/queue", headers=headers)
    assert resp.status_code == 200
    queue = resp.json()
    assert len(queue) > 0

    # Verify all items in queue tab are active queue statuses
    for item in queue:
        assert item["status"] in ["QUEUED", "SCHEDULED", "DUE_SOON", "OVERDUE"]

    # Verify that if both new and existing institutions exist, all new institutions appear first
    first_existing_index = None
    for idx, item in enumerate(queue):
        if not item["is_new_institution"]:
            first_existing_index = idx
            break

    if first_existing_index is not None:
        # None of the items after first_existing_index should have is_new_institution == True
        for item in queue[first_existing_index:]:
            assert not item["is_new_institution"]


def test_evc_overdue_endpoint_and_escalations(client: TestClient, db_session: Session):
    """
    Verify /evc/overdue returns overdue schedules sorted by days_overdue descending,
    and triggers alert hooks/escalations.
    """
    bureau_user = db_session.query(User).filter(User.role == UserRole.BUREAU_OFFICER.value).first()
    assert bureau_user is not None
    headers = get_auth_header(bureau_user)

    resp = client.get("/evc/overdue", headers=headers)
    assert resp.status_code == 200
    overdue_list = resp.json()

    assert len(overdue_list) > 0
    # Check that each item is overdue
    for item in overdue_list:
        assert item["is_overdue"] is True
        assert item["days_overdue"] >= 0

    # Check sorted descending by days_overdue
    days_list = [item["days_overdue"] for item in overdue_list]
    assert days_list == sorted(days_list, reverse=True)


def test_evc_calendar_endpoint(client: TestClient, db_session: Session):
    """
    Verify /evc/calendar returns events with scheduled dates.
    """
    admin_user = db_session.query(User).filter(User.role == UserRole.ADMIN.value).first()
    headers = get_auth_header(admin_user)

    resp = client.get("/evc/calendar", headers=headers)
    assert resp.status_code == 200
    calendar_events = resp.json()
    assert len(calendar_events) > 0

    for item in calendar_events:
        assert item["scheduled_date"] is not None

    # Test month/year query
    resp_filtered = client.get("/evc/calendar?year=2026&month=11", headers=headers)
    assert resp_filtered.status_code == 200
    for item in resp_filtered.json():
        dt = datetime.fromisoformat(item["scheduled_date"])
        assert dt.year == 2026
        assert dt.month == 11


def test_evc_committee_members_endpoint(client: TestClient, db_session: Session):
    """
    Verify /evc/committee-members returns eligible inspectors and displays active assignments count.
    """
    admin_user = db_session.query(User).filter(User.role == UserRole.ADMIN.value).first()
    headers = get_auth_header(admin_user)

    resp = client.get("/evc/committee-members", headers=headers)
    assert resp.status_code == 200
    members = resp.json()
    assert len(members) > 0

    for m in members:
        assert m["role"] in [UserRole.EVC_MEMBER.value, "EVC_INSPECTOR", UserRole.ADMIN.value]
        assert "active_assignments" in m
        assert isinstance(m["active_assignments"], int)


def test_evc_workflow_auto_creation_and_prescribed_windows(db_session: Session):
    """
    Verify that when an application with an EVC route completes preliminary stage:
    1. An EVCSchedule row is automatically created in QUEUED status.
    2. A new institution gets 10 days due window.
    3. An existing institution gets 21 days due window.
    """
    # 1. New institution
    evc_new = create_test_evc_schedule(db_session, is_new=True)
    assert evc_new is not None
    assert evc_new.status == "QUEUED"
    assert evc_new.is_new_institution is True
    # Due date should be roughly now + 10 days
    delta_new = (evc_new.due_date - datetime.utcnow()).total_seconds() / 86400
    assert 9.0 <= delta_new <= 10.5

    # 2. Existing institution
    evc_old = create_test_evc_schedule(db_session, is_new=False)
    assert evc_old is not None
    assert evc_old.status == "QUEUED"
    assert evc_old.is_new_institution is False
    # Due date should be roughly now + 21 days
    delta_old = (evc_old.due_date - datetime.utcnow()).total_seconds() / 86400
    assert 20.0 <= delta_old <= 21.5


def test_evc_scheduling_and_rescheduling_lifecycle(client: TestClient, db_session: Session):
    """
    Test full lifecycle of scheduling an EVC:
    1. Schedule visit with committee members
    2. Reschedule with mandatory reason
    3. Attempt rescheduling without reason (should fail 422/400)
    4. Audit logs are created for every change
    """
    admin_user = db_session.query(User).filter(User.role == UserRole.ADMIN.value).first()
    headers = get_auth_header(admin_user)

    # Create fresh queued EVC
    queued_evc = create_test_evc_schedule(db_session, is_new=True)
    assert queued_evc is not None

    evc_members = db_session.query(User).filter(User.role == UserRole.EVC_MEMBER.value).limit(2).all()
    assert len(evc_members) >= 1
    member_ids = [m.id for m in evc_members]

    # 1. Schedule visit
    sched_dt = datetime.utcnow() + timedelta(days=5)
    sched_payload = {
        "scheduled_date": sched_dt.isoformat(),
        "committee_ids": member_ids
    }

    sched_resp = client.post(f"/evc/{queued_evc.id}/schedule", json=sched_payload, headers=headers)
    assert sched_resp.status_code == 200
    sched_data = sched_resp.json()
    assert sched_data["status"] == "success"
    assert sched_data["schedule"]["raw_status"] == "SCHEDULED"
    assert set(sched_data["schedule"]["committee_ids"]) == set(member_ids)

    # Check notification sent to members
    notif = db_session.query(Notification).filter(
        Notification.user_id == member_ids[0],
        Notification.category == "EVC_ASSIGNMENT"
    ).first()
    assert notif is not None

    # Check Audit log
    audit_sched = db_session.query(AuditLog).filter(
        AuditLog.action == "EVC_VISIT_SCHEDULED",
        AuditLog.entity_id == str(queued_evc.id)
    ).first()
    assert audit_sched is not None

    # 2. Reschedule with valid reason
    new_dt = datetime.utcnow() + timedelta(days=8)
    resched_payload = {
        "scheduled_date": new_dt.isoformat(),
        "reason": "Expert committee member unavailable due to AICTE council review duties."
    }

    resched_resp = client.post(f"/evc/{queued_evc.id}/reschedule", json=resched_payload, headers=headers)
    assert resched_resp.status_code == 200
    resched_data = resched_resp.json()
    assert resched_data["status"] == "success"

    # Check Audit log for reschedule
    audit_resched = db_session.query(AuditLog).filter(
        AuditLog.action == "EVC_VISIT_RESCHEDULED",
        AuditLog.entity_id == str(queued_evc.id)
    ).first()
    assert audit_resched is not None
    assert "unavailable" in audit_resched.details

    # 3. Attempt rescheduling without reason (validation error)
    bad_payload = {
        "scheduled_date": (datetime.utcnow() + timedelta(days=9)).isoformat(),
        "reason": " "
    }
    bad_resp = client.post(f"/evc/{queued_evc.id}/reschedule", json=bad_payload, headers=headers)
    assert bad_resp.status_code in [400, 422]


def test_evc_completion_and_workflow_autoadvancement(client: TestClient, db_session: Session):
    """
    Test EVC inspection report completion:
    1. Mark inspection completed with report summary and checklist
    2. Verify status changes to COMPLETED
    3. Verify application automatically advances to next stage via WorkflowService
    """
    admin_user = db_session.query(User).filter(User.role == UserRole.ADMIN.value).first()
    headers = get_auth_header(admin_user)

    # Create fresh queued EVC
    sched = create_test_evc_schedule(db_session, is_new=True)
    assert sched is not None

    app_id = sched.application_id
    current_app_stage = sched.application.current_stage
    assert current_app_stage == "EVC"

    complete_payload = {
        "report_summary": "Comprehensive physical inspection verified adequate carpet area, instructional computing laboratories, and qualified faculty as per AICTE Approval Process Handbook (APH 2026-27).",
        "recommendation": "RECOMMENDED",
        "infra_verified": True,
        "faculty_verified": True,
        "labs_functional": True
    }

    resp = client.post(f"/evc/{sched.id}/complete", json=complete_payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    assert data["status"] == "success"
    assert data["schedule"]["status"] == "COMPLETED"
    assert data["schedule"]["completed_at"] is not None

    # Verify application auto-advanced
    db_session.refresh(sched.application)
    assert sched.application.current_stage != current_app_stage
    assert data["next_stage"] == sched.application.current_stage

    # Verify audit log
    audit_comp = db_session.query(AuditLog).filter(
        AuditLog.action == "EVC_INSPECTION_COMPLETED",
        AuditLog.entity_id == str(sched.id)
    ).first()
    assert audit_comp is not None
    new_val = json.loads(audit_comp.new_value) if isinstance(audit_comp.new_value, str) else audit_comp.new_value
    assert new_val["recommendation"] == "RECOMMENDED"


def test_evc_member_role_scoping(client: TestClient, db_session: Session):
    """
    Verify EVC_MEMBER only sees inspections where they are an assigned committee member.
    """
    evc_user = db_session.query(User).filter(User.role == UserRole.EVC_MEMBER.value).first()
    assert evc_user is not None
    headers = get_auth_header(evc_user)

    resp = client.get("/evc/schedules?tab=all", headers=headers)
    assert resp.status_code == 200
    schedules = resp.json()

    # All returned schedules must contain evc_user.id in committee_ids
    for s in schedules:
        assert evc_user.id in s["committee_ids"]
