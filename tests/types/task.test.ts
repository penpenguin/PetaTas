import { describe, it, expect } from 'vitest';
import { Task, isValidTask, createTask, validateTaskData } from '../../src/types/task';

describe('Task Types and Validation', () => {
  describe('Red Phase: Failing Tests', () => {
    it('should fail: isValidTask with valid task', () => {
      // TDD Red Phase: This should fail because isValidTask doesn't exist yet
      const task: Task = {
        id: '1',
        name: 'Test Task',
        status: 'todo',
        notes: 'Test notes',
        elapsedMs: 0,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01')
      };
      
      expect(isValidTask(task)).toBe(true);
    });

    it('should fail: isValidTask with invalid task - missing id', () => {
      // TDD Red Phase: This should fail
      const invalidTask = {
        name: 'Test Task',
        status: 'todo',
        notes: 'Test notes',
        elapsedMs: 0,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01')
      };
      
      expect(isValidTask(invalidTask)).toBe(false);
    });

    it('should fail: isValidTask with invalid task - wrong status', () => {
      // TDD Red Phase: This should fail
      const invalidTask = {
        id: '1',
        name: 'Test Task',
        status: 'invalid-status',
        notes: 'Test notes',
        elapsedMs: 0,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01')
      };
      
      expect(isValidTask(invalidTask)).toBe(false);
    });

    it('should fail: isValidTask with invalid task - negative elapsed time', () => {
      // TDD Red Phase: This should fail
      const invalidTask = {
        id: '1',
        name: 'Test Task',
        status: 'todo',
        notes: 'Test notes',
        elapsedMs: -100,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01')
      };
      
      expect(isValidTask(invalidTask)).toBe(false);
    });

    it('should fail: createTask from markdown row', () => {
      // TDD Red Phase: This should fail
      const headers = ['Name', 'Status', 'Notes'];
      const row = ['Test Task', 'todo', 'Important task'];
      
      const task = createTask(headers, row);
      
      expect(task.name).toBe('Test Task');
      expect(task.status).toBe('todo');
      expect(task.notes).toBe('Important task');
      expect(task.id).toBeDefined();
      expect(task.elapsedMs).toBe(0);
      expect(task.createdAt).toBeInstanceOf(Date);
    });

    it('should fail: validateTaskData with valid data', () => {
      // TDD Red Phase: This should fail
      const taskData = {
        tasks: [
          {
            id: '1',
            name: 'Test Task',
            status: 'todo',
            notes: 'Test notes',
            elapsedMs: 0,
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-01')
          }
        ]
      };
      
      expect(validateTaskData(taskData)).toBe(true);
    });

    it('should fail: validateTaskData with invalid data', () => {
      // TDD Red Phase: This should fail
      const invalidData = {
        tasks: [
          {
            id: '1',
            name: 'Test Task',
            status: 'invalid-status',
            notes: 'Test notes',
            elapsedMs: 0,
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-01')
          }
        ]
      };
      
      expect(validateTaskData(invalidData)).toBe(false);
    });
  });
});