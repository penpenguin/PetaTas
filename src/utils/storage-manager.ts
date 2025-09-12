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
  private static readonly STORAGE_KEY_TASKS = 'tasks'; // legacy single-item key
  private static readonly STORAGE_KEY_TASKS_INDEX = 'tasks_index'; // chunked index
  private static readonly STORAGE_KEY_TIMER_PREFIX = 'timer_';
  private static readonly MAX_STORAGE_BYTES = 100 * 1024; // 100KB chrome.storage.sync limit
  private static readonly MAX_ITEM_BYTES = 8 * 1024; // 8KB per item limit
  private static readonly DEFAULT_TARGET_CHUNK_BYTES = 7 * 1024; // keep below per-item limit with margin
  
  // Write operation throttling to prevent quota exceeded errors
  private static readonly DEFAULT_WRITE_THROTTLE_MS = 2000; // 2 seconds between writes
  private static readonly DEFAULT_MAX_WRITES_PER_MINUTE = 120; // Chrome limit

  private readonly writeThrottleMs: number;
  private readonly maxWritesPerMinute: number;
  private readonly targetChunkBytes: number;
  private writeQueue: Map<string, { data: unknown; resolve: (value: void) => void; reject: (error: Error) => void; timestamp: number }> = new Map();
  private writeHistory: number[] = [];
  private throttleTimer: NodeJS.Timeout | null = null;

  constructor(
    options?: { writeThrottleMs?: number; maxWritesPerMinute?: number },
    chunking?: { targetChunkBytes?: number }
  ) {
    this.writeThrottleMs = options?.writeThrottleMs ?? StorageManager.DEFAULT_WRITE_THROTTLE_MS;
    this.maxWritesPerMinute = options?.maxWritesPerMinute ?? StorageManager.DEFAULT_MAX_WRITES_PER_MINUTE;
    const tcb = chunking?.targetChunkBytes ?? StorageManager.DEFAULT_TARGET_CHUNK_BYTES;
    // Never exceed hard item limit; clamp just in case tests pass very small sizes
    this.targetChunkBytes = Math.min(Math.max(256, tcb), StorageManager.MAX_ITEM_BYTES - 64);
  }

  // Save tasks to chrome.storage.sync (chunked with index) with throttling
  async saveTasks(tasks: Task[]): Promise<void> {
    const data = { tasks };
    
    // Validate data before saving
    if (!validateTaskData(data)) {
      throw new Error('Invalid task data structure');
    }

    // Build chunks
    const { chunkKeys, chunkPayloads, index } = this.buildTaskChunks(tasks);

    // Approximate preflight (sum of serialized chunk sizes + index)
    const approxTotal = chunkPayloads.reduce((sum, c) => sum + this.estimateValueSize(c), 0) + this.estimateValueSize(index);
    if (approxTotal > StorageManager.MAX_STORAGE_BYTES) {
      throw new Error(`Data size (~${approxTotal} bytes) exceeds storage limit`);
    }

    // Get previous index to clean up obsolete chunks after successful write
    let previousChunks: string[] = [];
    try {
      const prev = await chrome.storage.sync.get(StorageManager.STORAGE_KEY_TASKS_INDEX);
      const idx = prev?.[StorageManager.STORAGE_KEY_TASKS_INDEX];
      if (idx && Array.isArray(idx.chunks)) previousChunks = idx.chunks as string[];
    } catch { /* ignore */ }

    // Queue chunk writes first, then index last (atomic-ish in a batch)
    const writePromises: Promise<void>[] = [];
    chunkKeys.forEach((key, i) => {
      writePromises.push(this.throttledWrite(key, chunkPayloads[i]));
    });
    const indexPromise = this.throttledWrite(StorageManager.STORAGE_KEY_TASKS_INDEX, index);
    writePromises.push(indexPromise);

    await Promise.all(writePromises);

    // Cleanup stale keys: legacy 'tasks' and any previous chunk keys not in new set
    const newSet = new Set(chunkKeys);
    const toRemove: string[] = [];
    if (tasks.length > 0) {
      // Only remove legacy key if we actually persist via chunking
      toRemove.push(StorageManager.STORAGE_KEY_TASKS);
    }
    previousChunks.forEach(k => { if (!newSet.has(k)) toRemove.push(k); });
    if (tasks.length === 0) {
      // Clearing all tasks: remove index and any existing chunks
      toRemove.push(StorageManager.STORAGE_KEY_TASKS_INDEX);
      // Also remove any remaining chunks currently present
      try {
        const all = await chrome.storage.sync.get(null);
        Object.keys(all).forEach(k => { if (/^tasks_\d+$/.test(k)) toRemove.push(k); });
      } catch { /* ignore */ }
    }
    if (toRemove.length > 0) {
      try { await chrome.storage.sync.remove(Array.from(new Set(toRemove))); } catch { /* ignore */ }
    }
  }

  // Load tasks from chrome.storage.sync (prefers chunked index; falls back to legacy single key)
  async loadTasks(): Promise<Task[]> {
    try {
      // Try chunked format first
      const idxRes = await chrome.storage.sync.get(StorageManager.STORAGE_KEY_TASKS_INDEX);
      const idx = idxRes?.[StorageManager.STORAGE_KEY_TASKS_INDEX] as { version?: number; chunks?: string[]; total?: number } | undefined;
      if (idx && Array.isArray(idx.chunks) && idx.chunks.length > 0) {
        const chunksRes = await chrome.storage.sync.get(idx.chunks);
        const tasksArrays: unknown[] = [];
        for (const key of idx.chunks) {
          const arr = (chunksRes as Record<string, unknown>)[key];
          if (Array.isArray(arr)) tasksArrays.push(...arr);
        }
        const tasks = tasksArrays as Task[];
        return tasks.map(task => ({
          ...task,
          createdAt: new Date((task as any).createdAt),
          updatedAt: new Date((task as any).updatedAt),
        }));
      }

      // No index → treat as empty (no backward compatibility)
      return [];
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

  // Estimate value size (works with arrays/objects directly)
  private estimateValueSize(value: unknown): number {
    try {
      return new Blob([JSON.stringify(value)]).size;
    } catch {
      return JSON.stringify(value).length * 2;
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
    }, this.writeThrottleMs);
  }

  // Execute a batch of writes
  private async executeWrites(): Promise<void> {
    const now = Date.now();
    
    // Clean old write history (older than 1 minute)
    this.writeHistory = this.writeHistory.filter(timestamp => 
      now - timestamp < 60000
    );

    // Check if we're approaching rate limit
    if (this.writeHistory.length >= this.maxWritesPerMinute * 0.8) {
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
        setTimeout(() => this.processWriteQueue(), this.writeThrottleMs * 3);
        return;
      }
    }
  }

  // Build chunk keys, payloads, and index for a given tasks array
  private buildTaskChunks(tasks: Task[]): { chunkKeys: string[]; chunkPayloads: unknown[]; index: { version: 1; chunks: string[]; total: number; updatedAt: number } } {
    // Special case: empty
    if (tasks.length === 0) {
      return { chunkKeys: [], chunkPayloads: [], index: { version: 1, chunks: [], total: 0, updatedAt: Date.now() } };
    }

    const chunkKeys: string[] = [];
    const chunkPayloads: unknown[] = [];

    let currentChunk: Task[] = [];
    let currentBytes = 2; // []

    const flush = () => {
      if (currentChunk.length === 0) return;
      const key = `tasks_${chunkKeys.length}`;
      chunkKeys.push(key);
      // Persist as plain objects (Date -> ISO strings via JSON)
      const payload = currentChunk.map(t => ({ ...t }));
      chunkPayloads.push(payload);
      currentChunk = [];
      currentBytes = 2;
    };

    for (const task of tasks) {
      const tentative = [...currentChunk, task];
      const approx = this.estimateValueSize(tentative);
      if (approx > this.targetChunkBytes && currentChunk.length > 0) {
        flush();
      }
      currentChunk.push(task);
      currentBytes = this.estimateValueSize(currentChunk);
      if (currentBytes >= this.targetChunkBytes) {
        flush();
      }
    }
    flush();

    const index = { version: 1 as const, chunks: chunkKeys, total: tasks.length, updatedAt: Date.now() };
    return { chunkKeys, chunkPayloads, index };
  }
}
