"""
Core configuration settings for IntelliApprove backend.
Supports PostgreSQL with SQLite fallback via environment variables.
"""
from pydantic_settings import BaseSettings
from typing import List
from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DEFAULT_DB_PATH = (BASE_DIR / "intelliapprove.db").as_posix()

class Settings(BaseSettings):
    PROJECT_NAME: str = "IntelliApprove AICTE Approval Platform"
    PROJECT_VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "aicte_sih_2026_super_secret_jwt_key_98374283749234")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # Database: Default SQLite fallback for local demo, override with DATABASE_URL for Postgres
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{DEFAULT_DB_PATH}")
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*"
    ]
    
    # Scheduler
    ENABLE_SCHEDULER: bool = True
    SLA_CHECK_INTERVAL_SECONDS: int = 30  # run SLA check every 30s in demo
    
    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()
