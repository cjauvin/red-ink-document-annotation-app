from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Document, Annotation
from ..schemas import SharedDocumentResponse

router = APIRouter()


@router.get("/{share_hash}", response_model=SharedDocumentResponse)
def get_shared_document(share_hash: str, db: Session = Depends(get_db)):
    """Get a shared document with all its annotations (read-only)."""
    document = db.query(Document).filter(Document.share_hash == share_hash).first()
    if not document:
        raise HTTPException(status_code=404, detail="Shared document not found")

    annotations = (
        db.query(Annotation)
        .filter(Annotation.document_id == document.id)
        .order_by(Annotation.page_number)
        .all()
    )

    return {"document": document, "annotations": annotations}
