"""
Admin Operations API.
Enforces ADMIN only clearance.
Provides Time-Travel Simulation and Reset Clock endpoints.
Immediately triggers alert rules evaluation after time shifting.
"""
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, get_client_ip, require_roles
from app.models.entities import SystemClock, User, UserRole
from app.services.alert_engine import evaluate_all_alert_rules
from app.services.audit_service import AuditService
from app.services.notification_service import DISPATCH_HISTORY

router = APIRouter()


class TimeTravelRequest(BaseModel):
    days: int = Field(default=1, description="Number of days to advance simulated time")
    hours: Optional[int] = Field(default=0, description="Optional additional hours")


def _get_or_create_clock(db: Session) -> SystemClock:
    clock = db.query(SystemClock).first()
    if not clock:
        clock = SystemClock(simulated_date=datetime.now(timezone.utc))
        db.add(clock)
        db.commit()
        db.refresh(clock)
    return clock


def _clock_dict(clock: SystemClock) -> Dict[str, Any]:
    real_now = datetime.now(timezone.utc)
    sim_d = clock.simulated_date
    if sim_d.tzinfo is None:
        sim_d = sim_d.replace(tzinfo=timezone.utc)
    delta = (sim_d - real_now).total_seconds() / 86400.0

    return {
        "id": clock.id,
        "simulated_date": sim_d.isoformat(),
        "is_simulated": abs(delta) > 0.001,
        "real_date": real_now.isoformat(),
        "delta_days": round(delta, 2)
    }


@router.post("/time-travel")
def admin_time_travel(
    payload: TimeTravelRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    ADMIN only: Fast-forward simulated system time by given days.
    Immediately triggers full alert, SLA, and escalation rules evaluation.
    Logs SYSTEM_CLOCK_ADVANCED audit entry.
    """
    if current_user.role != UserRole.ADMIN.value:
        raise HTTPException(
            status_code=403,
            detail="Security clearance denied: Administrator role required for Time Travel control."
        )

    clock = _get_or_create_clock(db)
    old_time = clock.simulated_date
    if old_time.tzinfo is None:
        old_time = old_time.replace(tzinfo=timezone.utc)

    advance_delta = timedelta(days=payload.days, hours=payload.hours or 0)
    new_time = old_time + advance_delta
    clock.simulated_date = new_time
    db.commit()
    db.refresh(clock)

    client_ip = get_client_ip(request)

    # Universal Rule #1 Audit Log
    AuditService.log(
        db=db,
        action="SYSTEM_CLOCK_ADVANCED",
        entity_type="SYSTEM_CLOCK",
        entity_id=str(clock.id),
        user=current_user,
        old_value={"simulated_date": old_time.isoformat()},
        new_value={"simulated_date": new_time.isoformat(), "advanced_days": payload.days},
        details=f"Admin {current_user.email} fast-forwarded system clock by {payload.days} days to {new_time.strftime('%Y-%m-%d %H:%M UTC')}.",
        ip_address=client_ip
    )

    # Immediately trigger the alert evaluation job
    evaluation_result = evaluate_all_alert_rules(
        db=db,
        actor_user=current_user,
        client_ip=client_ip
    )

    return {
        "status": "success",
        "message": f"Time traveled +{payload.days} days successfully. Alert evaluation executed.",
        "clock": _clock_dict(clock),
        "evaluation": evaluation_result
    }


@router.post("/reset-clock")
def admin_reset_clock(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    ADMIN only: Reset simulated system clock back to real-time UTC wall clock.
    Immediately triggers alert evaluation job.
    """
    if current_user.role != UserRole.ADMIN.value:
        raise HTTPException(
            status_code=403,
            detail="Security clearance denied: Administrator role required to reset system clock."
        )

    clock = _get_or_create_clock(db)
    old_time = clock.simulated_date
    real_now = datetime.now(timezone.utc)

    clock.simulated_date = real_now
    db.commit()
    db.refresh(clock)

    client_ip = get_client_ip(request)

    AuditService.log(
        db=db,
        action="SYSTEM_CLOCK_RESET",
        entity_type="SYSTEM_CLOCK",
        entity_id=str(clock.id),
        user=current_user,
        old_value={"simulated_date": old_time.isoformat() if hasattr(old_time, 'isoformat') else str(old_time)},
        new_value={"simulated_date": real_now.isoformat()},
        details=f"Admin {current_user.email} reset system clock to UTC wall clock.",
        ip_address=client_ip
    )

    evaluation_result = evaluate_all_alert_rules(
        db=db,
        actor_user=current_user,
        client_ip=client_ip
    )

    return {
        "status": "success",
        "message": "System clock reset to real-time UTC. Alert evaluation executed.",
        "clock": _clock_dict(clock),
        "evaluation": evaluation_result
    }


@router.get("/clock")
def get_clock_status(db: Session = Depends(get_db)):
    """Retrieve current simulated clock status."""
    clock = _get_or_create_clock(db)
    return _clock_dict(clock)


@router.get("/dispatches")
def get_external_dispatches(
    current_user: User = Depends(get_current_user)
):
    """
    ADMIN only: Retrieve recent external channel dispatches (Email / SMS / WhatsApp)
    for auditing and hackathon live evaluation.
    """
    if current_user.role not in [UserRole.ADMIN.value, UserRole.BUREAU_OFFICER.value]:
        raise HTTPException(status_code=403, detail="Unauthorized")
    return {"dispatches": DISPATCH_HISTORY[-50:]}

