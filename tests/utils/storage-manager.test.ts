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

      expect(chrome.storage.sync.set).toHaveBeenCalledWith({
        tasks: tasks,
      });
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

      chrome.storage.sync.get.mockResolvedValue({
        tasks: storedTasks,
      });

      const result = await storageManager.loadTasks();

      expect(chrome.storage.sync.get).toHaveBeenCalledWith('tasks');
      expect(result).toEqual(storedTasks);
    });

    it('should fail: load tasks returns empty array when no data', async () => {
      // TDD Red Phase: This should fail
      chrome.storage.sync.get.mockResolvedValue({});

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