// Markdown table parser for PetaTas
// Converts Markdown tables to structured data

export interface ParsedMarkdownTable {
  headers: string[];
  rows: string[][];
}

const MAX_INPUT_LENGTH = 1_000_000;
const PIPE_CODE = 124; // '|'
const separatorRegex = /^:?-+:?$/;

export function parseMarkdownTable(markdown: unknown): ParsedMarkdownTable | null {
  if (typeof markdown !== 'string') {
    return null;
  }

  if (markdown.length === 0) {
    return null;
  }

  if (markdown.length > MAX_INPUT_LENGTH) {
    return null;
  }

  const trimmedInput = fastTrim(markdown);
  if (trimmedInput === '') {
    return null;
  }

  const lines = splitLines(trimmedInput);
  if (lines.length < 3) {
    return null;
  }

  const headerBounds = getTrimmedBounds(lines[0]);
  if (!headerBounds) {
    return null;
  }
  const headers = parseTableRow(lines[0], headerBounds.start, headerBounds.end);

  const separatorBounds = getTrimmedBounds(lines[1]);
  if (!separatorBounds) {
    return null;
  }
  const separatorCells = parseTableRow(lines[1], separatorBounds.start, separatorBounds.end);
  if (!separatorCells.every(cell => separatorRegex.test(cell))) {
    return null;
  }

  if (headers.length !== separatorCells.length) {
    return null;
  }

  const rows: string[][] = [];
  for (let i = 2; i < lines.length; i++) {
    const bounds = getTrimmedBounds(lines[i]);
    if (!bounds) {
      continue;
    }

    const cells = parseTableRow(lines[i], bounds.start, bounds.end);
    if (cells.length === headers.length) {
      rows.push(cells);
    }
  }

  return {
    headers,
    rows,
  };
}

// Fast newline splitter tailored for markdown tables to avoid regex overhead.
function splitLines(input: string): string[] {
  const result: string[] = [];
  let start = 0;
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    if (code === 10 || code === 13) { // \n or \r
      result.push(input.slice(start, i));
      if (code === 13 && i + 1 < input.length && input.charCodeAt(i + 1) === 10) {
        i++;
      }
      start = i + 1;
    }
  }

  if (start <= input.length) {
    result.push(input.slice(start));
  }

  return result;
}

function getTrimmedBounds(line: string): { start: number; end: number } | null {
  let start = 0;
  let end = line.length;

  while (start < end && isWhitespace(line.charCodeAt(start))) start++;
  while (end > start && isWhitespace(line.charCodeAt(end - 1))) end--;

  if (end - start <= 2) {
    return null;
  }

  if (line.charCodeAt(start) !== PIPE_CODE || line.charCodeAt(end - 1) !== PIPE_CODE) {
    return null;
  }

  return { start, end };
}

function parseTableRow(line: string, start: number, end: number): string[] {
  const cells: string[] = [];
  let cellStart = start + 1;

  for (let i = cellStart; i < end; i++) {
    if (line.charCodeAt(i) === PIPE_CODE) {
      cells.push(extractCell(line, cellStart, i));
      cellStart = i + 1;
    }
  }

  return cells;
}

function extractCell(line: string, start: number, end: number): string {
  while (start < end && isWhitespace(line.charCodeAt(start))) start++;
  while (end > start && isWhitespace(line.charCodeAt(end - 1))) end--;
  return start >= end ? '' : line.slice(start, end);
}

// Manual trim keeps behaviour while avoiding the cost of RegExp-based String.trim on large inputs.
function fastTrim(value: string): string {
  let start = 0;
  let end = value.length;

  while (start < end && isWhitespace(value.charCodeAt(start))) start++;
  while (end > start && isWhitespace(value.charCodeAt(end - 1))) end--;

  if (start === 0 && end === value.length) {
    return value;
  }

  return value.slice(start, end);
}

function isWhitespace(charCode: number): boolean {
  return charCode === 32 || charCode === 9 || charCode === 13 || charCode === 10 || charCode === 12;
}
