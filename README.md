# PetaTas Chrome Extension

Markdown table-based task management with timers and side panel functionality.

## Installation & Testing

### 1. Load Extension in Chrome Developer Mode

1. Open Chrome browser
2. Navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `dist` folder from this directory
6. The extension should now appear in your extensions list

### 2. Usage

1. Click the PetaTas extension icon in the Chrome toolbar
2. The Side Panel will open with the task manager interface
3. Click "Paste Markdown" to import tasks from a Markdown table
4. Use the timer buttons to track time spent on tasks
5. Click "Export" to copy tasks back to clipboard as Markdown

### 3. Sample Markdown Table

Copy this sample table and paste it into the extension:

```markdown
| Task | Status | Notes |
|------|--------|-------|
| Review documentation | todo | Important for project |
| Fix styling issues | in-progress | Almost complete |
| Write tests | todo | Need to add E2E tests |
| Deploy to production | todo | After all tests pass |
```

### 4. Features

- **Markdown Table Import**: Paste any Markdown table to create tasks
- **Timer Tracking**: Start/stop timers for individual tasks
- **Task Status**: Toggle between todo/in-progress/done
- **Persistent Storage**: Tasks are saved using Chrome's storage API
- **Export**: Copy tasks back to clipboard as Markdown
- **Side Panel**: Native Chrome side panel integration

### 5. File Structure

```
dist/
├── manifest.json          # Chrome Extension manifest
├── service-worker.js      # Background service worker
├── panel-client.js        # Main client-side JavaScript
├── index.html             # Side panel HTML (built)
├── favicon.ico            # Extension favicon
└── assets/                # Static assets
    ├── index.<hash>.css   # Bundled CSS (hashed)
    ├── icon-16.png
    ├── icon-48.png
    └── icon-128.png
```

### 6. Development

The extension is built using:
- **Astro 5.x**: Static site generator
- **daisyUI**: Tailwind CSS component library
  - Policy: favor utility classes and built-in themes; minimize custom CSS and avoid overriding core component classes. Prefer semantic classes (e.g., `badge-*`) and data attributes for state.
- **TypeScript**: Type safety
- **Chrome Extension Manifest V3**: Modern extension platform
- **Vitest**: 171 passing tests with TDD approach

### 7. Troubleshooting

- If the extension doesn't load, check the console for errors
- Make sure all files are in the `dist` folder
- Verify Chrome is updated to support Manifest V3
- Check that the extension has necessary permissions

### 8. Next Steps

1. Test in real browser environment
2. Verify clipboard permissions work
3. Test Side Panel API integration
4. Add E2E tests with Playwright
5. Performance optimizations
