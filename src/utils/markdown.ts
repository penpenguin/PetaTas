import { Task } from '../types/types.js';

export interface MarkdownTableOptions {
  includeTimer?: boolean;
  includeDone?: boolean;
  includeNotes?: boolean;
}

export function generateMarkdownTable(
  headers: string[],
  tasks: Task[],
  options: MarkdownTableOptions = {}
): string {
  const {
    includeTimer = true,
    includeDone = true,
    includeNotes = true
  } = options;

  // Build the final headers array
  const finalHeaders = [...headers];
  if (includeDone) finalHeaders.push('Done');
  if (includeTimer) finalHeaders.push('Timer');
  if (includeNotes) finalHeaders.push('Notes');

  // Create header row
  const headerRow = '| ' + finalHeaders.join(' | ') + ' |';
  
  // Create separator row
  const separatorRow = '| ' + finalHeaders.map(() => '---').join(' | ') + ' |';
  
  // Create data rows
  const dataRows = tasks.map(task => {
    const cells = [...task.cells];
    
    // Pad cells to match header count
    while (cells.length < headers.length) {
      cells.push('');
    }
    cells.splice(headers.length); // Trim to header count
    
    // Add additional columns
    if (includeDone) {
      cells.push(task.done ? '✅' : '❌');
    }
    if (includeTimer) {
      cells.push(formatTime(task.elapsedMs));
    }
    if (includeNotes) {
      cells.push(escapeMarkdown(task.notes));
    }
    
    return '| ' + cells.map(cell => escapeMarkdown(cell)).join(' | ') + ' |';
  });

  return [headerRow, separatorRow, ...dataRows].join('\n');
}

export function formatTime(elapsedMs: number): string {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}

function escapeMarkdown(text: string): string {
  if (!text) return '';
  
  // Escape markdown characters and handle table-specific issues
  return text
    .replace(/\|/g, '\\|')  // Escape pipe characters
    .replace(/\n/g, '<br>') // Convert newlines to HTML breaks
    .replace(/\r/g, '')     // Remove carriage returns
    .trim();
}

export async function copyMarkdownToClipboard(markdown: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(markdown);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}