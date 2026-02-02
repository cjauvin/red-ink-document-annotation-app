# Red Ink - Homework Annotation App

## Development Workflow
- **Commit after important changes**: Every time you make an important change (new feature, bug fix, refactor), commit it immediately with a descriptive message.

## Project Overview
A web application for teachers/graders to upload homework documents (PDF/DOCX), annotate them with simple drawing tools (arrows, boxes, text), and share the annotated result via secret URLs.

## Key Design Decisions
- **DOCX handling**: Convert to PDF on backend using LibreOffice headless for consistent browser rendering
- **Annotations**: Auto-save with debouncing as user draws (no manual save button)
- **Styling**: Tailwind CSS
- **Database**: SQLite (simple, no separate server needed)
- **Sharing**: UUID v4 hash for unguessable public URLs

## Tech Stack

### Frontend
- **React** with Vite
- **Tailwind CSS** for styling
- **react-pdf** (PDF.js wrapper) for document rendering
- **Fabric.js** for annotation canvas layer

### Backend
- **Python 3.10+** with **FastAPI**
- **SQLAlchemy** ORM with **SQLite**
- **LibreOffice** headless for DOCX → PDF conversion
- Local filesystem for file storage

## Prerequisites
LibreOffice must be installed for DOCX conversion:
- macOS: `brew install --cask libreoffice`
- Linux: `apt install libreoffice`

## Project Structure
```
red-ink-app/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── FileUpload.jsx      # Drag & drop upload
│   │   │   ├── DocumentViewer.jsx  # PDF rendering with react-pdf
│   │   │   ├── AnnotationCanvas.jsx # Fabric.js overlay
│   │   │   ├── Toolbar.jsx         # Tools & colors
│   │   │   └── SharedView.jsx      # Read-only public view
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.js
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI app, CORS config
│   │   ├── models.py         # SQLAlchemy models
│   │   ├── schemas.py        # Pydantic schemas
│   │   ├── database.py       # DB connection
│   │   └── routers/
│   │       ├── documents.py  # Upload, retrieve, annotations
│   │       └── share.py      # Public sharing endpoint
│   ├── uploads/              # Stored PDF files
│   ├── requirements.txt
│   └── run.py
├── CLAUDE.md                 # This file
└── README.md
```

## Database Schema

### documents
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| original_filename | String | Original uploaded filename |
| stored_filename | String | UUID-based filename (always .pdf) |
| original_type | String | "pdf" or "docx" |
| share_hash | UUID | Secret hash for public URL |
| created_at | DateTime | |
| updated_at | DateTime | |

### annotations
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| document_id | UUID | Foreign key to documents |
| page_number | Integer | 1-indexed page number |
| annotation_data | JSON | Fabric.js serialized canvas objects |
| created_at | DateTime | |
| updated_at | DateTime | |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/documents/upload` | Upload PDF/DOCX, returns document ID |
| GET | `/api/documents/{id}` | Get document metadata |
| GET | `/api/documents/{id}/file` | Stream PDF file |
| GET | `/api/documents/{id}/annotations` | Get all annotations |
| POST | `/api/documents/{id}/annotations` | Save annotations (auto-save) |
| GET | `/api/share/{hash}` | Get shared document (read-only) |

## Annotation Tools
- **Arrow**: Click and drag to draw directional arrow
- **Box**: Click and drag to draw rectangle outline
- **Text**: Click to place text, type content
- **Colors**: Red (#EF4444), Blue (#3B82F6), Green (#22C55E), Black (#000000)
- **Undo**: Remove last annotation
- **Clear**: Remove all annotations on current page

## Implementation Phases

### Phase 1: Backend
1. Create FastAPI app with CORS (allow frontend origin)
2. SQLAlchemy models + SQLite setup
3. File upload endpoint with DOCX → PDF conversion via `soffice --headless --convert-to pdf`
4. Document retrieval and file streaming
5. Annotation CRUD endpoints
6. Share endpoint

### Phase 2: Frontend
1. Vite + React + Tailwind setup
2. FileUpload component with drag & drop
3. DocumentViewer with react-pdf (page navigation)
4. AnnotationCanvas overlay using Fabric.js
5. Toolbar component
6. Auto-save hook with 500ms debounce
7. SharedView for read-only mode

### Phase 3: Integration
1. API client setup (fetch wrapper)
2. Connect all components
3. Share URL generation + copy button
4. Loading states, error toasts

## Running the App

### Backend (Docker + uv)
```bash
cd backend
docker compose up --build
# Runs on http://localhost:8001
```

**Note:** Backend uses Docker with uv for Python dependency management. LibreOffice is installed in the container for DOCX conversion.

### Frontend
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

## Key Implementation Notes

### DOCX Conversion
```python
import subprocess
subprocess.run([
    'soffice', '--headless', '--convert-to', 'pdf',
    '--outdir', output_dir, input_file
], check=True)
```

### Fabric.js Annotation Serialization
```javascript
// Save: canvas.toJSON()
// Load: canvas.loadFromJSON(data, canvas.renderAll.bind(canvas))
```

### Auto-save with Debounce
```javascript
const saveAnnotations = useMemo(
  () => debounce((data) => api.saveAnnotations(docId, page, data), 500),
  [docId, page]
);
```
