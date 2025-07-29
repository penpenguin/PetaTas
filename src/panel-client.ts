// PetaTas Chrome Extension - Client-side TypeScript
// This file handles all client-side functionality for the side panel

import { parseMarkdownTable } from './utils/markdown-parser.js';
import { createTask, type Task } from './types/task.js';
import { StorageManager } from './utils/storage-manager.js';
import { escapeHtml } from './utils/html-utils.js';
import { handleStorageError, handleClipboardError, handleGeneralError } from './utils/error-handler.js';


interface Timer {
  startTime: number;
  interval: NodeJS.Timeout;
}


class PetaTasClient {
  private currentTasks: Task[] = [];
  private activeTimers = new Map<string, Timer>();
  private storageManager = new StorageManager();
  private timerUpdateBatch: Set<string> = new Set();
  private batchUpdateTimer: NodeJS.Timeout | null = null;
  
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
      this.setupTaskEventListeners();
      this.setupErrorNotificationListener();
      
      console.log('PetaTas initialized successfully');
      this.showToast('PetaTas loaded successfully', 'success');
    } catch (error) {
      handleGeneralError(error, 'critical', { 
        module: 'PetaTasClient', 
        operation: 'initialize'
      }, `Failed to initialize app: ${(error as Error).message}`);
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
      handleStorageError(error, { 
        module: 'PetaTasClient', 
        operation: 'saveTasks',
        additionalData: { tasksCount: this.currentTasks.length }
      });
      
      // Re-throw for caller handling if not a throttling error
      if (error instanceof Error && !error.message.includes('Write operation replaced by newer write')) {
        throw error;
      }
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
      handleClipboardError(error, { 
        module: 'PetaTasClient', 
        operation: 'handlePasteClick',
        additionalData: { tasksCount: this.currentTasks.length }
      }, 'read');
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
      handleClipboardError(error, { 
        module: 'PetaTasClient', 
        operation: 'handleExportClick',
        additionalData: { tasksCount: this.currentTasks.length }
      }, 'write');
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
      this.updateTaskListDiff(taskList);
    }
  }

  private updateTaskListDiff(taskList: HTMLElement): void {
    const existingRows = Array.from(taskList.querySelectorAll('[data-testid^="task-"]'));
    const currentTaskIds = new Set(this.currentTasks.map(task => task.id));

    // Remove rows for tasks that no longer exist
    existingRows.forEach(row => {
      const taskId = row.getAttribute('data-testid')?.replace('task-', '');
      if (taskId && !currentTaskIds.has(taskId)) {
        row.remove();
      }
    });

    // Update or add rows for current tasks
    this.currentTasks.forEach((task, index) => {
      const existingRow = taskList.querySelector(`[data-testid="task-${task.id}"]`) as HTMLElement;

      if (existingRow) {
        // Check if the task data has changed by comparing key attributes
        if (this.hasTaskChanged(existingRow, task)) {
          this.updateTaskRowSafely(existingRow, task);
        }
        // Ensure correct position
        const currentPosition = Array.from(taskList.children).indexOf(existingRow);
        if (currentPosition !== index) {
          const targetPosition = taskList.children[index];
          if (targetPosition) {
            taskList.insertBefore(existingRow, targetPosition);
          } else {
            taskList.appendChild(existingRow);
          }
        }
      } else {
        // Add new task row
        const newRow = this.createTaskRowElement(task);
        if (newRow) {
          const targetPosition = taskList.children[index];
          if (targetPosition) {
            taskList.insertBefore(newRow, targetPosition);
          } else {
            taskList.appendChild(newRow);
          }
        }
      }
    });
  }

  private updateTaskRowSafely(existingRow: HTMLElement, task: Task): void {
    // Update content without destroying the element
    const isTimerRunning = this.activeTimers.has(task.id);
    
    // Update checkbox
    const checkbox = existingRow.querySelector('input[type="checkbox"]') as HTMLInputElement;
    if (checkbox) {
      checkbox.checked = task.status === 'done';
    }
    
    // Update task name
    const taskName = existingRow.querySelector('.task-name');
    if (taskName) {
      taskName.textContent = task.name;
    }
    
    // Update notes
    const notesElement = existingRow.querySelector('.text-sm.text-gray-500');
    if (task.notes) {
      if (notesElement) {
        notesElement.textContent = task.notes;
      } else {
        // Add notes element if it doesn't exist
        const notesDiv = document.createElement('div');
        notesDiv.className = 'text-sm text-gray-500';
        notesDiv.textContent = task.notes;
        const taskNameParent = existingRow.querySelector('.list-col-grow');
        if (taskNameParent) {
          taskNameParent.appendChild(notesDiv);
        }
      }
    } else if (notesElement) {
      notesElement.remove();
    }
    
    // Update timer display
    const timerDisplay = existingRow.querySelector('.timer-display');
    if (timerDisplay) {
      timerDisplay.textContent = this.formatTime(task.elapsedMs);
      timerDisplay.className = `timer-display ${isTimerRunning ? 'running' : ''}`;
    }
    
    // Update timer button
    const timerButton = existingRow.querySelector('button[data-action="timer"]');
    if (timerButton) {
      timerButton.textContent = isTimerRunning ? '⏸️' : '▶️';
      timerButton.setAttribute('title', isTimerRunning ? 'Pause timer' : 'Start timer');
    }
    
    // Update data attributes
    existingRow.setAttribute('data-status', task.status);
  }

  private createTaskRowElement(task: Task): HTMLElement | null {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = this.renderTaskRow(task);
    return tempDiv.firstElementChild as HTMLElement;
  }

  private hasTaskChanged(existingRow: Element, task: Task): boolean {
    // Check key attributes that would require a re-render
    const currentStatus = existingRow.getAttribute('data-status');
    const currentName = existingRow.querySelector('.task-name')?.textContent;
    const currentTimerRunning = this.activeTimers.has(task.id);
    const currentTimerButton = existingRow.querySelector('[data-action="timer"]')?.textContent;
    const expectedTimerButton = currentTimerRunning ? '⏸️' : '▶️';

    return (
      currentStatus !== task.status ||
      currentName !== task.name ||
      currentTimerButton !== expectedTimerButton
    );
  }

  updateSingleTaskRow(taskId: string): void {
    const task = this.currentTasks.find(t => t.id === taskId);
    if (!task) {
      console.warn(`Task ${taskId} not found for single row update`);
      return;
    }

    const existingRow = document.querySelector(`[data-testid="task-${taskId}"]`) as HTMLElement;
    if (existingRow) {
      // Update only the specific task row safely without destroying the element
      this.updateTaskRowSafely(existingRow, task);
    } else {
      console.warn(`Task row ${taskId} not found, falling back to full render`);
      // Fallback to full render if row not found
      this.renderTasks();
    }
  }

  updateTaskRowVisualState(taskId: string, status: string): void {
    const taskRow = document.querySelector(`[data-testid="task-${taskId}"]`) as HTMLElement;
    if (!taskRow) {
      console.warn(`Task row ${taskId} not found for visual state update`);
      return;
    }

    // Update data-status attribute for CSS styling
    taskRow.setAttribute('data-status', status);

    // Update task name styling (strikethrough for completed tasks)
    const taskName = taskRow.querySelector('.task-name') as HTMLElement;
    if (taskName) {
      if (status === 'done') {
        taskName.style.textDecoration = 'line-through';
        taskName.style.opacity = '0.6';
      } else {
        taskName.style.textDecoration = 'none';
        taskName.style.opacity = '1';
      }
    } else {
      console.warn(`Task name element not found for task ${taskId}`);
    }

    // Update row background based on status
    taskRow.classList.remove('status-todo', 'status-done', 'status-in-progress');
    taskRow.classList.add(`status-${status}`);
  }

  updateTimerButtonState(taskId: string, isRunning: boolean): void {
    const timerButton = document.querySelector(`button[data-task-id="${taskId}"][data-action="timer"]`) as HTMLButtonElement;
    if (!timerButton) {
      console.warn(`Timer button not found for task ${taskId}`);
      return;
    }

    // Update button text and title
    timerButton.textContent = isRunning ? '⏸️' : '▶️';
    timerButton.setAttribute('title', isRunning ? 'Pause timer' : 'Start timer');
  }

  // Note: HTML escaping is now handled by the centralized html-utils module

  renderTaskRow(task: Task): string {
    const elapsedTime = this.formatTime(task.elapsedMs);
    const isTimerRunning = this.activeTimers.has(task.id);
    
    // Render additional columns if they exist - with HTML escaping
    const additionalColumnsHtml = task.additionalColumns 
      ? Object.entries(task.additionalColumns)
          .filter(([, value]) => value.trim() !== '')
          .map(([header, value]) => `
            <div class="text-xs text-gray-600 bg-gray-100 rounded px-2 py-1 inline-block mr-1 mb-1">
              <strong>${escapeHtml(header)}:</strong> ${escapeHtml(value)}
            </div>
          `).join('')
      : '';
    
    return `
      <div class="list-row" data-testid="task-${escapeHtml(task.id)}" data-status="${escapeHtml(task.status)}">
        <input 
          type="checkbox" 
          class="checkbox" 
          ${task.status === 'done' ? 'checked' : ''}
          data-task-id="${escapeHtml(task.id)}"
        />
        <div class="list-col-grow">
          <span class="task-name">${escapeHtml(task.name)}</span>
          ${task.notes ? `<div class="text-sm text-gray-500">${escapeHtml(task.notes)}</div>` : ''}
          ${additionalColumnsHtml ? `<div class="mt-1">${additionalColumnsHtml}</div>` : ''}
        </div>
        <div class="timer-display ${isTimerRunning ? 'running' : ''}">${elapsedTime}</div>
        <div class="flex gap-1">
          <button class="btn btn-ghost btn-xs" data-task-id="${escapeHtml(task.id)}" data-action="timer">
            ${isTimerRunning ? '⏸️' : '▶️'}
          </button>
          <button class="btn btn-ghost btn-xs" data-task-id="${escapeHtml(task.id)}" data-action="delete">
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
          this.toggleTaskStatus(taskId, target.checked);
        }
      }
    });
  }

  async toggleTaskStatus(taskId: string, checked: boolean): Promise<void> {
    const task = this.currentTasks.find(t => t.id === taskId);
    if (!task) return;

    // Validate DOM state matches expected internal state
    const expectedChecked = task.status === 'done';
    if (checked === expectedChecked) {
      console.warn(`State sync issue: checkbox is ${checked} but task status is ${task.status}. Skipping toggle.`);
      return;
    }

    // Store previous state in case we need to revert
    const previousStatus = task.status;
    const previousUpdatedAt = task.updatedAt;

    // Set status based on actual checkbox state (optimistic update)
    const newStatus = checked ? 'done' : 'todo';
    
    // If task is currently running timer, stop it when marking as done
    if (newStatus === 'done' && this.activeTimers.has(taskId)) {
      this.toggleTimer(taskId);
    }

    task.status = newStatus;
    task.updatedAt = new Date();
    
    // Apply visual changes immediately for instant feedback
    this.updateTaskRowVisualState(taskId, newStatus);

    // Save to storage in background (non-blocking)
    this.saveTasks().catch(error => {
      // Handle "replaced by newer write" gracefully - this is expected behavior
      if (error instanceof Error && error.message.includes('Write operation replaced by newer write')) {
        console.log('Task status change was superseded by a newer write operation');
        return;
      }
      
      // Revert the task state if save failed for other reasons
      console.error('Failed to save task status, reverting state:', error);
      task.status = previousStatus;
      task.updatedAt = previousUpdatedAt;
      
      // Revert visual state
      this.updateTaskRowVisualState(taskId, previousStatus);
      
      // Revert checkbox state in DOM
      const checkbox = document.querySelector(`input[data-task-id="${taskId}"]`) as HTMLInputElement;
      if (checkbox) {
        checkbox.checked = previousStatus === 'done';
      }
      
      // Show error message to user
      this.showToast('Failed to save task change. Please try again.', 'error');
    });
  }

  async deleteTask(taskId: string): Promise<void> {
    // Check if task exists and prevent double deletion
    const taskIndex = this.currentTasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) {
      console.warn(`Task ${taskId} not found for deletion`);
      return;
    }

    // Remove DOM element immediately to prevent visual inconsistencies
    const taskElement = document.querySelector(`[data-testid="task-${taskId}"]`);
    if (taskElement) {
      taskElement.remove();
    }

    // Stop and clean up active timer if running
    if (this.activeTimers.has(taskId)) {
      const timer = this.activeTimers.get(taskId)!;
      clearInterval(timer.interval);
      
      // Update elapsed time before deletion
      const task = this.currentTasks[taskIndex];
      if (task) {
        task.elapsedMs += Date.now() - timer.startTime;
      }
      
      this.activeTimers.delete(taskId);
    }

    // Remove task from array
    this.currentTasks.splice(taskIndex, 1);
    
    // Update empty state visibility immediately
    this.updateEmptyStateVisibility();
    
    // Clean up timer state from storage and save tasks (non-blocking)
    this.cleanupTaskData(taskId).catch(error => {
      console.error('Failed to cleanup task data:', error);
      this.showToast('Task deleted but cleanup failed', 'warning');
    });
    
    this.showToast('Task deleted', 'success');
  }

  private async cleanupTaskData(taskId: string): Promise<void> {
    try {
      await Promise.all([
        this.storageManager.clearTimerState(taskId),
        this.saveTasks()
      ]);
    } catch (error) {
      console.error('Failed to clean up task data:', error);
      throw error;
    }
  }

  private updateEmptyStateVisibility(): void {
    const emptyState = document.getElementById('empty-state');
    const taskList = document.getElementById('task-list');
    
    if (this.currentTasks.length === 0) {
      emptyState?.classList.remove('hidden');
      taskList?.classList.add('hidden');
    } else {
      emptyState?.classList.add('hidden');
      taskList?.classList.remove('hidden');
    }
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
      
      // Update visual state immediately
      this.updateTaskRowVisualState(taskId, task.status);
      this.updateTimerButtonState(taskId, false);
      
      // Save in background
      this.saveTasks().catch(error => {
        console.error('Failed to save timer state:', error);
      });
      
      this.activeTimers.delete(taskId);
    } else {
      // Start timer
      const timer: Timer = {
        startTime: Date.now(),
        interval: setInterval(() => {
          this.scheduleTimerUpdate(taskId);
        }, 1000)
      };
      
      // Update task status to in-progress
      task.status = 'in-progress';
      task.updatedAt = new Date();
      
      // Update visual state immediately
      this.updateTaskRowVisualState(taskId, 'in-progress');
      this.updateTimerButtonState(taskId, true);
      
      // Save in background
      this.saveTasks().catch(error => {
        console.error('Failed to save timer state:', error);
      });
      
      this.activeTimers.set(taskId, timer);
    }
  }

  private scheduleTimerUpdate(taskId: string): void {
    // Add to batch for updating
    this.timerUpdateBatch.add(taskId);
    
    // Schedule batched update if not already scheduled
    if (!this.batchUpdateTimer) {
      this.batchUpdateTimer = setTimeout(() => {
        this.processBatchedTimerUpdates();
        this.batchUpdateTimer = null;
      }, 100); // 100ms batch delay for smooth updates
    }
  }

  private processBatchedTimerUpdates(): void {
    // Process all timer updates in a single batch to improve performance
    const updates: Array<{ element: Element; content: string }> = [];
    
    this.timerUpdateBatch.forEach(taskId => {
      const timer = this.activeTimers.get(taskId);
      const task = this.currentTasks.find(t => t.id === taskId);
      
      if (timer && task) {
        const currentElapsed = task.elapsedMs + (Date.now() - timer.startTime);
        const display = document.querySelector(`[data-testid="task-${taskId}"] .timer-display`);
        
        if (display) {
          updates.push({
            element: display,
            content: this.formatTime(currentElapsed)
          });
        }
      }
    });
    
    // Apply all updates at once to minimize DOM reflows
    updates.forEach(({ element, content }) => {
      element.textContent = content;
    });
    
    // Clear the batch
    this.timerUpdateBatch.clear();
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

  setupErrorNotificationListener(): void {
    document.addEventListener('error-notification', (event: Event) => {
      const customEvent = event as CustomEvent;
      const { message, severity } = customEvent.detail;
      
      // Map error severity to toast type
      const toastType = severity === 'critical' || severity === 'high' ? 'error' : 
                       severity === 'medium' ? 'warning' : 'success';
      
      this.showToast(message, toastType);
    });
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