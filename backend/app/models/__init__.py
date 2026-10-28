"""
Database models export for IntelliApprove.
Exposes the 15 core tables matching the AICTE approval workflow specification.
"""
from app.core.database import Base
from app.models.entities import (
    UserRole,
    Region,
    User,
    Institution,
    WorkflowTemplate,
    Application,
    StageHistory,
    EVCSchedule,
    FileRecord,
    Undertaking,
    Document,
    AlertRule,
    Notification,
    Escalation,
    AuditLog,
    SystemClock,
    ComplianceNormRule,
    DeficiencyRecord,
    AcademicProgram,
)

__all__ = [
    "Base",
    "UserRole",
    "Region",
    "User",
    "Institution",
    "WorkflowTemplate",
    "Application",
    "StageHistory",
    "EVCSchedule",
    "FileRecord",
    "Undertaking",
    "Document",
    "AlertRule",
    "Notification",
    "Escalation",
    "AuditLog",
    "SystemClock",
    "ComplianceNormRule",
    "DeficiencyRecord",
    "AcademicProgram",
]
