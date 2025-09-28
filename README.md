# PetaTas Chrome Extension
[![Test](https://github.com/penpenguin/PetaTas/actions/workflows/test.yml/badge.svg)](https://github.com/penpenguin/PetaTas/actions/workflows/test.yml)
[![codecov](https://codecov.io/github/penpenguin/PetaTas/graph/badge.svg?token=N2IBYQEU2O)](https://codecov.io/github/penpenguin/PetaTas)

Markdown table-based task management with timers and side panel functionality.

## Installation & Testing

### 1. Build the Extension

1. `npm install`
2. `npm run build`
   - The production bundle is emitted to `dist/`

### 2. Load Extension in Chrome Developer Mode

1. Open Chrome browser
2. Navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `dist` folder generated in the previous step
6. The extension should now appear in your extensions list

### 3. Usage

1. Click the PetaTas extension icon in the Chrome toolbar
2. The Side Panel will open with the task manager interface
3. Click "Paste Markdown" to import tasks from a Markdown table
4. Use the timer buttons to track time spent on tasks
5. Click "Export" to copy tasks back to clipboard as Markdown

### 4. Sample Markdown Table

Copy this sample table and paste it into the extension:

```markdown
| Task | Status | Notes |
|------|--------|-------|
| Review documentation | todo | Important for project |
| Fix styling issues | in-progress | Almost complete |
| Write tests | todo | Need to add E2E tests |
| Deploy to production | todo | After all tests pass |
```

### 5. Features

- **Markdown Table Import**: Paste any Markdown table to create tasks
- **Timer Tracking**: Start/stop timers for individual tasks
- **Task Status**: Toggle between todo/in-progress/done
- **Persistent Storage**: Tasks are saved using Chrome's storage API
- **Export**: Copy tasks back to clipboard as Markdown
- **Side Panel**: Native Chrome side panel integration

### 5.1 Status & Timer Behavior

- Start sets the task status to `in-progress`.
- Stop returns the status to `todo` unless the task is already `done`.
  - In other words, Stop implies `todo`.
  - If the task is `done` and you press Stop, the status stays `done` (the timer stops).
- Marking a task as `done` via the checkbox stops any running timer.
- Unchecking `done` switches the task back to `todo`; you can Start again as needed.


### 6. Development

The extension is built using:
- **Astro 5.x**: Static site generator
- **daisyUI**: Tailwind CSS component library
  - Policy: favor utility classes and built-in themes; minimize custom CSS and avoid overriding core component classes. Prefer semantic classes (e.g., `badge-*`) and data attributes for state.
- **TypeScript**: Type safety
- **Chrome Extension Manifest V3**: Modern extension platform
- **Vitest**: Run `npm test` to execute the unit test suite developed with TDD

### 6.1 Local Development Workflow

- `npm run dev`: Start the Astro dev server with hot reload
- `npm test`: Run unit tests (jsdom environment)
- `npm run lint`: Check lint rules
- `npm run typecheck`: Perform type checking
- `npm run build`: Generate the production bundle in `dist/`

### 6.2 File Structure

```
src/
├── components/            # UI components (.astro)
├── pages/                 # Astro pages
├── panel-client.ts        # Side panel bootstrap
├── service-worker.ts      # Background service worker
├── utils/                 # Shared utilities
└── types/                 # Shared type definitions

tests/                     # Vitest specs (jsdom)
public/                    # Static assets copied as-is
dist/                      # Production build output (after `npm run build`)
```

### 6.3 Security (CSP)

- Extension pages use CSP with `style-src 'self' blob:` and do not include `'unsafe-inline'`.
- Astro is configured with `inlineStylesheets: 'never'`; styles are emitted as external CSS.

### 6.4 Permissions

- To support reliable paste/copy, the manifest explicitly requests `clipboardRead` and `clipboardWrite`.
- If organization policies restrict the clipboard, users may need to allow clipboard access in browser settings.

### 7. Troubleshooting

- If the extension doesn't load, check the console for errors
- Make sure all files are in the `dist` folder
- Verify Chrome is updated to support Manifest V3
- Check that the extension has necessary permissions

### 8. Staying Up To Date

- Follow the GitHub Issues/Projects board for open work items
- Review the CI badges above for the latest build and test status
- Capture larger roadmap discussions in `AGENTS.md` or project docs as they evolve
