import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';

// Minimal Chrome storage mock
const mockChrome = {
  storage: {
    sync: {
      get: vi.fn().mockResolvedValue({ tasks: [] }),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn(),
      clear: vi.fn(),
      getBytesInUse: vi.fn().mockResolvedValue(0),
    },
  },
};

describe('Add Task modal spacing', () => {
  beforeEach(() => {
    const dom = new JSDOM(`
      <html>
        <body>
          <div id=\"task-list\" class=\"list hidden\"></div>
          <div id=\"empty-state\" data-testid=\"empty-state\"></div>
          <div id=\"toast-container\"></div>

          <button id=\"add-task-button\">Add Task</button>

          <input type=\"checkbox\" id=\"add-task-modal\" class=\"modal-toggle\" />
          <div class=\"modal\">
            <div class=\"modal-box\">
              <h3 class=\"font-bold text-lg mb-4\">Add New Task</h3>
              <form id=\"add-task-form\" class=\"space-y-4\">
                <div id=\"dynamic-fields-container\"></div>
                <div class=\"modal-action\">
                  <button type=\"button\">Cancel</button>
                  <button type=\"submit\">Add Task</button>
                </div>
              </form>
            </div>
          </div>
        </body>
      </html>
    `);

    global.document = dom.window.document as unknown as Document;
    global.window = dom.window as any;
    global.chrome = mockChrome as any;

    Object.defineProperty(global.navigator, 'clipboard', {
      value: { readText: vi.fn(), writeText: vi.fn() },
      writable: true,
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('applies vertical spacing to dynamic fields container for comfortable layout', async () => {
    vi.resetModules();
    await import('../../src/panel-client.ts');

    // Open modal -> triggers populateDynamicFields()
    (document.getElementById('add-task-button') as HTMLButtonElement).click();

    const container = document.getElementById('dynamic-fields-container')!;
    // Expect a spacing utility applied to container so children (.form-control) are spaced vertically
    const classList = Array.from(container.classList.values()).join(' ');
    expect(classList).toMatch(/\bspace-y-4\b/);

    // And at least one field should exist
    expect(container.querySelector('.form-control')).toBeTruthy();
  });
});

