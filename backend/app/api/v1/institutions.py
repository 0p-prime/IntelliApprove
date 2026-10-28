"""
Institutions endpoints with role-based scoping.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.entities import User, Institution
from app.core.scoping import scope_institutions_by_role
from app.schemas.all_schemas import InstitutionOut

router = APIRouter()

@router.get("", response_model=List[InstitutionOut])
def list_institutions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List institutions with role-based scoping:
    - INSTITUTION: sees only own institution
    - REGIONAL_OFFICER & REGIONAL_HEAD: see institutions in own region
    - BUREAU_OFFICER & ADMIN: see all institutions
    - EVC_MEMBER: institutions of assigned EVCs
    """
    query = scope_institutions_by_role(db.query(Institution), current_user, db)
    return query.order_by(Institution.name.asc()).all()

@router.get("/{institution_id}", response_model=InstitutionOut)
def get_institution(
    institution_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve institution by ID with role scoping."""
    query = scope_institutions_by_role(
        db.query(Institution).filter(Institution.id == institution_id),
        current_user,
        db
    )
    inst = query.first()
    if not inst:
        exists = db.query(Institution).filter(Institution.id == institution_id).first()
        if exists:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized access to this institution")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Institution not found")
    return inst
