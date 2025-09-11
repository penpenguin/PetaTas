// Generate a Markdown table string from headers and rows.
// Pure function: does not touch DOM or storage.
export function generateMarkdownTable(headers: string[], rows: string[][]): string {
  const headerLine = `| ${headers.join(' | ')} |\n`;
  const sepLine = `|${headers.map(() => '---').join('|')}|\n`;
  const body = rows.map((row) => `| ${row.join(' | ')} |`).join('\n');
  return headerLine + sepLine + (body ? body + '\n' : '');
}

export default generateMarkdownTable;

