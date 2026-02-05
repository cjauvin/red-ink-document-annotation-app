// Options page script

const DEFAULT_API_URL = 'http://localhost:8001';

document.addEventListener('DOMContentLoaded', async () => {
  const apiUrlInput = document.getElementById('apiUrl');
  const saveButton = document.getElementById('save');
  const statusDiv = document.getElementById('status');

  // Load saved settings
  const result = await chrome.storage.sync.get(['apiUrl']);
  apiUrlInput.value = result.apiUrl || DEFAULT_API_URL;

  // Preset buttons
  document.querySelectorAll('.presets button').forEach(button => {
    button.addEventListener('click', () => {
      apiUrlInput.value = button.dataset.url;
    });
  });

  // Save settings
  saveButton.addEventListener('click', async () => {
    const apiUrl = apiUrlInput.value.trim().replace(/\/$/, ''); // Remove trailing slash

    if (!apiUrl) {
      showStatus('Please enter a valid URL', 'error');
      return;
    }

    try {
      // Test the connection
      const testUrl = `${apiUrl}/api/health`;
      const response = await fetch(testUrl, { method: 'GET' });

      if (!response.ok && response.status !== 404) {
        // 404 is OK - health endpoint might not exist
        throw new Error(`Server returned ${response.status}`);
      }

      await chrome.storage.sync.set({ apiUrl });
      showStatus('Settings saved successfully!', 'success');
    } catch (error) {
      // Save anyway but warn
      await chrome.storage.sync.set({ apiUrl });
      showStatus(`Settings saved. Note: Could not verify connection (${error.message})`, 'success');
    }
  });

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    setTimeout(() => {
      statusDiv.className = 'status';
    }, 3000);
  }
});
