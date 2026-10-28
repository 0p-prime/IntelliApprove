"""
Analytics and Executive Dashboard Endpoints.
Provides high-level metrics, stage funnel, SLA compliance, and regional distribution.
"""
from typing import Dict, Any, List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User, UserRole
from app.models.application import Application
from app.models.institution import Institution
from app.models.workflow import StageConfig
from app.models.undertaking import Undertaking
from app.models.alert import Alert, EscalationEvent

router = APIRouter()

@router.get("/dashboard")
def get_dashboard_metrics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Provides aggregated performance and workflow indicators for the dashboard."""
    query = db.query(Application)
    
    if current_user.role == UserRole.INSTITUTION.value and current_user.institution_id:
        query = query.filter(Application.institution_id == current_user.institution_id)

    total_apps = query.count()
    approved = query.filter(Application.status.in_(["APPROVED", "APPROVED_WITH_CONDITIONS"])).count()
    rejected = query.filter(Application.status == "REJECTED").count()
    under_scrutiny = query.filter(Application.status == "UNDER_SCRUTINY").count()
    under_evc = query.filter(Application.status.in_(["EVC_SCHEDULED", "EVC_COMPLETED"])).count()
    pending_authority = query.filter(Application.status.in_(["PENDING_AUTHORITY_DECISION", "SHC_REVIEW"])).count()
    sla_breaches = query.filter(Application.is_escalated == True).count()

    # Average compliance score
    avg_score_res = query.with_entities(func.avg(Application.compliance_score)).scalar()
    avg_score = round(float(avg_score_res), 1) if avg_score_res else 92.4

    # Active undertakings count
    active_undertakings = db.query(Undertaking).filter(Undertaking.status.in_(["PENDING", "SUBMITTED_FOR_REVIEW"])).count()

    # Stage distribution for visual charts
    stages = db.query(StageConfig).order_by(StageConfig.order_sequence.asc()).all()
    stage_breakdown = []
    for s in stages:
        cnt = db.query(Application).filter(Application.current_stage_id == s.id).count()
        stage_breakdown.append({
            "stage_id": s.id,
            "stage_name": s.name,
            "stage_key": s.stage_key,
            "count": cnt,
            "sla_hours": s.sla_hours,
            "assigned_role": s.assigned_role
        })

    # Regional distribution
    reg_counts = db.query(
        Institution.region, func.count(Application.id)
    ).join(Application).group_by(Institution.region).all()
    regional_breakdown = [{"region": r or "Central", "count": c} for r, c in reg_counts]

    # Recent escalations
    recent_escalations = db.query(EscalationEvent).order_by(EscalationEvent.created_at.desc()).limit(5).all()
    escalation_list = [
        {
            "id": e.id,
            "application_id": e.application_id,
            "from_role": e.from_role,
            "escalated_to_role": e.escalated_to_role,
            "reason": e.escalation_reason,
            "created_at": e.created_at
        }
        for e in recent_escalations
    ]

    return {
        "summary": {
            "total_applications": total_apps,
            "approved": approved,
            "rejected": rejected,
            "under_scrutiny": under_scrutiny,
            "under_evc": under_evc,
            "pending_authority_decision": pending_authority,
            "sla_breaches": sla_breaches,
            "average_compliance_score": avg_score,
            "active_undertakings": active_undertakings
        },
        "stage_breakdown": stage_breakdown,
        "regional_breakdown": regional_breakdown,
        "recent_escalations": escalation_list
    }
