"""
Delay Risk Scoring Service: Computes an explainable, transparent 0-100 risk score
for in-progress applications using a weighted multi-factor formula:
1. Current Ageing vs Stage SLA (30% weight)
2. Regional / Stage Historical Dwell Benchmark (20% weight)
3. Officer Workload Backlog (20% weight)
4. Return / Revert Count (15% weight)
5. New-Institution Statutory Complexity Flag (15% weight)
"""
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_

from app.models.entities import (
    Application,
    Institution,
    Region,
    User,
    StageHistory,
    SystemClock
)
from app.api.v1.evc import get_system_now

STAGE_SLA_DAYS = {
    "SUBMITTED": 3,
    "SCRUTINY": 7,
    "EVC": 15,
    "SAC_SHC": 7,
    "BUREAU_DECISION": 5,
    "APPROVED": 0,
    "REJECTED": 0,
}

STAGE_REGIONAL_AVERAGES = {
    "SCRUTINY": 8.5,
    "EVC": 16.0,
    "SAC_SHC": 6.8,
    "BUREAU_DECISION": 4.5,
    "SUBMITTED": 2.5,
}


class RiskService:
    @staticmethod
    def compute_risk_score(db: Session, application: Application) -> Dict[str, Any]:
        """
        Computes the explainable delay risk score (0-100) and returns the full
        contributing factors breakdown.
        """
        now = get_system_now(db)
        is_terminal = application.status in ["APPROVED", "REJECTED"] or application.current_stage in ["APPROVED", "REJECTED"]

        if is_terminal:
            return {
                "application_id": application.id,
                "ref_no": application.ref_no,
                "risk_score": 0.0,
                "risk_level": "LOW",
                "formula": "Terminal stage — no ongoing delay risk",
                "factors": [],
                "is_terminal": True
            }

        stage_key = (application.current_stage or "SCRUTINY").upper()
        stage_sla = STAGE_SLA_DAYS.get(stage_key, 7)
        dwell_days = max(0, (now - application.stage_entered_at).days) if application.stage_entered_at else 0

        # --- Factor 1: Current Ageing vs Stage SLA (Weight: 30%) ---
        ratio = dwell_days / max(stage_sla, 1)
        if ratio <= 0.5:
            f1_pts = round(ratio * 12, 1)
            f1_desc = f"Current dwell time ({dwell_days}d) is well within stage SLA of {stage_sla}d ({round(ratio*100)}%)."
        elif ratio <= 1.0:
            f1_pts = round(12 + (ratio - 0.5) * 16, 1)
            f1_desc = f"Approaching stage SLA limit: {dwell_days}d of {stage_sla}d SLA consumed ({round(ratio*100)}%)."
        elif ratio <= 1.5:
            f1_pts = round(20 + (ratio - 1.0) * 16, 1)
            f1_desc = f"SLA Breach: Current dwell time ({dwell_days}d) exceeds statutory stage SLA of {stage_sla}d."
        else:
            f1_pts = 30.0
            f1_desc = f"Severe SLA Breach: {dwell_days}d spent in {stage_key} stage (>150% of {stage_sla}d SLA)."

        f1_pts = min(30.0, max(0.0, f1_pts))

        # --- Factor 2: Regional Benchmark Dwell Comparison (Weight: 20%) ---
        hist_avg = STAGE_REGIONAL_AVERAGES.get(stage_key, 8.0)
        reg_name = application.region.name if application.region else "National"
        if dwell_days > hist_avg * 1.25:
            f2_pts = 20.0
            f2_desc = f"Dwell time ({dwell_days}d) significantly exceeds historical {reg_name} benchmark average of {hist_avg}d."
        elif dwell_days > hist_avg:
            f2_pts = 14.0
            f2_desc = f"Dwell time ({dwell_days}d) is above the regional historical average of {hist_avg}d for {stage_key}."
        elif dwell_days > hist_avg * 0.7:
            f2_pts = 8.0
            f2_desc = f"Dwell time ({dwell_days}d) is near regional baseline of {hist_avg}d."
        else:
            f2_pts = 3.0
            f2_desc = f"Dwell time ({dwell_days}d) is faster than regional benchmark average of {hist_avg}d."

        # --- Factor 3: Assigned Officer Workload Backlog (Weight: 20%) ---
        officer_id = application.assigned_officer_id
        if officer_id:
            officer = db.query(User).filter(User.id == officer_id).first()
            active_cases_count = db.query(func.count(Application.id)).filter(
                Application.assigned_officer_id == officer_id,
                ~Application.status.in_(["APPROVED", "REJECTED"])
            ).scalar() or 0

            officer_name = officer.name if officer else f"Officer #{officer_id}"
            if active_cases_count >= 15:
                f3_pts = 20.0
                f3_desc = f"Critical Workload: {officer_name} carries {active_cases_count} active cases (threshold: 15)."
            elif active_cases_count >= 10:
                f3_pts = 14.0
                f3_desc = f"Elevated Workload: {officer_name} carries {active_cases_count} active cases."
            elif active_cases_count >= 5:
                f3_pts = 8.0
                f3_desc = f"Normal Workload: {officer_name} carries {active_cases_count} active cases."
            else:
                f3_pts = 3.0
                f3_desc = f"Optimal Workload: {officer_name} has only {active_cases_count} active cases."
        else:
            f3_pts = 15.0
            f3_desc = "Unassigned Desk: Application has no dedicated scrutiny officer assigned."

        # --- Factor 4: Return / Revert Count (Weight: 15%) ---
        return_count = db.query(func.count(StageHistory.id)).filter(
            StageHistory.application_id == application.id,
            or_(
                StageHistory.action.ilike("%RETURN%"),
                StageHistory.action.ilike("%REVERT%"),
                StageHistory.stage == "RETURNED"
            )
        ).scalar() or 0

        if return_count >= 2:
            f4_pts = 15.0
            f4_desc = f"High Deficiency Recurrence: Application returned {return_count} times for rectification."
        elif return_count == 1:
            f4_pts = 10.0
            f4_desc = "Single Revert: Case was previously returned once for deficiency clarification."
        else:
            f4_pts = 0.0
            f4_desc = "Clean Lifecycle: Case has proceeded without deficiency returns."

        # --- Factor 5: New-Institution Flag (Weight: 15%) ---
        is_new_inst = bool(application.institution and application.institution.is_new)
        if is_new_inst:
            f5_pts = 15.0
            f5_desc = "New Technical Institution: Requires comprehensive physical land, lab cadre, and NOC verification."
        else:
            f5_pts = 2.0
            f5_desc = "Established Institution: Extension of Approval (EoA) with prior verified track record."

        total_score = round(f1_pts + f2_pts + f3_pts + f4_pts + f5_pts, 1)
        total_score = min(100.0, max(0.0, total_score))

        if total_score >= 70.0:
            risk_level = "HIGH"
        elif total_score >= 40.0:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"

        factors = [
            {
                "name": "Stage SLA Consumption",
                "weight": 30,
                "score": f1_pts,
                "percentage": round((f1_pts / 30.0) * 100),
                "severity": "HIGH" if f1_pts >= 20 else "MEDIUM" if f1_pts >= 12 else "LOW",
                "details": f1_desc,
            },
            {
                "name": "Regional Historical Dwell Benchmark",
                "weight": 20,
                "score": f2_pts,
                "percentage": round((f2_pts / 20.0) * 100),
                "severity": "HIGH" if f2_pts >= 16 else "MEDIUM" if f2_pts >= 10 else "LOW",
                "details": f2_desc,
            },
            {
                "name": "Assigned Officer Workload",
                "weight": 20,
                "score": f3_pts,
                "percentage": round((f3_pts / 20.0) * 100),
                "severity": "HIGH" if f3_pts >= 15 else "MEDIUM" if f3_pts >= 10 else "LOW",
                "details": f3_desc,
            },
            {
                "name": "Deficiency Return Frequency",
                "weight": 15,
                "score": f4_pts,
                "percentage": round((f4_pts / 15.0) * 100),
                "severity": "HIGH" if f4_pts >= 12 else "MEDIUM" if f4_pts >= 8 else "LOW",
                "details": f4_desc,
            },
            {
                "name": "Institutional Complexity (New vs Existing)",
                "weight": 15,
                "score": f5_pts,
                "percentage": round((f5_pts / 15.0) * 100),
                "severity": "HIGH" if f5_pts >= 12 else "LOW",
                "details": f5_desc,
            },
        ]

        # Primary risk driver
        primary_driver = max(factors, key=lambda f: f["percentage"])

        return {
            "application_id": application.id,
            "ref_no": application.ref_no,
            "institution_name": application.institution.name if application.institution else "N/A",
            "region_name": application.region.name if application.region else "N/A",
            "current_stage": application.current_stage,
            "status": application.status,
            "risk_score": total_score,
            "risk_level": risk_level,
            "primary_driver": primary_driver["name"],
            "primary_driver_details": primary_driver["details"],
            "formula": "Score = 0.30×StageSLA + 0.20×RegionalBenchmark + 0.20×OfficerWorkload + 0.15×ReturnCount + 0.15×NewInstitutionFlag",
            "factors": factors,
            "is_terminal": False,
            "computed_at": now.isoformat()
        }

    @staticmethod
    def get_high_risk_cases(
        db: Session,
        region_id: Optional[int] = None,
        limit: int = 10,
        current_user: Optional[User] = None
    ) -> List[Dict[str, Any]]:
        """
        Retrieves the top in-progress applications ranked by delay risk score,
        scoped by user role.
        """
        q = db.query(Application).filter(~Application.status.in_(["APPROVED", "REJECTED"]))

        if current_user:
            if current_user.role == "INSTITUTION":
                q = q.filter(Application.institution_id == current_user.institution_id)
            elif current_user.role in ["REGIONAL_OFFICER", "REGIONAL_HEAD"]:
                if current_user.region_id:
                    q = q.filter(Application.region_id == current_user.region_id)
        
        if region_id:
            q = q.filter(Application.region_id == region_id)

        apps = q.all()
        scored_apps = []

        for app in apps:
            risk_info = RiskService.compute_risk_score(db, app)
            scored_apps.append({
                "application_id": app.id,
                "ref_no": app.ref_no,
                "institution_name": app.institution.name if app.institution else "N/A",
                "region_name": app.region.name if app.region else "N/A",
                "current_stage": app.current_stage,
                "status": app.status,
                "due_date": app.due_date.strftime("%Y-%m-%d") if app.due_date else "—",
                "risk_score": risk_info["risk_score"],
                "risk_level": risk_info["risk_level"],
                "primary_driver": risk_info["primary_driver"],
                "primary_driver_details": risk_info["primary_driver_details"],
                "factors": risk_info["factors"]
            })

        # Sort descending by risk_score
        scored_apps.sort(key=lambda x: x["risk_score"], reverse=True)
        return scored_apps[:limit]

