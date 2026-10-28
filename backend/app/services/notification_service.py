"""
Multi-Channel Notification Dispatcher.
Channels:
1. In-App Notification (Stored in notifications table with idempotency key)
2. Email via SMTP (Mailtrap / Production SMTP with console/log fallback)
3. Mock SMS / WhatsApp Adapter (Logs dispatched messages for vigilance & compliance)
"""
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.clock import get_current_datetime
from app.models.entities import Notification, User

logger = logging.getLogger("intelliapprove.notifications")

# In-memory buffer of external channel dispatches for auditing and tests
DISPATCH_HISTORY: List[Dict[str, Any]] = []


def send_email(to_email: str, subject: str, body: str) -> bool:
    """
    Sends email via configured SMTP (e.g. Mailtrap) or falls back to console logger.
    """
    record = {
        "channel": "EMAIL",
        "to": to_email,
        "subject": subject,
        "body": body,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status": "SENT"
    }

    if settings.SMTP_HOST and settings.SMTP_USER:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = settings.SMTP_FROM
            msg["To"] = to_email
            msg.attach(MIMEText(body, "plain"))

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=5) as server:
                server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_FROM, [to_email], msg.as_string())
            record["status"] = "DELIVERED_SMTP"
            print(f"[SMTP Mailer] Email sent to {to_email}: {subject}")
        except Exception as e:
            record["status"] = f"SMTP_FAILED: {str(e)}"
            print(f"[SMTP Mailer Error] Failed sending to {to_email}: {e}")
    else:
        # Dev / Console Logger mode
        record["status"] = "LOGGED_CONSOLE"
        if len(DISPATCH_HISTORY) < 20:
            print(f"[EMAIL DISPATCH] >>> To: {to_email} | Subject: {subject}")
        logger.info("[EMAIL DISPATCH] To: %s | Subject: %s", to_email, subject)

    DISPATCH_HISTORY.append(record)
    if len(DISPATCH_HISTORY) > 500:
        DISPATCH_HISTORY.pop(0)
    return True


def send_sms_whatsapp(phone: str, message: str, platform: str = "WHATSAPP") -> bool:
    """
    Mock SMS / WhatsApp Adapter.
    Logs structured communication payload for official regulatory compliance.
    """
    record = {
        "channel": platform,
        "to": phone,
        "message": message,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status": "DELIVERED_SIMULATED"
    }
    if len(DISPATCH_HISTORY) < 20:
        print(f"[{platform} ADAPTER] >>> To: {phone} | Status: DELIVERED | Message: {message[:80]}...")
    logger.info("[%s ADAPTER] To: %s | Status: DELIVERED", platform, phone)
    DISPATCH_HISTORY.append(record)
    if len(DISPATCH_HISTORY) > 500:
        DISPATCH_HISTORY.pop(0)
    return True


def dispatch_notification(
    db: Session,
    title: str,
    message: str,
    category: str,
    severity: str,
    user: Optional[User] = None,
    user_id: Optional[int] = None,
    link: Optional[str] = None,
    idempotency_key: Optional[str] = None,
    recipient_email: Optional[str] = None,
    recipient_phone: Optional[str] = None
) -> Optional[Notification]:
    """
    Centralized dispatcher:
    1. Enforces Idempotency (key per entity + rule + level)
    2. Persists In-App notification
    3. Triggers Email (SMTP / Log)
    4. Triggers Mock SMS / WhatsApp
    """
    now = get_current_datetime(db)

    # 1. Idempotency Check
    if idempotency_key:
        existing = db.query(Notification).filter(
            Notification.idempotency_key == idempotency_key
        ).first()
        if existing:
            # Duplicate suppressed
            return None

    target_user_id = user.id if user else user_id
    notif = Notification(
        user_id=target_user_id,
        title=title,
        message=message,
        category=category,
        severity=severity,
        link=link,
        channel="IN_APP",
        idempotency_key=idempotency_key,
        is_read=False,
        created_at=now
    )
    db.add(notif)
    db.flush()

    # 2. External Channels
    target_email = recipient_email or (user.email if user else None)
    target_phone = recipient_phone or (user.phone if (user and hasattr(user, 'phone')) else None)

    if settings.ENABLE_EXTERNAL_CHANNELS:
        if target_email:
            send_email(
                to_email=target_email,
                subject=f"[AICTE IntelliApprove - {severity}] {title}",
                body=f"{title}\n\n{message}\n\nDirect Portal Link: {link or '/dashboard'}\n\nAll India Council for Technical Education (AICTE)\nMinistry of Education, Govt. of India"
            )
        if target_phone:
            send_sms_whatsapp(
                phone=target_phone,
                message=f"[AICTE Alert] {title}: {message[:100]}... Access: {link or '/dashboard'}",
                platform="WHATSAPP"
            )

    return notif
