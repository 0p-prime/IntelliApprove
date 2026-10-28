"""
Configurable Workflow and Escalation models.
Per Rule #3: All timelines, stage routes, reminder offsets and escalation ladders are CONFIGURABLE data in DB.
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base

class StageConfig(Base):
    __tablename__ = "stage_configs"
    
    id = Column(Integer, primary_key=True, index=True)
    stage_key = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    order_sequence = Column(Integer, nullable=False)
    sla_hours = Column(Integer, default=72)  # Configurable SLA for this stage
    assigned_role = Column(String(50), nullable=False)  # Role responsible
    can_flag_deficiencies = Column(Boolean, default=False)
    is_terminal = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class WorkflowRoute(Base):
    __tablename__ = "workflow_routes"
    
    id = Column(Integer, primary_key=True, index=True)
    from_stage_id = Column(Integer, ForeignKey("stage_configs.id", ondelete="CASCADE"), nullable=False)
    to_stage_id = Column(Integer, ForeignKey("stage_configs.id", ondelete="CASCADE"), nullable=False)
    action_name = Column(String(100), nullable=False)  # e.g., "Submit", "Recommend for EVC", "Grant Approval"
    required_role = Column(String(50), nullable=False)  # Role authorized to take this action
    requires_human_badge = Column(Boolean, default=True)  # Highlight Human Oversight Requirement
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    # Relationships
    from_stage = relationship("StageConfig", foreign_keys=[from_stage_id])
    to_stage = relationship("StageConfig", foreign_keys=[to_stage_id])

class EscalationLadder(Base):
    __tablename__ = "escalation_ladders"
    
    id = Column(Integer, primary_key=True, index=True)
    stage_id = Column(Integer, ForeignKey("stage_configs.id", ondelete="CASCADE"), nullable=False)
    stage_name = Column(String(100), nullable=True)
    sla_hours = Column(Integer, nullable=False, default=72)
    first_reminder_hours_before = Column(Integer, default=24)   # Reminder T - 24 hours
    second_reminder_hours_before = Column(Integer, default=6)   # Reminder T - 6 hours
    escalate_to_role = Column(String(50), nullable=False)       # Escalation recipient (e.g. REGIONAL_OFFICER, COMPETENT_AUTHORITY)
    escalate_action = Column(String(100), default="SEND_HIGH_PRIORITY_ESCALATION_ALERT")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    # Relationships
    stage = relationship("StageConfig")
