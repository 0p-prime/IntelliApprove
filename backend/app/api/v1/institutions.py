"""
Institutions endpoints.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.institution import Institution
from app.schemas.all_schemas import InstitutionOut

router = APIRouter()

@router.get("", response_model=List[InstitutionOut])
def list_institutions(db: Session = Depends(get_db)):
    """List all AICTE affiliated institutions."""
    return db.query(Institution).all()

@router.get("/{institution_id}", response_model=InstitutionOut)
def get_institution(institution_id: int, db: Session = Depends(get_db)):
    """Retrieve institution by ID."""
    inst = db.query(Institution).filter(Institution.id == institution_id).first()
    if not inst:
        raise HTTPException(status_code=404, detail="Institution not found")
    return inst
