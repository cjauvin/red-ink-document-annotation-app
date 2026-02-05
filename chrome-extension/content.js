// Content script for Red Ink Uploader
// Injects "Send to Red Ink" buttons next to PDF/DOCX links

const FILE_EXTENSIONS = ['.pdf', '.docx', '.doc'];

function isDocumentLink(link) {
  const href = link.href?.toLowerCase() || '';
  const text = link.textContent?.toLowerCase() || '';
  // Check both href and link text for file extensions
  return FILE_EXTENSIONS.some(ext => href.includes(ext) || text.includes(ext));
}

function getFilenameFromLink(link) {
  // First, try to get filename from link text (common for dynamic download links)
  const text = link.textContent?.trim() || '';
  if (FILE_EXTENSIONS.some(ext => text.toLowerCase().includes(ext))) {
    return text;
  }

  // Fall back to extracting from URL
  try {
    const url = new URL(link.href);
    const pathname = url.pathname;
    const filename = pathname.split('/').pop();
    return decodeURIComponent(filename) || 'document';
  } catch {
    return 'document';
  }
}

function createRedInkButton(link) {
  const button = document.createElement('button');
  button.className = 'red-ink-upload-btn';
  button.title = 'Send to Red Ink';
  button.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 19V5M5 12l7-7 7 7"/>
    </svg>
  `;

  button.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const filename = getFilenameFromLink(link);
    button.classList.add('uploading');
    button.disabled = true;

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'uploadToRedInk',
        url: link.href,
        filename: filename
      });

      if (response.success) {
        button.classList.remove('uploading');
        button.classList.add('success');
        setTimeout(() => button.classList.remove('success'), 2000);
      } else {
        throw new Error(response.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Red Ink upload error:', error);
      button.classList.remove('uploading');
      button.classList.add('error');
      setTimeout(() => button.classList.remove('error'), 2000);
    } finally {
      button.disabled = false;
    }
  });

  return button;
}

function injectButtons() {
  const links = document.querySelectorAll('a[href]');

  links.forEach(link => {
    // Skip if already processed
    if (link.dataset.redInkProcessed) return;

    if (isDocumentLink(link)) {
      link.dataset.redInkProcessed = 'true';

      // Create wrapper to position button
      const wrapper = document.createElement('span');
      wrapper.className = 'red-ink-wrapper';
      wrapper.style.display = 'inline-flex';
      wrapper.style.alignItems = 'center';
      wrapper.style.gap = '4px';

      // Wrap the link
      link.parentNode.insertBefore(wrapper, link);
      wrapper.appendChild(link);
      wrapper.appendChild(createRedInkButton(link));
    }
  });
}

// Run on page load
injectButtons();

// Watch for dynamically added links
const observer = new MutationObserver((mutations) => {
  let shouldInject = false;
  mutations.forEach(mutation => {
    if (mutation.addedNodes.length > 0) {
      shouldInject = true;
    }
  });
  if (shouldInject) {
    injectButtons();
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});
