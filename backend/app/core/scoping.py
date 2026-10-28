"""
Data scoping helper module for IntelliApprove.
Enforces the mandatory Role-Based Scoping Rules:
- INSTITUTION: sees only own institution's data
- REGIONAL_OFFICER and REGIONAL_HEAD: see own region's data
- BUREAU_OFFICER and ADMIN: see all data across India
- EVC_MEMBER: sees assigned EVC inspections and corresponding applications
"""
import json
from typing import Optional, List, Any
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.models.entities import (
    User,
    UserRole,
    Institution,
    Application,
    EVCSchedule,
    Undertaking,
    Document,
)

def get_user_institution(user: User, db: Session) -> Optional[Institution]:
    """Retrieve institution associated with an INSTITUTION user via contact email."""
    if not user:
        return None
    return db.query(Institution).filter(Institution.contact_email == user.email).first()

def get_evc_assigned_app_ids(user: User, db: Session) -> List[int]:
    """Retrieve application IDs assigned to an EVC_MEMBER user."""
    schedules = db.query(EVCSchedule).all()
    assigned_app_ids = []
    for s in schedules:
        try:
            c_ids = json.loads(s.committee_ids) if isinstance(s.committee_ids, str) else s.committee_ids
            if user.id in c_ids:
                assigned_app_ids.append(s.application_id)
        except Exception:
            pass
    return assigned_app_ids

def scope_applications_by_role(query, user: User, db: Session):
    """
    Scope application query based on user's role:
    - INSTITUTION: only own institution's applications
    - REGIONAL_OFFICER / REGIONAL_HEAD: only applications in their region
    - BUREAU_OFFICER / ADMIN: all applications nationwide
    - EVC_MEMBER: only applications with assigned EVC inspections
    """
    if user.role in [UserRole.ADMIN.value, UserRole.BUREAU_OFFICER.value, "COMPETENT_AUTHORITY"]:
        return query

    if user.role in [UserRole.REGIONAL_OFFICER.value, UserRole.REGIONAL_HEAD.value, "SCRUTINY_OFFICER"]:
        if user.region_id is not None:
            return query.filter(Application.region_id == user.region_id)
        return query

    if user.role == UserRole.INSTITUTION.value:
        inst = get_user_institution(user, db)
        if inst:
            return query.filter(Application.institution_id == inst.id)
        return query.filter(Application.id == -1)  # Empty result if no institution bound

    if user.role in [UserRole.EVC_MEMBER.value, "EVC_INSPECTOR"]:
        assigned_ids = get_evc_assigned_app_ids(user, db)
        return query.filter(Application.id.in_(assigned_ids))

    return query

def scope_institutions_by_role(query, user: User, db: Session):
    """
    Scope institution query:
    - INSTITUTION: only own institution
    - REGIONAL_OFFICER / REGIONAL_HEAD: only institutions in own region
    - BUREAU_OFFICER / ADMIN: all institutions
    - EVC_MEMBER: institutions of assigned EVCs
    """
    if user.role in [UserRole.ADMIN.value, UserRole.BUREAU_OFFICER.value, "COMPETENT_AUTHORITY"]:
        return query

    if user.role in [UserRole.REGIONAL_OFFICER.value, UserRole.REGIONAL_HEAD.value, "SCRUTINY_OFFICER"]:
        if user.region_id is not None:
            return query.filter(Institution.region_id == user.region_id)
        return query

    if user.role == UserRole.INSTITUTION.value:
        inst = get_user_institution(user, db)
        if inst:
            return query.filter(Institution.id == inst.id)
        return query.filter(Institution.id == -1)

    if user.role in [UserRole.EVC_MEMBER.value, "EVC_INSPECTOR"]:
        assigned_app_ids = get_evc_assigned_app_ids(user, db)
        assigned_inst_ids = [
            a[0] for a in db.query(Application.institution_id).filter(Application.id.in_(assigned_app_ids)).all()
        ]
        return query.filter(Institution.id.in_(assigned_inst_ids))

    return query

