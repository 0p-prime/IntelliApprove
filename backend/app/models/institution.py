"""
Institution model representing educational entities applying for AICTE approval.
"""
from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base

class Institution(Base):
    __tablename__ = "institutions"
    
    id = Column(Integer, primary_key=True, index=True)
    aicte_id = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False)  # Engineering & Technology, Management, Pharmacy, etc.
    state = Column(String(100), nullable=False)
    region = Column(String(100), nullable=False)  # Northern, Southern, Western, etc.
    district = Column(String(100), nullable=True)
    address = Column(String(500), nullable=False)
    pin_code = Column(String(20), nullable=True)
    established_year = Column(Integer, nullable=False)
    trust_society_name = Column(String(255), nullable=False)
    head_of_institution_name = Column(String(255), nullable=False)
    head_email = Column(String(255), nullable=False)
    head_phone = Column(String(50), nullable=False)
    
    # Baseline Infrastructure Norms Data
    total_land_acres = Column(Float, default=5.0)
    total_builtup_sqm = Column(Float, default=12000.0)
    total_computers = Column(Integer, default=300)
    broadband_bandwidth_mbps = Column(Integer, default=500)
    has_anti_ragging_committee = Column(Integer, default=1)  # 1: Yes, 0: No
    has_icc_committee = Column(Integer, default=1)
    has_grievance_committee = Column(Integer, default=1)
    has_sc_st_cell = Column(Integer, default=1)
    has_barrier_free_environment = Column(Integer, default=1)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    # Relationships
    users = relationship("User", back_populates="institution")
    applications = relationship("Application", back_populates="institution")
