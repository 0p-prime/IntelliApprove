"""
Background Scheduler Service using APScheduler.
Monitors SLA deadlines, triggers configured reminder offsets,
and executes escalation ladders stored in the database.
Enforces Rule #1: Every escalation and state change writes an audit_logs entry.
"""
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.core.config import settings
from app.services.alert_engine import evaluate_all_alert_rules

scheduler = BackgroundScheduler()


def check_sla_breaches_and_escalations():
    """
    Periodic job: Evaluates ALL alert rules across Applications, EVC schedules,
    Undertakings, and Documents against current simulated date.
    """
    db: Session = SessionLocal()
    try:
        res = evaluate_all_alert_rules(db=db, client_ip="127.0.0.1")
        print(f"[Scheduler] Alert rules evaluated: {res['notifications_created']} notifs, {res['escalations_created']} escs created.")
    except Exception as e:
        db.rollback()
        print(f"[Scheduler Error] Background alert check failed: {e}")
    finally:
        db.close()


def start_scheduler():
    """Start background scheduler if not already running."""
    if not scheduler.running:
        interval_sec = settings.ALERT_EVAL_INTERVAL_SECONDS or 60
        scheduler.add_job(
            check_sla_breaches_and_escalations,
            'interval',
            seconds=interval_sec,
            id='sla_breach_monitor',
            replace_existing=True
        )
        scheduler.start()
        print(f"[Scheduler] APScheduler started (evaluating alert_rules every {interval_sec}s).")


def shutdown_scheduler():
    """Stop background scheduler."""
    if scheduler.running:
        scheduler.shutdown()
        print("[Scheduler] APScheduler stopped.")
