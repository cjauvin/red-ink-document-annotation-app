import os
import uuid
import subprocess
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, Depends, File, Header, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Document, Annotation, AnonymousUser
from ..schemas import (
    DocumentResponse,
    AnnotationCreate,
    AnnotationResponse,
    AnnotationsListResponse,
)

router = APIRouter()

UPLOADS_DIR = Path("uploads")
UPLOADS_DIR.mkdir(exist_ok=True)


def convert_docx_to_pdf(input_path: Path, output_dir: Path) -> Path:
    """Convert DOCX to PDF using LibreOffice headless."""
    subprocess.run(
        [
            "soffice",
            "--headless",
            "--convert-to",
            "pdf",
            "--outdir",
            str(output_dir),
            str(input_path),
        ],
        check=True,
        capture_output=True,
    )
    # LibreOffice creates the PDF with the same name but .pdf extension
    pdf_path = output_dir / (input_path.stem + ".pdf")
    return pdf_path


@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    x_user_id: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """Upload a PDF or DOCX file."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    # Verify user exists if provided
    user_id = None
    if x_user_id:
        user = db.query(AnonymousUser).filter(AnonymousUser.id == x_user_id).first()
        if user:
            user_id = x_user_id

    # Determine file type
    filename_lower = file.filename.lower()
    if filename_lower.endswith(".pdf"):
        original_type = "pdf"
    elif filename_lower.endswith(".docx"):
        original_type = "docx"
    else:
        raise HTTPException(
            status_code=400, detail="Only PDF and DOCX files are supported"
        )

    # Generate unique filename
    file_id = str(uuid.uuid4())
    temp_filename = f"{file_id}.{original_type}"
    temp_path = UPLOADS_DIR / temp_filename

    # Save uploaded file
    content = await file.read()
    with open(temp_path, "wb") as f:
        f.write(content)

    # Convert DOCX to PDF if needed
    if original_type == "docx":
        try:
            pdf_path = convert_docx_to_pdf(temp_path, UPLOADS_DIR)
            # Remove the original DOCX file
            os.remove(temp_path)
            stored_filename = pdf_path.name
        except subprocess.CalledProcessError as e:
            os.remove(temp_path)
            raise HTTPException(
                status_code=500, detail=f"Failed to convert DOCX to PDF: {e.stderr}"
            )
    else:
        stored_filename = temp_filename

    # Create document record
    document = Document(
        user_id=user_id,
        original_filename=file.filename,
        stored_filename=stored_filename,
        original_type=original_type,
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    return document


@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(document_id: str, db: Session = Depends(get_db)):
    """Get document metadata."""
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


@router.get("/{document_id}/file")
def get_document_file(document_id: str, db: Session = Depends(get_db)):
    """Stream the PDF file."""
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    file_path = UPLOADS_DIR / document.stored_filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        filename=document.original_filename.rsplit(".", 1)[0] + ".pdf",
    )


@router.get("/{document_id}/annotations", response_model=AnnotationsListResponse)
def get_annotations(document_id: str, db: Session = Depends(get_db)):
    """Get all annotations for a document."""
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    annotations = (
        db.query(Annotation)
        .filter(Annotation.document_id == document_id)
        .order_by(Annotation.page_number)
        .all()
    )
    return {"annotations": annotations}


@router.post("/{document_id}/annotations", response_model=AnnotationResponse)
def save_annotation(
    document_id: str,
    annotation: AnnotationCreate,
    db: Session = Depends(get_db),
):
    """Save or update annotation for a specific page (upsert)."""
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Check if annotation exists for this page
    existing = (
        db.query(Annotation)
        .filter(
            Annotation.document_id == document_id,
            Annotation.page_number == annotation.page_number,
        )
        .first()
    )

    if existing:
        # Update existing annotation
        existing.annotation_data = annotation.annotation_data
        db.commit()
        db.refresh(existing)
        return existing
    else:
        # Create new annotation
        new_annotation = Annotation(
            document_id=document_id,
            page_number=annotation.page_number,
            annotation_data=annotation.annotation_data,
        )
        db.add(new_annotation)
        db.commit()
        db.refresh(new_annotation)
        return new_annotation


@router.delete("/{document_id}")
def delete_document(
    document_id: str,
    x_user_id: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """Delete a document and its associated file."""
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Verify ownership if user_id is provided
    if x_user_id and document.user_id and document.user_id != x_user_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this document")

    # Delete the file
    file_path = UPLOADS_DIR / document.stored_filename
    if file_path.exists():
        os.remove(file_path)

    # Delete the document (annotations will cascade)
    db.delete(document)
    db.commit()

    return {"status": "deleted"}
