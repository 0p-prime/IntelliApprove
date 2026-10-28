"""
API Router for OCR Assistance and Expiry Date Extraction.
"""
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from typing import Optional, Dict, Any

from app.core.deps import get_current_user
from app.models.entities import User
from app.services.ocr_service import OCRService

router = APIRouter(prefix="/documents", tags=["OCR Assistance"])


@router.post("/ocr-extract-expiry")
async def extract_document_expiry_ocr(
    file: UploadFile = File(..., description="Uploaded document (PDF, PNG, JPG) to scan"),
    doc_type: Optional[str] = Form(None, description="Optional document classification e.g. LEASE"),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Scans an uploaded lease deed, NOC, or building certificate to extract the expiry date
    and pre-fill the form field.
    
    REGULATORY RULE: NEVER auto-verifies. Pre-fills date field for human officer / applicant
    confirmation with strict human-in-the-loop audit logging.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Uploaded file has no filename")

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty (0 bytes)")
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File exceeds maximum permissible size of 10 MB")

    result = OCRService.extract_expiry_info(content, file.filename)
    if doc_type:
        result["detected_document_type"] = doc_type

    return result
