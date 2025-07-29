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

describe('DOM Consistency During Task Operations', () => {
  let mockTaskManager: any;

  beforeEach(() => {
    // Setup DOM with multiple tasks
    const dom = new JSDOM(`
      <html>
        <body>
          <div id="task-list">
            <div class="list-row" data-testid="task-task-1" data-status="todo">
              <input type="checkbox" class="checkbox" data-task-id="task-1" />
              <div class="list-col-grow">
                <span class="task-name">Task 1</span>
              </div>
              <div class="timer-display">00:00:00</div>
              <div class="flex gap-1">
                <button class="btn btn-ghost btn-xs" data-task-id="task-1" data-action="timer">▶️</button>
                <button class="btn btn-ghost btn-xs" data-task-id="task-1" data-action="delete">🗑️</button>
              </div>
            </div>
            <div class="list-row" data-testid="task-task-2" data-status="in-progress">
              <input type="checkbox" class="checkbox" data-task-id="task-2" />
              <div class="list-col-grow">
                <span class="task-name">Task 2</span>
              </div>
              <div class="timer-display running">00:05:30</div>
              <div class="flex gap-1">
                <button class="btn btn-ghost btn-xs" data-task-id="task-2" data-action="timer">⏸️</button>
                <button class="btn btn-ghost btn-xs" data-task-id="task-2" data-action="delete">🗑️</button>
              </div>
            </div>
            <div class="list-row" data-testid="task-task-3" data-status="todo">
              <input type="checkbox" class="checkbox" data-task-id="task-3" />
              <div class="list-col-grow">
                <span class="task-name">Task 3</span>
              </div>
              <div class="timer-display">00:02:15</div>
              <div class="flex gap-1">
                <button class="btn btn-ghost btn-xs" data-task-id="task-3" data-action="timer">▶️</button>
                <button class="btn btn-ghost btn-xs" data-task-id="task-3" data-action="delete">🗑️</button>
              </div>
            </div>
          </div>
          <div id="empty-state" class="hidden">No tasks</div>
          <div id="toast-container"></div>
        </body>
      </html>
    `);

    global.document = dom.window.document;
    global.window = dom.window as any;
    global.chrome = mockChrome as any;

    // Mock task manager with DOM-safe deletion
    mockTaskManager = {
      currentTasks: [
        { id: 'task-1', name: 'Task 1', status: 'todo', notes: '', elapsedMs: 0 },
        { id: 'task-2', name: 'Task 2', status: 'in-progress', notes: '', elapsedMs: 330000 },
        { id: 'task-3', name: 'Task 3', status: 'todo', notes: '', elapsedMs: 135000 }
      ],
      activeTimers: new Map(),
      deletingTasks: new Set(),

      async deleteTask(taskId: string): Promise<void> {
        // Prevent double deletion
        if (this.deletingTasks.has(taskId)) {
          console.warn(`Task ${taskId} is already being deleted`);
          return;
        }

        const taskIndex = this.currentTasks.findIndex(t => t.id === taskId);
        if (taskIndex === -1) {
          console.warn(`Task ${taskId} not found for deletion`);
          return;
        }

        // Mark as being deleted
        this.deletingTasks.add(taskId);

        try {
          // Remove DOM element immediately
          const taskElement = document.querySelector(`[data-testid="task-${taskId}"]`);
          if (taskElement) {
            taskElement.remove();
          }

          // Clean up timer if running
          if (this.activeTimers.has(taskId)) {
            const timer = this.activeTimers.get(taskId);
            clearInterval(timer.interval);
            this.activeTimers.delete(taskId);
          }

          // Remove from array
          this.currentTasks.splice(taskIndex, 1);

          // Update empty state
          this.updateEmptyStateVisibility();

          // Cleanup storage (non-blocking)
          try {
            await mockChrome.storage.sync.remove(`timer_${taskId}`);
          } catch (error) {
            console.error('Storage cleanup failed:', error);
            // Don't throw - continue with deletion
          }
        } finally {
          // Always remove from deleting set
          this.deletingTasks.delete(taskId);
        }
      },

      updateEmptyStateVisibility(): void {
        const emptyState = document.getElementById('empty-state');
        const taskList = document.getElementById('task-list');
        
        if (this.currentTasks.length === 0) {
          emptyState?.classList.remove('hidden');
          taskList?.classList.add('hidden');
        } else {
          emptyState?.classList.add('hidden');
          taskList?.classList.remove('hidden');
        }
      },

      getTaskCount(): number {
        return this.currentTasks.length;
      },

      getDOMTaskCount(): number {
        return document.querySelectorAll('[data-testid^="task-"]').length;
      }
    };

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should maintain DOM consistency during single task deletion', async () => {
    // Initial state
    expect(mockTaskManager.getTaskCount()).toBe(3);
    expect(mockTaskManager.getDOMTaskCount()).toBe(3);

    // Delete middle task
    await mockTaskManager.deleteTask('task-2');

    // Verify DOM consistency
    expect(mockTaskManager.getTaskCount()).toBe(2);
    expect(mockTaskManager.getDOMTaskCount()).toBe(2);

    // Verify correct tasks remain
    const remainingTasks = mockTaskManager.currentTasks.map(t => t.id);
    expect(remainingTasks).toEqual(['task-1', 'task-3']);

    // Verify DOM elements match
    const remainingElements = Array.from(document.querySelectorAll('[data-testid^="task-"]'))
      .map(el => el.getAttribute('data-testid')?.replace('task-', ''));
    expect(remainingElements).toEqual(['task-1', 'task-3']);
  });

  it('should handle rapid consecutive deletions without duplication', async () => {
    // Initial state
    expect(mockTaskManager.getTaskCount()).toBe(3);
    expect(mockTaskManager.getDOMTaskCount()).toBe(3);

    // Attempt rapid consecutive deletions
    const deletePromises = [
      mockTaskManager.deleteTask('task-1'),
      mockTaskManager.deleteTask('task-2'),
      mockTaskManager.deleteTask('task-3')
    ];

    await Promise.all(deletePromises);

    // All tasks should be deleted exactly once
    expect(mockTaskManager.getTaskCount()).toBe(0);
    expect(mockTaskManager.getDOMTaskCount()).toBe(0);

    // Empty state should be visible
    const emptyState = document.getElementById('empty-state');
    const taskList = document.getElementById('task-list');
    expect(emptyState?.classList.contains('hidden')).toBe(false);
    expect(taskList?.classList.contains('hidden')).toBe(true);
  });

  it('should prevent double deletion of the same task', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Initial state
    expect(mockTaskManager.getTaskCount()).toBe(3);

    // Try to delete the same task twice simultaneously
    const deletePromises = [
      mockTaskManager.deleteTask('task-1'),
      mockTaskManager.deleteTask('task-1')
    ];

    await Promise.all(deletePromises);

    // Task should only be deleted once
    expect(mockTaskManager.getTaskCount()).toBe(2);
    expect(mockTaskManager.getDOMTaskCount()).toBe(2);

    // Should have warned about duplicate deletion
    expect(consoleWarnSpy).toHaveBeenCalledWith('Task task-1 is already being deleted');

    consoleWarnSpy.mockRestore();
  });

  it('should handle deletion of non-existent task gracefully', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Initial state
    expect(mockTaskManager.getTaskCount()).toBe(3);

    // Try to delete non-existent task
    await mockTaskManager.deleteTask('non-existent-task');

    // No changes should occur
    expect(mockTaskManager.getTaskCount()).toBe(3);
    expect(mockTaskManager.getDOMTaskCount()).toBe(3);

    // Should have warned about missing task
    expect(consoleWarnSpy).toHaveBeenCalledWith('Task non-existent-task not found for deletion');

    consoleWarnSpy.mockRestore();
  });

  it('should maintain timer state consistency during deletion', async () => {
    // Setup running timer for task-2
    const mockTimer = {
      startTime: Date.now() - 30000, // Started 30 seconds ago
      interval: setInterval(() => {}, 1000)
    };
    mockTaskManager.activeTimers.set('task-2', mockTimer);

    // Verify timer is running
    expect(mockTaskManager.activeTimers.has('task-2')).toBe(true);

    // Delete task with running timer
    await mockTaskManager.deleteTask('task-2');

    // Timer should be cleaned up
    expect(mockTaskManager.activeTimers.has('task-2')).toBe(false);

    // Task should be deleted
    expect(mockTaskManager.getTaskCount()).toBe(2);
    expect(mockTaskManager.getDOMTaskCount()).toBe(2);

    // Storage cleanup should have been called
    expect(mockChrome.storage.sync.remove).toHaveBeenCalledWith('timer_task-2');
  });

  it('should handle storage cleanup errors without affecting DOM consistency', async () => {
    // Make storage operations fail
    mockChrome.storage.sync.remove.mockRejectedValueOnce(new Error('Storage error'));

    // Initial state
    expect(mockTaskManager.getTaskCount()).toBe(3);
    expect(mockTaskManager.getDOMTaskCount()).toBe(3);

    // Delete task despite storage error
    await mockTaskManager.deleteTask('task-1');

    // DOM should still be consistent even with storage error
    expect(mockTaskManager.getTaskCount()).toBe(2);
    expect(mockTaskManager.getDOMTaskCount()).toBe(2);

    // Storage cleanup should have been attempted
    expect(mockChrome.storage.sync.remove).toHaveBeenCalledWith('timer_task-1');
  });

  it('should maintain correct task order after selective deletions', async () => {
    // Delete first and last tasks, keep middle one
    await mockTaskManager.deleteTask('task-1');
    await mockTaskManager.deleteTask('task-3');

    // Only task-2 should remain
    expect(mockTaskManager.getTaskCount()).toBe(1);
    expect(mockTaskManager.getDOMTaskCount()).toBe(1);
    expect(mockTaskManager.currentTasks[0].id).toBe('task-2');

    // DOM should show only task-2
    const remainingElement = document.querySelector('[data-testid^="task-"]');
    expect(remainingElement?.getAttribute('data-testid')).toBe('task-task-2');
  });
});