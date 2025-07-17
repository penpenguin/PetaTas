/**
 * @jest-environment jsdom
 */

import { generateMarkdownTable, formatTime, copyMarkdownToClipboard } from './markdown';
import { Task } from '../types/types';

// Mock navigator.clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(),
  },
});

describe('markdown utilities', () => {
  describe('formatTime', () => {
    test('should format seconds correctly', () => {
      expect(formatTime(5000)).toBe('0:05');
      expect(formatTime(30000)).toBe('0:30');
      expect(formatTime(59000)).toBe('0:59');
    });

    test('should format minutes correctly', () => {
      expect(formatTime(60000)).toBe('1:00');
      expect(formatTime(90000)).toBe('1:30');
      expect(formatTime(3540000)).toBe('59:00');
    });

    test('should format hours correctly', () => {
      expect(formatTime(3600000)).toBe('1:00:00');
      expect(formatTime(3665000)).toBe('1:01:05');
      expect(formatTime(86400000)).toBe('24:00:00');
    });

    test('should handle zero time', () => {
      expect(formatTime(0)).toBe('0:00');
    });
  });

  describe('generateMarkdownTable', () => {
    const mockTasks: Task[] = [
      {
        id: 'task1',
        cells: ['Task 1', 'Description 1'],
        done: false,
        notes: 'Note 1',
        elapsedMs: 60000
      },
      {
        id: 'task2',
        cells: ['Task 2', 'Description 2'],
        done: true,
        notes: 'Note with | pipe',
        elapsedMs: 3665000
      }
    ];

    test('should generate basic markdown table', () => {
      const headers = ['Name', 'Description'];
      const markdown = generateMarkdownTable(headers, mockTasks);
      
      expect(markdown).toContain('| Name | Description | Done | Timer | Notes |');
      expect(markdown).toContain('| --- | --- | --- | --- | --- |');
      expect(markdown).toContain('| Task 1 | Description 1 | ❌ | 1:00 | Note 1 |');
      expect(markdown).toContain('| Task 2 | Description 2 | ✅ | 1:01:05 | Note with \\\\| pipe |');
    });

    test('should handle custom options', () => {
      const headers = ['Name'];
      const markdown = generateMarkdownTable(headers, mockTasks, {
        includeTimer: false,
        includeDone: false,
        includeNotes: false
      });
      
      expect(markdown).toContain('| Name |');
      expect(markdown).not.toContain('Done');
      expect(markdown).not.toContain('Timer');
      expect(markdown).not.toContain('Notes');
    });

    test('should escape markdown characters', () => {
      const taskWithSpecialChars: Task[] = [{
        id: 'special',
        cells: ['Test\nNewline'],
        done: false,
        notes: 'Line 1\nLine 2',
        elapsedMs: 0
      }];

      const markdown = generateMarkdownTable(['Name'], taskWithSpecialChars);
      expect(markdown).toContain('Test<br>Newline');
      expect(markdown).toContain('Line 1<br>Line 2');
    });

    test('should handle empty tasks', () => {
      const markdown = generateMarkdownTable(['Name'], []);
      expect(markdown).toContain('| Name | Done | Timer | Notes |');
      expect(markdown).toContain('| --- | --- | --- | --- |');
    });
  });

  describe('copyMarkdownToClipboard', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('should copy text to clipboard successfully', async () => {
      const mockWriteText = navigator.clipboard.writeText as jest.Mock;
      mockWriteText.mockResolvedValue(undefined);

      const result = await copyMarkdownToClipboard('test markdown');
      
      expect(mockWriteText).toHaveBeenCalledWith('test markdown');
      expect(result).toBe(true);
    });

    test('should handle clipboard errors', async () => {
      const mockWriteText = navigator.clipboard.writeText as jest.Mock;
      mockWriteText.mockRejectedValue(new Error('Clipboard error'));

      const result = await copyMarkdownToClipboard('test markdown');
      
      expect(result).toBe(false);
    });
  });
});