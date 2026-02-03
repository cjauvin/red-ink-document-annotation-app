import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getAllDocuments, deleteDocument } from '../api/client';

export function AdminDocuments() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchDocuments() {
      try {
        const data = await getAllDocuments();
        setDocuments(data.documents);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchDocuments();
  }, []);

  const handleDelete = useCallback(async (e, doc) => {
    e.stopPropagation();

    if (!window.confirm(`Supprimer "${doc.original_filename}"? Cette action est irréversible.`)) {
      return;
    }

    try {
      await deleteDocument(doc.id);
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (err) {
      alert(`Échec de la suppression: ${err.message}`);
    }
  }, []);

  if (loading) {
    return <p className="text-gray-500 text-center py-4">Chargement des documents...</p>;
  }

  if (error) {
    return <p className="text-red-500 text-center py-4">{error}</p>;
  }

  if (documents.length === 0) {
    return (
      <p className="text-gray-500 text-center py-4">
        Aucun document dans le système.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="flex items-center gap-2"
        >
          <Link
            to={`/document/${doc.id}`}
            className="flex-1 p-4 bg-white border border-gray-200 rounded-lg hover:border-red-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">{doc.original_filename}</h3>
                <p className="text-sm text-gray-500">
                  {new Date(doc.updated_at).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {doc.user_id && (
                    <span className="ml-2 text-gray-400">
                      · User: {doc.user_id.substring(0, 8)}...
                    </span>
                  )}
                </p>
              </div>
              <span className="text-gray-400">→</span>
            </div>
          </Link>
          <button
            type="button"
            onClick={(e) => handleDelete(e, doc)}
            className="p-3 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Supprimer le document"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
