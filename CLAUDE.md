# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PetaTas is a Chrome extension (Manifest V3) that enables users to paste HTML tables and convert them into task management rows with timers and markdown export functionality. Built with TypeScript + Lit web components.

## Architecture

### Core Components
- **Side Panel UI**: Lit-based components rendered in Chrome's side panel
- **Table Parser**: Converts HTML tables from clipboard to 2D string arrays
- **Task Management**: Each table row becomes a task with checkbox, timer, and notes
- **Storage**: Uses `chrome.storage.sync` for persistence across browser sessions
- **Markdown Export**: Generates GitHub Flavored Markdown tables

### Key File Structure
```
/manifest.json          - Manifest V3 with side_panel and storage permissions
/panel.html + panel.ts  - Main side panel UI (Lit components)
/styles.css            - Pure CSS styling (no frameworks)
/utils/tableParser.ts  - HTML table → string[][] parser
/utils/markdown.ts     - 2D array → GFM markdown generator
/types.ts              - Task type definitions
/dist/                 - esbuild output directory
```

## Development Commands

```bash
# Install dependencies
npm install

# Build for development
npm run build

# Build for production
npm run build:prod

# Run tests
npm test

# Run single test file
npm test tableParser.test.ts

# Lint code
npm run lint

# Type check
npm run typecheck
```

## Build System

Uses `esbuild` to bundle TypeScript files to `dist/` directory. The `manifest.json` must include:
```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self';"
  }
}
```

## Key Implementation Details

### Task Row Component (`<task-row>`)
- Checkbox for `done` state
- Start/Stop/Reset timer using `requestAnimationFrame` for smooth updates
- Textarea for `notes` (starts as single row, expands as needed)
- All changes auto-save to `chrome.storage.sync`

### Timer Implementation
- Stores `elapsedMs` internally, supports 24+ hour durations
- Uses `requestAnimationFrame` for display updates when running
- Persists across browser restarts

### Table Parsing
- Handles variable row/column sizes
- Empty cells preserved as empty strings
- Extracts `<th>` elements for markdown headers, falls back to "Col1"..."ColN"

### Storage Pattern
```typescript
interface Task {
  id: string;
  cells: string[];
  done: boolean;
  notes: string;
  elapsedMs: number;
}
```

### Side Panel Behavior
- Opens on extension icon click via `chrome.sidePanel.open()`
- Uses Port communication to detect panel closure
- Auto-stops running timers when panel closes

## Performance Requirements
- Must handle 1000+ rows without UI freezing
- Efficient clipboard paste handling with `@paste` listeners
- Immediate persistence of all task changes

## Extension Permissions Required
```json
{
  "permissions": ["storage", "sidePanel"],
  "host_permissions": ["clipboardRead", "clipboardWrite"]
}
```

## Testing
- Minimum requirement: `tableParser.test.ts` with Jest
- Test table parsing edge cases (empty cells, malformed HTML, large tables)
- Verify markdown output matches GitHub Flavored Markdown spec

## Development Notes
- No external CSS frameworks (Tailwind, CSS Modules, etc.)
- Pure CSS styling in `/styles.css`
- Lit components should follow TypeScript strict mode
- Toast notifications for successful markdown copy operations
- Clipboard operations use `navigator.clipboard` API