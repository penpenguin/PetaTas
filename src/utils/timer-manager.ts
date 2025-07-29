// Timer Manager for PetaTas Chrome Extension
// Handles per-task timers with persistence across service-worker restarts

import { StorageManager } from './storage-manager';
import type { TimerState } from './storage-manager';

export interface TimerEventMap {
  timerStart: (taskId: string) => void;
  timerStop: (taskId: string) => void;
  timerTick: (taskId: string, elapsedMs: number) => void;
  timerReset: (taskId: string) => void;
}

export class TimerManager {
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private timerStates: Map<string, TimerState> = new Map();
  private eventListeners: Map<keyof TimerEventMap, Set<(...args: unknown[]) => void>> = new Map();
  private storageManager: StorageManager;

  constructor(storageManager?: StorageManager) {
    this.storageManager = storageManager || new StorageManager();
    
    // Initialize event listener maps
    this.eventListeners.set('timerStart', new Set());
    this.eventListeners.set('timerStop', new Set());
    this.eventListeners.set('timerTick', new Set());
    this.eventListeners.set('timerReset', new Set());
  }

  // Start timer for a task
  startTimer(taskId: string): void {
    // Don't start if already running
    if (this.isRunning(taskId)) {
      return;
    }

    const now = Date.now();
    const existingState = this.timerStates.get(taskId);
    
    // Create or update timer state
    const timerState: TimerState = {
      taskId,
      isRunning: true,
      startTime: now,
      elapsedMs: existingState?.elapsedMs || 0
    };

    this.timerStates.set(taskId, timerState);

    // Create interval timer
    const intervalId = setInterval(() => {
      this.handleTimerTick(taskId);
    }, 1000);

    this.timers.set(taskId, intervalId);

    // Save state to storage
    this.saveTimerState(timerState);

    // Emit event
    this.emit('timerStart', taskId);
  }

  // Stop timer for a task
  stopTimer(taskId: string): void {
    const intervalId = this.timers.get(taskId);
    const timerState = this.timerStates.get(taskId);

    if (intervalId) {
      clearInterval(intervalId);
      this.timers.delete(taskId);
    }

    if (timerState) {
      // Calculate final elapsed time
      const elapsedInSession = timerState.isRunning ? Date.now() - timerState.startTime : 0;
      const totalElapsed = timerState.elapsedMs + elapsedInSession;

      // Update state
      const updatedState: TimerState = {
        ...timerState,
        isRunning: false,
        elapsedMs: totalElapsed
      };

      this.timerStates.set(taskId, updatedState);

      // Save state to storage
      this.saveTimerState(updatedState);

      // Emit event
      this.emit('timerStop', taskId);
    }
  }

  // Check if timer is running
  isRunning(taskId: string): boolean {
    const timerState = this.timerStates.get(taskId);
    return timerState?.isRunning || false;
  }

  // Get elapsed time for a task
  getElapsedTime(taskId: string): number {
    const timerState = this.timerStates.get(taskId);
    if (!timerState) {
      return 0;
    }

    if (timerState.isRunning) {
      const elapsedInSession = Date.now() - timerState.startTime;
      return timerState.elapsedMs + elapsedInSession;
    }

    return timerState.elapsedMs;
  }

  // Format time from milliseconds to HH:MM:SS
  formatTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    // Cap at 99:59:59 for display purposes
    const displayHours = Math.min(hours, 99);
    const displayMinutes = minutes % 60;
    const displaySeconds = seconds % 60;

    return `${displayHours.toString().padStart(2, '0')}:${displayMinutes.toString().padStart(2, '0')}:${displaySeconds.toString().padStart(2, '0')}`;
  }

  // Reset timer for a task
  resetTimer(taskId: string): void {
    this.stopTimer(taskId);
    this.timerStates.delete(taskId);
    
    // Clear from storage
    this.clearTimerState(taskId);
    
    // Emit event
    this.emit('timerReset', taskId);
  }

  // Get all active timer task IDs
  getActiveTimers(): string[] {
    const activeTimers: string[] = [];
    
    for (const [taskId, state] of this.timerStates) {
      if (state.isRunning) {
        activeTimers.push(taskId);
      }
    }
    
    return activeTimers;
  }

  // Restore timer state from storage
  async restoreTimerState(taskId: string): Promise<void> {
    try {
      const savedState = await this.storageManager.loadTimerState(taskId);
      
      if (savedState) {
        this.timerStates.set(taskId, savedState);
        
        // If timer was running, restart it
        if (savedState.isRunning) {
          // Update elapsed time based on time passed since restart
          const timeSinceRestart = Date.now() - savedState.startTime;
          const totalElapsed = savedState.elapsedMs + timeSinceRestart;
          
          const updatedState: TimerState = {
            ...savedState,
            elapsedMs: totalElapsed,
            startTime: Date.now()
          };
          
          this.timerStates.set(taskId, updatedState);
          
          // Restart the interval timer
          const intervalId = setInterval(() => {
            this.handleTimerTick(taskId);
          }, 1000);
          
          this.timers.set(taskId, intervalId);
        }
      }
    } catch (error) {
      console.error('Failed to restore timer state:', error);
    }
  }

  // Restore all timer states from storage
  async restoreAllTimerStates(): Promise<void> {
    // This would need to be implemented based on how we store timer states
    // For now, we'll skip this as it requires knowing all task IDs
  }

  // Event system
  on<K extends keyof TimerEventMap>(event: K, listener: TimerEventMap[K]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.add(listener as (...args: unknown[]) => void);
    }
  }

  off<K extends keyof TimerEventMap>(event: K, listener: TimerEventMap[K]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener as (...args: unknown[]) => void);
    }
  }

  private emit<K extends keyof TimerEventMap>(event: K, ...args: Parameters<TimerEventMap[K]>): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(...args);
        } catch (error) {
          console.error('Error in timer event listener:', error);
        }
      });
    }
  }

  // Handle timer tick
  private handleTimerTick(taskId: string): void {
    const elapsedMs = this.getElapsedTime(taskId);
    this.emit('timerTick', taskId, elapsedMs);
  }

  // Save timer state to storage
  private async saveTimerState(timerState: TimerState): Promise<void> {
    try {
      await this.storageManager.saveTimerState(timerState);
    } catch (error) {
      // Handle throttling errors gracefully - these are expected in high-frequency scenarios
      if (error instanceof Error && error.message.includes('Write operation replaced by newer write')) {
        // This is expected behavior when multiple timer operations happen quickly
        // The most recent state will be saved, so we don't need to log this as an error
        return;
      }
      console.error('Failed to save timer state:', error);
    }
  }

  // Clear timer state from storage
  private async clearTimerState(taskId: string): Promise<void> {
    try {
      // Create a cleared state to save
      const clearedState: TimerState = {
        taskId,
        isRunning: false,
        startTime: 0,
        elapsedMs: 0
      };
      
      await this.storageManager.saveTimerState(clearedState);
    } catch (error) {
      // Handle throttling errors gracefully - these are expected in high-frequency scenarios
      if (error instanceof Error && error.message.includes('Write operation replaced by newer write')) {
        // This is expected behavior when multiple timer operations happen quickly
        return;
      }
      console.error('Failed to clear timer state:', error);
    }
  }

  // Cleanup all timers
  destroy(): void {
    // Stop all active timers
    for (const intervalId of this.timers.values()) {
      clearInterval(intervalId);
    }
    
    // Clear all state
    this.timers.clear();
    this.timerStates.clear();
    
    // Clear event listeners
    this.eventListeners.forEach(listeners => listeners.clear());
  }
}