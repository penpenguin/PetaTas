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

describe('Add Task UX (optimistic + dynamic fields)', () => {
  beforeEach(() => {
    // Minimal panel DOM required by panel-client
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

    // Clipboard not used by these tests, but define to satisfy any checks
    Object.defineProperty(global.navigator, 'clipboard', {
      value: {
        readText: vi.fn(),
        writeText: vi.fn()
      },
      writable: true
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('always shows a name field (but not system fields) even when existing tasks have empty names', async () => {
    // Existing tasks with empty names
    mockChrome.storage.sync.get.mockImplementation(async (keys: any) => {
      const tasks = [
        { id: 't1', name: '', status: 'todo', notes: '', elapsedMs: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), additionalColumns: { priority: 'High' } },
        { id: 't2', name: '', status: 'done', notes: '', elapsedMs: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), additionalColumns: { assignee: 'Alex' } }
      ]
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

    // Reset modules to ensure a fresh client per test and import
    vi.resetModules();
    await import('../../src/panel-client.ts');

    // Open modal via button (triggers populateDynamicFields)
    const addBtn = document.getElementById('add-task-button') as HTMLButtonElement;
    addBtn.click();

    const container = document.getElementById('dynamic-fields-container')!;
    const nameInput = container.querySelector('[data-field-name="name"]');
    const statusInput = container.querySelector('[data-field-name="status"]');
    const notesInput = container.querySelector('[data-field-name="notes"]');
    const timerInput = container.querySelector('[data-field-name="timer"]');

    expect(nameInput).toBeTruthy();
    // System fields should NOT be present in creation modal
    expect(statusInput).toBeFalsy();
    expect(notesInput).toBeFalsy();
    expect(timerInput).toBeFalsy();
  });

  it('renders the new task optimistically before storage save resolves', async () => {
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

    // Create a controllable promise for set
    let resolveSet: (() => void) | null = null;
    const setPromise = new Promise<void>((resolve) => { resolveSet = resolve; });
    mockChrome.storage.sync.set.mockReturnValue(setPromise);

    vi.resetModules();
    await import('../../src/panel-client.ts');

    // Open modal and populate dynamic fields
    (document.getElementById('add-task-button') as HTMLButtonElement).click();
    const container = document.getElementById('dynamic-fields-container')!;

    // Add inputs if not created (defensive), but should be created by handleAddTaskClick
    if (container.children.length === 0) {
      container.innerHTML = `
        <div class="form-control">
          <input type="text" class="dynamic-field-input" data-field-name="name" />
        </div>`;
    }

    const nameField = container.querySelector('[data-field-name="name"]') as HTMLInputElement;
    nameField.value = 'Optimistic Task';

    // Submit the form
    const form = document.getElementById('add-task-form') as HTMLFormElement;
    const submitEvent = new window.Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(submitEvent);

    // Allow event loop to process any pending microtasks from the listener
    await Promise.resolve();

    // Optimistic render: task-list should show the new task even though set() not resolved
    const list = document.getElementById('task-list')!;
    const empty = document.getElementById('empty-state')!;
    expect(list.classList.contains('hidden')).toBe(false);
    const renderedName = list.querySelector('[data-testid="task-name"]') as HTMLElement;
    expect(renderedName?.textContent).toBe('Optimistic Task');
    expect(empty.classList.contains('hidden')).toBe(true);

    // Now resolve the storage save and allow microtasks to flush
    resolveSet?.();
    await Promise.resolve();
  });

  it('ignores injected system fields even if they appear in the DOM', async () => {
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

    vi.resetModules();
    await import('../../src/panel-client.ts');

    // Open modal
    (document.getElementById('add-task-button') as HTMLButtonElement).click();
    const container = document.getElementById('dynamic-fields-container')!;

    // Legit field
    const nameField = container.querySelector('[data-field-name="name"]') as HTMLInputElement;
    nameField.value = 'System-Field-Ignore';

    // Inject a fake system input (should be ignored by submit handler)
    const injected = document.createElement('input');
    injected.className = 'dynamic-field-input';
    injected.setAttribute('data-field-name', 'status');
    (injected as HTMLInputElement).value = 'done';
    container.appendChild(injected);

    // Submit
    const form = document.getElementById('add-task-form') as HTMLFormElement;
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();

    // Check rendered task: should not be done (default 'todo')
    const list = document.getElementById('task-list')!;
    const row = list.querySelector('[data-testid^="task-"]') as HTMLElement;
    expect(row).toBeTruthy();
    expect(row.getAttribute('data-status')).toBe('todo');
  });

  it('persists dynamic column values with special characters in field names', async () => {
    // Existing tasks define dynamic columns with special characters
    mockChrome.storage.sync.get.mockImplementation(async (keys: any) => {
      const tasks = [
        { id: 't1', name: 'T1', status: 'todo', notes: '', elapsedMs: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), additionalColumns: { 'Priority (P0)': 'P0', 'Owner/Team': 'Core' } }
      ]
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

    // Open modal and fill dynamic fields
    (document.getElementById('add-task-button') as HTMLButtonElement).click();
    const container = document.getElementById('dynamic-fields-container')!;

    const nameField = container.querySelector('[data-field-name="name"]') as HTMLInputElement;
    nameField.value = 'Dynamic Special';

    const pField = container.querySelector('[data-field-name="Priority (P0)"]') as HTMLInputElement;
    const oField = container.querySelector('[data-field-name="Owner/Team"]') as HTMLInputElement;
    expect(pField).toBeTruthy();
    expect(oField).toBeTruthy();
    pField.value = 'P1';
    oField.value = 'Platform/Infra';

    // Submit
    const form = document.getElementById('add-task-form') as HTMLFormElement;
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();

    const list = document.getElementById('task-list')!;
    const html = list.innerHTML;
    expect(html).toContain('Priority (P0)');
    expect(html).toContain('P1');
    expect(html).toContain('Owner/Team');
    expect(html).toContain('Platform/Infra');
  });

  it('persists dynamic column values with Japanese header names', async () => {
    mockChrome.storage.sync.get.mockImplementation(async (keys: any) => {
      const tasks = [
        { id: 't1', name: 'T1', status: 'todo', notes: '', elapsedMs: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), additionalColumns: { '見積(分)': '10' } }
      ]
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

    (document.getElementById('add-task-button') as HTMLButtonElement).click();
    const container = document.getElementById('dynamic-fields-container')!;

    const nameField = container.querySelector('[data-field-name="name"]') as HTMLInputElement;
    nameField.value = '日本語列タスク';

    const jpField = container.querySelector('[data-field-name="見積(分)"]') as HTMLInputElement;
    expect(jpField).toBeTruthy();
    jpField.value = '25';

    const form = document.getElementById('add-task-form') as HTMLFormElement;
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();

    const list = document.getElementById('task-list')!;
    const html = list.innerHTML;
    expect(html).toContain('見積(分)');
    expect(html).toContain('25');
  });

  it('rolls back UI and keeps modal values if storage save fails', async () => {
    vi.useFakeTimers();
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
    mockChrome.storage.sync.set.mockRejectedValue(new Error('save failed'));

    vi.resetModules();
    await import('../../src/panel-client.ts');

    // Open modal and set a name
    (document.getElementById('add-task-button') as HTMLButtonElement).click();
    const container = document.getElementById('dynamic-fields-container')!;
    const ensureName = () => {
      if (!container.querySelector('[data-field-name="name"]')) {
        container.innerHTML = `<input class="dynamic-field-input" data-field-name="name" />`;
      }
      return container.querySelector('[data-field-name="name"]') as HTMLInputElement;
    };
    const nameField = ensureName();
    nameField.value = 'Should Roll Back';

    // Submit
    const form = document.getElementById('add-task-form') as HTMLFormElement;
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));

    // Advance timers to trigger throttled write and rejection (WRITE_THROTTLE_MS = 2000)
    await vi.advanceTimersByTimeAsync(2100);
    // Allow promise microtasks to settle
    await Promise.resolve();

    const list = document.getElementById('task-list')!;
    const empty = document.getElementById('empty-state')!;
    // List should be hidden and empty state visible after rollback
    expect(list.classList.contains('hidden')).toBe(true);
    expect(empty.classList.contains('hidden')).toBe(false);

    const modal = document.getElementById('add-task-modal') as HTMLInputElement;
    expect(modal.checked).toBe(true);

    const restoredNameField = container.querySelector('[data-field-name="name"]') as HTMLInputElement;
    expect(restoredNameField.value).toBe('Should Roll Back');
  });
});
