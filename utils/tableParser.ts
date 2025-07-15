export interface ParsedTable {
  headers: string[];
  rows: string[][];
}

export function parseHTMLTable(htmlString: string): ParsedTable | null {
  // Input validation
  if (!htmlString || typeof htmlString !== 'string' || htmlString.trim() === '') {
    return null;
  }
  
  // Limit input size to prevent DoS
  if (htmlString.length > 1000000) { // 1MB limit
    console.warn('HTML input too large, truncating');
    htmlString = htmlString.substring(0, 1000000);
  }
  
  try {
    // Use DOMParser for safe HTML parsing
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    
    // Check for parser errors
    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      console.error('HTML parsing error:', parserError.textContent);
      return null;
    }
    
    // Find the first table element
    const table = doc.querySelector('table');
  if (!table) {
    return null;
  }
  
  const headers: string[] = [];
  const rows: string[][] = [];
  
  // Extract headers from thead or first row with th elements
  const headerCells = table.querySelectorAll('thead th, tr:first-child th');
  if (headerCells.length > 0) {
    headerCells.forEach(cell => {
      headers.push(cell.textContent?.trim() || '');
    });
  }
  
  // Extract data rows
  const tableRows = table.querySelectorAll('tr');
  let startIndex = 0;
  
  // If we found headers in the first row, skip it for data extraction
  if (headerCells.length > 0 && table.querySelector('tr:first-child th')) {
    startIndex = 1;
  }
  
  for (let i = startIndex; i < tableRows.length; i++) {
    const row = tableRows[i];
    if (!row) continue;
    
    const cells = row.querySelectorAll('td, th');
    const rowData: string[] = [];
    
    cells.forEach(cell => {
      rowData.push(cell.textContent?.trim() || '');
    });
    
    if (rowData.length > 0) {
      rows.push(rowData);
    }
  }
  
  // Return null if no data found
  if (rows.length === 0) {
    return null;
  }
  
  // If no headers were found, generate default ones
  if (headers.length === 0) {
    const maxColumns = Math.max(...rows.map(row => row.length));
    for (let i = 0; i < maxColumns; i++) {
      headers.push(`Col${i + 1}`);
    }
  }
  
  // Normalize row lengths to match header count
  const normalizedRows = rows.map(row => {
    const normalizedRow = [...row];
    while (normalizedRow.length < headers.length) {
      normalizedRow.push('');
    }
    return normalizedRow.slice(0, headers.length);
  });
  
  return {
    headers,
    rows: normalizedRows
  };
  } catch (error) {
    console.error('Error parsing HTML table:', error);
    return null;
  }
}

export function isHTMLTable(htmlString: string): boolean {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    return doc.querySelector('table') !== null;
  } catch (error) {
    console.error('Failed to parse HTML:', error);
    return false;
  }
}