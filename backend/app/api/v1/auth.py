"""
Authentication & Demo Quick-Login Endpoints.
Rule #1: Every login writes an audit_logs entry with cryptographic SHA-256 chain.
Security Hardening: Rate limiting on failed login attempts & JWT refresh token support.
"""
import time
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_user, get_client_ip
from app.core.security import verify_password, create_access_token, create_refresh_token, decode_access_token
from app.models.entities import User, Region, Institution
from app.services.audit_service import AuditService

router = APIRouter()

# In-memory sliding window rate limiter
LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 5
LOGIN_RATE_LIMIT_WINDOW_SECONDS = 300  # 5 minutes
FAILED_ATTEMPTS_STORE: Dict[str, List[float]] = {}


def check_login_rate_limit(key: str) -> None:
    now = time.time()
    attempts = FAILED_ATTEMPTS_STORE.get(key, [])
    valid_attempts = [t for t in attempts if now - t < LOGIN_RATE_LIMIT_WINDOW_SECONDS]
    FAILED_ATTEMPTS_STORE[key] = valid_attempts
    if len(valid_attempts) >= LOGIN_RATE_LIMIT_MAX_ATTEMPTS:
        retry_after = int(LOGIN_RATE_LIMIT_WINDOW_SECONDS - (now - valid_attempts[0]))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Security lockout: Too many consecutive failed login attempts. Retry after {max(1, retry_after)} seconds."
        )


def record_failed_attempt(key: str) -> None:
    now = time.time()
    if key not in FAILED_ATTEMPTS_STORE:
        FAILED_ATTEMPTS_STORE[key] = []
    FAILED_ATTEMPTS_STORE[key].append(now)


def clear_failed_attempts(key: str) -> None:
    if key in FAILED_ATTEMPTS_STORE:
        del FAILED_ATTEMPTS_STORE[key]


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


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
    refresh_token: Optional[str] = None
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
    Enforces rate limiting (max 5 failed attempts per 5 mins).
    Returns signed JWT access token, refresh token, and user profile.
    Logs successful logins to audit_logs.
    """
    client_ip = get_client_ip(request)
    rate_key = f"{login_data.email}:{client_ip}"

    # Rate limiting check
    check_login_rate_limit(rate_key)

    user = db.query(User).filter(User.email == login_data.email).first()
    if not user or not verify_password(login_data.password, user.password_hash):
        record_failed_attempt(rate_key)

        # Audit failure attempt
        AuditService.log(
            db=db,
            action="USER_LOGIN_FAILED",
            entity_type="user",
            entity_id=login_data.email,
            user=None,
            details=f"Failed login attempt for email: {login_data.email} from IP {client_ip}",
            ip_address=client_ip
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Account is deactivated")
        
    clear_failed_attempts(rate_key)

    access_token = create_access_token(data={"sub": str(user.id), "role": user.role, "email": user.email})
    refresh_token = create_refresh_token(data={"sub": str(user.id), "role": user.role, "email": user.email})
    
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
        ip_address=client_ip
    )
    db.commit()
    
    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=user_profile,
        role=user.role,
        user_id=user.id,
        email=user.email,
        full_name=user.name,
        institution_id=inst_id
    )


@router.post("/refresh")
def refresh_token_endpoint(req: RefreshTokenRequest, db: Session = Depends(get_db)):
    """
    Exchanges a valid refresh token for a newly signed access token and rotated refresh token.
    """
    payload = decode_access_token(req.refresh_token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == int(user_id)).first() if user_id else None
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User account no longer active")

    new_access_token = create_access_token(data={"sub": str(user.id), "role": user.role, "email": user.email})
    new_refresh_token = create_refresh_token(data={"sub": str(user.id), "role": user.role, "email": user.email})

    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
        "expires_in": 3600
    }


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
