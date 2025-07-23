// PetaTas Chrome Extension - Client-side TypeScript
// This file handles all client-side functionality for the side panel

interface Task {
  id: string;
  name: string;
  status: 'todo' | 'in-progress' | 'done';
  notes: string;
  elapsedMs: number;
  createdAt: Date;
  updatedAt: Date;
}

interface Timer {
  startTime: number;
  interval: NodeJS.Timeout;
}

interface ParsedTable {
  headers: string[];
  rows: string[][];
}

class PetaTasClient {
  private currentTasks: Task[] = [];
  private activeTimers = new Map<string, Timer>();
  
  constructor() {
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.initialize());
    } else {
      this.initialize();
    }
  }

  async initialize(): Promise<void> {
    try {
      console.log('PetaTas client initializing...');
      
      // Check if we're in a Chrome Extension environment
      if (typeof chrome === 'undefined' || !chrome.storage) {
        throw new Error('Chrome Extension environment not detected');
      }
      
      // Load tasks from storage
      await this.loadTasks();
      this.renderTasks();
      
      // Setup event listeners
      this.setupEventListeners();
      
      console.log('PetaTas initialized successfully');
      this.showToast('PetaTas loaded successfully', 'success');
    } catch (error) {
      console.error('Failed to initialize PetaTas:', error);
      this.showToast(`Failed to initialize app: ${(error as Error).message}`, 'error');
    }
  }

  setupEventListeners(): void {
    const pasteButton = document.getElementById('paste-button');
    const exportButton = document.getElementById('export-button');
    
    if (pasteButton) {
      pasteButton.addEventListener('click', () => this.handlePasteClick());
    }
    
    if (exportButton) {
      exportButton.addEventListener('click', () => this.handleExportClick());
    }
  }

  async loadTasks(): Promise<void> {
    try {
      const result = await chrome.storage.sync.get('tasks');
      this.currentTasks = result.tasks || [];
      
      // Convert date strings back to Date objects
      this.currentTasks = this.currentTasks.map(task => ({
        ...task,
        createdAt: new Date(task.createdAt),
        updatedAt: new Date(task.updatedAt)
      }));
    } catch (error) {
      console.error('Failed to load tasks:', error);
      this.currentTasks = [];
    }
  }

  async saveTasks(): Promise<void> {
    try {
      await chrome.storage.sync.set({ tasks: this.currentTasks });
    } catch (error) {
      console.error('Failed to save tasks:', error);
      throw error;
    }
  }

  async handlePasteClick(): Promise<void> {
    try {
      // Check clipboard permissions
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        throw new Error('Clipboard API not available');
      }
      
      const clipboardText = await navigator.clipboard.readText();
      
      if (!clipboardText || clipboardText.trim() === '') {
        this.showToast('Clipboard is empty', 'warning');
        return;
      }
      
      const parsedTable = this.parseMarkdownTable(clipboardText);
      
      if (!parsedTable) {
        this.showToast('Invalid Markdown table format. Please copy a valid table.', 'error');
        return;
      }

      // Convert to tasks
      const newTasks: Task[] = parsedTable.rows.map(row => ({
        id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        name: row[0] || 'Unnamed Task',
        status: (row[1]?.toLowerCase() === 'done' ? 'done' : 'todo') as Task['status'],
        notes: row[2] || '',
        elapsedMs: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      this.currentTasks = newTasks;
      await this.saveTasks();
      this.renderTasks();
      this.showToast(`Imported ${newTasks.length} tasks`, 'success');
    } catch (error) {
      console.error('Failed to paste:', error);
      if ((error as Error).name === 'NotAllowedError') {
        this.showToast('Clipboard access denied. Please allow clipboard permissions.', 'error');
      } else {
        this.showToast(`Failed to paste from clipboard: ${(error as Error).message}`, 'error');
      }
    }
  }

  async handleExportClick(): Promise<void> {
    try {
      if (this.currentTasks.length === 0) {
        this.showToast('No tasks to export', 'warning');
        return;
      }

      // Check clipboard permissions
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        throw new Error('Clipboard API not available');
      }

      const headers = ['Name', 'Status', 'Notes'];
      const rows = this.currentTasks.map(task => [
        task.name,
        task.status,
        task.notes
      ]);

      const markdown = this.generateMarkdownTable(headers, rows);
      await navigator.clipboard.writeText(markdown);
      this.showToast(`Copied ${this.currentTasks.length} tasks to clipboard`, 'success');
    } catch (error) {
      console.error('Failed to export:', error);
      if ((error as Error).name === 'NotAllowedError') {
        this.showToast('Clipboard access denied. Please allow clipboard permissions.', 'error');
      } else {
        this.showToast(`Failed to copy to clipboard: ${(error as Error).message}`, 'error');
      }
    }
  }

  parseMarkdownTable(text: string): ParsedTable | null {
    const lines = text.trim().split('\n');
    if (lines.length < 3) return null; // Need at least header, separator, and one row

    // Parse header
    const headerLine = lines[0].trim();
    if (!headerLine.includes('|')) return null;
    
    const headers = headerLine.split('|')
      .map(h => h.trim())
      .filter(h => h !== '');

    if (headers.length === 0) return null;

    // Check separator line
    const separatorLine = lines[1].trim();
    if (!separatorLine.includes('|') || !separatorLine.includes('-')) return null;

    const rows: string[][] = [];
    for (let i = 2; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || !line.includes('|')) continue;
      
      const row = line.split('|')
        .map(cell => cell.trim())
        .filter(cell => cell !== '');
      
      if (row.length > 0) {
        rows.push(row);
      }
    }

    if (rows.length === 0) return null;

    return { headers, rows };
  }

  generateMarkdownTable(headers: string[], rows: string[][]): string {
    let markdown = '| ' + headers.join(' | ') + ' |\n';
    markdown += '|' + headers.map(() => '---').join('|') + '|\n';
    
    for (const row of rows) {
      markdown += '| ' + row.join(' | ') + ' |\n';
    }
    
    return markdown;
  }

  renderTasks(): void {
    const emptyState = document.getElementById('empty-state');
    const taskList = document.getElementById('task-list');
    
    if (this.currentTasks.length === 0) {
      emptyState?.classList.remove('hidden');
      taskList?.classList.add('hidden');
      return;
    }

    emptyState?.classList.add('hidden');
    taskList?.classList.remove('hidden');

    if (taskList) {
      taskList.innerHTML = this.currentTasks.map(task => this.renderTaskRow(task)).join('');
      
      // Setup task event listeners
      this.setupTaskEventListeners();
    }
  }

  renderTaskRow(task: Task): string {
    const elapsedTime = this.formatTime(task.elapsedMs);
    const isTimerRunning = this.activeTimers.has(task.id);
    
    return `
      <div class="list-row" data-testid="task-${task.id}" data-status="${task.status}">
        <input 
          type="checkbox" 
          class="checkbox" 
          ${task.status === 'done' ? 'checked' : ''}
          data-task-id="${task.id}"
        />
        <div class="list-col-grow">
          <span class="task-name">${task.name}</span>
          ${task.notes ? `<div class="text-sm text-gray-500">${task.notes}</div>` : ''}
        </div>
        <div class="timer-display ${isTimerRunning ? 'running' : ''}">${elapsedTime}</div>
        <div class="flex gap-1">
          <button class="btn btn-ghost btn-xs" data-task-id="${task.id}" data-action="timer">
            ${isTimerRunning ? '⏸️' : '▶️'}
          </button>
          <button class="btn btn-ghost btn-xs" data-task-id="${task.id}" data-action="delete">
            🗑️
          </button>
        </div>
      </div>
    `;
  }

  setupTaskEventListeners(): void {
    const taskList = document.getElementById('task-list');
    if (!taskList) return;

    // Event delegation for task operations
    taskList.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const taskId = target.dataset.taskId;
      
      if (!taskId) return;

      if (target.dataset.action === 'timer') {
        this.toggleTimer(taskId);
      } else if (target.dataset.action === 'delete') {
        this.deleteTask(taskId);
      }
    });

    taskList.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      if (target.type === 'checkbox') {
        const taskId = target.dataset.taskId;
        if (taskId) {
          this.toggleTaskStatus(taskId);
        }
      }
    });
  }

  async toggleTaskStatus(taskId: string): Promise<void> {
    const task = this.currentTasks.find(t => t.id === taskId);
    if (!task) return;

    // If task is currently running timer, stop it when marking as done
    if (task.status !== 'done' && this.activeTimers.has(taskId)) {
      this.toggleTimer(taskId);
    }

    task.status = task.status === 'done' ? 'todo' : 'done';
    task.updatedAt = new Date();
    
    await this.saveTasks();
    this.renderTasks();
  }

  async deleteTask(taskId: string): Promise<void> {
    this.currentTasks = this.currentTasks.filter(t => t.id !== taskId);
    await this.saveTasks();
    this.renderTasks();
    this.showToast('Task deleted', 'success');
  }

  toggleTimer(taskId: string): void {
    const task = this.currentTasks.find(t => t.id === taskId);
    if (!task) return;

    if (this.activeTimers.has(taskId)) {
      // Stop timer
      const timer = this.activeTimers.get(taskId)!;
      clearInterval(timer.interval);
      
      // Update elapsed time and status
      task.elapsedMs += Date.now() - timer.startTime;
      task.status = task.status === 'done' ? 'done' : 'todo';
      task.updatedAt = new Date();
      this.saveTasks();
      
      this.activeTimers.delete(taskId);
    } else {
      // Start timer
      const timer: Timer = {
        startTime: Date.now(),
        interval: setInterval(() => {
          this.updateTimerDisplay(taskId);
        }, 1000)
      };
      
      // Update task status to in-progress
      task.status = 'in-progress';
      task.updatedAt = new Date();
      this.saveTasks();
      
      this.activeTimers.set(taskId, timer);
    }
    
    this.renderTasks();
  }

  updateTimerDisplay(taskId: string): void {
    const timer = this.activeTimers.get(taskId);
    const task = this.currentTasks.find(t => t.id === taskId);
    
    if (!timer || !task) return;

    const currentElapsed = task.elapsedMs + (Date.now() - timer.startTime);
    const display = document.querySelector(`[data-testid="task-${taskId}"] .timer-display`);
    
    if (display) {
      display.textContent = this.formatTime(currentElapsed);
    }
  }

  formatTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    return `${hours.toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  }

  showToast(message: string, type: 'success' | 'error' | 'warning' = 'success'): void {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `alert alert-${type} shadow-lg`;
    toast.innerHTML = `
      <div>
        <span>${message}</span>
      </div>
    `;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }
}

// Initialize the client when this script loads
new PetaTasClient();