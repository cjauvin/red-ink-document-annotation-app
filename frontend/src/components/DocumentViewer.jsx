import { useState, useCallback, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Internal scale values
// Displayed as 2x: 25% → 50%, 33% → 66%, 50% → 100%, 62.5% → 125%
const ZOOM_LEVELS = [0.25, 0.33, 0.5, 0.625];
const FIT_WIDTH = 'fit';
const ZOOM_STORAGE_KEY = 'red-ink-zoom-level';

// Load zoom from localStorage
const getInitialZoom = () => {
  try {
    const stored = localStorage.getItem(ZOOM_STORAGE_KEY);
    if (stored === FIT_WIDTH) return FIT_WIDTH;
    const parsed = parseFloat(stored);
    if (!isNaN(parsed) && ZOOM_LEVELS.includes(parsed)) {
      return parsed;
    }
    // If stored value is out of new range (e.g., old 0.67+), use max
    if (!isNaN(parsed) && parsed > 0.5) {
      return 0.5;
    }
  } catch (e) {
    // localStorage not available
  }
  return 0.33;
};

const PAGE_GAP = 16; // Gap between pages in pixels (gap-4 = 16px)

export function DocumentViewer({
  fileUrl,
  onDocumentDimensions,
  renderAnnotations,
  readOnly = false,
  annotationCount = 0,
}) {
  const [numPages, setNumPages] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(null);
  const [originalPageSize, setOriginalPageSize] = useState(null);
  const [zoom, setZoomState] = useState(getInitialZoom);

  // Wrapper to save zoom to localStorage
  const setZoom = useCallback((newZoom) => {
    setZoomState(newZoom);
    try {
      localStorage.setItem(ZOOM_STORAGE_KEY, String(newZoom));
    } catch (e) {
      // localStorage not available
    }
  }, []);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const onDocumentLoadSuccess = useCallback(({ numPages }) => {
    setNumPages(numPages);
    setLoading(false);
  }, []);

  const onDocumentLoadError = useCallback((error) => {
    console.error('PDF load error:', error);
    setError('Échec du chargement du document');
    setLoading(false);
  }, []);

  // Calculate the page width based on zoom level
  const calculatePageWidth = useCallback(() => {
    if (!containerWidth) return undefined;

    if (zoom === FIT_WIDTH) {
      // Account for padding (24px each side) and scrollbar (~20px)
      return containerWidth - 68;
    }

    if (originalPageSize) {
      return originalPageSize.width * zoom;
    }

    return containerWidth - 68;
  }, [zoom, originalPageSize, containerWidth]);

  const onFirstPageLoadSuccess = useCallback((page) => {
    const { width, height } = page;

    if (!originalPageSize) {
      setOriginalPageSize({ width, height });
    }
  }, [originalPageSize]);

  // Calculate and report total document dimensions
  useEffect(() => {
    if (!originalPageSize || !containerWidth || !numPages) return;

    const pageWidth = calculatePageWidth();
    const scale = pageWidth / originalPageSize.width;
    const pageHeight = originalPageSize.height * scale;

    // Total height = all pages + gaps between them
    const totalHeight = (pageHeight * numPages) + (PAGE_GAP * (numPages - 1));

    if (onDocumentDimensions) {
      onDocumentDimensions({
        width: pageWidth,
        height: totalHeight,
        pageHeight,
        numPages,
        originalWidth: originalPageSize.width,
        originalHeight: originalPageSize.height,
        scale,
      });
    }
  }, [zoom, originalPageSize, containerWidth, numPages, calculatePageWidth, onDocumentDimensions]);

  const handleZoomIn = () => {
    if (zoom === FIT_WIDTH) {
      const fitScale = calculateFitScale();
      const nextLevel = ZOOM_LEVELS.find(level => level > fitScale) || ZOOM_LEVELS[ZOOM_LEVELS.length - 1];
      setZoom(nextLevel);
    } else {
      const currentIndex = ZOOM_LEVELS.indexOf(zoom);
      if (currentIndex < ZOOM_LEVELS.length - 1) {
        setZoom(ZOOM_LEVELS[currentIndex + 1]);
      }
    }
  };

  const handleZoomOut = () => {
    if (zoom === FIT_WIDTH) {
      const fitScale = calculateFitScale();
      const levels = [...ZOOM_LEVELS].reverse();
      const nextLevel = levels.find(level => level < fitScale) || ZOOM_LEVELS[0];
      setZoom(nextLevel);
    } else {
      const currentIndex = ZOOM_LEVELS.indexOf(zoom);
      if (currentIndex > 0) {
        setZoom(ZOOM_LEVELS[currentIndex - 1]);
      }
    }
  };

  const handleFitWidth = () => {
    setZoom(FIT_WIDTH);
  };

  const calculateFitScale = () => {
    if (!originalPageSize || !containerWidth) return 1;
    return (containerWidth - 68) / originalPageSize.width;
  };

  const getZoomDisplay = () => {
    if (zoom === FIT_WIDTH) {
      const fitScale = calculateFitScale();
      // Display at 2x since we capped internal scale at 0.5
      return `Ajuster (${Math.round(fitScale * 200)}%)`;
    }
    // Display at 2x since we capped internal scale at 0.5
    return `${Math.round(zoom * 200)}%`;
  };

  const pageWidth = calculatePageWidth();

  return (
    <div className="flex flex-col h-full">
      {/* Zoom controls */}
      <div className="bg-gray-100 border-b border-gray-200 px-4 py-2 flex items-center justify-between">
        <span className="text-sm text-gray-600">
          {numPages ? `${numPages} page${numPages > 1 ? 's' : ''} · ${annotationCount} annotation${annotationCount !== 1 ? 's' : ''}` : 'Chargement...'}
        </span>

        {/* Zoom controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            className="px-2 py-1 rounded text-sm text-gray-600 hover:bg-gray-200"
            title="Zoom arrière"
          >
            −
          </button>
          <button
            onClick={handleFitWidth}
            className={`px-3 py-1 rounded text-sm min-w-[100px] ${
              zoom === FIT_WIDTH
                ? 'bg-gray-300 text-gray-800'
                : 'text-gray-600 hover:bg-gray-200'
            }`}
            title="Ajuster à la largeur"
          >
            {getZoomDisplay()}
          </button>
          <button
            onClick={handleZoomIn}
            className="px-2 py-1 rounded text-sm text-gray-600 hover:bg-gray-200"
            title="Zoom avant"
          >
            +
          </button>
        </div>
      </div>

      {/* PDF container - continuous scroll */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-gray-200"
      >
        <div className="min-h-full py-4 px-6 flex flex-col items-center">
          {error ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-red-500">{error}</p>
            </div>
          ) : (
            <div className="relative">
              <Document
                file={fileUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={
                  <div className="flex items-center justify-center h-64">
                    <p className="text-gray-500">Chargement du document...</p>
                  </div>
                }
                className="flex flex-col items-center gap-4"
              >
                {numPages && Array.from({ length: numPages }, (_, index) => (
                  <div key={index} className="shadow-lg">
                    <Page
                      pageNumber={index + 1}
                      width={pageWidth}
                      onLoadSuccess={index === 0 ? onFirstPageLoadSuccess : undefined}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                      loading={
                        <div className="flex items-center justify-center h-64 bg-white" style={{ width: pageWidth }}>
                          <p className="text-gray-500">Chargement de la page {index + 1}...</p>
                        </div>
                      }
                    />
                  </div>
                ))}
              </Document>
              {/* Single annotation canvas overlay for entire document */}
              {!loading && renderAnnotations && (
                <div className="absolute top-0 left-0 w-full h-full pointer-events-auto">
                  {renderAnnotations()}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
