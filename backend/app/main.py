"""
Main FastAPI Application Entrypoint for IntelliApprove.
AICTE Approval Workflow Automation, Compliance Monitoring & Alert Management System.
(SIH 2026, Problem Statement 26262)
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.api.v1.api import api_router
from app.api.v1.auth import router as auth_router
from app.api.v1.applications import router as applications_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.evc import router as evc_router
from app.api.v1.undertakings import router as undertakings_router
from app.api.v1.documents import router as documents_router
from app.api.v1.alerts import router as alerts_router
from app.api.v1.system_clock import router as system_clock_router
from app.services.scheduler_service import start_scheduler, shutdown_scheduler
from app.seed import seed_database

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown hooks."""
    print("Initializing database and seeding baseline data...")
    seed_database()
    
    if settings.ENABLE_SCHEDULER:
        start_scheduler()
        
    yield
    
    if settings.ENABLE_SCHEDULER:
        shutdown_scheduler()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.PROJECT_VERSION,
    description="Integrated AICTE Approval Workflow Automation, Compliance Monitoring and Alert Management System (SIH 2026, PS 26262)",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API v1 Router and direct /auth, /applications Routers
app.include_router(api_router, prefix=settings.API_V1_STR)
app.include_router(auth_router, prefix="/auth", tags=["Auth Direct"])
app.include_router(applications_router, prefix="/applications", tags=["Applications Direct"])
app.include_router(dashboard_router, prefix="/dashboard", tags=["Dashboard Direct"])
app.include_router(evc_router, prefix="/evc", tags=["EVC Direct"])
app.include_router(undertakings_router, prefix="/undertakings", tags=["Undertakings Direct"])
app.include_router(documents_router, prefix="/documents", tags=["Documents Direct"])
app.include_router(alerts_router, prefix="/alerts", tags=["Alerts Direct"])
app.include_router(alerts_router, prefix="/notifications", tags=["Notifications Direct"])
app.include_router(system_clock_router, prefix="/system/clock", tags=["System Clock Direct"])
app.include_router(system_clock_router, prefix="/clock", tags=["Clock Direct"])

@app.get("/")
def root():
    return {
        "system": "IntelliApprove",
        "description": "AICTE Approval Workflow Automation Platform",
        "version": settings.PROJECT_VERSION,
        "docs_url": "/docs",
        "status": "operational"
    }

@app.get("/health")
@app.get("/api/v1/health")
def health_check():
    return {
        "status": "healthy",
        "scheduler_enabled": settings.ENABLE_SCHEDULER,
        "database": "connected"
    }
