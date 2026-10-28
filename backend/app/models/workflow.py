"""
Workflow models (redirected to app.models.entities).
"""
from app.models.entities import WorkflowTemplate, StageHistory

class StageConfig:
    pass

class WorkflowRoute:
    pass

class EscalationLadder:
    pass

__all__ = [
    "WorkflowTemplate",
    "StageHistory",
    "StageConfig",
    "WorkflowRoute",
    "EscalationLadder"
]
