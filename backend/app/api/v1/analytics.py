"""
Analytics, Compliance Benchmarking, and Reporting Endpoints.
Provides high-level executive metrics, stage funnel, SLA compliance,
deficiency distributions, regional rankings, and CSV export.
"""
import io
import csv
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.entities import (
    User,
    UserRole,
    Application,
    Institution,
    Region,
    Undertaking,
    Escalation,
    ComplianceNormRule,
    DeficiencyRecord
)
from app.core.scoping import scope_applications_by_role, scope_undertakings_by_role

router = APIRouter()

@router.get("/dashboard")
def get_dashboard_metrics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Provides aggregated performance and workflow indicators for the dashboard."""
    query = scope_applications_by_role(db.query(Application), current_user, db)

    total_apps = query.count()
    approved = query.filter(Application.status == "APPROVED").count()
    rejected = query.filter(Application.status == "REJECTED").count()
    under_scrutiny = query.filter(Application.current_stage == "SCRUTINY").count()
    under_evc = query.filter(Application.current_stage == "EVC").count()
    pending_authority = query.filter(Application.current_stage.in_(["BUREAU_DECISION", "SAC_SHC"])).count()
    sla_breaches = query.filter(Application.status == "ESCALATED").count()

    # Average compliance score
    avg_score_res = query.with_entities(func.avg(Application.compliance_score)).scalar()
    avg_score = round(float(avg_score_res), 1) if avg_score_res else 84.5

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
    recent_escalations = db.query(Escalation).order_by(Escalation.created_at.desc()).limit(5).all()
    escalation_list = [
        {
            "id": e.id,
            "application_id": e.entity_id,
            "entity_type": e.entity_type,
            "level": e.level,
            "escalated_to": e.escalated_to,
            "reason": e.reason,
            "created_at": e.created_at.isoformat() if e.created_at else None
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

@router.get("/deficiency-report")
def get_national_deficiency_report(
    region_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Synthesizes nationwide AICTE Approval Process Handbook (APH) deficiency statistics,
    breakdowns by category, severity, and regional distribution.
    """
    total_deficiencies = db.query(DeficiencyRecord).count()
    rectified_count = db.query(DeficiencyRecord).filter(DeficiencyRecord.is_rectified == True).count()
    pending_count = total_deficiencies - rectified_count

    # By Severity
    critical_count = db.query(DeficiencyRecord).filter(DeficiencyRecord.severity == "CRITICAL", DeficiencyRecord.is_rectified == False).count()
    major_count = db.query(DeficiencyRecord).filter(DeficiencyRecord.severity == "MAJOR", DeficiencyRecord.is_rectified == False).count()
    minor_count = db.query(DeficiencyRecord).filter(DeficiencyRecord.severity == "MINOR", DeficiencyRecord.is_rectified == False).count()

    # Rule frequency ranking
    rule_counts = db.query(
        ComplianceNormRule.rule_code,
        ComplianceNormRule.name,
        ComplianceNormRule.category,
        ComplianceNormRule.severity,
        func.count(DeficiencyRecord.id).label("count")
    ).outerjoin(DeficiencyRecord, ComplianceNormRule.rule_code == DeficiencyRecord.rule_code)\
     .group_by(ComplianceNormRule.rule_code, ComplianceNormRule.name, ComplianceNormRule.category, ComplianceNormRule.severity)\
     .order_by(func.count(DeficiencyRecord.id).desc())\
     .all()

    rule_rankings = [
        {
            "rule_code": r[0],
            "name": r[1],
            "category": r[2],
            "severity": r[3],
            "deficiency_count": r[4]
        }
        for r in rule_counts
    ]

    # Category Breakdown
    cat_counts: Dict[str, int] = {}
    for r in rule_rankings:
        cat = r["category"]
        cat_counts[cat] = cat_counts.get(cat, 0) + r["deficiency_count"]
    category_breakdown = [{"category": k, "count": v} for k, v in cat_counts.items()]

    # Regional Deficiency Breakdown
    regional_counts = db.query(
        Region.name,
        func.count(DeficiencyRecord.id)
    ).join(Application, DeficiencyRecord.application_id == Application.id)\
     .join(Region, Application.region_id == Region.id)\
     .group_by(Region.name)\
     .order_by(func.count(DeficiencyRecord.id).desc())\
     .all()

    regional_deficiencies = [
        {"region": r[0], "deficiency_count": r[1]}
        for r in regional_counts
    ]

    # Top Deficient Applications
    top_apps = db.query(Application).filter(Application.deficiency_count > 0)\
                 .order_by(Application.deficiency_count.desc(), Application.compliance_score.asc())\
                 .limit(10).all()

    top_deficient_institutions = [
        {
            "application_id": app.id,
            "ref_no": app.ref_no,
            "institution_name": app.institution.name if app.institution else "Unknown",
            "state": app.institution.state if app.institution else "N/A",
            "region": app.region.name if app.region else "N/A",
            "deficiency_count": app.deficiency_count,
            "compliance_score": app.compliance_score,
            "current_stage": app.current_stage,
            "status": app.status
        }
        for app in top_apps
    ]

    return {
        "summary": {
            "total_deficiencies": total_deficiencies,
            "rectified_count": rectified_count,
            "pending_count": pending_count,
            "rectification_rate": round((rectified_count / max(total_deficiencies, 1)) * 100, 1),
            "critical_unresolved": critical_count,
            "major_unresolved": major_count,
            "minor_unresolved": minor_count
        },
        "category_breakdown": category_breakdown,
        "rule_rankings": rule_rankings,
        "regional_deficiencies": regional_deficiencies,
        "top_deficient_institutions": top_deficient_institutions
    }

@router.get("/export-csv")
def export_applications_csv(
    current_user: User = Depends(require_roles([UserRole.ADMIN.value, UserRole.BUREAU_OFFICER.value, UserRole.REGIONAL_HEAD.value, UserRole.REGIONAL_OFFICER.value])),
    db: Session = Depends(get_db)
):
    """
    Exports a comprehensive CSV data dump of all applications, compliance scores,
    and stage statuses for MIS reporting.
    """
    apps = scope_applications_by_role(db.query(Application), current_user, db).all()

    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        "Ref No",
        "Institution Name",
        "State",
        "Region",
        "Application Type",
        "Current Stage",
        "Status",
        "Compliance Score (%)",
        "Deficiencies Count",
        "Risk Score",
        "Submitted Date",
        "SLA Due Date"
    ])

    for a in apps:
        writer.writerow([
            a.ref_no,
            a.institution.name if a.institution else "N/A",
            a.institution.state if a.institution else "N/A",
            a.region.name if a.region else "N/A",
            a.application_type,
            a.current_stage,
            a.status,
            f"{a.compliance_score:.1f}",
            a.deficiency_count,
            f"{a.risk_score:.2f}",
            a.submitted_at.strftime("%Y-%m-%d") if a.submitted_at else "N/A",
            a.due_date.strftime("%Y-%m-%d") if a.due_date else "N/A"
        ])

    csv_data = output.getvalue()
    output.close()

    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=AICTE_IntelliApprove_Applications_Report.csv"
        }
    )
