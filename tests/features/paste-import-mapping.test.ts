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
    }
  }
};

describe('Paste import mapping', () => {
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

    global.document = dom.window.document;
    global.window = dom.window as any;
    global.chrome = mockChrome as any;

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('ignores system columns (状態/メモ/経過時間) on paste; keeps 名前 and custom columns', async () => {
    // No existing tasks
    mockChrome.storage.sync.get.mockResolvedValue({ tasks: [] });
    mockChrome.storage.sync.set.mockResolvedValue(undefined);

    // Mock clipboard content: include English + Japanese headers
    const md = [
      '| 名前 | 状態 | メモ | 経過時間 | 見積(分) |',
      '| --- | --- | --- | --- | --- |',
      '| タスクA | done | 備考A | 01:02:03 | 25 |',
      '| タスクB | todo |  | 5m 10s |  |'
    ].join('\n');

    Object.defineProperty(global.navigator, 'clipboard', {
      value: { readText: vi.fn().mockResolvedValue(md), writeText: vi.fn() },
      writable: true
    });

    vi.resetModules();
    await import('../../src/panel-client.ts');

    // Trigger paste
    (document.getElementById('paste-button') as HTMLButtonElement).click();

    // Allow async handlers and deferred render
    await new Promise(resolve => setTimeout(resolve, 160));

    const list = document.getElementById('task-list')!;
    const rows = list.querySelectorAll('div[data-testid^="task-"][data-status]');
    expect(rows.length).toBeGreaterThanOrEqual(2);

    const first = rows[0] as HTMLElement;
    // Status from paste is ignored; defaults to todo
    expect(first.getAttribute('data-status')).toBe('todo');
    const nameEl = first.querySelector('[data-testid="task-name"]') as HTMLElement;
    expect(nameEl.textContent).toBe('タスクA');
    const timerEl = first.querySelector('.timer-display') as HTMLElement;
    // Timer from paste is ignored; defaults to 00:00:00
    expect(timerEl.textContent).toBe('00:00:00');
    const html = first.innerHTML;
    expect(html).toContain('見積(分)');
    expect(html).toContain('25');
    // Notes from paste are ignored; textarea is empty (placeholder guides input)
    const notesInput = first.querySelector('textarea.notes-input') as HTMLTextAreaElement;
    expect(notesInput).toBeTruthy();
    expect(notesInput.value).toBe('');
    expect(notesInput.getAttribute('placeholder')).toBe('Add notes...');

    const second = rows[1] as HTMLElement;
    expect(second?.getAttribute('data-status')).toBe('todo');
    const timerEl2 = second.querySelector('.timer-display') as HTMLElement;
    expect(timerEl2.textContent).toBe('00:00:00');
  });
});
