from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import AnonymousUser, Document
from ..schemas import AnonymousUserResponse, DocumentListResponse

router = APIRouter()


@router.post("", response_model=AnonymousUserResponse)
def create_anonymous_user(db: Session = Depends(get_db)):
    """Create a new anonymous user."""
    user = AnonymousUser()
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/{user_id}", response_model=AnonymousUserResponse)
def get_user(user_id: str, db: Session = Depends(get_db)):
    """Get an anonymous user by ID."""
    user = db.query(AnonymousUser).filter(AnonymousUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/{user_id}/documents", response_model=DocumentListResponse)
def get_user_documents(user_id: str, db: Session = Depends(get_db)):
    """Get all documents for an anonymous user."""
    user = db.query(AnonymousUser).filter(AnonymousUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    documents = (
        db.query(Document)
        .filter(Document.user_id == user_id)
        .order_by(Document.updated_at.desc())
        .all()
    )
    return {"documents": documents}
