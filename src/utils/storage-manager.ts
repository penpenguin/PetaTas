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
  
  // Write operation throttling to prevent quota exceeded errors
  private static readonly WRITE_THROTTLE_MS = 2000; // 2 seconds between writes
  private static readonly MAX_WRITES_PER_MINUTE = 120; // Chrome limit
  private writeQueue: Map<string, { data: unknown; resolve: (value: void) => void; reject: (error: Error) => void; timestamp: number }> = new Map();
  private writeHistory: number[] = [];
  private throttleTimer: NodeJS.Timeout | null = null;

  // Save tasks to chrome.storage.sync with throttling
  async saveTasks(tasks: Task[]): Promise<void> {
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

    return this.throttledWrite(StorageManager.STORAGE_KEY_TASKS, tasks);
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

  // Save timer state for a specific task with throttling
  async saveTimerState(timerState: TimerState): Promise<void> {
    const key = `${StorageManager.STORAGE_KEY_TIMER_PREFIX}${timerState.taskId}`;
    return this.throttledWrite(key, timerState);
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

  // Clear timer state for a specific task
  async clearTimerState(taskId: string): Promise<void> {
    try {
      const timerKey = StorageManager.STORAGE_KEY_TIMER_PREFIX + taskId;
      await chrome.storage.sync.remove(timerKey);
    } catch (error) {
      console.error(`Failed to clear timer state for task ${taskId}:`, error);
      throw error;
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
  private estimateDataSize(data: Record<string, unknown>): number {
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

  // Throttled write operation to prevent quota exceeded errors
  private async throttledWrite(key: string, data: unknown): Promise<void> {
    return new Promise((resolve, reject) => {
      // If there's already a pending write for this key, replace it (debounce)
      if (this.writeQueue.has(key)) {
        const existing = this.writeQueue.get(key)!;
        existing.reject(new Error('Write operation replaced by newer write'));
      }

      // Add to queue
      this.writeQueue.set(key, {
        data,
        resolve,
        reject,
        timestamp: Date.now()
      });

      // Process queue
      this.processWriteQueue();
    });
  }

  // Process the write queue with throttling
  private processWriteQueue(): void {
    if (this.throttleTimer) {
      return; // Already processing
    }

    this.throttleTimer = setTimeout(() => {
      this.executeWrites();
      this.throttleTimer = null;
      
      // Continue processing if queue not empty
      if (this.writeQueue.size > 0) {
        this.processWriteQueue();
      }
    }, StorageManager.WRITE_THROTTLE_MS);
  }

  // Execute a batch of writes
  private async executeWrites(): Promise<void> {
    const now = Date.now();
    
    // Clean old write history (older than 1 minute)
    this.writeHistory = this.writeHistory.filter(timestamp => 
      now - timestamp < 60000
    );

    // Check if we're approaching rate limit
    if (this.writeHistory.length >= StorageManager.MAX_WRITES_PER_MINUTE * 0.8) {
      console.warn('Approaching write rate limit, delaying writes');
      return; // Skip this batch
    }

    // Get the next batch to write (up to 10 items)
    const entries = Array.from(this.writeQueue.entries()).slice(0, 10);
    if (entries.length === 0) return;

    // Prepare batch write
    const batchData: Record<string, unknown> = {};
    const promises: Array<{ resolve: (value: void) => void; reject: (error: Error) => void }> = [];

    for (const [key, item] of entries) {
      batchData[key] = item.data;
      promises.push({ resolve: item.resolve, reject: item.reject });
      this.writeQueue.delete(key);
    }

    try {
      // Execute batch write
      await chrome.storage.sync.set(batchData);
      
      // Record successful write
      this.writeHistory.push(now);
      
      // Resolve all promises
      promises.forEach(p => p.resolve());
    } catch (error) {
      console.error('Batch write failed:', error);
      
      // Reject all promises
      promises.forEach(p => p.reject(error instanceof Error ? error : new Error(String(error))));
      
      // If quota exceeded, wait longer before next attempt
      if (error instanceof Error && (
        error.message.includes('QUOTA_BYTES_PER_ITEM') ||
        error.message.includes('MAX_WRITE_OPERATIONS_PER_MINUTE')
      )) {
        console.warn('Storage quota exceeded, increasing throttle delay');
        setTimeout(() => this.processWriteQueue(), StorageManager.WRITE_THROTTLE_MS * 3);
        return;
      }
    }
  }
}