import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';

const mockChrome = {
  storage: {
    sync: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
      getBytesInUse: vi.fn().mockResolvedValue(0)
    },
    local: {
      get: vi.fn(),
      set: vi.fn()
    }
  }
};

describe('Settings UI: save title aliases', () => {
  beforeEach(() => {
    const dom = new JSDOM(`
      <html>
        <body>
          <div id=\"task-list\" class=\"list hidden\"></div>
          <div id=\"empty-state\" data-testid=\"empty-state\"></div>
          <div id=\"toast-container\"></div>

          <div class=\"dropdown\">
            <button id=\"settings-button\" data-testid=\"settings-button\">Settings</button>
          </div>

          <!-- Required buttons for panel-client wiring -->
          <button id=\"paste-button\">Paste Markdown</button>
          <button id=\"export-button\">Export</button>
          <button id=\"add-task-button\">Add Task</button>
          <button id=\"clear-all-button\">Clear All</button>

          <!-- Add Task Modal placeholder -->
          <input type=\"checkbox\" id=\"add-task-modal\" class=\"modal-toggle\" />
          <div class=\"modal\"><div class=\"modal-box\"><form id=\"add-task-form\"><div id=\"dynamic-fields-container\"></div></form></div></div>

          <!-- Settings Modal -->
          <input type=\"checkbox\" id=\"settings-modal\" class=\"modal-toggle\" />
          <div class=\"modal\">
            <div class=\"modal-box\">
              <h3>Settings</h3>
              <form id=\"settings-form\">
                <textarea id=\"title-aliases-input\"></textarea>
                <button id=\"settings-save-button\" type=\"submit\">Save</button>
              </form>
            </div>
          </div>
        </body>
      </html>
    `);

    global.document = dom.window.document;
    global.window = dom.window as any;
    global.chrome = mockChrome as any;

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens modal, preloads existing aliases, and saves normalized CSV to storage.local', async () => {
    // Existing settings
    mockChrome.storage.local.get.mockResolvedValue({ settings_title_aliases: ['Subject'] });
    mockChrome.storage.local.set.mockResolvedValue(undefined);
    mockChrome.storage.sync.get.mockResolvedValue({ tasks: [] });

    vi.resetModules();
    await import('../../src/panel-client.ts');

    // Open settings
    (document.getElementById('settings-button') as HTMLButtonElement).click();

    // Allow async
    await new Promise(r => setTimeout(r, 10));

    const modal = document.getElementById('settings-modal') as HTMLInputElement;
    const textarea = document.getElementById('title-aliases-input') as HTMLTextAreaElement;
    expect(modal.checked).toBe(true);
    expect(textarea.value).toContain('Subject');

    // Update and save
    textarea.value = 'Subject, Story, Ticket ';
    (document.getElementById('settings-save-button') as HTMLButtonElement).click();

    await new Promise(r => setTimeout(r, 10));

    // Saved as trimmed array
    expect(mockChrome.storage.local.set).toHaveBeenCalled();
    const arg = mockChrome.storage.local.set.mock.calls[0][0];
    expect(arg.settings_title_aliases).toEqual(['Subject', 'Story', 'Ticket']);

    // Modal closes
    expect(modal.checked).toBe(false);
  });
});

