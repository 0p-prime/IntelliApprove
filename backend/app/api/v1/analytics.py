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
    from app.core.scoping import scope_applications_by_role, scope_undertakings_by_role
    from app.models.entities import Region

    query = scope_applications_by_role(db.query(Application), current_user, db)

    total_apps = query.count()
    approved = query.filter(Application.status == "APPROVED").count()
    rejected = query.filter(Application.status == "REJECTED").count()
    under_scrutiny = query.filter(Application.current_stage == "SCRUTINY").count()
    under_evc = query.filter(Application.current_stage == "EVC").count()
    pending_authority = query.filter(Application.current_stage.in_(["BUREAU_DECISION", "SAC_SHC"])).count()
    sla_breaches = query.filter(Application.status == "ESCALATED").count()

    # Average risk score
    avg_score_res = query.with_entities(func.avg(Application.risk_score)).scalar()
    avg_score = round(float(avg_score_res), 1) if avg_score_res else 24.5

    # Active undertakings count
    undertakings_q = scope_undertakings_by_role(db.query(Undertaking), current_user, db)
    active_undertakings = undertakings_q.filter(Undertaking.status.in_(["PENDING", "DUE_SOON", "OVERDUE"])).count()

    # Stage distribution for visual charts
    all_stages = ["SUBMITTED", "SCRUTINY", "EVC", "SAC_SHC", "BUREAU_DECISION", "APPROVED", "REJECTED"]
    stage_breakdown = []
    for s_name in all_stages:
        cnt = query.filter(Application.current_stage == s_name).count()
        stage_breakdown.append({
            "stage_id": s_name,
            "stage_name": s_name.replace("_", " ").title(),
            "stage_key": s_name,
            "count": cnt,
            "sla_hours": 72,
            "assigned_role": "AICTE_COMMITTEE"
        })

    # Regional distribution
    reg_counts = db.query(
        Region.name, func.count(Application.id)
    ).join(Application, Region.id == Application.region_id).group_by(Region.name).all()
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
