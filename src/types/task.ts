// Task type definitions and validation for PetaTas
import { isSystemHeader } from '../utils/system-columns.js';
import { parseTimerToMs } from '../utils/time-utils.js';

export type TaskStatus = 'todo' | 'in-progress' | 'done';

export interface Task {
  id: string;
  name: string;
  status: TaskStatus;
  notes: string;
  elapsedMs: number;
  createdAt: Date;
  updatedAt: Date;
  // Store additional columns from markdown table
  additionalColumns?: Record<string, string>;
}

export interface TaskData {
  tasks: Task[];
}

// Validation function for Task objects
export function isValidTask(obj: unknown): obj is Task {
  if (obj === null || obj === undefined || typeof obj !== 'object' || Array.isArray(obj)) {
    return false;
  }
  
  const taskObj = obj as Record<string, unknown>;
  
  const isBasicValid = (
    typeof taskObj.id === 'string' &&
    taskObj.id.length > 0 &&
    typeof taskObj.name === 'string' &&
    typeof taskObj.status === 'string' &&
    ['todo', 'in-progress', 'done'].includes(taskObj.status) &&
    typeof taskObj.notes === 'string' &&
    typeof taskObj.elapsedMs === 'number' &&
    taskObj.elapsedMs >= 0 &&
    taskObj.createdAt instanceof Date &&
    taskObj.updatedAt instanceof Date
  );

  // Check additionalColumns if present
  if (taskObj.additionalColumns !== undefined) {
    if (typeof taskObj.additionalColumns !== 'object' || 
        taskObj.additionalColumns === null || 
        Array.isArray(taskObj.additionalColumns)) {
      return false;
    }
    
    // Validate that all values in additionalColumns are strings
    const additionalColumns = taskObj.additionalColumns as Record<string, unknown>;
    for (const value of Object.values(additionalColumns)) {
      if (typeof value !== 'string') {
        return false;
      }
    }
  }

  return isBasicValid;
}

// Note: System/extension-managed columns are identified via isSystemHeader()

// Create a new task from markdown table row
export function createTask(
  headers: string[], 
  row: string[], 
  ignoreExtensionColumns: boolean = false,
  customNameAliases?: string[],
): Task {
  const now = new Date();
  const task: Task = {
    id: generateTaskId(),
    name: '',
    status: 'todo',
    notes: '',
    elapsedMs: 0,
    createdAt: now,
    updatedAt: now,
    additionalColumns: {}
  };

  // Build custom alias set (normalized)
  const customAliasSet = new Set<string>((customNameAliases || []).map((s) => s.toLowerCase().trim()))

  // Map headers to task properties
  headers.forEach((header, index) => {
    const value = row[index] || '';
    const normalizedHeader = header.toLowerCase().trim();
    
    // Skip extension columns if ignoreExtensionColumns is true
    if (ignoreExtensionColumns && isSystemHeader(header)) {
      return;
    }

    // User-configured aliases for title/name take precedence
    if (customAliasSet.has(normalizedHeader)) {
      task.name = value;
      return;
    }
    
    switch (normalizedHeader) {
      // Title/name aliases (English + Japanese)
      case 'name':
      case 'task':
      case 'title':
      case 'taskname':
      case 'task name':
      case '名前':
      case '題名':
      case '件名':
      case 'タスク名':
      case 'タスク':
        task.name = value;
        break;
      case 'status':
      case 'state':
      case '状態':
      case 'ステータス': {
        const normalizedStatus = value.toLowerCase().trim();
        if (['todo', 'in-progress', 'done'].includes(normalizedStatus)) {
          task.status = normalizedStatus as TaskStatus;
        }
        break;
      }
      case 'notes':
      case 'description':
      case 'comment':
      case 'メモ':
      case '説明':
      case 'コメント':
        task.notes = value;
        break;
      case 'timer':
      case 'time':
      case '経過時間':
      case 'タイマー': {
        const ms = parseTimerToMs(value);
        if (Number.isFinite(ms) && ms >= 0) {
          task.elapsedMs = ms;
        }
        break;
      }
      default:
        // Store all additional columns in additionalColumns
        if (task.additionalColumns) {
          task.additionalColumns[header] = value;
        }
    }
  });

  return task;
}

// Validate TaskData structure
export function validateTaskData(data: unknown): data is TaskData {
  if (data === null || data === undefined || typeof data !== 'object' || Array.isArray(data)) {
    return false;
  }
  
  const dataObj = data as Record<string, unknown>;
  
  return (
    Array.isArray(dataObj.tasks) &&
    dataObj.tasks.every(isValidTask)
  );
}

// Generate unique task ID
function generateTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}
