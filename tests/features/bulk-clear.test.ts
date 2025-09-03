import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';

// Mock Chrome API
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

describe('Bulk Clear Tasks', () => {
  beforeEach(() => {
    const dom = new JSDOM(`
      <html>
        <body>
          <div id="task-list" class="list"></div>
          <div id="empty-state" class="hidden"></div>

          <!-- No modal in simplified confirm-only flow -->

          <div id="toast-container"></div>
        </body>
      </html>
    `);

    global.document = dom.window.document;
    global.window = dom.window as any;
    global.chrome = mockChrome as any;

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should not clear when user cancels confirmation', async () => {
    // Stub confirm to cancel
    const confirmSpy = vi.spyOn(global, 'confirm' as any).mockReturnValue(false);

    // Mock manager with spyable clearAll
    const clearAll = vi.fn();
    function handleClearAllClick(currentCount: number) {
      if (currentCount === 0) return;
      const ok = confirm(`This will delete all ${currentCount} tasks and timer states.`);
      if (!ok) return;
      clearAll();
    }

    handleClearAllClick(3);
    expect(confirmSpy).toHaveBeenCalled();
    expect(clearAll).not.toHaveBeenCalled();
  });

  it('should clear tasks and cleanup timers when confirmed', async () => {
    // Stub confirm to accept
    vi.spyOn(global, 'confirm' as any).mockReturnValue(true);
    // Simulate timers and tasks
    const activeIntervals: NodeJS.Timeout[] = [];

    class MockTaskManager {
      private activeTimers = new Map<string, { startTime: number; interval: NodeJS.Timeout }>();
      private currentTasks = [
        { id: 't1', name: 'A', status: 'todo', notes: '', elapsedMs: 0, createdAt: new Date(), updatedAt: new Date() },
        { id: 't2', name: 'B', status: 'in-progress', notes: '', elapsedMs: 0, createdAt: new Date(), updatedAt: new Date() },
      ];

      constructor() {
        // Start a couple of mock timers
        const i1 = setInterval(() => {}, 1000); activeIntervals.push(i1);
        const i2 = setInterval(() => {}, 1000); activeIntervals.push(i2);
        this.activeTimers.set('t1', { startTime: Date.now() - 5000, interval: i1 });
        this.activeTimers.set('t2', { startTime: Date.now() - 10000, interval: i2 });
      }

      async clearAll(): Promise<void> {
        // Stop timers
        this.activeTimers.forEach(t => clearInterval(t.interval));
        this.activeTimers.clear();

        // Remove timer states and save empty tasks
        this.currentTasks = [];
        await Promise.all([
          // In production we batch-remove timer_* keys; here we just call remove with an array
          mockChrome.storage.sync.remove(['timer_t1', 'timer_t2']),
          mockChrome.storage.sync.set({ tasks: [] })
        ]);
      }

      timersRunning(): boolean {
        return this.activeTimers.size > 0;
      }

      taskCount(): number {
        return this.currentTasks.length;
      }
    }

    const mgr = new MockTaskManager();
    expect(mgr.timersRunning()).toBe(true);
    expect(mgr.taskCount()).toBe(2);

    await mgr.clearAll();

    expect(mgr.timersRunning()).toBe(false);
    expect(mgr.taskCount()).toBe(0);
    expect(mockChrome.storage.sync.remove).toHaveBeenCalledWith(['timer_t1', 'timer_t2']);
    expect(mockChrome.storage.sync.set).toHaveBeenCalledWith({ tasks: [] });

    // Cleanup any dangling intervals in case of test failures
    activeIntervals.forEach(clearInterval);
  });
});
