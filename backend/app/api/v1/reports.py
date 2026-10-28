"""
Statutory Reporting Endpoints.
Covers the 6 core AICTE Statutory Reports:
1. Application Pendency (by stage, region, ageing)
2. EVC Status (queued, scheduled, overdue, completed)
3. Undertaking Compliance (by institution, region)
4. Document Validity (expiring, expired, renewed)
5. Overdue Cases & Escalations
6. Region-wise Processing Performance

Non-Negotiable Rule #1: Every report generation and export writes an audit_logs entry.
"""
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, Query, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles, get_client_ip
from app.models.entities import User, UserRole
from app.services.audit_service import AuditService
from app.services.report_service import ReportService

router = APIRouter()


@router.get("/types")
def list_report_types():
    """Returns list of the 6 core AICTE statutory reports and descriptions."""
    return ReportService.get_available_reports()


@router.get("/{report_id}")
def generate_statutory_report(
    report_id: str,
    request: Request,
    region_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    stage: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user: User = Depends(require_roles([
        UserRole.ADMIN.value,
        UserRole.BUREAU_OFFICER.value,
        UserRole.REGIONAL_HEAD.value,
        UserRole.REGIONAL_OFFICER.value,
        UserRole.EVC_MEMBER.value
    ])),
    db: Session = Depends(get_db)
):
    """
    Generates structured statutory report with KPIs, chart data, and preview table.
    Enforces Rule #1: Writes an immutable audit_logs entry for every report generation.
    """
    try:
        report_data = ReportService.get_report(
            report_id=report_id,
            db=db,
            region_id=region_id,
            status_filter=status,
            stage_filter=stage,
            from_date=from_date,
            to_date=to_date,
            search=search,
            current_user=current_user
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    # Universal Rule #1: Audit logging
    AuditService.log(
        db=db,
        action="REPORT_GENERATED",
        entity_type="report",
        entity_id=report_id,
        user=current_user,
        old_value=None,
        new_value={"filters": {"region_id": region_id, "status": status, "stage": stage}},
        details=f"User {current_user.email} generated statutory report '{report_data.get('title')}'.",
        ip_address=get_client_ip(request)
    )
    db.commit()

    return report_data


@router.get("/{report_id}/export-csv")
def export_statutory_report_csv(
    report_id: str,
    request: Request,
    region_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    stage: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user: User = Depends(require_roles([
        UserRole.ADMIN.value,
        UserRole.BUREAU_OFFICER.value,
        UserRole.REGIONAL_HEAD.value,
        UserRole.REGIONAL_OFFICER.value,
        UserRole.EVC_MEMBER.value
    ])),
    db: Session = Depends(get_db)
):
    """
    Exports the statutory report to Excel-compatible CSV with official AICTE header.
    Enforces Rule #1: Writes an immutable audit_logs entry.
    """
    try:
        report_data = ReportService.get_report(
            report_id=report_id,
            db=db,
            region_id=region_id,
            status_filter=status,
            stage_filter=stage,
            from_date=from_date,
            to_date=to_date,
            search=search,
            current_user=current_user
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    csv_content = ReportService.export_csv(report_data)

    # Universal Rule #1: Audit logging
    AuditService.log(
        db=db,
        action="REPORT_EXPORTED_CSV",
        entity_type="report",
        entity_id=report_id,
        user=current_user,
        old_value=None,
        new_value={"format": "CSV", "total_rows": len(report_data.get("table_data", []))},
        details=f"User {current_user.email} exported CSV for statutory report '{report_data.get('title')}'.",
        ip_address=get_client_ip(request)
    )
    db.commit()

    filename = f"AICTE_Report_{report_id}_{report_data.get('generated_at', '')[:10]}.csv"

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )

