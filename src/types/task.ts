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
}

export interface TaskData {
  tasks: Task[];
}

// Validation function for Task objects
export function isValidTask(obj: any): obj is Task {
  return (
    obj !== null &&
    obj !== undefined &&
    typeof obj === 'object' &&
    !Array.isArray(obj) &&
    typeof obj.id === 'string' &&
    obj.id.length > 0 &&
    typeof obj.name === 'string' &&
    typeof obj.status === 'string' &&
    ['todo', 'in-progress', 'done'].includes(obj.status) &&
    typeof obj.notes === 'string' &&
    typeof obj.elapsedMs === 'number' &&
    obj.elapsedMs >= 0 &&
    obj.createdAt instanceof Date &&
    obj.updatedAt instanceof Date
  );
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
    updatedAt: now
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
        // For unknown headers, add to notes if not empty
        if (value.trim() !== '') {
          task.notes += (task.notes ? ' | ' : '') + `${header}: ${value}`;
        }
    }
  });

  return task;
}

// Validate TaskData structure
export function validateTaskData(data: any): data is TaskData {
  return (
    data !== null &&
    data !== undefined &&
    typeof data === 'object' &&
    !Array.isArray(data) &&
    Array.isArray(data.tasks) &&
    data.tasks.every(isValidTask)
  );
}

// Generate unique task ID
function generateTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}