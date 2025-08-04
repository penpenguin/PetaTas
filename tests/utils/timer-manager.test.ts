import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TimerManager } from '../../src/utils/timer-manager';
import { Task } from '../../src/types/task';

describe('TimerManager', () => {
  let timerManager: TimerManager;
  let mockTask: Task;

  beforeEach(() => {
    vi.useFakeTimers();
    timerManager = new TimerManager();
    mockTask = {
      id: 'task-1',
      name: 'Test Task',
      status: 'todo',
      notes: 'Test notes',
      elapsedMs: 0,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01')
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Red Phase: Failing Tests', () => {
    it('should fail: start timer for a task', () => {
      // TDD Red Phase: This should fail because TimerManager doesn't exist yet
      expect(() => {
        timerManager.startTimer(mockTask.id);
      }).not.toThrow();
      
      expect(timerManager.isRunning(mockTask.id)).toBe(true);
    });

    it('should fail: stop timer for a task', () => {
      // TDD Red Phase: This should fail
      timerManager.startTimer(mockTask.id);
      expect(timerManager.isRunning(mockTask.id)).toBe(true);
      
      timerManager.stopTimer(mockTask.id);
      expect(timerManager.isRunning(mockTask.id)).toBe(false);
    });

    it('should fail: calculate elapsed time correctly', () => {
      // TDD Red Phase: This should fail
      timerManager.startTimer(mockTask.id);
      
      // Advance time by 5 seconds
      vi.advanceTimersByTime(5000);
      
      const elapsed = timerManager.getElapsedTime(mockTask.id);
      expect(elapsed).toBe(5000);
    });

    it('should fail: accumulate elapsed time across multiple sessions', () => {
      // TDD Red Phase: This should fail
      // First session: 3 seconds
      timerManager.startTimer(mockTask.id);
      vi.advanceTimersByTime(3000);
      timerManager.stopTimer(mockTask.id);
      
      let elapsed = timerManager.getElapsedTime(mockTask.id);
      expect(elapsed).toBe(3000);
      
      // Second session: 2 seconds
      timerManager.startTimer(mockTask.id);
      vi.advanceTimersByTime(2000);
      timerManager.stopTimer(mockTask.id);
      
      elapsed = timerManager.getElapsedTime(mockTask.id);
      expect(elapsed).toBe(5000);
    });

    it('should fail: handle timer persistence across restarts', async () => {
      // TDD Red Phase: This should fail
      const storageManager = {
        saveTimerState: vi.fn(),
        loadTimerState: vi.fn(),
      };

      timerManager = new TimerManager(storageManager as any);
      
      // Start timer
      timerManager.startTimer(mockTask.id);
      
      // Should save timer state
      expect(storageManager.saveTimerState).toHaveBeenCalledWith({
        taskId: mockTask.id,
        isRunning: true,
        startTime: expect.any(Number),
        elapsedMs: 0
      });
    });

    it('should fail: restore timer state from storage', async () => {
      // TDD Red Phase: This should fail
      const storageManager = {
        saveTimerState: vi.fn(),
        loadTimerState: vi.fn().mockResolvedValue({
          taskId: mockTask.id,
          isRunning: true,
          startTime: Date.now() - 10000, // Started 10 seconds ago
          elapsedMs: 5000 // 5 seconds from previous session
        }),
      };

      timerManager = new TimerManager(storageManager as any);
      
      await timerManager.restoreTimerState(mockTask.id);
      
      expect(timerManager.isRunning(mockTask.id)).toBe(true);
      
      // Should have ~15 seconds (5 from previous + 10 from current)
      const elapsed = timerManager.getElapsedTime(mockTask.id);
      expect(elapsed).toBeGreaterThanOrEqual(14000);
      expect(elapsed).toBeLessThanOrEqual(16000);
    });

    it('should fail: format time correctly', () => {
      // TDD Red Phase: This should fail
      const testCases = [
        { ms: 0, expected: '00:00:00' },
        { ms: 1000, expected: '00:00:01' },
        { ms: 60000, expected: '00:01:00' },
        { ms: 3600000, expected: '01:00:00' },
        { ms: 3661000, expected: '01:01:01' },
        { ms: 36000000, expected: '10:00:00' },
        { ms: 359999000, expected: '99:59:59' },
      ];
      
      testCases.forEach(({ ms, expected }) => {
        const formatted = timerManager.formatTime(ms);
        expect(formatted).toBe(expected);
      });
    });

    it('should fail: handle multiple timers simultaneously', () => {
      // TDD Red Phase: This should fail
      const task2Id = 'task-2';
      const task3Id = 'task-3';
      
      // Start multiple timers
      timerManager.startTimer(mockTask.id);
      timerManager.startTimer(task2Id);
      timerManager.startTimer(task3Id);
      
      expect(timerManager.isRunning(mockTask.id)).toBe(true);
      expect(timerManager.isRunning(task2Id)).toBe(true);
      expect(timerManager.isRunning(task3Id)).toBe(true);
      
      // Advance time
      vi.advanceTimersByTime(3000);
      
      // Stop one timer
      timerManager.stopTimer(task2Id);
      
      expect(timerManager.isRunning(mockTask.id)).toBe(true);
      expect(timerManager.isRunning(task2Id)).toBe(false);
      expect(timerManager.isRunning(task3Id)).toBe(true);
      
      // All should have 3 seconds elapsed
      expect(timerManager.getElapsedTime(mockTask.id)).toBe(3000);
      expect(timerManager.getElapsedTime(task2Id)).toBe(3000);
      expect(timerManager.getElapsedTime(task3Id)).toBe(3000);
    });

    it('should fail: emit events when timer state changes', () => {
      // TDD Red Phase: This should fail
      const onTimerStart = vi.fn();
      const onTimerStop = vi.fn();
      const onTimerTick = vi.fn();
      
      timerManager.on('timerStart', onTimerStart);
      timerManager.on('timerStop', onTimerStop);
      timerManager.on('timerTick', onTimerTick);
      
      // Start timer
      timerManager.startTimer(mockTask.id);
      expect(onTimerStart).toHaveBeenCalledWith(mockTask.id);
      
      // Advance time to trigger tick
      vi.advanceTimersByTime(1000);
      expect(onTimerTick).toHaveBeenCalledWith(mockTask.id, 1000);
      
      // Stop timer
      timerManager.stopTimer(mockTask.id);
      expect(onTimerStop).toHaveBeenCalledWith(mockTask.id);
    });

    it('should fail: handle timer reset', () => {
      // TDD Red Phase: This should fail
      // Start timer and accumulate time
      timerManager.startTimer(mockTask.id);
      vi.advanceTimersByTime(5000);
      timerManager.stopTimer(mockTask.id);
      
      expect(timerManager.getElapsedTime(mockTask.id)).toBe(5000);
      
      // Reset timer
      timerManager.resetTimer(mockTask.id);
      
      expect(timerManager.getElapsedTime(mockTask.id)).toBe(0);
      expect(timerManager.isRunning(mockTask.id)).toBe(false);
    });

    it('should fail: handle edge case - stop timer that was never started', () => {
      // TDD Red Phase: This should fail
      expect(() => {
        timerManager.stopTimer(mockTask.id);
      }).not.toThrow();
      
      expect(timerManager.isRunning(mockTask.id)).toBe(false);
      expect(timerManager.getElapsedTime(mockTask.id)).toBe(0);
    });

    it('should fail: handle edge case - start timer that is already running', () => {
      // TDD Red Phase: This should fail
      timerManager.startTimer(mockTask.id);
      expect(timerManager.isRunning(mockTask.id)).toBe(true);
      
      // Starting again should not create a new timer
      timerManager.startTimer(mockTask.id);
      expect(timerManager.isRunning(mockTask.id)).toBe(true);
      
      // Should still be only one timer
      vi.advanceTimersByTime(1000);
      expect(timerManager.getElapsedTime(mockTask.id)).toBe(1000);
    });

    it('should fail: cleanup timers on destroy', () => {
      // TDD Red Phase: This should fail
      timerManager.startTimer(mockTask.id);
      timerManager.startTimer('task-2');
      
      expect(timerManager.isRunning(mockTask.id)).toBe(true);
      expect(timerManager.isRunning('task-2')).toBe(true);
      
      timerManager.destroy();
      
      expect(timerManager.isRunning(mockTask.id)).toBe(false);
      expect(timerManager.isRunning('task-2')).toBe(false);
    });

    it('should fail: get all active timers', () => {
      // TDD Red Phase: This should fail
      timerManager.startTimer(mockTask.id);
      timerManager.startTimer('task-2');
      
      const activeTimers = timerManager.getActiveTimers();
      expect(activeTimers).toHaveLength(2);
      expect(activeTimers).toContain(mockTask.id);
      expect(activeTimers).toContain('task-2');
      
      timerManager.stopTimer(mockTask.id);
      
      const activeTimersAfterStop = timerManager.getActiveTimers();
      expect(activeTimersAfterStop).toHaveLength(1);
      expect(activeTimersAfterStop).toContain('task-2');
    });
  });
});