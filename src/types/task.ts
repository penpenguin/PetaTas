// Task type definitions and validation for PetaTas

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

// Create a new task from markdown table row
export function createTask(headers: string[], row: string[]): Task {
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

  // Map headers to task properties
  headers.forEach((header, index) => {
    const value = row[index] || '';
    const normalizedHeader = header.toLowerCase().trim();
    
    switch (normalizedHeader) {
      case 'name':
      case 'task':
      case 'title':
        task.name = value;
        break;
      case 'status':
      case 'state': {
        const normalizedStatus = value.toLowerCase().trim();
        if (['todo', 'in-progress', 'done'].includes(normalizedStatus)) {
          task.status = normalizedStatus as TaskStatus;
        }
        break;
      }
      case 'notes':
      case 'description':
      case 'comment':
        task.notes = value;
        break;
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