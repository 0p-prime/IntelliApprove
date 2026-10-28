"""
Alert and Escalation models (redirected to app.models.entities).
"""
from app.models.entities import AlertRule, Notification, Escalation

Alert = Notification
EscalationEvent = Escalation

__all__ = ["AlertRule", "Notification", "Escalation", "Alert", "EscalationEvent"]
