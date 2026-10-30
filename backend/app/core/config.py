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
    
    # Database: Default SQLite fallback for local demo, override with DATABASE_URL for Postgres (Supabase, Neon, Render, Railway)
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{DEFAULT_DB_PATH}")

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        url = self.DATABASE_URL
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        return url
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*"
    ]
    
    # Scheduler & Alerts
    ENABLE_SCHEDULER: bool = True
    SLA_CHECK_INTERVAL_SECONDS: int = 30  # run SLA check every 30s in demo
    ALERT_EVAL_INTERVAL_SECONDS: int = 60 # APScheduler alert evaluation interval (every 1 minute)
    
    # Notification Channels (SMTP / Mailtrap / Mock SMS)
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM: str = os.getenv("SMTP_FROM", "alerts@aicte.gov.in")
    ENABLE_EXTERNAL_CHANNELS: bool = True
    
    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()
