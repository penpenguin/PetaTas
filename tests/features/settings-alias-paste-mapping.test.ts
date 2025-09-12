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

describe('Settings: title aliases affect paste mapping', () => {
  beforeEach(() => {
    const dom = new JSDOM(`
      <html>
        <body>
          <div id="task-list" class="list hidden"></div>
          <div id="empty-state" data-testid="empty-state"></div>
          <div id="toast-container"></div>

          <button id="paste-button" data-testid="paste-button">Paste Markdown</button>
          <button id="export-button" data-testid="export-button">Export</button>
          <button id="add-task-button">Add Task</button>
          <button id="clear-all-button">Clear</button>

          <!-- Add Task Modal/Form placeholders for event wiring -->
          <input type="checkbox" id="add-task-modal" class="modal-toggle" />
          <div class="modal">
            <div class="modal-box">
              <form id="add-task-form">
                <div id="dynamic-fields-container"></div>
                <button type="submit" id="submit-btn">Add Task</button>
              </form>
            </div>
          </div>
        </body>
      </html>
    `);

    // DOM + Chrome mocks
    global.document = dom.window.document;
    global.window = dom.window as any;
    global.chrome = mockChrome as any;

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses user-defined aliases from storage.local (e.g., Subject) as task name', async () => {
    // No existing tasks
    mockChrome.storage.sync.get.mockImplementation(async (keys: any) => {
      const index = { version: 1, chunks: ['tasks_0'], total: 0, updatedAt: 0 }
      if (keys === 'tasks_index') return { tasks_index: index }
      if (Array.isArray(keys)) {
        const out: Record<string, unknown> = {}
        for (const k of keys) if (k === 'tasks_0') out[k] = []
        return out
      }
      return {}
    });
    mockChrome.storage.sync.set.mockResolvedValue(undefined);

    // User setting: treat Subject as title
    mockChrome.storage.local.get.mockResolvedValue({ settings_title_aliases: ['Subject'] });

    const md = [
      '| Subject | Status |',
      '| --- | --- |',
      '| Foo | Done |'
    ].join('\n');

    Object.defineProperty(global.navigator, 'clipboard', {
      value: { readText: vi.fn().mockResolvedValue(md), writeText: vi.fn() },
      writable: true
    });

    vi.resetModules();
    await import('../../src/panel-client.ts');

    // Trigger paste
    (document.getElementById('paste-button') as HTMLButtonElement).click();

    // Allow async work
    await new Promise(resolve => setTimeout(resolve, 160));

    const rows = document.querySelectorAll('div[data-testid^="task-"][data-status]');
    expect(rows.length).toBe(1);
    const nameEl = (rows[0] as HTMLElement).querySelector('[data-testid="task-name"]') as HTMLElement;
    expect(nameEl.textContent).toBe('Foo');
  });
});
