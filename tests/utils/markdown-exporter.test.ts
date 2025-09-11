import { describe, it, expect } from 'vitest';
import generateMarkdownTable from '@/utils/markdown-exporter';

describe('utils/markdown-exporter', () => {
  it('generates a simple markdown table', () => {
    const headers = ['Status', 'Notes'];
    const rows = [
      ['TODO', 'first'],
      ['DONE', 'second']
    ];
    const md = generateMarkdownTable(headers, rows);
    expect(md).toContain('| Status | Notes |');
    expect(md).toContain('|---|---|');
    expect(md).toContain('| TODO | first |');
    expect(md).toContain('| DONE | second |');
  });
});

