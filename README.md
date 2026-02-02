# Red Ink - Homework Annotation App

A web application for teachers/graders to upload homework documents (PDF/DOCX), annotate them with drawing tools (arrows, boxes, text), and share the annotated result via secret URLs.

## Quick Start

### Backend (Docker)

```bash
cd backend
docker compose up --build
# Runs on http://localhost:8001
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

Open http://localhost:5173 to use the app.

## Features

- **File Upload**: Drag & drop PDF or DOCX files
- **DOCX Conversion**: Automatic conversion to PDF using LibreOffice
- **Annotation Tools**: Arrow, Box, and Text tools
- **Color Selection**: Red, Blue, Green, Black
- **Auto-save**: Annotations save automatically as you draw
- **Page Navigation**: Multi-page document support
- **Sharing**: Generate secret URLs for read-only access

## Tech Stack

### Frontend
- React with Vite
- Tailwind CSS
- react-pdf (PDF.js wrapper)
- Fabric.js for annotations
- React Router

### Backend
- Python 3.11+ with FastAPI
- SQLAlchemy with SQLite
- LibreOffice for DOCX conversion
- Docker with uv for dependency management

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/documents/upload` | Upload PDF/DOCX file |
| GET | `/api/documents/{id}` | Get document metadata |
| GET | `/api/documents/{id}/file` | Stream PDF file |
| GET | `/api/documents/{id}/annotations` | Get all annotations |
| POST | `/api/documents/{id}/annotations` | Save page annotation |
| GET | `/api/share/{hash}` | Get shared document (read-only) |

## Development

### Backend without Docker

If you have LibreOffice and uv installed locally:

```bash
cd backend
uv run python run.py
```

### Test Upload

```bash
curl -F "file=@test.pdf" http://localhost:8001/api/documents/upload
```
