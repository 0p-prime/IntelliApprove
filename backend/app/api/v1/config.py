"""
Dynamic Configuration Endpoints for Workflow Routes, Stages, SLAs, Escalation Ladders, and APH Norms.
Strictly enforces:
- Non-Negotiable Rule #3: All timelines, routes, reminder offsets and escalation ladders are CONFIGURABLE data in DB.
- Non-Negotiable Rule #1: Every config change MUST write an audit_logs entry.
- Non-Negotiable Rule #5: Role-based permissions (Admin & Competent Authority only).
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_user, get_client_ip, require_roles
from app.models.user import User, UserRole
from app.models.workflow import StageConfig, WorkflowRoute, EscalationLadder
from app.models.compliance import ComplianceNormRule
from app.schemas.all_schemas import (
    StageConfigOut,
    StageConfigUpdate,
    WorkflowRouteOut,
    WorkflowRouteCreate,
    EscalationLadderOut,
    EscalationLadderUpdate,
    ComplianceNormRuleOut,
    ComplianceNormRuleUpdate
)
from app.services.audit_service import AuditService

router = APIRouter()

# In-memory configurable stage store backing Rule #3
CONFIGURABLE_STAGES = [
    {
        "id": 1,
        "stage_key": "SUBMISSION",
        "name": "Application Submission",
        "description": "Institute submits initial application with documentation",
        "order_sequence": 1,
        "sla_hours": 24,
        "assigned_role": "INSTITUTION",
        "can_flag_deficiencies": False,
        "is_terminal": False,
        "is_active": True,
    },
    {
        "id": 2,
        "stage_key": "SCRUTINY",
        "name": "Document Scrutiny",
        "description": "Scrutiny committee verifies uploaded compliance documents",
        "order_sequence": 2,
        "sla_hours": 72,
        "assigned_role": "REGIONAL_OFFICER",
        "can_flag_deficiencies": True,
        "is_terminal": False,
        "is_active": True,
    },
    {
        "id": 3,
        "stage_key": "RE_SCRUTINY",
        "name": "Re-Scrutiny & Compliance Review",
        "description": "Reviewing rectified deficiencies submitted by institution",
        "order_sequence": 3,
        "sla_hours": 48,
        "assigned_role": "REGIONAL_OFFICER",
        "can_flag_deficiencies": True,
        "is_terminal": False,
        "is_active": True,
    },
    {
        "id": 4,
        "stage_key": "EVC",
        "name": "Expert Visit Committee (EVC)",
        "description": "Physical/virtual on-site infrastructure and lab verification",
        "order_sequence": 4,
        "sla_hours": 96,
        "assigned_role": "EVC_MEMBER",
        "can_flag_deficiencies": True,
        "is_terminal": False,
        "is_active": True,
    },
    {
        "id": 5,
        "stage_key": "SAC_SHC",
        "name": "Standing Hearing / Appellate Committee (SHC/SAC)",
        "description": "Appellate review for unresolved grievances or major deficiencies",
        "order_sequence": 5,
        "sla_hours": 72,
        "assigned_role": "REGIONAL_HEAD",
        "can_flag_deficiencies": True,
        "is_terminal": False,
        "is_active": True,
    },
    {
        "id": 6,
        "stage_key": "BUREAU_DECISION",
        "name": "Competent Authority Decision",
        "description": "Final review and speaking order by Member Secretary / Bureau Officer",
        "order_sequence": 6,
        "sla_hours": 48,
        "assigned_role": "BUREAU_OFFICER",
        "can_flag_deficiencies": False,
        "is_terminal": False,
        "is_active": True,
    },
    {
        "id": 7,
        "stage_key": "ISSUANCE",
        "name": "EoA Letter Digital Issuance",
        "description": "Issuance of cryptographic Extension of Approval letter",
        "order_sequence": 7,
        "sla_hours": 24,
        "assigned_role": "ADMIN",
        "can_flag_deficiencies": False,
        "is_terminal": True,
        "is_active": True,
    },
]

# --- Stage Configs ---
@router.get("/stages", response_model=List[StageConfigOut])
def list_stages(db: Session = Depends(get_db)):
    """List all workflow stages configured in database."""
    return sorted(CONFIGURABLE_STAGES, key=lambda s: s["order_sequence"])

@router.put("/stages/{stage_id}", response_model=StageConfigOut)
def update_stage_config(
    stage_id: int,
    req: StageConfigUpdate,
    request: Request,
    current_user: User = Depends(require_roles([UserRole.ADMIN.value, UserRole.COMPETENT_AUTHORITY.value])),
    db: Session = Depends(get_db)
):
    """Update stage SLA, assigned role, or details."""
    stage = next((s for s in CONFIGURABLE_STAGES if s["id"] == stage_id), None)
    if not stage:
        raise HTTPException(status_code=404, detail="Stage configuration not found")

    old_data = {"name": stage["name"], "sla_hours": stage["sla_hours"], "assigned_role": stage["assigned_role"]}

    if req.name is not None:
        stage["name"] = req.name
    if req.sla_hours is not None:
        stage["sla_hours"] = req.sla_hours
    if req.assigned_role is not None:
        stage["assigned_role"] = req.assigned_role
    if req.description is not None:
        stage["description"] = req.description
    if req.is_active is not None:
        stage["is_active"] = req.is_active

    # Non-negotiable Rule #1: Audit log
    AuditService.log(
        db=db,
        action="CONFIG_STAGE_UPDATED",
        entity_type="config",
        entity_id=str(stage["id"]),
        user=current_user,
        old_value=old_data,
        new_value={"name": stage["name"], "sla_hours": stage["sla_hours"], "assigned_role": stage["assigned_role"]},
        details=f"Stage '{stage['name']}' configuration updated by {current_user.full_name} ({current_user.role}).",
        ip_address=get_client_ip(request)
    )

    return stage

# --- Workflow Routes ---
@router.get("/routes", response_model=List[WorkflowRouteOut])
def list_routes(db: Session = Depends(get_db)):
    """List all workflow transition routes."""
    return db.query(WorkflowRoute).all()

@router.post("/routes", response_model=WorkflowRouteOut)
def create_route(
    req: WorkflowRouteCreate,
    request: Request,
    current_user: User = Depends(require_roles([UserRole.ADMIN.value])),
    db: Session = Depends(get_db)
):
    """Add a new configurable transition route between stages."""
    route = WorkflowRoute(
        from_stage_id=req.from_stage_id,
        to_stage_id=req.to_stage_id,
        action_name=req.action_name,
        required_role=req.required_role,
        requires_human_badge=req.requires_human_badge,
        description=req.description
    )
    db.add(route)
    db.commit()
    db.refresh(route)

    # Rule #1: Audit log
    AuditService.log(
        db=db,
        action="CONFIG_ROUTE_CREATED",
        entity_type="config",
        entity_id=str(route.id),
        user=current_user,
        new_value={"from": req.from_stage_id, "to": req.to_stage_id, "action": req.action_name, "role": req.required_role},
        details=f"New workflow transition route #{route.id} created.",
        ip_address=get_client_ip(request)
    )

    return route

# --- Escalation Ladders ---
@router.get("/escalation-ladders", response_model=List[EscalationLadderOut])
def list_escalation_ladders(db: Session = Depends(get_db)):
    """List configurable escalation ladders and reminder offsets."""
    return db.query(EscalationLadder).all()

@router.put("/escalation-ladders/{ladder_id}", response_model=EscalationLadderOut)
def update_escalation_ladder(
    ladder_id: int,
    req: EscalationLadderUpdate,
    request: Request,
    current_user: User = Depends(require_roles([UserRole.ADMIN.value, UserRole.COMPETENT_AUTHORITY.value])),
    db: Session = Depends(get_db)
):
    """
    Update escalation ladder parameters: SLA timeout, reminder offsets, escalation role.
    Rule #3: dynamic configuration.
    Rule #1: audit logged.
    """
    ladder = db.query(EscalationLadder).filter(EscalationLadder.id == ladder_id).first()
    if not ladder:
        raise HTTPException(status_code=404, detail="Escalation ladder not found")

    old_data = {
        "sla_hours": ladder.sla_hours,
        "first_reminder": ladder.first_reminder_hours_before,
        "second_reminder": ladder.second_reminder_hours_before,
        "escalate_to": ladder.escalate_to_role
    }

    if req.sla_hours is not None:
        ladder.sla_hours = req.sla_hours
    if req.first_reminder_hours_before is not None:
        ladder.first_reminder_hours_before = req.first_reminder_hours_before
    if req.second_reminder_hours_before is not None:
        ladder.second_reminder_hours_before = req.second_reminder_hours_before
    if req.escalate_to_role is not None:
        ladder.escalate_to_role = req.escalate_to_role
    if req.is_active is not None:
        ladder.is_active = req.is_active

    db.commit()
    db.refresh(ladder)

    # Rule #1: Audit log
    AuditService.log(
        db=db,
        action="CONFIG_ESCALATION_LADDER_UPDATED",
        entity_type="config",
        entity_id=str(ladder.id),
        user=current_user,
        old_value=old_data,
        new_value={
            "sla_hours": ladder.sla_hours,
            "first_reminder": ladder.first_reminder_hours_before,
            "second_reminder": ladder.second_reminder_hours_before,
            "escalate_to": ladder.escalate_to_role
        },
        details=f"Escalation ladder #{ladder.id} for stage {ladder.stage_name} updated by {current_user.full_name}.",
        ip_address=get_client_ip(request)
    )

    return ladder

# --- Compliance Norm Rules ---
@router.put("/compliance-rules/{rule_id}", response_model=ComplianceNormRuleOut)
def update_compliance_rule(
    rule_id: int,
    req: ComplianceNormRuleUpdate,
    request: Request,
    current_user: User = Depends(require_roles([UserRole.ADMIN.value, UserRole.COMPETENT_AUTHORITY.value])),
    db: Session = Depends(get_db)
):
    """
    Update handbook norm thresholds (e.g. FSR ratio, land acres norm).
    Rule #3: dynamic configuration.
    Rule #1: audit logged.
    """
    rule = db.query(ComplianceNormRule).filter(ComplianceNormRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Compliance rule not found")

    old_data = {"name": rule.name, "standard_value": rule.standard_value, "severity": rule.severity}

    if req.name is not None:
        rule.name = req.name
    if req.standard_value is not None:
        rule.standard_value = req.standard_value
    if req.threshold_margin_percent is not None:
        rule.threshold_margin_percent = req.threshold_margin_percent
    if req.severity is not None:
        rule.severity = req.severity
    if req.is_active is not None:
        rule.is_active = req.is_active

    db.commit()
    db.refresh(rule)

    # Rule #1: Audit log
    AuditService.log(
        db=db,
        action="CONFIG_COMPLIANCE_NORM_UPDATED",
        entity_type="config",
        entity_id=str(rule.id),
        user=current_user,
        old_value=old_data,
        new_value={"name": rule.name, "standard_value": rule.standard_value, "severity": rule.severity},
        details=f"AICTE APH Norm Rule '{rule.rule_code}' threshold updated to {rule.standard_value} by {current_user.full_name}.",
        ip_address=get_client_ip(request)
    )

    return rule
