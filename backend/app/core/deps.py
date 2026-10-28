"""
Dependency injection helpers for FastAPI:
- Database session
- Current authenticated user via JWT
- Reusable Role-based access control (RBAC) dependency & decorator
- Client IP extractor
- Scoping helpers
"""
import functools
from typing import Generator, List, Optional, Union
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.core.security import decode_access_token
from app.models.entities import User, UserRole
from app.core.scoping import (
    get_user_institution,
    scope_applications_by_role,
    scope_institutions_by_role,
    scope_evc_schedules_by_role,
    scope_undertakings_by_role,
    scope_documents_by_role
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

def get_db() -> Generator[Session, None, None]:
    """Provide a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_client_ip(request: Request) -> str:
    """Extract real client IP address."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"

def get_current_user(
    db: Session = Depends(get_db),
    token: Optional[str] = Depends(oauth2_scheme)
) -> User:
    """Retrieve and validate current authenticated user via Bearer JWT."""
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User associated with token not found",
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated",
        )
        
    return user

def require_roles(allowed_roles: List[Union[str, UserRole]]):
    """
    Reusable dependency and decorator to enforce Role-Based Access Control (RBAC).
    Usage as FastAPI Dependency:
        current_user: User = Depends(require_roles(["ADMIN", "BUREAU_OFFICER"]))
    Usage as Python Decorator:
        @require_roles(["ADMIN"])
        def my_function(..., current_user: User): ...
    """
    expanded_roles = set()
    role_names_str = []
    for r in allowed_roles:
        val = r.value if hasattr(r, "value") else str(r)
        expanded_roles.add(val)
        role_names_str.append(val)
        # Handle role equivalences across modules
        if val == "COMPETENT_AUTHORITY":
            expanded_roles.add("BUREAU_OFFICER")
        elif val == "BUREAU_OFFICER":
            expanded_roles.add("COMPETENT_AUTHORITY")
        elif val == "SCRUTINY_OFFICER":
            expanded_roles.add("REGIONAL_OFFICER")
        elif val == "REGIONAL_OFFICER":
            expanded_roles.add("SCRUTINY_OFFICER")
        elif val == "EVC_INSPECTOR":
            expanded_roles.add("EVC_MEMBER")
        elif val == "EVC_MEMBER":
            expanded_roles.add("EVC_INSPECTOR")

    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in expanded_roles and current_user.role != UserRole.ADMIN.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Requires one of roles: {', '.join(role_names_str)} (Your role: {current_user.role})",
            )
        return current_user

    def decorator(fn):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            user = kwargs.get("current_user")
            if not user or (user.role not in expanded_roles and user.role != UserRole.ADMIN.value):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Access denied. Requires one of roles: {', '.join(role_names_str)}"
                )
            return fn(*args, **kwargs)
        return wrapper

    # Support both FastAPI Depends and standard decorator usage
    role_checker.__call__ = role_checker
    role_checker.decorator = decorator
    return role_checker
