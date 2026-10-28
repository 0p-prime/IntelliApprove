"""
User and Role models.
Enforces role-based permissions across IntelliApprove.
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum
from app.core.database import Base

class UserRole(str, enum.Enum):
    INSTITUTION = "INSTITUTION"
    SCRUTINY_OFFICER = "SCRUTINY_OFFICER"
    EVC_INSPECTOR = "EVC_INSPECTOR"
    REGIONAL_OFFICER = "REGIONAL_OFFICER"
    COMPETENT_AUTHORITY = "COMPETENT_AUTHORITY"
    ADMIN = "ADMIN"

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default=UserRole.INSTITUTION.value)
    designation = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    institution_id = Column(Integer, ForeignKey("institutions.id", ondelete="SET NULL"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    # Relationships
    institution = relationship("Institution", back_populates="users")
