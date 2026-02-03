import { useState, useCallback, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams, Link } from 'react-router-dom';
import { FileUpload } from './components/FileUpload';
import { DocumentViewer } from './components/DocumentViewer';
import { AnnotationCanvas } from './components/AnnotationCanvas';
import { Toolbar } from './components/Toolbar';
import { SharedView } from './components/SharedView';
import { MyDocuments } from './components/MyDocuments';
import { AdminDocuments } from './components/AdminDocuments';
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

function DocumentPage() {
  const { id } = useParams();
  const [document, setDocument] = useState(null);
  const [annotationsMap, setAnnotationsMap] = useState({});  // { pageNumber: annotationData }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [documentDimensions, setDocumentDimensions] = useState(null);
  const [activeTool, setActiveTool] = useState('arrow');
  const [activeColor, setActiveColor] = useState('#EF4444');
  const [canUndoMap, setCanUndoMap] = useState({});  // { pageNumber: boolean }
  const [activePage, setActivePage] = useState(1);  // Track which page is being edited

  const canvasRefsMap = useRef({});  // { pageNumber: canvasRef }

  // Check if current user is the document owner
  const currentUserId = getUserToken();
  const isOwner = document?.user_id && document.user_id === currentUserId;
  const readOnly = !isOwner;

  // Debounced save functions per page
  const saveFunctionsRef = useRef({});

  const getSaveFunction = useCallback((pageNumber) => {
    if (!saveFunctionsRef.current[pageNumber]) {
      saveFunctionsRef.current[pageNumber] = debounce((data) => {
        saveAnnotations(id, pageNumber, data);
      }, 500);
    }
    return saveFunctionsRef.current[pageNumber];
  }, [id]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [doc, annots] = await Promise.all([
          getDocument(id),
          getAnnotations(id),
        ]);
        setDocument(doc);
        // Build map of annotations by page number
        const map = {};
        annots.annotations.forEach((a) => {
          if (a.page_number > 0) {  // Skip legacy global annotations (page 0)
            map[a.page_number] = a.annotation_data;
          }
        });
        setAnnotationsMap(map);
      } catch (err) {
        setError(err.message || 'Failed to load document');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [id]);

  // Reset save functions when id changes
  useEffect(() => {
    saveFunctionsRef.current = {};
  }, [id]);

  const handleDocumentDimensions = useCallback((dims) => {
    setDocumentDimensions(dims);
  }, []);

  const handleCanvasChange = useCallback((pageNumber, data) => {
    if (!readOnly) {
      getSaveFunction(pageNumber)(data);
      setAnnotationsMap(prev => ({ ...prev, [pageNumber]: data }));
    }
  }, [readOnly, getSaveFunction]);

  const handleHistoryChange = useCallback((pageNumber, hasHistory) => {
    setCanUndoMap(prev => ({ ...prev, [pageNumber]: hasHistory }));
  }, []);

  const handleUndo = useCallback(() => {
    canvasRefsMap.current[activePage]?.undo();
  }, [activePage]);

  const handleClear = useCallback(() => {
    if (!window.confirm('Enlever toutes les annotations de cette page? Cette action est irréversible.')) {
      return;
    }
    canvasRefsMap.current[activePage]?.clear();
  }, [activePage]);

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

  const renderAnnotations = useCallback((pageNumber, pageWidth, pageHeight) => {
    if (!documentDimensions) return null;

    return (
      <AnnotationCanvas
        ref={(ref) => {
          canvasRefsMap.current[pageNumber] = ref;
        }}
        width={pageWidth}
        height={pageHeight}
        scale={documentDimensions.scale}
        activeTool={activeTool}
        activeColor={activeColor}
        onCanvasChange={(data) => handleCanvasChange(pageNumber, data)}
        initialData={annotationsMap[pageNumber] || null}
        onHistoryChange={(hasHistory) => handleHistoryChange(pageNumber, hasHistory)}
        onFocus={() => setActivePage(pageNumber)}
        readOnly={readOnly}
      />
    );
  }, [documentDimensions, activeTool, activeColor, handleCanvasChange, annotationsMap, handleHistoryChange, readOnly]);

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
        canUndo={canUndoMap[activePage] || false}
        readOnly={readOnly}
      />

      {/* Document viewer with annotations */}
      <div className="flex-1 overflow-hidden">
        <DocumentViewer
          fileUrl={getDocumentFileUrl(id)}
          onDocumentDimensions={handleDocumentDimensions}
          renderAnnotations={renderAnnotations}
          annotationCount={Object.values(annotationsMap).reduce((sum, data) => sum + (data?.objects?.length || 0), 0)}
        />
      </div>
    </div>
  );
}

function AdminPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto">
        <div className="pt-12 pb-8 px-8">
          <div className="flex justify-center mb-4">
            <Link to="/">
              <img src="/encre-rouge-logo.png" alt="Encre Rouge" className="h-32" />
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 text-center mb-8">Administration</h1>
        </div>

        <div className="border-t border-gray-200 px-8 py-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Tous les documents</h2>
          <AdminDocuments />
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/document/:id" element={<DocumentPage />} />
        <Route path="/share/:hash" element={<SharedView />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
