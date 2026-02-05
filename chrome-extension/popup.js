// Popup script

const DEFAULT_API_URL = 'http://localhost:8001';

document.addEventListener('DOMContentLoaded', async () => {
  const statusDiv = document.getElementById('status');
  const apiUrlDiv = document.getElementById('apiUrl');
  const openRedInkBtn = document.getElementById('openRedInk');
  const openOptionsBtn = document.getElementById('openOptions');

  // Get saved API URL
  const result = await chrome.storage.sync.get(['apiUrl']);
  const apiUrl = result.apiUrl || DEFAULT_API_URL;
  apiUrlDiv.textContent = apiUrl;

  // Check connection
  try {
    const response = await fetch(`${apiUrl}/api/documents/`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000)
    });

    if (response.ok || response.status === 404) {
      statusDiv.innerHTML = `<strong>Connected</strong><div class="api-url">${apiUrl}</div>`;
      statusDiv.className = 'status connected';
    } else {
      throw new Error('Server error');
    }
  } catch (error) {
    statusDiv.innerHTML = `<strong>Not connected</strong><div class="api-url">${apiUrl}</div>`;
    statusDiv.className = 'status disconnected';
  }

  // Open Red Ink
  openRedInkBtn.addEventListener('click', () => {
    // Derive frontend URL from API URL
    let frontendUrl = apiUrl;
    if (apiUrl.includes('localhost:8001')) {
      frontendUrl = 'http://localhost:5173';
    } else if (apiUrl.includes('encrerouge.ink')) {
      frontendUrl = 'https://encrerouge.ink';
    }
    chrome.tabs.create({ url: frontendUrl });
  });

  // Open options
  openOptionsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
});
