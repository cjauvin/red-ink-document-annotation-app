// Background service worker for Red Ink Uploader

const DEFAULT_API_URL = 'http://localhost:8001';

async function getApiUrl() {
  const result = await chrome.storage.sync.get(['apiUrl']);
  return result.apiUrl || DEFAULT_API_URL;
}

async function downloadFile(url) {
  const response = await fetch(url, {
    credentials: 'include' // Include cookies for authenticated downloads
  });

  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status}`);
  }

  return await response.blob();
}

async function uploadToRedInk(fileBlob, filename) {
  const apiUrl = await getApiUrl();
  const formData = new FormData();
  formData.append('file', fileBlob, filename);

  const response = await fetch(`${apiUrl}/api/documents/upload`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Upload failed: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'uploadToRedInk') {
    handleUpload(message.url, message.filename)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));

    // Return true to indicate async response
    return true;
  }
});

function getFrontendUrl(apiUrl) {
  // Derive frontend URL from API URL
  if (apiUrl.includes('localhost:8001')) {
    return 'http://localhost:5173';
  } else if (apiUrl.includes('encrerouge.ink')) {
    return 'https://encrerouge.ink';
  }
  // Default: assume frontend is on same host without port
  return apiUrl.replace(/:\d+$/, '');
}

async function handleUpload(fileUrl, filename) {
  try {
    // Download the file
    const fileBlob = await downloadFile(fileUrl);

    // Upload to Red Ink
    const result = await uploadToRedInk(fileBlob, filename);

    // Get frontend URL and open document in new tab
    const apiUrl = await getApiUrl();
    const frontendUrl = getFrontendUrl(apiUrl);
    const documentUrl = `${frontendUrl}/document/${result.id}`;

    chrome.tabs.create({ url: documentUrl });

    return result;
  } catch (error) {
    // Show error notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Red Ink - Error',
      message: `Failed to upload ${filename}: ${error.message}`
    });
    throw error;
  }
}

