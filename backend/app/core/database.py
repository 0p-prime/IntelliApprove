"""
Database connection and session management.
Supports PostgreSQL and SQLite fallback.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings

db_uri = settings.SQLALCHEMY_DATABASE_URI

# Engine configuration
connect_args = {}
engine_kwargs = {"pool_pre_ping": True}

if db_uri.startswith("sqlite"):
    connect_args["check_same_thread"] = False
else:
    # Production PostgreSQL pool sizing
    engine_kwargs["pool_size"] = 10
    engine_kwargs["max_overflow"] = 20

engine = create_engine(
    db_uri,
    connect_args=connect_args,
    **engine_kwargs
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """Dependency that yields a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
