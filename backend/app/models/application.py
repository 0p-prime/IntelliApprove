"""
Application and related models (redirected to app.models.entities).
"""
from app.models.entities import Application, EVCSchedule, Document, StageHistory, FileRecord

ApplicationDocument = Document
ApplicationStageHistory = StageHistory

class AcademicProgram:
    pass

__all__ = [
    "Application",
    "EVCSchedule",
    "Document",
    "StageHistory",
    "FileRecord",
    "ApplicationDocument",
    "ApplicationStageHistory",
    "AcademicProgram"
]
