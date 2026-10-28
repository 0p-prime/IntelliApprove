"""
API Router for Explainable Delay Risk Scoring and High-Risk Pipeline Cases.
"""
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.entities import User, Application
from app.services.risk_service import RiskService

router = APIRouter(tags=["Delay Risk Scoring"])


@router.get("/applications/{application_id}/risk-score")
def get_application_risk_score(
    application_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Computes and returns the explainable 0-100 delay risk score for an application
    along with its 5 contributing factors, weights, and primary risk driver.
    """
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    # RBAC Scoping
    if current_user.role == "INSTITUTION" and app.institution_id != current_user.institution_id:
        raise HTTPException(status_code=403, detail="Access forbidden: cannot view risk score of other institutions")
    if current_user.role in ["REGIONAL_OFFICER", "REGIONAL_HEAD"] and current_user.region_id and app.region_id != current_user.region_id:
        raise HTTPException(status_code=403, detail="Access forbidden: application is outside your region jurisdiction")

    return RiskService.compute_risk_score(db, app)


@router.get("/analytics/high-risk")
def get_high_risk_cases(
    region_id: Optional[int] = Query(None, description="Optional region filter"),
    limit: int = Query(10, ge=1, le=50, description="Max cases to return"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    """
    Returns in-progress applications with the highest risk of statutory delay,
    ranked by explainable score and scoped by user permissions.
    """
    return RiskService.get_high_risk_cases(
        db=db,
        region_id=region_id,
        limit=limit,
        current_user=current_user
    )


@router.get("/dashboard/high-risk")
def get_dashboard_high_risk(
    limit: int = Query(6, ge=1, le=20),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    """Dashboard widget shortcut for top high-risk bottleneck cases."""
    return RiskService.get_high_risk_cases(
        db=db,
        limit=limit,
        current_user=current_user
    )
