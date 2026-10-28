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

# Include API v1 Router
app.include_router(api_router, prefix=settings.API_V1_STR)

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
def health_check():
    return {
        "status": "healthy",
        "scheduler_enabled": settings.ENABLE_SCHEDULER,
        "database": "connected"
    }
