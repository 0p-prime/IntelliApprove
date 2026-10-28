"""
API Router for Role-Scoped Natural Language AI Assistant.
"""
from fastapi import APIRouter, Depends, HTTPException, Body
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.entities import User
from app.services.assistant_service import AssistantService
from app.services.audit_service import AuditService

router = APIRouter(prefix="/assistant", tags=["Natural Language Assistant"])


class AssistantChatRequest(BaseModel):
    prompt: Optional[str] = Field(None, description="Natural language question or command")
    message: Optional[str] = Field(None, description="Natural language question or command (alias)")

    def get_query(self) -> str:
        text = self.prompt or self.message or ""
        return text.strip()


@router.post("/chat")
def chat_with_assistant(
    req: AssistantChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Translates officer natural-language queries into role-scoped, verified database
    queries (NO raw SQL), respecting strict RBAC barriers.
    
    Can also draft statutory deficiency notices clearly labelled 'AI Draft, requires official review'.
    """
    query_text = req.get_query()
    if not query_text:
        raise HTTPException(status_code=400, detail="A prompt or message query must be provided.")

    result = AssistantService.process_query(db, query_text, current_user)

    # Log query execution in audit trail (Rule #1 compliance)
    AuditService.log(
        db=db,
        action="ASSISTANT_QUERY_PROCESSED",
        entity_type="assistant",
        entity_id=result.get("intent", "QUERY"),
        user=current_user,
        old_value=None,
        new_value={"prompt": query_text, "intent": result.get("intent"), "is_ai_draft": result.get("is_ai_draft", False)},
        details=f"Officer {current_user.email} queried AI Assistant with intent '{result.get('intent')}': {query_text[:80]}"
    )
    db.commit()

    return result
