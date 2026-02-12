# Red Ink - Homework Annotation App

## Development Workflow
- **Commit and push after important changes**: Every time you make an important change (new feature, bug fix, refactor), commit it immediately with a descriptive message and push to remote.

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

### Chrome Extension
- **Manifest V3** Chrome extension
- Injects upload buttons on TELUQ university pages
- Downloads files with user's authenticated session
- Uploads directly to Red Ink API

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
├── chrome-extension/
│   ├── manifest.json         # Extension manifest (v3)
│   ├── content.js            # Injects buttons on TELUQ pages
│   ├── content.css           # Button styling
│   ├── background.js         # Service worker for file handling
│   ├── popup.html/js         # Extension popup UI
│   ├── options.html/js       # Settings page
│   ├── icons/                # Extension icons (16/48/128px)
│   └── README.md             # Extension documentation
├── CLAUDE.md                 # This file
├── Caddyfile                 # Caddy reverse proxy config (production)
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
- **Arrow**: Click and drag to draw directional arrow (minimum 25px length enforced)
- **Box**: Click and drag to draw rectangle outline
- **Text**: Click to place text (default width 150px), type content
- **Draw**: Freehand drawing with pencil brush (2px stroke width)
- **Colors**: Red (#EF4444), Blue (#3B82F6), Green (#22C55E), Black (#000000)
- **Undo**: Remove last annotation
- **Clear**: Remove all annotations on current page

### Text Annotation Behavior
When a text annotation is selected:
- **Corner handles**: Uniform scaling (both dimensions proportionally)
- **Left/right side handles**: Adjust textbox width (text wrapping area)
- **Top/bottom handles**: Disabled (height is auto-calculated from content)
- Uses `lockUniScaling: true` in Fabric.js to enforce proportional scaling

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

### Production Deployment (with SSL)
The app uses **Caddy** as a reverse proxy with automatic HTTPS via Let's Encrypt.

```bash
# On VPS, from project root:
docker compose up -d
```

This starts:
- **Caddy**: Reverse proxy on ports 80/443, auto-obtains SSL certificate
- **Frontend**: Nginx serving React app (internal only)
- **Backend**: FastAPI server (internal only)

Caddy automatically:
- Obtains SSL certificate from Let's Encrypt
- Redirects HTTP → HTTPS
- Renews certificates before expiry

**Requirements**:
- Domain DNS pointing to VPS
- Ports 80 and 443 open in firewall
- No other service using ports 80/443

The domain is configured in `Caddyfile`:
```
encrerouge.ink {
    reverse_proxy frontend:80
}
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

### Zoom Levels and Performance
The DocumentViewer uses internal scale values displayed at 2x:
- Internal 0.25 → 50% display
- Internal 0.33 → 66% display
- Internal 0.5 → 100% display
- Internal 0.625 → 125% display (max)

**Performance note**: Canvas performance degrades non-linearly with size (pixel count = scale²). Testing found that internal scales above ~0.65-0.7 cause sluggish annotation rendering due to Fabric.js redraw overhead. The 0.625 max was chosen as a safe limit that works across different hardware.

## Chrome Extension

### Purpose
The Chrome extension allows uploading documents directly from TELUQ university pages (`univ.teluq.ca`) to Red Ink without manually downloading and re-uploading files.

### How It Works
1. **Content script** (`content.js`) runs on `https://univ.teluq.ca/*` pages
2. Detects PDF/DOCX links by checking both `href` and **link text** (important: TELUQ uses dynamic download URLs like `d_doc.aspx?guid=...` where the filename only appears in the link text)
3. Injects a small red upload button next to each document link
4. When clicked, sends message to background service worker
5. **Background script** (`background.js`) downloads the file using the user's authenticated TELUQ session cookies
6. Uploads to Red Ink API with `X-User-Id` header for ownership
7. Opens the document in a new tab and syncs the user ID to frontend localStorage

### Key Design Decisions

#### Link Detection
TELUQ doesn't use direct PDF URLs. Instead, links look like:
- **href**: `https://univ.teluq.ca/depot-travaux/download/d_doc.aspx?guid=XXX`
- **text**: `INF1220-StudentName-Assignment.pdf`

The content script checks BOTH href and text content for file extensions:
```javascript
function isDocumentLink(link) {
  const href = link.href?.toLowerCase() || '';
  const text = link.textContent?.toLowerCase() || '';
  return FILE_EXTENSIONS.some(ext => href.includes(ext) || text.includes(ext));
}
```

#### User ID Synchronization
Documents have ownership via `user_id`. The extension maintains its own user ID in `chrome.storage.sync` and syncs it to the frontend:

1. Extension creates/retrieves user ID via `/api/users` endpoint
2. Sends `X-User-Id` header with upload request
3. After opening document tab, injects script to set `localStorage['red-ink-user-token']`
4. Reloads page so frontend recognizes ownership and enables editing

This ensures documents uploaded via extension are editable (not read-only).

#### URL Mapping
The extension derives frontend URL from API URL:
- `http://localhost:8001` → `http://localhost:5173` (development)
- `https://encrerouge.ink` → `https://encrerouge.ink` (production)

#### Iframe Support
TELUQ opens document details in a **fancybox iframe popup**. The manifest uses `"all_frames": true` so the content script runs inside iframes and can inject buttons in the popup.

### Extension Files

| File | Purpose |
|------|---------|
| `manifest.json` | Manifest V3 config, permissions, content script matching |
| `content.js` | Detects document links, injects upload buttons |
| `content.css` | Button styling (red, with loading/success/error states) |
| `background.js` | Service worker: file download, upload, user ID management |
| `popup.html/js` | Extension popup showing connection status |
| `options.html/js` | Settings page for API URL configuration |
| `icons/` | Extension icons (16/48/128px PNG) |
| `generate_icons.py` | Python script to regenerate icons |

### Permissions Required
```json
{
  "permissions": ["storage", "notifications", "scripting"],
  "host_permissions": [
    "https://univ.teluq.ca/*",
    "http://localhost:8001/*",
    "http://localhost:5173/*",
    "https://encrerouge.ink/*"
  ]
}
```

### Installation
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `chrome-extension/` folder
5. Click extension icon → Settings to configure API URL

### Configuration
Default API URL: `http://localhost:8001`

Presets available in settings:
- **Localhost**: `http://localhost:8001`
- **Production**: `https://encrerouge.ink`

### Troubleshooting

**Button doesn't appear:**
- Verify you're on `univ.teluq.ca` domain
- Check that the link text contains `.pdf`, `.docx`, or `.doc`
- Reload the extension in `chrome://extensions/`
- Refresh the page

**Upload fails with CORS error:**
- Check extension is pointing to backend (port 8001), not frontend (port 5173)
- Verify backend is running

**Document opens in read-only mode:**
- Extension user ID sync may have failed
- Check browser console for errors
- Try reloading the extension and uploading again

**File downloads but upload fails:**
- Verify you're logged into TELUQ (cookies needed for authenticated download)
- Check Red Ink backend is running and accessible
