// Markdown table parser for PetaTas
// Converts Markdown tables to structured data

export interface ParsedMarkdownTable {
  headers: string[];
  rows: string[][];
}

export function parseMarkdownTable(markdown: unknown): ParsedMarkdownTable | null {
  // Handle invalid input types
  if (markdown === null || markdown === undefined || typeof markdown !== 'string') {
    return null;
  }

  // Handle empty input
  if (markdown.trim() === '') {
    return null;
  }

  // Security: Limit input size to prevent DoS attacks
  if (markdown.length > 1000000) {
    return null;
  }

  const lines = markdown.trim().split('\n');
  
  // Need at least 3 lines for a valid table (header, separator, data)
  if (lines.length < 3) {
    return null;
  }

  // Parse header row
  const headerLine = lines[0].trim();
  if (!isValidTableRow(headerLine)) {
    return null;
  }

  const headers = parseTableRow(headerLine);

  // Validate separator row
  const separatorLine = lines[1].trim();
  if (!isValidTableRow(separatorLine)) {
    return null;
  }

  const separatorCells = parseTableRow(separatorLine);

  // Check that separator cells contain only dashes and optional colons (alignment markers)
  const separatorRegex = /^:?-+:?$/;
  if (!separatorCells.every(cell => separatorRegex.test(cell))) {
    return null;
  }

  // Check that header and separator have same number of columns
  if (headers.length !== separatorCells.length) {
    return null;
  }

  // Parse data rows
  const rows: string[][] = [];
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!isValidTableRow(line)) {
      // Skip invalid rows
      continue;
    }

    const cells = parseTableRow(line);

    // Ensure row has correct number of columns
    if (cells.length === headers.length) {
      rows.push(cells);
    }
  }

  return {
    headers,
    rows
  };
}

// Helper function to validate table row format
function isValidTableRow(line: string): boolean {
  return line.startsWith('|') && line.endsWith('|') && line.length > 2;
}

// Helper function to parse table row cells
function parseTableRow(line: string): string[] {
  return line
    .slice(1, -1) // Remove outer pipes
    .split('|')
    .map(cell => cell.trim());
}