import { describe, it, expect } from 'vitest';
import { parseMarkdownTable } from '../../src/utils/markdown-parser';

describe('parseMarkdownTable', () => {
  describe('Basic Functionality', () => {
    it('should parse empty string', () => {
      const result = parseMarkdownTable('');
      expect(result).toBeNull();
    });

    it('should parse single row table', () => {
      const markdown = `| Name | Status |
|------|--------|
| Task 1 | Todo |`;
      
      const result = parseMarkdownTable(markdown);
      expect(result).toEqual({
        headers: ['Name', 'Status'],
        rows: [['Task 1', 'Todo']]
      });
    });

    it('should parse multiple row table', () => {
      const markdown = `| Name | Status | Notes |
|------|--------|-------|
| Task 1 | Todo | Important |
| Task 2 | Done | Completed |`;
      
      const result = parseMarkdownTable(markdown);
      expect(result).toEqual({
        headers: ['Name', 'Status', 'Notes'],
        rows: [
          ['Task 1', 'Todo', 'Important'],
          ['Task 2', 'Done', 'Completed']
        ]
      });
    });

    it('should handle invalid markdown', () => {
      const result = parseMarkdownTable('Not a table');
      expect(result).toBeNull();
    });

    it('should handle table with empty cells', () => {
      const markdown = `| Name | Status |
|------|--------|
| Task 1 |  |
|  | Done |`;
      
      const result = parseMarkdownTable(markdown);
      expect(result).toEqual({
        headers: ['Name', 'Status'],
        rows: [
          ['Task 1', ''],
          ['', 'Done']
        ]
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null input', () => {
      const result = parseMarkdownTable(null as any);
      expect(result).toBeNull();
    });

    it('should handle undefined input', () => {
      const result = parseMarkdownTable(undefined as any);
      expect(result).toBeNull();
    });

    it('should handle non-string input', () => {
      const result = parseMarkdownTable(123 as any);
      expect(result).toBeNull();
    });

    it('should handle table with inconsistent column counts', () => {
      const markdown = `| Name | Status |
|------|--------|
| Task 1 | Todo | Extra |
| Task 2 |`;
      
      const result = parseMarkdownTable(markdown);
      expect(result).toEqual({
        headers: ['Name', 'Status'],
        rows: [] // Should skip invalid rows
      });
    });

    it('should handle malformed separator row', () => {
      const markdown = `| Name | Status |
| invalid | separator |
| Task 1 | Todo |`;
      
      const result = parseMarkdownTable(markdown);
      expect(result).toBeNull();
    });

    it('should handle table with alignment markers', () => {
      const markdown = `| Name | Status | Priority |
|:-----|:------:|--------:|
| Task 1 | Todo | High |
| Task 2 | Done | Low |`;
      
      const result = parseMarkdownTable(markdown);
      expect(result).toEqual({
        headers: ['Name', 'Status', 'Priority'],
        rows: [
          ['Task 1', 'Todo', 'High'],
          ['Task 2', 'Done', 'Low']
        ]
      });
    });

    it('should handle table with whitespace padding', () => {
      const markdown = `|   Name   |   Status   |
|----------|------------|
|  Task 1  |    Todo    |
|  Task 2  |    Done    |`;
      
      const result = parseMarkdownTable(markdown);
      expect(result).toEqual({
        headers: ['Name', 'Status'],
        rows: [
          ['Task 1', 'Todo'],
          ['Task 2', 'Done']
        ]
      });
    });

    it('should handle large input safely', () => {
      const largeInput = 'a'.repeat(1000000);
      const result = parseMarkdownTable(largeInput);
      expect(result).toBeNull();
    });
  });
});