"""
API Router for Integration with Existing AICTE Legacy Approval Portal.
Provides endpoints for bidirectional data synchronization, status pushes,
and OpenAPI-documented secure webhooks.
"""
from fastapi import APIRouter, Depends, HTTPException, Header, Query, Body
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.entities import User
from app.services.integration_service import IntegrationService

router = APIRouter(prefix="/integration", tags=["AICTE Portal Integration Adapter"])


class PushStatusRequest(BaseModel):
    application_id: int = Field(..., description="Application ID to synchronize to legacy portal")


class WebhookPayload(BaseModel):
    event_type: str = Field(..., description="Type of legacy portal event")
    ref_no: Optional[str] = Field(None, description="AICTE Application Reference Number")
    amount: Optional[int] = Field(None, description="Fee amount in INR if applicable")
    case_no: Optional[str] = Field(None, description="Court case reference if judicial order")
    details: Optional[str] = Field(None, description="Human readable description")
    timestamp: Optional[str] = Field(None, description="ISO timestamp of event from legacy portal")

    class Config:
        extra = "allow"


@router.get("/status")
def get_integration_adapter_status(
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Returns the real-time connectivity status, latency, protocol specs,
    and webhook listener configurations for the existing AICTE National Approval Portal.
    """
    return IntegrationService.get_adapter_status()


@router.post("/aicte-portal/sync-applications")
def sync_applications_from_legacy_portal(
    batch_size: int = Query(3, ge=1, le=10, description="Number of applications to pull"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "BUREAU_OFFICER"]))
) -> Dict[str, Any]:
    """
    Pulls batch of pending applications submitted through the legacy national
    AICTE portal into IntelliApprove pipeline buffer.
    """
    return IntegrationService.pull_applications_from_legacy_portal(
        db=db,
        batch_size=batch_size,
        current_user=current_user
    )


@router.post("/aicte-portal/push-status")
def push_status_to_legacy_portal(
    req: PushStatusRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "BUREAU_OFFICER", "REGIONAL_HEAD", "REGIONAL_OFFICER"]))
) -> Dict[str, Any]:
    """
    Pushes an application's current stage, status, and compliance score
    from IntelliApprove back to the legacy national portal with cryptographic checksum.
    """
    try:
        return IntegrationService.push_status_update_to_legacy_portal(
            db=db,
            application_id=req.application_id,
            current_user=current_user
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/webhooks/aicte-event")
def receive_legacy_portal_webhook(
    payload: WebhookPayload,
    x_aicte_signature: Optional[str] = Header(None, description="HMAC-SHA256 signature generated using shared secret"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    OpenAPI-documented webhook receiver for external AICTE legacy portal notifications.
    
    Accepts inbound notifications for:
    - `AFFILIATION_FEE_PAID`: Automatically clears fee requirements and notifies scrutiny officer.
    - `UNIVERSITY_NOC_ISSUED`: Attaches affiliating university clearance to case.
    - `COURT_STAY_ISSUED`: Enforces immediate judicial freeze and escalates to Bureau.
    
    Every webhook transaction is permanently recorded in the SHA-256 tamper-evident audit ledger.
    """
    try:
        data_dict = payload.model_dump(exclude_none=True) if hasattr(payload, 'model_dump') else payload.dict(exclude_none=True)
        return IntegrationService.process_incoming_webhook(
            db=db,
            event_type=payload.event_type,
            payload=data_dict,
            signature=x_aicte_signature
        )
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
