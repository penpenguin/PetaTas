import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';

// Mock Chrome API with controllable promises
const mockChrome = {
  storage: {
    sync: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
      getBytesInUse: vi.fn().mockResolvedValue(0)
    }
  }
};

describe('UI hides Japanese system columns (状態/終了)', () => {
  beforeEach(() => {
    const dom = new JSDOM(`
      <html>
        <body>
          <div id="task-list" class="list hidden"></div>
          <div id="empty-state" data-testid="empty-state"></div>
          <div id="toast-container"></div>

          <button id="add-task-button">Add Task</button>

          <!-- Add Task Modal -->
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

    global.document = dom.window.document;
    global.window = dom.window as any;
    global.chrome = mockChrome as any;

    // Clipboard placeholder
    Object.defineProperty(global.navigator, 'clipboard', {
      value: { readText: vi.fn(), writeText: vi.fn() },
      writable: true
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hides 状態 (system) but allows 終了 (custom) in dynamic fields; and does not display empty values in rows', async () => {
    // Prepare storage with tasks that (incorrectly) include Japanese system columns in additionalColumns
    const tasks = [
      { 
        id: 't1', name: 'T1', status: 'todo', notes: '', elapsedMs: 0,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        additionalColumns: { '状態': 'todo', '終了': '', '見積(分)': '15' }
      }
    ]
    mockChrome.storage.sync.get.mockImplementation(async (keys: any) => {
      const index = { version: 1, chunks: ['tasks_0'], total: tasks.length, updatedAt: 0 }
      if (keys === 'tasks_index') return { tasks_index: index }
      if (Array.isArray(keys)) {
        const out: Record<string, unknown> = {}
        for (const k of keys) if (k === 'tasks_0') out[k] = tasks
        return out
      }
      return {}
    });
    mockChrome.storage.sync.set.mockResolvedValue(undefined);

    vi.resetModules();
    await import('../../src/panel-client.ts');

    // Ensure the task rendered does not show badges for system columns or empty values
    const list = document.getElementById('task-list')!;
    const html = list.innerHTML;
    expect(html).not.toContain('状態');
    expect(html).not.toContain('終了');
    // Still shows non-system custom column
    expect(html).toContain('見積(分)');
    expect(html).toContain('15');

    // Open the modal (populateDynamicFields)
    (document.getElementById('add-task-button') as HTMLButtonElement).click();
    const container = document.getElementById('dynamic-fields-container')!;
    const fieldNames = Array.from(container.querySelectorAll('.dynamic-field-input'))
      .map(el => (el as HTMLInputElement).dataset.fieldName);

    // Should include name and 見積(分), 状態は除外（system）、終了は許可（custom）
    expect(fieldNames).toContain('name');
    expect(fieldNames).toContain('見積(分)');
    expect(fieldNames).not.toContain('状態');
    expect(fieldNames).toContain('終了');
  });
});
