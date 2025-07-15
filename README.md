# PetaTas

A Chrome extension that converts HTML tables into task management rows with timers and markdown export functionality.

## Features

- **Table Import**: Paste HTML tables from any application to create task lists
- **Task Management**: Each table row becomes a task with checkbox, timer, and notes
- **Timer System**: Start/Stop/Reset timers for each task with precise timing (24+ hour support)
- **Markdown Export**: Export tasks to GitHub Flavored Markdown format
- **Persistent Storage**: All data persists across browser sessions using Chrome storage
- **Side Panel Interface**: Clean, responsive UI in Chrome's side panel

## Requirements

- Node.js 16 or higher
- Chrome browser (for testing)

## Installation & Build

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd PetaTas
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the extension**
   ```bash
   # Development build
   npm run build
   
   # Production build (minified)
   npm run build:prod
   ```

4. **Load in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` folder

## Development

### Available Scripts

```bash
# Build for development
npm run build

# Build for production
npm run build:prod

# Run tests
npm test

# Run tests in watch mode
npm test:watch

# Type checking
npm run typecheck

# Linting
npm run lint
```

### Project Structure

```
PetaTas/
├── manifest.json           # Chrome extension manifest
├── panel.html             # Side panel HTML
├── panel.ts               # Main application component
├── task-row.ts            # Task row Lit component
├── background.ts          # Background service worker
├── styles.css             # Global CSS styles
├── types.ts               # TypeScript type definitions
├── utils/
│   ├── tableParser.ts     # HTML table parser
│   ├── tableParser.test.ts # Unit tests for parser
│   └── markdown.ts        # Markdown table generator
├── build.js               # esbuild configuration
├── package.json           # Project dependencies
├── tsconfig.json          # TypeScript configuration
└── dist/                  # Built extension files
```

## Usage

1. **Open the extension**
   - Click the PetaTas icon in Chrome's toolbar
   - The side panel will open on the right side

2. **Import a table**
   - Copy any HTML table from Excel, Google Sheets, web pages, etc.
   - Paste (Ctrl+V/Cmd+V) anywhere in the side panel
   - The table will be converted to task rows

3. **Manage tasks**
   - Check/uncheck tasks as complete
   - Use Start/Stop/Reset buttons for timing
   - Add notes in the textarea for each task

4. **Export to Markdown**
   - Click "Export Markdown" to copy the task table
   - Paste into GitHub Issues, README files, etc.

## Technical Details

### Architecture

- **Lit Components**: Modern web components for reactive UI
- **Chrome APIs**: Uses `storage.sync`, `sidePanel`, and `clipboard` APIs
- **TypeScript**: Full type safety and modern JavaScript features
- **esbuild**: Fast bundling with ES modules output
- **CSP Compliant**: No eval(), inline scripts, or unsafe practices

### Timer Implementation

- Uses `requestAnimationFrame` for smooth display updates
- Stores elapsed time in milliseconds for precision
- Supports durations over 24 hours
- Auto-saves timer state to prevent data loss

### Storage Schema

```typescript
interface Task {
  id: string;           // Unique identifier
  cells: string[];      // Table cell contents
  done: boolean;        // Completion status
  notes: string;        // User notes
  elapsedMs: number;    // Timer elapsed time in milliseconds
}
```

### Performance

- Handles 1000+ row tables without UI freezing
- Efficient DOM updates using Lit's reactive system
- Lazy evaluation and minimal re-renders
- Memory-conscious timer management

## Testing

The project includes comprehensive unit tests for the table parser:

```bash
# Run all tests
npm test

# Run specific test file
npm test tableParser.test.ts

# Generate coverage report
npm test -- --coverage
```

Test coverage includes:
- HTML table parsing edge cases
- Empty cell handling
- Malformed HTML graceful handling
- Performance testing with large datasets
- Header detection and generation

## Browser Compatibility

- Chrome 88+ (Manifest V3 support)
- Chromium-based browsers (Edge, Brave, etc.)

## Permissions

The extension requests these permissions:
- `storage`: Save tasks and settings
- `sidePanel`: Display in Chrome's side panel
- `clipboardRead`: Read pasted table data
- `clipboardWrite`: Export markdown to clipboard

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite: `npm test`
6. Build and test the extension: `npm run build`
7. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Troubleshooting

### Build Issues

- Ensure Node.js 16+ is installed
- Clear `node_modules` and reinstall: `rm -rf node_modules package-lock.json && npm install`
- Check for TypeScript errors: `npm run typecheck`

### Extension Loading Issues

- Verify the `dist` folder exists and contains built files
- Check Chrome developer console for errors
- Ensure manifest.json is valid
- Try reloading the extension in `chrome://extensions/`

### Data Loss

- Tasks are automatically saved to Chrome storage
- If data appears lost, check Chrome storage quota
- Storage persists across browser restarts but not across Chrome profiles