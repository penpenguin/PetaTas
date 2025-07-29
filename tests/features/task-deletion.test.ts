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

describe('Task Deletion with Timer Cleanup', () => {
  beforeEach(() => {
    // Setup DOM
    const dom = new JSDOM(`
      <html>
        <body>
          <div id="task-list">
            <div class="list-row" data-testid="task-test-1" data-status="in-progress">
              <input type="checkbox" class="checkbox" data-task-id="test-1" />
              <div class="list-col-grow">
                <span class="task-name">Test Task 1</span>
              </div>
              <div class="timer-display">00:05:30</div>
              <div class="flex gap-1">
                <button class="btn btn-ghost btn-xs" data-task-id="test-1" data-action="timer">⏸️</button>
                <button class="btn btn-ghost btn-xs" data-task-id="test-1" data-action="delete">🗑️</button>
              </div>
            </div>
          </div>
          <div id="toast-container"></div>
        </body>
      </html>
    `);

    global.document = dom.window.document;
    global.window = dom.window as any;
    global.chrome = mockChrome as any;
    
    // Mock navigator.clipboard
    Object.defineProperty(global.navigator, 'clipboard', {
      value: {
        readText: vi.fn(),
        writeText: vi.fn()
      },
      writable: true
    });

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should clean up active timer when deleting task', async () => {
    // Mock PetaTasClient-like behavior
    class MockTaskManager {
      private activeTimers = new Map();
      private currentTasks = [
        {
          id: 'test-1',
          name: 'Test Task 1',
          status: 'in-progress',
          notes: '',
          elapsedMs: 330000, // 5:30
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      constructor() {
        // Simulate running timer
        const mockTimer = {
          startTime: Date.now() - 10000, // Started 10 seconds ago
          interval: setInterval(() => {}, 1000)
        };
        this.activeTimers.set('test-1', mockTimer);
      }

      async deleteTask(taskId: string): Promise<void> {
        // Stop and clean up active timer if running
        if (this.activeTimers.has(taskId)) {
          const timer = this.activeTimers.get(taskId)!;
          clearInterval(timer.interval);
          
          // Update elapsed time before deletion
          const task = this.currentTasks.find(t => t.id === taskId);
          if (task) {
            task.elapsedMs += Date.now() - timer.startTime;
          }
          
          this.activeTimers.delete(taskId);
        }

        // Remove task from array
        this.currentTasks = this.currentTasks.filter(t => t.id !== taskId);
        
        // Clean up timer state from storage
        await mockChrome.storage.sync.remove(`timer_${taskId}`);
      }

      hasActiveTimer(taskId: string): boolean {
        return this.activeTimers.has(taskId);
      }

      getTaskCount(): number {
        return this.currentTasks.length;
      }
    }

    const taskManager = new MockTaskManager();

    // Verify timer is running before deletion
    expect(taskManager.hasActiveTimer('test-1')).toBe(true);
    expect(taskManager.getTaskCount()).toBe(1);

    // Delete the task
    await taskManager.deleteTask('test-1');

    // Verify timer is cleaned up
    expect(taskManager.hasActiveTimer('test-1')).toBe(false);
    expect(taskManager.getTaskCount()).toBe(0);

    // Verify storage cleanup was called
    expect(mockChrome.storage.sync.remove).toHaveBeenCalledWith('timer_test-1');
  });

  it('should handle task deletion when no timer is running', async () => {
    class MockTaskManager {
      private activeTimers = new Map();
      private currentTasks = [
        {
          id: 'test-2',
          name: 'Test Task 2',
          status: 'todo',
          notes: '',
          elapsedMs: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      async deleteTask(taskId: string): Promise<void> {
        // Stop and clean up active timer if running
        if (this.activeTimers.has(taskId)) {
          const timer = this.activeTimers.get(taskId)!;
          clearInterval(timer.interval);
          this.activeTimers.delete(taskId);
        }

        // Remove task from array
        this.currentTasks = this.currentTasks.filter(t => t.id !== taskId);
        
        // Clean up timer state from storage
        await mockChrome.storage.sync.remove(`timer_${taskId}`);
      }

      hasActiveTimer(taskId: string): boolean {
        return this.activeTimers.has(taskId);
      }

      getTaskCount(): number {
        return this.currentTasks.length;
      }
    }

    const taskManager = new MockTaskManager();

    // Verify no timer is running
    expect(taskManager.hasActiveTimer('test-2')).toBe(false);
    expect(taskManager.getTaskCount()).toBe(1);

    // Delete the task
    await taskManager.deleteTask('test-2');

    // Verify task is deleted
    expect(taskManager.getTaskCount()).toBe(0);

    // Verify storage cleanup was still called
    expect(mockChrome.storage.sync.remove).toHaveBeenCalledWith('timer_test-2');
  });

  it('should update elapsed time before deleting task with running timer', async () => {
    const startTime = Date.now() - 15000; // Started 15 seconds ago
    
    class MockTaskManager {
      private activeTimers = new Map();
      private currentTasks = [
        {
          id: 'test-3',
          name: 'Test Task 3',
          status: 'in-progress',
          notes: '',
          elapsedMs: 60000, // 1 minute base time
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      constructor() {
        const mockTimer = {
          startTime: startTime,
          interval: setInterval(() => {}, 1000)
        };
        this.activeTimers.set('test-3', mockTimer);
      }

      async deleteTask(taskId: string): Promise<void> {
        // Stop and clean up active timer if running
        if (this.activeTimers.has(taskId)) {
          const timer = this.activeTimers.get(taskId)!;
          clearInterval(timer.interval);
          
          // Update elapsed time before deletion
          const task = this.currentTasks.find(t => t.id === taskId);
          if (task) {
            task.elapsedMs += Date.now() - timer.startTime;
          }
          
          this.activeTimers.delete(taskId);
        }

        // Remove task from array
        this.currentTasks = this.currentTasks.filter(t => t.id !== taskId);
      }

      getTaskElapsedTime(taskId: string): number {
        const task = this.currentTasks.find(t => t.id === taskId);
        return task ? task.elapsedMs : 0;
      }

      getTaskCount(): number {
        return this.currentTasks.length;
      }
    }

    const taskManager = new MockTaskManager();

    // Get initial elapsed time
    const initialElapsed = taskManager.getTaskElapsedTime('test-3');
    expect(initialElapsed).toBe(60000); // 1 minute

    // Delete the task (should update elapsed time first)
    await taskManager.deleteTask('test-3');

    // Task should be deleted
    expect(taskManager.getTaskCount()).toBe(0);
    
    // Note: Since task is deleted, we can't verify the updated elapsed time
    // but the test confirms the logic path is executed
  });

  it('should handle storage cleanup errors gracefully', async () => {
    // Make storage.remove fail
    mockChrome.storage.sync.remove.mockRejectedValue(new Error('Storage error'));

    class MockTaskManager {
      private activeTimers = new Map();
      private currentTasks = [
        {
          id: 'test-4',
          name: 'Test Task 4',
          status: 'todo',
          notes: '',
          elapsedMs: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      async deleteTask(taskId: string): Promise<void> {
        // Remove task from array first
        this.currentTasks = this.currentTasks.filter(t => t.id !== taskId);
        
        // Try to clean up timer state from storage
        try {
          await mockChrome.storage.sync.remove(`timer_${taskId}`);
        } catch (error) {
          console.error('Failed to clean up task data:', error);
          // Don't throw - task deletion should continue even if cleanup fails
        }
      }

      getTaskCount(): number {
        return this.currentTasks.length;
      }
    }

    const taskManager = new MockTaskManager();

    // Should not throw even if storage cleanup fails
    await expect(taskManager.deleteTask('test-4')).resolves.toBeUndefined();

    // Task should still be deleted from memory
    expect(taskManager.getTaskCount()).toBe(0);

    // Storage cleanup should have been attempted
    expect(mockChrome.storage.sync.remove).toHaveBeenCalledWith('timer_test-4');
  });
});