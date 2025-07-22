// Storage Manager for PetaTas Chrome Extension
// Handles chrome.storage.sync operations with error handling and quota management

import type { Task } from '../types/task';
import { validateTaskData } from '../types/task';

export interface TimerState {
  taskId: string;
  isRunning: boolean;
  startTime: number;
  elapsedMs: number;
}

export interface StorageInfo {
  bytesUsed: number;
  bytesAvailable: number;
  percentUsed: number;
}

export class StorageManager {
  private static readonly STORAGE_KEY_TASKS = 'tasks';
  private static readonly STORAGE_KEY_TIMER_PREFIX = 'timer_';
  private static readonly MAX_STORAGE_BYTES = 100 * 1024; // 100KB chrome.storage.sync limit
  // private static readonly MAX_ITEM_BYTES = 8 * 1024; // 8KB per item limit - reserved for future use

  // Save tasks to chrome.storage.sync
  async saveTasks(tasks: Task[]): Promise<void> {
    try {
      const data = { tasks };
      
      // Validate data before saving
      if (!validateTaskData(data)) {
        throw new Error('Invalid task data structure');
      }

      // Check storage quota
      const dataSize = this.estimateDataSize(data);
      if (dataSize > StorageManager.MAX_STORAGE_BYTES) {
        throw new Error(`Data size (${dataSize} bytes) exceeds storage limit`);
      }

      await chrome.storage.sync.set({
        [StorageManager.STORAGE_KEY_TASKS]: tasks,
      });
    } catch (error) {
      console.error('Failed to save tasks:', error);
      throw error;
    }
  }

  // Load tasks from chrome.storage.sync
  async loadTasks(): Promise<Task[]> {
    try {
      const result = await chrome.storage.sync.get(StorageManager.STORAGE_KEY_TASKS);
      
      if (!result || !result[StorageManager.STORAGE_KEY_TASKS]) {
        return [];
      }

      const tasks = result[StorageManager.STORAGE_KEY_TASKS];
      
      // Validate loaded data
      if (!Array.isArray(tasks)) {
        console.warn('Invalid tasks data format, returning empty array');
        return [];
      }

      // Convert date strings back to Date objects
      return tasks.map(task => ({
        ...task,
        createdAt: new Date(task.createdAt),
        updatedAt: new Date(task.updatedAt),
      }));
    } catch (error) {
      console.error('Failed to load tasks:', error);
      return [];
    }
  }

  // Save timer state for a specific task
  async saveTimerState(timerState: TimerState): Promise<void> {
    try {
      const key = `${StorageManager.STORAGE_KEY_TIMER_PREFIX}${timerState.taskId}`;
      
      await chrome.storage.sync.set({
        [key]: timerState,
      });
    } catch (error) {
      console.error('Failed to save timer state:', error);
      throw error;
    }
  }

  // Load timer state for a specific task
  async loadTimerState(taskId: string): Promise<TimerState | null> {
    try {
      const key = `${StorageManager.STORAGE_KEY_TIMER_PREFIX}${taskId}`;
      const result = await chrome.storage.sync.get(key);
      
      return result[key] || null;
    } catch (error) {
      console.error('Failed to load timer state:', error);
      return null;
    }
  }

  // Clear all timer states
  async clearTimerStates(): Promise<void> {
    try {
      const allData = await chrome.storage.sync.get(null);
      const timerKeys = Object.keys(allData).filter(key => 
        key.startsWith(StorageManager.STORAGE_KEY_TIMER_PREFIX)
      );
      
      if (timerKeys.length > 0) {
        await chrome.storage.sync.remove(timerKeys);
      }
    } catch (error) {
      console.error('Failed to clear timer states:', error);
      throw error;
    }
  }

  // Clear all data
  async clearAllData(): Promise<void> {
    try {
      await chrome.storage.sync.clear();
    } catch (error) {
      console.error('Failed to clear all data:', error);
      throw error;
    }
  }

  // Get storage usage information
  async getStorageInfo(): Promise<StorageInfo> {
    try {
      const bytesInUse = await chrome.storage.sync.getBytesInUse();
      const bytesAvailable = StorageManager.MAX_STORAGE_BYTES - bytesInUse;
      const percentUsed = (bytesInUse / StorageManager.MAX_STORAGE_BYTES) * 100;

      return {
        bytesUsed: bytesInUse,
        bytesAvailable: Math.max(0, bytesAvailable),
        percentUsed: Math.round(percentUsed * 100) / 100,
      };
    } catch (error) {
      console.error('Failed to get storage info:', error);
      // Return default values if API fails
      return {
        bytesUsed: 0,
        bytesAvailable: StorageManager.MAX_STORAGE_BYTES,
        percentUsed: 0,
      };
    }
  }

  // Estimate data size (approximate)
  private estimateDataSize(data: any): number {
    try {
      return new Blob([JSON.stringify(data)]).size;
    } catch (error) {
      // Fallback estimation
      return JSON.stringify(data).length * 2; // Rough estimate
    }
  }

  // Check if storage is approaching quota limit
  async isStorageNearLimit(): Promise<boolean> {
    const info = await this.getStorageInfo();
    return info.percentUsed > 80; // 80% threshold
  }
}