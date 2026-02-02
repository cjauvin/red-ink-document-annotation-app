import { useState, useCallback, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams, Link } from 'react-router-dom';
import { FileUpload } from './components/FileUpload';
import { DocumentViewer } from './components/DocumentViewer';
import { AnnotationCanvas } from './components/AnnotationCanvas';
import { Toolbar } from './components/Toolbar';
import { SharedView } from './components/SharedView';
import { MyDocuments } from './components/MyDocuments';
import { saveAnnotations, getDocument, getAnnotations, getDocumentFileUrl, getOrCreateUser, getUserToken } from './api/client';
import debounce from 'lodash/debounce';

function HomePage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState(null);
  const [userLoading, setUserLoading] = useState(true);

  useEffect(() => {
    async function initUser() {
      try {
        const id = await getOrCreateUser();
        setUserId(id);
      } catch (err) {
        console.error('Failed to initialize user:', err);
      } finally {
        setUserLoading(false);
      }
    }
    initUser();
  }, []);

  const handleUploadComplete = useCallback((document) => {
    navigate(`/document/${document.id}`);
  }, [navigate]);

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-500">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto">
        {/* Upload section */}
        <div className="pt-12 pb-8 px-8">
          <div className="flex justify-center mb-4">
            <img src="/encre-rouge-logo.png" alt="Encre Rouge" className="h-[500px]" />
          </div>
          <p className="text-gray-600 text-center mb-8">
            Téléverser un document à annoter
          </p>
          <FileUpload onUploadComplete={handleUploadComplete} userId={userId} />
        </div>

        {/* Documents section */}
        <div className="border-t border-gray-200 px-8 py-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Mes documents</h2>
          <MyDocuments key={userId} />
        </div>
      </div>
    </div>
  );
}

// Use page_number = 0 to indicate global (cross-page) annotations
const GLOBAL_PAGE = 0;

function DocumentPage() {
  const { id } = useParams();
  const [document, setDocument] = useState(null);
  const [annotationData, setAnnotationData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [documentDimensions, setDocumentDimensions] = useState(null);
  const [activeTool, setActiveTool] = useState('arrow');
  const [activeColor, setActiveColor] = useState('#EF4444');
  const [canUndo, setCanUndo] = useState(false);

  const canvasRef = useRef(null);

  // Check if current user is the document owner
  const currentUserId = getUserToken();
  const isOwner = document?.user_id && document.user_id === currentUserId;
  const readOnly = !isOwner;

  // Debounced save function for global annotations
  const saveFunction = useRef(
    debounce((data) => {
      saveAnnotations(id, GLOBAL_PAGE, data);
    }, 500)
  );

  useEffect(() => {
    async function fetchData() {
      try {
        const [doc, annots] = await Promise.all([
          getDocument(id),
          getAnnotations(id),
        ]);
        setDocument(doc);
        // Look for global annotation (page_number = 0)
        const globalAnnotation = annots.annotations.find((a) => a.page_number === GLOBAL_PAGE);
        setAnnotationData(globalAnnotation?.annotation_data || null);
      } catch (err) {
        setError(err.message || 'Failed to load document');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [id]);

  // Update save function when id changes
  useEffect(() => {
    saveFunction.current = debounce((data) => {
      saveAnnotations(id, GLOBAL_PAGE, data);
    }, 500);
  }, [id]);

  const handleDocumentDimensions = useCallback((dims) => {
    setDocumentDimensions(dims);
  }, []);

  const handleCanvasChange = useCallback((data) => {
    if (!readOnly) {
      saveFunction.current(data);
      setAnnotationData(data);
    }
  }, [readOnly]);

  const handleHistoryChange = useCallback((hasHistory) => {
    setCanUndo(hasHistory);
  }, []);

  const handleUndo = useCallback(() => {
    canvasRef.current?.undo();
  }, []);

  const handleClear = useCallback(() => {
    if (!window.confirm('Enlever toutes les annotations? Cette action est irréversible.')) {
      return;
    }
    canvasRef.current?.clear();
  }, []);

  const handleCopyShareLink = useCallback(async () => {
    if (!document) return;

    const shareUrl = `${window.location.origin}/share/${document.share_hash}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert('Lien de partage copié!');
    } catch (err) {
      prompt('Copier ce lien de partage:', shareUrl);
    }
  }, [document]);

  const renderAnnotations = useCallback(() => {
    if (!documentDimensions) return null;

    return (
      <AnnotationCanvas
        ref={canvasRef}
        width={documentDimensions.width}
        height={documentDimensions.height}
        scale={documentDimensions.scale}
        activeTool={activeTool}
        activeColor={activeColor}
        onCanvasChange={handleCanvasChange}
        initialData={annotationData}
        onHistoryChange={handleHistoryChange}
        readOnly={readOnly}
      />
    );
  }, [documentDimensions, activeTool, activeColor, handleCanvasChange, annotationData, handleHistoryChange, readOnly]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-500">Chargement du document...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/">
            <img src="/encre-rouge-logo.png" alt="Encre Rouge" className="h-20" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              {document.original_filename}
            </h1>
            {readOnly && (
              <p className="text-sm text-gray-500">Lecture seule</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
          >
            Mes documents
          </Link>
          {isOwner && (
            <button
              onClick={handleCopyShareLink}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Partager
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <Toolbar
        activeTool={activeTool}
        activeColor={activeColor}
        onToolChange={setActiveTool}
        onColorChange={setActiveColor}
        onUndo={handleUndo}
        onClear={handleClear}
        canUndo={canUndo}
        readOnly={readOnly}
      />

      {/* Document viewer with annotations */}
      <div className="flex-1 overflow-hidden">
        <DocumentViewer
          fileUrl={getDocumentFileUrl(id)}
          onDocumentDimensions={handleDocumentDimensions}
          renderAnnotations={renderAnnotations}
          annotationCount={annotationData?.objects?.length || 0}
        />
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/document/:id" element={<DocumentPage />} />
        <Route path="/share/:hash" element={<SharedView />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
