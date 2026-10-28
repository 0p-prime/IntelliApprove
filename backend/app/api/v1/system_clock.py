"""
System Clock Simulation & Time Travel API.
Enables judges and evaluators to fast-forward simulated system time (+1d, +7d, +30d, etc.)
and immediately witness dynamic status shifts, SLA breach escalations,
alert notifications, and immutable audit logs.
"""
from datetime import datetime, timezone, timedelta
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, get_client_ip
from app.models.entities import SystemClock, User, AuditLog
from app.schemas.all_schemas import (
    SystemClockOut,
    SystemClockAdvanceIn,
    SystemClockSetIn
)
from app.services.alert_engine import evaluate_all_alert_rules, get_simulated_or_real_now
from app.services.audit_service import AuditService

router = APIRouter()


def _get_or_create_clock(db: Session) -> SystemClock:
    clock = db.query(SystemClock).first()
    if not clock:
        clock = SystemClock(simulated_date=datetime.now(timezone.utc))
        db.add(clock)
        db.commit()
        db.refresh(clock)
    return clock


def _build_clock_response(clock: SystemClock) -> Dict[str, Any]:
    real_now = datetime.now(timezone.utc)
    sim_date = clock.simulated_date
    if sim_date.tzinfo is None:
        sim_date = sim_date.replace(tzinfo=timezone.utc)
    
    delta = (sim_date - real_now).total_seconds() / 86400.0
    is_sim = abs(delta) > 0.001  # more than ~1.5 minutes difference

    return {
        "id": clock.id,
        "simulated_date": sim_date,
        "is_simulated": is_sim,
        "real_date": real_now,
        "delta_days": round(delta, 2)
    }


@router.get("", response_model=SystemClockOut)
@router.get("/current", response_model=SystemClockOut)
def get_system_clock(db: Session = Depends(get_db)):
    """Retrieve current simulated clock date and delta compared to real UTC time."""
    clock = _get_or_create_clock(db)
    return _build_clock_response(clock)


@router.post("/advance")
def advance_system_clock(
    payload: SystemClockAdvanceIn,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fast-forward simulated time by given days/hours.
    Instantly runs the full alert & escalation evaluation engine.
    Writes immutable audit log.
    """
    clock = _get_or_create_clock(db)
    old_time = clock.simulated_date
    if old_time.tzinfo is None:
        old_time = old_time.replace(tzinfo=timezone.utc)

    delta_to_add = timedelta(days=payload.days or 0, hours=payload.hours or 0)
    if delta_to_add.total_seconds() == 0:
        delta_to_add = timedelta(days=1)  # Default +1 day if nothing specified

    new_time = old_time + delta_to_add
    clock.simulated_date = new_time
    db.commit()
    db.refresh(clock)

    client_ip = get_client_ip(request)

    # Non-Negotiable Rule #1: Audit log
    AuditService.log(
        db=db,
        action="SYSTEM_CLOCK_ADVANCED",
        entity_type="SYSTEM_CLOCK",
        entity_id=str(clock.id),
        user=current_user,
        old_value={"simulated_date": old_time.isoformat()},
        new_value={"simulated_date": new_time.isoformat(), "advanced_days": payload.days, "advanced_hours": payload.hours},
        details=f"Evaluator fast-forwarded system clock by {payload.days or 0}d {payload.hours or 0}h to {new_time.strftime('%Y-%m-%d %H:%M UTC')}.",
        ip_address=client_ip
    )

    # Trigger comprehensive alert & escalation engine immediately
    eval_res = evaluate_all_alert_rules(db=db, actor_user=current_user, client_ip=client_ip)

    clock_info = _build_clock_response(clock)
    return {
        "status": "success",
        "clock": clock_info,
        "evaluation": eval_res
    }


@router.post("/set")
def set_system_clock(
    payload: SystemClockSetIn,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Set simulated clock to an exact target date.
    Triggers alert rules and logs audit entry.
    """
    clock = _get_or_create_clock(db)
    old_time = clock.simulated_date
    new_time = payload.target_date
    if new_time.tzinfo is None:
        new_time = new_time.replace(tzinfo=timezone.utc)

    clock.simulated_date = new_time
    db.commit()
    db.refresh(clock)

    client_ip = get_client_ip(request)

    AuditService.log(
        db=db,
        action="SYSTEM_CLOCK_SET",
        entity_type="SYSTEM_CLOCK",
        entity_id=str(clock.id),
        user=current_user,
        old_value={"simulated_date": old_time.isoformat() if hasattr(old_time, 'isoformat') else str(old_time)},
        new_value={"simulated_date": new_time.isoformat()},
        details=f"System clock explicitly set to {new_time.strftime('%Y-%m-%d %H:%M UTC')}.",
        ip_address=client_ip
    )

    eval_res = evaluate_all_alert_rules(db=db, actor_user=current_user, client_ip=client_ip)
    clock_info = _build_clock_response(clock)

    return {
        "status": "success",
        "clock": clock_info,
        "evaluation": eval_res
    }


@router.post("/reset")
def reset_system_clock(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Reset simulated clock back to the current real UTC time.
    """
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
        details="System clock reset to real-time UTC.",
        ip_address=client_ip
    )

    eval_res = evaluate_all_alert_rules(db=db, actor_user=current_user, client_ip=client_ip)
    clock_info = _build_clock_response(clock)

    return {
        "status": "success",
        "clock": clock_info,
        "evaluation": eval_res
    }

