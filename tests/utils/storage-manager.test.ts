import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StorageManager } from '../../src/utils/storage-manager';
import { Task } from '../../src/types/task';

describe('StorageManager', () => {
  let storageManager: StorageManager;

  beforeEach(() => {
    storageManager = new StorageManager();
  });

  describe('Red Phase: Failing Tests', () => {
    it('should fail: save tasks to storage', async () => {
      // TDD Red Phase: This should fail because StorageManager doesn't exist yet
      const tasks: Task[] = [
        {
          id: '1',
          name: 'Test Task',
          status: 'todo',
          notes: 'Test notes',
          elapsedMs: 0,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01')
        }
      ];

      chrome.storage.sync.set.mockResolvedValue(undefined);

      await storageManager.saveTasks(tasks);

      expect(chrome.storage.sync.set).toHaveBeenCalled();
      const args = chrome.storage.sync.set.mock.calls[chrome.storage.sync.set.mock.calls.length - 1][0];
      // Chunked format: should include tasks_0 and tasks_index
      expect(args).toHaveProperty('tasks_index');
      expect(args).toHaveProperty('tasks_0');
    });

    it('should fail: load tasks from storage', async () => {
      // TDD Red Phase: This should fail
      const storedTasks: Task[] = [
        {
          id: '1',
          name: 'Test Task',
          status: 'todo',
          notes: 'Test notes',
          elapsedMs: 0,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01')
        }
      ];

      chrome.storage.sync.get.mockImplementation(async (keys: any) => {
        const index = { version: 1, chunks: ['tasks_0'], total: storedTasks.length, updatedAt: 0 }
        if (keys === 'tasks_index') return { tasks_index: index }
        if (Array.isArray(keys)) {
          const out: Record<string, unknown> = {}
          for (const k of keys) if (k === 'tasks_0') out[k] = storedTasks
          return out
        }
        return {}
      });

      const result = await storageManager.loadTasks();

      expect(chrome.storage.sync.get).toHaveBeenCalledWith('tasks_index');
      expect(result.map(t => ({...t, createdAt: new Date(t.createdAt), updatedAt: new Date(t.updatedAt)}))).toEqual(
        storedTasks
      );
    });

    it('should fail: load tasks returns empty array when no data', async () => {
      // TDD Red Phase: This should fail
      chrome.storage.sync.get.mockImplementation(async (keys: any) => {
        if (keys === 'tasks_index') return {}
        return {}
      });

      const result = await storageManager.loadTasks();

      expect(result).toEqual([]);
    });

    it('should fail: save timer state', async () => {
      // TDD Red Phase: This should fail
      const timerState = {
        taskId: '1',
        isRunning: true,
        startTime: Date.now(),
        elapsedMs: 5000
      };

      chrome.storage.sync.set.mockResolvedValue(undefined);

      await storageManager.saveTimerState(timerState);

      expect(chrome.storage.sync.set).toHaveBeenCalledWith({
        [`timer_${timerState.taskId}`]: timerState,
      });
    });

    it('should fail: load timer state', async () => {
      // TDD Red Phase: This should fail
      const taskId = '1';
      const timerState = {
        taskId: '1',
        isRunning: true,
        startTime: Date.now(),
        elapsedMs: 5000
      };

      chrome.storage.sync.get.mockResolvedValue({
        [`timer_${taskId}`]: timerState,
      });

      const result = await storageManager.loadTimerState(taskId);

      expect(chrome.storage.sync.get).toHaveBeenCalledWith(`timer_${taskId}`);
      expect(result).toEqual(timerState);
    });

    it('should fail: clear all data', async () => {
      // TDD Red Phase: This should fail
      chrome.storage.sync.clear.mockResolvedValue(undefined);

      await storageManager.clearAllData();

      expect(chrome.storage.sync.clear).toHaveBeenCalled();
    });

    it('should fail: get storage quota info', async () => {
      // TDD Red Phase: This should fail
      chrome.storage.sync.getBytesInUse.mockResolvedValue(5000);

      const quotaInfo = await storageManager.getStorageInfo();

      expect(chrome.storage.sync.getBytesInUse).toHaveBeenCalled();
      expect(quotaInfo).toHaveProperty('bytesUsed');
      expect(quotaInfo).toHaveProperty('bytesAvailable');
      expect(quotaInfo).toHaveProperty('percentUsed');
      expect(quotaInfo.bytesUsed).toBe(5000);
    });

    it('should fail: handle storage errors gracefully', async () => {
      // TDD Red Phase: This should fail
      chrome.storage.sync.get.mockRejectedValue(new Error('Storage error'));

      const result = await storageManager.loadTasks();

      expect(result).toEqual([]);
    });
  });
});
