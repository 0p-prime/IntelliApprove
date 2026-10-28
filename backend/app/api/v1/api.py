"""
API v1 Router aggregation.
"""
from fastapi import APIRouter
from app.api.v1 import (
    auth,
    applications,
    workflow,
    compliance,
    documents,
    undertakings,
    alerts,
    config,
    audit,
    analytics,
    dashboard,
    institutions
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Real-Time Dashboard"])
api_router.include_router(applications.router, prefix="/applications", tags=["Applications"])
api_router.include_router(workflow.router, prefix="/workflow", tags=["Workflow Execution"])
api_router.include_router(compliance.router, prefix="/compliance", tags=["Compliance & Deficiencies"])
api_router.include_router(documents.router, prefix="/documents", tags=["Documents"])
api_router.include_router(undertakings.router, prefix="/undertakings", tags=["Undertakings"])
api_router.include_router(alerts.router, prefix="/alerts", tags=["Alerts & Escalations"])
api_router.include_router(config.router, prefix="/config", tags=["Dynamic Configuration"])
api_router.include_router(audit.router, prefix="/audit", tags=["Audit Trail"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["Analytics & Dashboard"])
api_router.include_router(institutions.router, prefix="/institutions", tags=["Institutions"])
