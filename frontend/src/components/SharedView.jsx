import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getSharedDocument, getDocumentFileUrl } from '../api/client';
import { DocumentViewer } from './DocumentViewer';
import { AnnotationCanvas } from './AnnotationCanvas';

export function SharedView() {
  const { hash } = useParams();
  const [document, setDocument] = useState(null);
  const [annotationsMap, setAnnotationsMap] = useState({});  // { pageNumber: annotationData }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [documentDimensions, setDocumentDimensions] = useState(null);

  useEffect(() => {
    async function fetchDocument() {
      try {
        const data = await getSharedDocument(hash);
        setDocument(data.document);
        // Build map of annotations by page number
        const map = {};
        data.annotations.forEach((a) => {
          if (a.page_number > 0) {  // Skip legacy global annotations (page 0)
            map[a.page_number] = a.annotation_data;
          }
        });
        setAnnotationsMap(map);
      } catch (err) {
        setError(err.message || 'Document not found');
      } finally {
        setLoading(false);
      }
    }

    fetchDocument();
  }, [hash]);

  const handleDocumentDimensions = useCallback((dims) => {
    setDocumentDimensions(dims);
  }, []);

  const renderAnnotations = useCallback((pageNumber, pageWidth, pageHeight) => {
    if (!documentDimensions) return null;

    return (
      <AnnotationCanvas
        width={pageWidth}
        height={pageHeight}
        scale={documentDimensions.scale}
        initialData={annotationsMap[pageNumber] || null}
        readOnly
      />
    );
  }, [documentDimensions, annotationsMap]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-500">Chargement du document...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <p className="text-red-500 mb-4">{error}</p>
        <Link to="/" className="text-red-600 hover:text-red-700">
          Retour à l'accueil
        </Link>
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
            <p className="text-sm text-gray-500">Document partagé (lecture seule)</p>
          </div>
        </div>
        <Link
          to="/"
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        >
          Téléverser le vôtre
        </Link>
      </div>

      {/* Document viewer with annotations */}
      <div className="flex-1 overflow-hidden">
        <DocumentViewer
          fileUrl={getDocumentFileUrl(document.id)}
          onDocumentDimensions={handleDocumentDimensions}
          renderAnnotations={renderAnnotations}
          readOnly
          annotationCount={Object.values(annotationsMap).reduce((sum, data) => sum + (data?.objects?.length || 0), 0)}
        />
      </div>
    </div>
  );
}
