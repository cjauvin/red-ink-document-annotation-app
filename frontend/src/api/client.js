const API_BASE = '/api';
const USER_TOKEN_KEY = 'red-ink-user-token';

// User management
export function getUserToken() {
  return localStorage.getItem(USER_TOKEN_KEY);
}

export function setUserToken(token) {
  localStorage.setItem(USER_TOKEN_KEY, token);
}

export async function createAnonymousUser() {
  const response = await fetch(`${API_BASE}/users`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error('Failed to create user');
  }

  return response.json();
}

export async function getOrCreateUser() {
  const existingToken = getUserToken();

  if (existingToken) {
    // Verify user still exists
    const response = await fetch(`${API_BASE}/users/${existingToken}`);
    if (response.ok) {
      return existingToken;
    }
  }

  // Create new user
  const user = await createAnonymousUser();
  setUserToken(user.id);
  return user.id;
}

export async function getUserDocuments(userId) {
  const response = await fetch(`${API_BASE}/users/${userId}/documents`);

  if (!response.ok) {
    throw new Error('Failed to get documents');
  }

  return response.json();
}

export async function uploadDocument(file, userId = null) {
  const formData = new FormData();
  formData.append('file', file);

  const headers = {};
  if (userId) {
    headers['X-User-Id'] = userId;
  }

  const response = await fetch(`${API_BASE}/documents/upload`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Upload failed');
  }

  return response.json();
}

export async function getDocument(documentId) {
  const response = await fetch(`${API_BASE}/documents/${documentId}`);

  if (!response.ok) {
    throw new Error('Document not found');
  }

  return response.json();
}

export function getDocumentFileUrl(documentId) {
  return `${API_BASE}/documents/${documentId}/file`;
}

export async function getAnnotations(documentId) {
  const response = await fetch(`${API_BASE}/documents/${documentId}/annotations`);

  if (!response.ok) {
    throw new Error('Failed to get annotations');
  }

  return response.json();
}

export async function saveAnnotations(documentId, pageNumber, annotationData) {
  const response = await fetch(`${API_BASE}/documents/${documentId}/annotations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      page_number: pageNumber,
      annotation_data: annotationData,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to save annotations');
  }

  return response.json();
}

export async function getSharedDocument(shareHash) {
  const response = await fetch(`${API_BASE}/share/${shareHash}`);

  if (!response.ok) {
    throw new Error('Shared document not found');
  }

  return response.json();
}

export async function deleteDocument(documentId, userId = null) {
  const headers = {};
  if (userId) {
    headers['X-User-Id'] = userId;
  }

  const response = await fetch(`${API_BASE}/documents/${documentId}`, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to delete document');
  }

  return response.json();
}
