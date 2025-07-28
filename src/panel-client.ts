// PetaTas Chrome Extension - Client-side TypeScript
// This file handles all client-side functionality for the side panel

import { parseMarkdownTable } from './utils/markdown-parser.js';
import { createTask, type Task } from './types/task.js';
import { StorageManager } from './utils/storage-manager.js';


interface Timer {
  startTime: number;
  interval: NodeJS.Timeout;
}


class PetaTasClient {
  private currentTasks: Task[] = [];
  private activeTimers = new Map<string, Timer>();
  private storageManager = new StorageManager();
  
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
      this.currentTasks = await this.storageManager.loadTasks();
    } catch (error) {
      console.error('Failed to load tasks:', error);
      this.currentTasks = [];
    }
  }

  async saveTasks(): Promise<void> {
    try {
      await this.storageManager.saveTasks(this.currentTasks);
    } catch (error) {
      console.error('Failed to save tasks:', error);
      
      // Show user-friendly error messages for quota issues
      if (error instanceof Error) {
        if (error.message.includes('MAX_WRITE_OPERATIONS_PER_MINUTE')) {
          this.showToast('Too many changes too quickly. Please wait a moment before making more changes.', 'warning');
          return; // Don't re-throw for quota errors - they're handled by throttling
        } else if (error.message.includes('QUOTA_BYTES_PER_ITEM') || error.message.includes('Data size')) {
          this.showToast('Too much task data. Please delete some tasks to continue.', 'error');
        } else if (error.message.includes('Write operation replaced by newer write')) {
          // This is expected behavior when multiple saves happen quickly - don't show error
          return; // Don't re-throw as this is normal throttling behavior
        } else {
          this.showToast('Failed to save tasks. Please try again.', 'error');
        }
      }
      
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
      
      const parsedTable = parseMarkdownTable(clipboardText);
      
      if (!parsedTable) {
        this.showToast('Invalid Markdown table format. Please copy a valid table.', 'error');
        return;
      }

      // Show confirmation dialog if there are existing tasks
      if (this.currentTasks.length > 0) {
        const confirmed = confirm(
          `This will replace all ${this.currentTasks.length} existing tasks with ${parsedTable.rows.length} new tasks from the clipboard.\n\nAre you sure you want to continue?`
        );
        if (!confirmed) {
          this.showToast('Import cancelled', 'warning');
          return;
        }
      }

      // Convert to tasks using the createTask function
      const newTasks: Task[] = parsedTable.rows.map(row => 
        createTask(parsedTable.headers, row)
      );

      // Stop all active timers before replacing tasks
      this.activeTimers.forEach((timer) => {
        clearInterval(timer.interval);
      });
      this.activeTimers.clear();

      // Replace all tasks with new ones (delete and insert)
      this.currentTasks = newTasks;
      try {
        await this.saveTasks();
        this.renderTasks();
        this.showToast(`Replaced all tasks with ${newTasks.length} imported tasks`, 'success');
      } catch (saveError) {
        // If save fails, we need to provide recovery options
        this.showToast(`Failed to save tasks: ${(saveError as Error).message}`, 'error');
        // Don't restore the old tasks - let user know they need to reduce data or try again
        throw saveError;
      }
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

      // Collect all unique headers from all tasks
      const allHeaders = new Set(['Name', 'Status', 'Notes']);
      this.currentTasks.forEach(task => {
        if (task.additionalColumns) {
          Object.keys(task.additionalColumns).forEach(header => allHeaders.add(header));
        }
      });
      const headers = Array.from(allHeaders);

      const rows = this.currentTasks.map(task => {
        const row: string[] = [];
        headers.forEach(header => {
          switch (header) {
            case 'Name':
              row.push(task.name);
              break;
            case 'Status':
              row.push(task.status);
              break;
            case 'Notes':
              row.push(task.notes);
              break;
            default:
              row.push(task.additionalColumns?.[header] || '');
          }
        });
        return row;
      });

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

  // Helper function to safely escape HTML
  private escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  renderTaskRow(task: Task): string {
    const elapsedTime = this.formatTime(task.elapsedMs);
    const isTimerRunning = this.activeTimers.has(task.id);
    
    // Render additional columns if they exist - with HTML escaping
    const additionalColumnsHtml = task.additionalColumns 
      ? Object.entries(task.additionalColumns)
          .filter(([, value]) => value.trim() !== '')
          .map(([header, value]) => `
            <div class="text-xs text-gray-600 bg-gray-100 rounded px-2 py-1 inline-block mr-1 mb-1">
              <strong>${this.escapeHtml(header)}:</strong> ${this.escapeHtml(value)}
            </div>
          `).join('')
      : '';
    
    return `
      <div class="list-row" data-testid="task-${this.escapeHtml(task.id)}" data-status="${this.escapeHtml(task.status)}">
        <input 
          type="checkbox" 
          class="checkbox" 
          ${task.status === 'done' ? 'checked' : ''}
          data-task-id="${this.escapeHtml(task.id)}"
        />
        <div class="list-col-grow">
          <span class="task-name">${this.escapeHtml(task.name)}</span>
          ${task.notes ? `<div class="text-sm text-gray-500">${this.escapeHtml(task.notes)}</div>` : ''}
          ${additionalColumnsHtml ? `<div class="mt-1">${additionalColumnsHtml}</div>` : ''}
        </div>
        <div class="timer-display ${isTimerRunning ? 'running' : ''}">${elapsedTime}</div>
        <div class="flex gap-1">
          <button class="btn btn-ghost btn-xs" data-task-id="${this.escapeHtml(task.id)}" data-action="timer">
            ${isTimerRunning ? '⏸️' : '▶️'}
          </button>
          <button class="btn btn-ghost btn-xs" data-task-id="${this.escapeHtml(task.id)}" data-action="delete">
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

    // Store previous state in case we need to revert
    const previousStatus = task.status;
    const previousUpdatedAt = task.updatedAt;

    try {
      // If task is currently running timer, stop it when marking as done
      if (task.status !== 'done' && this.activeTimers.has(taskId)) {
        this.toggleTimer(taskId);
      }

      task.status = task.status === 'done' ? 'todo' : 'done';
      task.updatedAt = new Date();
      
      await this.saveTasks();
      this.renderTasks();
    } catch (error) {
      // Handle "replaced by newer write" gracefully - this is expected behavior
      if (error instanceof Error && error.message.includes('Write operation replaced by newer write')) {
        // Don't revert state - the newer write will have the correct state
        console.log('Task status change was superseded by a newer write operation');
        return;
      }
      
      // Revert the task state if save failed for other reasons
      task.status = previousStatus;
      task.updatedAt = previousUpdatedAt;
      this.renderTasks(); // Re-render to show correct state
      
      // The error message is already handled in saveTasks()
      console.error('Failed to toggle task status, reverting state:', error);
    }
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