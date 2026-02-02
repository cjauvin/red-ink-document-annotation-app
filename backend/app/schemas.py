from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel


class AnonymousUserResponse(BaseModel):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True


class DocumentBase(BaseModel):
    original_filename: str
    original_type: str


class DocumentCreate(DocumentBase):
    stored_filename: str


class DocumentResponse(DocumentBase):
    id: str
    user_id: Optional[str] = None
    stored_filename: str
    share_hash: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DocumentListResponse(BaseModel):
    documents: list[DocumentResponse]


class AnnotationBase(BaseModel):
    page_number: int
    annotation_data: dict[str, Any]


class AnnotationCreate(AnnotationBase):
    pass


class AnnotationResponse(AnnotationBase):
    id: str
    document_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AnnotationsListResponse(BaseModel):
    annotations: list[AnnotationResponse]


class SharedDocumentResponse(BaseModel):
    document: DocumentResponse
    annotations: list[AnnotationResponse]