def scope_evc_schedules_by_role(query, user: User, db: Session):
    """
    Scope EVC schedules:
    - INSTITUTION: EVCs for own institution
    - REGIONAL_OFFICER / REGIONAL_HEAD: EVCs for applications in their region
    - BUREAU_OFFICER / ADMIN: all EVCs
    - EVC_MEMBER: EVCs where user is member of committee
    """
    if user.role in [UserRole.ADMIN.value, UserRole.BUREAU_OFFICER.value, "COMPETENT_AUTHORITY"]:
        return query

    if user.role in [UserRole.REGIONAL_OFFICER.value, UserRole.REGIONAL_HEAD.value, "SCRUTINY_OFFICER"]:
        if user.region_id is not None:
            return query.join(Application, EVCSchedule.application_id == Application.id).filter(
                Application.region_id == user.region_id
            )
        return query

    if user.role == UserRole.INSTITUTION.value:
        inst = get_user_institution(user, db)
        if inst:
            return query.join(Application, EVCSchedule.application_id == Application.id).filter(
                Application.institution_id == inst.id
            )
        return query.filter(EVCSchedule.id == -1)

    if user.role in [UserRole.EVC_MEMBER.value, "EVC_INSPECTOR"]:
        all_schedules = query.all()
        assigned_sched_ids = []
        for s in all_schedules:
            try:
                c_ids = json.loads(s.committee_ids) if isinstance(s.committee_ids, str) else s.committee_ids
                if user.id in c_ids:
                    assigned_sched_ids.append(s.id)
            except Exception:
                pass
        return db.query(EVCSchedule).filter(EVCSchedule.id.in_(assigned_sched_ids))

    return query

def scope_undertakings_by_role(query, user: User, db: Session):
    """
    Scope undertakings:
    - INSTITUTION: only own institution's undertakings
    - REGIONAL_OFFICER / REGIONAL_HEAD: undertakings for institutions/applications in own region
    - BUREAU_OFFICER / ADMIN: all undertakings
    - EVC_MEMBER: undertakings for assigned applications
    """
    if user.role in [UserRole.ADMIN.value, UserRole.BUREAU_OFFICER.value, "COMPETENT_AUTHORITY"]:
        return query

    if user.role in [UserRole.REGIONAL_OFFICER.value, UserRole.REGIONAL_HEAD.value, "SCRUTINY_OFFICER"]:
        if user.region_id is not None:
            return query.join(Institution, Undertaking.institution_id == Institution.id).filter(
                Institution.region_id == user.region_id
            )
        return query

    if user.role == UserRole.INSTITUTION.value:
        inst = get_user_institution(user, db)
        if inst:
            return query.filter(Undertaking.institution_id == inst.id)
        return query.filter(Undertaking.id == -1)

    if user.role in [UserRole.EVC_MEMBER.value, "EVC_INSPECTOR"]:
        assigned_app_ids = get_evc_assigned_app_ids(user, db)
        return query.filter(Undertaking.application_id.in_(assigned_app_ids))

    return query

def scope_documents_by_role(query, user: User, db: Session):
    """
    Scope documents:
    - INSTITUTION: only own institution's documents
    - REGIONAL_OFFICER / REGIONAL_HEAD: documents for institutions in own region
    - BUREAU_OFFICER / ADMIN: all documents
    - EVC_MEMBER: documents for institutions of assigned applications
    """
    if user.role in [UserRole.ADMIN.value, UserRole.BUREAU_OFFICER.value, "COMPETENT_AUTHORITY"]:
        return query

    if user.role in [UserRole.REGIONAL_OFFICER.value, UserRole.REGIONAL_HEAD.value, "SCRUTINY_OFFICER"]:
        if user.region_id is not None:
            return query.join(Institution, Document.institution_id == Institution.id).filter(
                Institution.region_id == user.region_id
            )
        return query

    if user.role == UserRole.INSTITUTION.value:
        inst = get_user_institution(user, db)
        if inst:
            return query.filter(Document.institution_id == inst.id)
        return query.filter(Document.id == -1)

    if user.role in [UserRole.EVC_MEMBER.value, "EVC_INSPECTOR"]:
        assigned_app_ids = get_evc_assigned_app_ids(user, db)
        assigned_inst_ids = [
            a[0] for a in db.query(Application.institution_id).filter(Application.id.in_(assigned_app_ids)).all()
        ]
        return query.filter(Document.institution_id.in_(assigned_inst_ids))

    return query

