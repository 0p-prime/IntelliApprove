"""
Authentication & Demo Quick-Login Endpoints.
Rule #1: Every login writes an audit_logs entry with cryptographic SHA-256 chain.
"""
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_user, get_client_ip
from app.core.security import verify_password, create_access_token
from app.models.entities import User, Region, Institution
from app.services.audit_service import AuditService

router = APIRouter()

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserProfile(BaseModel):
    id: int
    name: str
    email: str
    role: str
    region_id: Optional[int] = None
    region_name: Optional[str] = None
    institution_id: Optional[int] = None
    institution_name: Optional[str] = None
    is_active: bool

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserProfile
    # Top-level attributes for backwards compatibility
    role: str
    user_id: int
    email: str
    full_name: str
    institution_id: Optional[int] = None

@router.post("/login", response_model=LoginResponse)
def login(login_data: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """
    Authenticate user with email and password.
    Returns signed JWT access token and user profile.
    Logs successful logins to audit_logs.
    """
    user = db.query(User).filter(User.email == login_data.email).first()
    if not user or not verify_password(login_data.password, user.password_hash):
        # Audit failure attempt
        AuditService.log(
            db=db,
            action="USER_LOGIN_FAILED",
            entity_type="user",
            entity_id=login_data.email,
            user=None,
            details=f"Failed login attempt for email: {login_data.email}",
            ip_address=get_client_ip(request)
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Account is deactivated")
        
    access_token = create_access_token(data={"sub": str(user.id), "role": user.role, "email": user.email})
    
    # Resolve region name
    region_name = user.region.name if user.region else None
    
    # Resolve institution if user is an institution representative
    inst_id = None
    inst_name = None
    inst = db.query(Institution).filter(Institution.contact_email == user.email).first()
    if inst:
        inst_id = inst.id
        inst_name = inst.name

    user_profile = UserProfile(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        region_id=user.region_id,
        region_name=region_name,
        institution_id=inst_id,
        institution_name=inst_name,
        is_active=user.is_active
    )

    # Non-negotiable Rule #1: Log user login to audit_logs
    AuditService.log(
        db=db,
        action="USER_LOGIN_SUCCESS",
        entity_type="user",
        entity_id=str(user.id),
        user=user,
        details=f"User {user.email} logged in with role {user.role}.",
        ip_address=get_client_ip(request)
    )
    
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_profile,
        role=user.role,
        user_id=user.id,
        email=user.email,
        full_name=user.name,
        institution_id=inst_id
    )

@router.get("/me")
def read_current_user(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Return currently logged-in user details and profile."""
    region_name = current_user.region.name if current_user.region else None
    inst = db.query(Institution).filter(Institution.contact_email == current_user.email).first()
    
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "full_name": current_user.name,
        "role": current_user.role,
        "region_id": current_user.region_id,
        "region_name": region_name,
        "institution_id": inst.id if inst else None,
        "institution_name": inst.name if inst else None,
        "is_active": current_user.is_active
    }

@router.get("/demo-users")
def get_demo_users(db: Session = Depends(get_db)):
    """
    Returns seeded demo users across each role to facilitate
    quick evaluation during presentations & SIH demos.
    """
    users = db.query(User).filter(User.is_active == True).all()
    res = []
    for u in users:
        reg_name = u.region.name if u.region else "National HQ"
        inst = db.query(Institution).filter(Institution.contact_email == u.email).first()
        inst_name = inst.name if inst else None
        res.append({
            "id": u.id,
            "email": u.email,
            "name": u.name,
            "full_name": u.name,
            "role": u.role,
            "region_id": u.region_id,
            "region_name": reg_name,
            "institution_id": inst.id if inst else None,
            "institution_name": inst_name,
            "designation": f"{u.role.replace('_', ' ').title()} ({reg_name})"
        })
    return res
