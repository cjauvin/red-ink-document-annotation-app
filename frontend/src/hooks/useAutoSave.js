import { useMemo, useCallback, useEffect } from 'react';
import debounce from 'lodash/debounce';
import { saveAnnotations } from '../api/client';

export function useAutoSave(documentId, pageNumber) {
  const debouncedSave = useMemo(() => {
    return debounce(async (data) => {
      if (!documentId || !pageNumber) return;

      try {
        await saveAnnotations(documentId, pageNumber, data);
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }, 500);
  }, [documentId, pageNumber]);

  // Cancel pending saves when component unmounts or dependencies change
  useEffect(() => {
    return () => {
      debouncedSave.cancel();
    };
  }, [debouncedSave]);

  const save = useCallback((data) => {
    debouncedSave(data);
  }, [debouncedSave]);

  return { save };
}
