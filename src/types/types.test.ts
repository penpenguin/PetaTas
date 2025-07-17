import { isValidTask, isValidStorageData, Task, StorageData } from './types';

describe('type validation functions', () => {
  describe('isValidTask', () => {
    test('should validate correct task', () => {
      const validTask: Task = {
        id: 'task1',
        cells: ['cell1', 'cell2'],
        done: false,
        notes: 'test notes',
        elapsedMs: 5000
      };

      expect(isValidTask(validTask)).toBe(true);
    });

    test('should reject invalid task properties', () => {
      // Missing id
      expect(isValidTask({
        cells: ['cell1'],
        done: false,
        notes: '',
        elapsedMs: 0
      })).toBe(false);

      // Invalid id type
      expect(isValidTask({
        id: 123,
        cells: ['cell1'],
        done: false,
        notes: '',
        elapsedMs: 0
      })).toBe(false);

      // Invalid cells (not array)
      expect(isValidTask({
        id: 'task1',
        cells: 'not an array',
        done: false,
        notes: '',
        elapsedMs: 0
      })).toBe(false);

      // Invalid cells (contains non-string)
      expect(isValidTask({
        id: 'task1',
        cells: ['cell1', 123],
        done: false,
        notes: '',
        elapsedMs: 0
      })).toBe(false);

      // Invalid done type
      expect(isValidTask({
        id: 'task1',
        cells: ['cell1'],
        done: 'false',
        notes: '',
        elapsedMs: 0
      })).toBe(false);

      // Invalid notes type
      expect(isValidTask({
        id: 'task1',
        cells: ['cell1'],
        done: false,
        notes: 123,
        elapsedMs: 0
      })).toBe(false);

      // Invalid elapsedMs (negative)
      expect(isValidTask({
        id: 'task1',
        cells: ['cell1'],
        done: false,
        notes: '',
        elapsedMs: -100
      })).toBe(false);

      // Invalid elapsedMs type
      expect(isValidTask({
        id: 'task1',
        cells: ['cell1'],
        done: false,
        notes: '',
        elapsedMs: '100'
      })).toBe(false);
    });

    test('should reject null, undefined, and non-objects', () => {
      expect(isValidTask(null)).toBe(false);
      expect(isValidTask(undefined)).toBe(false);
      expect(isValidTask('string')).toBe(false);
      expect(isValidTask(123)).toBe(false);
      expect(isValidTask([])).toBe(false);
    });
  });

  describe('isValidStorageData', () => {
    test('should validate correct storage data', () => {
      const validData: StorageData = {
        tasks: [
          {
            id: 'task1',
            cells: ['cell1'],
            done: false,
            notes: '',
            elapsedMs: 0
          }
        ],
        headers: ['Header1']
      };

      expect(isValidStorageData(validData)).toBe(true);
    });

    test('should validate storage data without headers', () => {
      const validData = {
        tasks: [
          {
            id: 'task1',
            cells: ['cell1'],
            done: false,
            notes: '',
            elapsedMs: 0
          }
        ]
      };

      expect(isValidStorageData(validData)).toBe(true);
    });

    test('should reject invalid storage data', () => {
      // Invalid tasks (not array)
      expect(isValidStorageData({
        tasks: 'not an array',
        headers: []
      })).toBe(false);

      // Invalid tasks (contains invalid task)
      expect(isValidStorageData({
        tasks: [
          { id: 'task1', cells: ['cell1'], done: false, notes: '', elapsedMs: 0 },
          { invalid: 'task' }
        ],
        headers: []
      })).toBe(false);

      // Invalid headers (not array of strings)
      expect(isValidStorageData({
        tasks: [],
        headers: [123, 'header2']
      })).toBe(false);

      // Invalid headers (not array)
      expect(isValidStorageData({
        tasks: [],
        headers: 'not an array'
      })).toBe(false);
    });

    test('should reject null, undefined, and non-objects', () => {
      expect(isValidStorageData(null)).toBe(false);
      expect(isValidStorageData(undefined)).toBe(false);
      expect(isValidStorageData('string')).toBe(false);
      expect(isValidStorageData([])).toBe(false);
    });
  });
});