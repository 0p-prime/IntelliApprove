"""
Authentication & Demo Quick-Login Endpoints.
Rule #1: Every login writes an audit_logs entry.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_user, get_client_ip
from app.core.security import verify_password, create_access_token
from app.models.user import User
from app.schemas.all_schemas import Token, UserLogin, UserOut
from app.services.audit_service import AuditService

router = APIRouter()

@router.post("/login", response_model=Token)
def login(login_data: UserLogin, request: Request, db: Session = Depends(get_db)):
    """Authenticate user with email and password."""
    user = db.query(User).filter(User.email == login_data.email).first()
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Account is deactivated")
        
    access_token = create_access_token(data={"sub": str(user.id), "role": user.role, "email": user.email})
    
    # Non-negotiable Rule #1: Log user login
    AuditService.log(
        db=db,
        action="USER_LOGIN_SUCCESS",
        entity_type="user",
        entity_id=str(user.id),
        user=user,
        details=f"User {user.email} logged in with role {user.role}.",
        ip_address=get_client_ip(request)
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "user_id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "institution_id": user.institution_id
    }

@router.get("/me", response_model=UserOut)
def read_current_user(current_user: User = Depends(get_current_user)):
    """Return currently logged-in user details."""
    return current_user

@router.get("/demo-users")
def get_demo_users(db: Session = Depends(get_db)):
    """
    Returns list of seeded demo users across each role to facilitate
    quick evaluation during presentations & SIH demos.
    """
    users = db.query(User).filter(User.is_active == True).all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "role": u.role,
            "designation": u.designation,
            "institution_id": u.institution_id
        }
        for u in users
    ]
