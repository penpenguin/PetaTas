export interface Task {
  id: string;
  cells: string[];
  done: boolean;
  notes: string;
  elapsedMs: number;
}

export interface StorageData {
  tasks: Task[];
  headers?: string[];
}

export interface TimerState {
  isRunning: boolean;
  startTime: number;
  previousElapsed: number;
}

// Validation functions
export function isValidTask(obj: any): obj is Task {
  return (
    obj !== null &&
    obj !== undefined &&
    typeof obj === 'object' &&
    !Array.isArray(obj) &&
    typeof obj.id === 'string' &&
    Array.isArray(obj.cells) &&
    obj.cells.every((cell: any) => typeof cell === 'string') &&
    typeof obj.done === 'boolean' &&
    typeof obj.notes === 'string' &&
    typeof obj.elapsedMs === 'number' &&
    obj.elapsedMs >= 0
  );
}

export function isValidStorageData(obj: any): obj is StorageData {
  return (
    obj !== null &&
    obj !== undefined &&
    typeof obj === 'object' &&
    !Array.isArray(obj) &&
    Array.isArray(obj.tasks) &&
    obj.tasks.every(isValidTask) &&
    (!obj.headers || (Array.isArray(obj.headers) && obj.headers.every((h: any) => typeof h === 'string')))
  );
}