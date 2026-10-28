"""
Global Time Travel & Clock Utility.
Centralized source of current time for all IntelliApprove date computations.
Respects simulated date from system_clock table.
"""
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.entities import SystemClock


def get_current_datetime(db: Optional[Session] = None) -> datetime:
    """
    Returns the current simulated datetime if system_clock has a simulated_date;
    otherwise returns UTC wall-clock time.
    Ensures datetime is timezone-aware in UTC.
    """
    close_db = False
    if db is None:
        db = SessionLocal()
        close_db = True

    try:
        clock = db.query(SystemClock).first()
        if clock and clock.simulated_date:
            d = clock.simulated_date
            return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
        return datetime.now(timezone.utc)
    except Exception:
        return datetime.now(timezone.utc)
    finally:
        if close_db:
            db.close()


def get_current_date(db: Optional[Session] = None) -> datetime:
    """
    Alias for get_current_datetime for API consistency.
    """
    return get_current_datetime(db)

