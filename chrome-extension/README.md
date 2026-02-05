# Red Ink Uploader - Chrome Extension

A Chrome extension that adds "Send to Red Ink" buttons next to PDF and DOCX links on TELUQ university pages, allowing you to upload documents directly for annotation.

## Features

- Injects upload buttons next to PDF/DOCX links on `univ.teluq.ca`
- Downloads files using your authenticated session
- Uploads directly to your Red Ink instance
- Configurable backend URL (localhost or production)
- Visual feedback (loading, success, error states)

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `chrome-extension` folder

## Configuration

1. Click the extension icon in Chrome toolbar
2. Click "Settings"
3. Enter your Red Ink API URL:
   - Development: `http://localhost:8001`
   - Production: `https://encrerouge.ink`
4. Click "Save Settings"

## Usage

1. Navigate to a TELUQ page with document links (e.g., `https://univ.teluq.ca/NotreTELUQ/depot/`)
2. Look for the red upload button next to PDF/DOCX links
3. Click the button to send the document to Red Ink
4. The button will show:
   - Gray + pulsing: Uploading
   - Green: Success
   - Red + shake: Error

## Permissions

- `storage`: Save your API URL preference
- `notifications`: Show upload success/error notifications
- `host_permissions`: Access TELUQ pages and your Red Ink server

## Development

To regenerate icons:
```bash
python3 generate_icons.py
```

## Troubleshooting

**Button doesn't appear:**
- Make sure you're on a `univ.teluq.ca` page
- Check that the link ends in `.pdf`, `.docx`, or `.doc`
- Try refreshing the page

**Upload fails:**
- Check that Red Ink backend is running
- Verify the API URL in settings
- Make sure you're logged into TELUQ (for authenticated downloads)
