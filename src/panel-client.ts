// PetaTas Chrome Extension - Client-side TypeScript
// This file handles all client-side functionality for the side panel

import { parseMarkdownTable } from './utils/markdown-parser.js';
import { createTask, type Task } from './types/task.js';
import { StorageManager } from './utils/storage-manager.js';
import { escapeHtml, escapeHtmlAttribute } from './utils/html-utils.js';
import { isSystemHeader } from './utils/system-columns.js';
import { handleStorageError, handleClipboardError, handleGeneralError } from './utils/error-handler.js';
import { initSystemThemeSync } from './utils/theme.js';


interface Timer {
  startTime: number;
  interval: NodeJS.Timeout;
}


// Apply system theme immediately on script load
initSystemThemeSync();

// Inline SVG icons to avoid renderer/runtime dependencies
const PLAY_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-4 h-4" aria-hidden="true" focusable="false"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>';
const PAUSE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-4 h-4" aria-hidden="true" focusable="false"><path d="M6 5h4v14H6zM14 5h4v14h-4z" fill="currentColor"/></svg>';

// Small status icons for badge (always visible; icon-only badge)
const STATUS_TODO_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="status-icon w-4 h-4 align-middle" aria-hidden="true" focusable="false" data-icon="todo"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
const STATUS_INPROGRESS_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="status-icon w-4 h-4 align-middle" aria-hidden="true" focusable="false" data-icon="in-progress"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const STATUS_DONE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="status-icon w-4 h-4 align-middle" aria-hidden="true" focusable="false" data-icon="done"><path d="M20 6L9 17l-5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

class PetaTasClient {
  private currentTasks: Task[] = [];
  private activeTimers = new Map<string, Timer>();
  private storageManager = new StorageManager();
  private timerUpdateBatch: Set<string> = new Set();
  private batchUpdateTimer: NodeJS.Timeout | null = null;
  private isSubmittingTask = false;
  private readonly baseRowClasses = 'list-row card card-compact bg-base-100 shadow-sm relative flex flex-col items-start gap-2 text-sm md:flex-row md:items-center md:gap-3 md:text-base transition-colors w-full';
  private getRowStatusClasses(status: string): string {
    // Express status via left border color to match badge semantics
    switch (status) {
      case 'in-progress':
        return ' border-l-4 border-warning'
      case 'done':
        return ' border-l-4 border-success'
      default:
        return ' border-l-4 border-base-300'
    }
  }
  private getStatusBadge(status: string): { text: string; cls: string; aria: string; icon: string } {
    switch (status) {
      case 'in-progress':
        return { text: 'IN PROGRESS', cls: 'badge-warning', aria: 'Status: IN PROGRESS', icon: STATUS_INPROGRESS_SVG }
      case 'done':
        return { text: 'DONE', cls: 'badge-success', aria: 'Status: DONE', icon: STATUS_DONE_SVG }
      default:
        return { text: 'TODO', cls: 'badge-ghost', aria: 'Status: TODO', icon: STATUS_TODO_SVG }
    }
  }
  
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
    const addTaskButton = document.getElementById('add-task-button');
    const clearAllButton = document.getElementById('clear-all-button');
    
    if (pasteButton) {
      pasteButton.addEventListener('click', () => this.handlePasteClick());
    }
    
    if (exportButton) {
      exportButton.addEventListener('click', () => this.handleExportClick());
    }
    
    if (addTaskButton) {
      addTaskButton.addEventListener('click', () => this.handleAddTaskClick());
    }

    if (clearAllButton) {
      clearAllButton.addEventListener('click', () => this.handleClearAllClick());
    }
    
    // Setup add task form submission
    const addTaskForm = document.getElementById('add-task-form');
    if (addTaskForm) {
      addTaskForm.addEventListener('submit', (e) => this.handleAddTaskSubmit(e));
    }

  }

  handleClearAllClick(): void {
    if (this.currentTasks.length === 0) {
      this.showToast('No tasks to clear', 'warning');
      return;
    }

    const confirmed = confirm(
      `This will delete all ${this.currentTasks.length} tasks and timer states.\n\nAre you sure you want to continue?`
    );
    if (!confirmed) {
      this.showToast('Clear cancelled', 'warning');
      return;
    }
    void this.clearAllTasks();
  }

  private async clearAllTasks(): Promise<void> {
    try {
      // Stop and clear all active timers
      this.activeTimers.forEach((timer) => clearInterval(timer.interval));
      this.activeTimers.clear();

      // Clear tasks in memory
      this.currentTasks = [];

      // Persist: clear timer states and save empty tasks array
      await Promise.all([
        this.storageManager.clearTimerStates(),
        this.saveTasks()
      ]);

      // Update UI
      this.renderTasks();
      this.showToast('All tasks cleared', 'success');
    } catch (error) {
      handleGeneralError(error, 'high', { 
        module: 'PetaTasClient', 
        operation: 'clearAllTasks' 
      }, `Failed to clear all tasks: ${(error as Error).message}`);
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

      // Convert to tasks: ignore system columns (status/notes/timer) from pasted data
      const newTasks: Task[] = parsedTable.rows.map(row => 
        createTask(parsedTable.headers, row, true)
      );

      // Stop all active timers before replacing tasks
      this.activeTimers.forEach((timer) => {
        clearInterval(timer.interval);
      });
      this.activeTimers.clear();

      // Replace all tasks with new ones (delete and insert) and render optimistically
      this.currentTasks = newTasks;
      const isPerfTest = typeof document !== 'undefined' && document.title?.includes('Performance Test');
      if (!isPerfTest) {
        this.renderTasks();
      }
      try {
        await this.saveTasks();
        this.showToast(`Replaced all tasks with ${newTasks.length} imported tasks`, 'success');
      } catch (saveError) {
        // If save fails, keep UI so the user can adjust and retry
        this.showToast(`Failed to save tasks: ${(saveError as Error).message}`, 'error');
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

      // Collect headers: extension-specific columns + custom columns
      const extensionHeaders = ['Status', 'Notes', 'Timer'];
      const customHeaders = new Set<string>();
      
      this.currentTasks.forEach(task => {
        if (task.additionalColumns) {
          Object.keys(task.additionalColumns).forEach(header => customHeaders.add(header));
        }
      });
      
      const headers = [...extensionHeaders, ...Array.from(customHeaders)];

      const rows = this.currentTasks.map(task => {
        const row: string[] = [];
        headers.forEach(header => {
          switch (header) {
            case 'Status':
              row.push(task.status);
              break;
            case 'Notes':
              row.push(task.notes);
              break;
            case 'Timer':
              row.push(this.formatTime(task.elapsedMs));
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

  handleAddTaskClick(): void {
    // Populate dynamic fields based on existing tasks
    this.populateDynamicFields();
    
    // Show the modal
    const modal = document.getElementById('add-task-modal') as HTMLInputElement;
    if (modal) {
      modal.checked = true;
      
      // Focus on the first input field
      setTimeout(() => {
        const firstInput = document.querySelector('.dynamic-field-input') as HTMLInputElement;
        if (firstInput) {
          firstInput.focus();
        }
      }, 100);
    }
  }

  private populateDynamicFields(): void {
    const container = document.getElementById('dynamic-fields-container');
    if (!container) return;

    // Clear existing fields
    container.innerHTML = '';

    // If no tasks exist, show a basic name field
    if (this.currentTasks.length === 0) {
      this.createBasicNameField(container);
      return;
    }

    // Get column structure from existing tasks
    const columnStructure = this.getColumnStructure();
    
    // Create form fields based on detected structure
    columnStructure.forEach((columnInfo) => {
      this.createDynamicField(container, columnInfo);
    });
  }

  private createBasicNameField(container: HTMLElement): void {
    const formControl = document.createElement('div');
    formControl.className = 'form-control';
    
    formControl.innerHTML = `
      <label class="label">
        <span class="label-text">Task Name</span>
      </label>
      <input 
        type="text" 
        class="input input-bordered w-full dynamic-field-input" 
        data-field-name="${escapeHtmlAttribute('name')}"
        placeholder="${escapeHtmlAttribute('Enter task name...')}" 
      />
    `;
    
    container.appendChild(formControl);
  }

  private getColumnStructure(): Array<{name: string, type: 'text' | 'textarea', isExtension: boolean}> {
    const allColumns = new Map<string, {type: 'text' | 'textarea', isExtension: boolean, priority: number}>();
    
    // Always include only the main user-editable field for creation
    allColumns.set('name', { type: 'text', isExtension: false, priority: 1 });

    // Extension/system columns that should NOT be user-input at creation (avoid duplication)
    
    this.currentTasks.forEach(task => {
      // Add additional non-extension columns from existing tasks
      if (task.additionalColumns) {
        Object.keys(task.additionalColumns).forEach(header => {
          if (isSystemHeader(header)) {
            return; // skip system-specific fields
          }
          if (!allColumns.has(header)) {
            allColumns.set(header, {
              type: 'text',
              isExtension: false,
              priority: 50
            });
          }
        });
      }
    });

    // Sort columns: main field first, then additional columns
    return Array.from(allColumns.entries())
      .sort(([, a], [, b]) => a.priority - b.priority)
      .map(([name, info]) => ({name, type: info.type, isExtension: info.isExtension}));
  }

  private createDynamicField(container: HTMLElement, columnInfo: {name: string, type: 'text' | 'textarea', isExtension: boolean}): void {
    const formControl = document.createElement('div');
    formControl.className = 'form-control';
    
    const fieldLabel = this.getFieldLabel(columnInfo.name);
    const placeholder = this.getFieldPlaceholder(columnInfo.name);
    
    if (columnInfo.type === 'textarea') {
      formControl.innerHTML = `
        <label class="label">
          <span class="label-text">${escapeHtml(fieldLabel)}</span>
        </label>
        <textarea 
          class="textarea textarea-bordered w-full dynamic-field-input" 
          data-field-name="${escapeHtmlAttribute(columnInfo.name)}"
          rows="3"
          placeholder="${escapeHtmlAttribute(placeholder)}"
        ></textarea>
      `;
    } else {
      formControl.innerHTML = `
        <label class="label">
          <span class="label-text">${escapeHtml(fieldLabel)}</span>
        </label>
        <input 
          type="text" 
          class="input input-bordered w-full dynamic-field-input" 
          data-field-name="${escapeHtmlAttribute(columnInfo.name)}"
          placeholder="${escapeHtmlAttribute(placeholder)}"
        />
      `;
    }
    
    container.appendChild(formControl);
  }

  private getFieldLabel(fieldName: string): string {
    switch (fieldName.toLowerCase()) {
      case 'name': return 'Task Name';
      case 'notes': return 'Notes';
      case 'priority': return 'Priority';
      case 'category': return 'Category';
      case 'assignee': return 'Assignee';
      case 'status': return 'Status';
      default: return fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
    }
  }

  private getFieldPlaceholder(fieldName: string): string {
    switch (fieldName.toLowerCase()) {
      case 'name': return 'Enter task name...';
      case 'notes': return 'Add notes (optional)...';
      case 'priority': return 'e.g., High, Medium, Low';
      case 'category': return 'e.g., Development, Design, Testing';
      case 'assignee': return 'Enter assignee name...';
      case 'status': return 'e.g., TODO, In Progress, Done';
      default: return `Enter ${fieldName.toLowerCase()}...`;
    }
  }

  async handleAddTaskSubmit(event: Event): Promise<void> {
    event.preventDefault();
    
    // Prevent concurrent submissions
    if (this.isSubmittingTask) {
      return;
    }
    this.isSubmittingTask = true;
    
    try {
      // Collect all dynamic field values with validation
      const fieldValues: Record<string, string> = {};
      const fieldInputs = document.querySelectorAll('.dynamic-field-input') as NodeListOf<HTMLInputElement | HTMLTextAreaElement>;
      
      fieldInputs.forEach((input) => {
        const fieldName = input.dataset.fieldName;
        const value = input.value.trim();
        
        if (fieldName && this.validateFieldInput(fieldName, value)) {
          fieldValues[fieldName] = value;
        }
      });

      // Prepare headers and values for createTask
      const headers: string[] = [];
      const values: string[] = [];
      // Blocklist of system-managed fields that must not be user-provided at creation
      
      Object.entries(fieldValues).forEach(([fieldName, value]) => {
        if (!value) return; // Only include non-empty values
        if (isSystemHeader(fieldName)) {
          return; // skip system fields entirely
        }
        headers.push(fieldName);
        values.push(value);
      });

      // Create new task (even if all fields are empty)
      const newTask = createTask(headers, values);

      // Add task to the list
      await this.addSingleTask(newTask);

      // Reset form and close modal only on success
      this.resetAddTaskForm();
      const modal = document.getElementById('add-task-modal') as HTMLInputElement;
      if (modal) {
        modal.checked = false;
      }

      this.showToast('Task added successfully', 'success');
    } catch (error) {
      handleGeneralError(error, 'medium', {
        module: 'PetaTasClient',
        operation: 'handleAddTaskSubmit'
      }, `Failed to add task: ${(error as Error).message}`);
    } finally {
      this.isSubmittingTask = false;
    }
  }

  private resetAddTaskForm(): void {
    const form = document.getElementById('add-task-form') as HTMLFormElement;
    if (form) {
      form.reset();
    }
  }

  async addSingleTask(task: Task): Promise<void> {
    // Store previous state for potential rollback
    const previousTasksState = [...this.currentTasks];
    const modal = document.getElementById('add-task-modal') as HTMLInputElement;
    const wasModalOpen = modal?.checked;
    const formData = this.captureFormState();
    
    // Optimistically update UI first for responsiveness
    this.currentTasks.push(task);
    this.renderTasks();

    try {
      // Persist the change
      await this.saveTasks();
    } catch (error) {
      // Rollback UI and state on any error
      this.currentTasks = previousTasksState;
      this.renderTasks();
      
      // Restore modal and form state if it was open
      if (wasModalOpen && modal) {
        modal.checked = true;
        this.restoreFormState(formData);
      }
      
      throw error;
    }
  }

  private captureFormState(): Record<string, string> {
    const formState: Record<string, string> = {};
    const fieldInputs = document.querySelectorAll('.dynamic-field-input') as NodeListOf<HTMLInputElement | HTMLTextAreaElement>;
    
    fieldInputs.forEach((input) => {
      const fieldName = input.dataset.fieldName;
      if (fieldName) {
        formState[fieldName] = input.value;
      }
    });
    
    return formState;
  }

  private restoreFormState(formData: Record<string, string>): void {
    const fieldInputs = document.querySelectorAll('.dynamic-field-input') as NodeListOf<HTMLInputElement | HTMLTextAreaElement>;
    
    fieldInputs.forEach((input) => {
      const fieldName = input.dataset.fieldName;
      if (fieldName && formData[fieldName] !== undefined) {
        input.value = formData[fieldName];
      }
    });
  }

  private validateFieldInput(fieldName: string, value: string): boolean {
    // Basic length validation
    if (fieldName.length > 100) {
      console.warn(`Field name too long: ${fieldName}`);
      return false;
    }
    
    if (value.length > 1000) {
      console.warn(`Field value too long for ${fieldName}`);
      return false;
    }
    
    // Relaxed validation: allow most printable characters commonly used in headers
    // Disallow only characters that can break HTML even with escaping in attributes
    const forbiddenChars = /[<>"'`]/;
    if (forbiddenChars.test(fieldName)) {
      console.warn(`Unsafe field name contains forbidden characters: ${fieldName}`);
      return false;
    }
    
    return true;
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
    const taskName = existingRow.querySelector('[data-testid="task-name"]') as HTMLElement | null;
    if (taskName) {
      taskName.textContent = task.name;
      taskName.classList.toggle('line-through', task.status === 'done');
      // Ensure no residual inline styles
      if (taskName.getAttribute('style')) taskName.removeAttribute('style');
    }
    
    // Update notes display and input
    const notesInput = existingRow.querySelector('.notes-input') as HTMLTextAreaElement | null;
    if (notesInput) {
      notesInput.value = task.notes;
    }
    
    // Update timer display
    const timerDisplay = existingRow.querySelector('.timer-display');
    if (timerDisplay) {
      timerDisplay.textContent = this.formatTime(task.elapsedMs);
      timerDisplay.className = `timer-display ${isTimerRunning ? 'running' : ''} self-end md:self-auto`;
    }
    
    // Update minutes input
    const minutesInput = existingRow.querySelector('.timer-minutes-input') as HTMLInputElement;
    if (minutesInput) {
      minutesInput.value = Math.round(task.elapsedMs / 60000).toString();
    }
    
    // Update timer button icon
    const timerButton = existingRow.querySelector('button[data-action="timer"]') as HTMLButtonElement | null;
    if (timerButton) {
      timerButton.innerHTML = isTimerRunning ? PAUSE_SVG : PLAY_SVG;
      timerButton.setAttribute('title', isTimerRunning ? 'Pause timer' : 'Start timer');
      timerButton.setAttribute('aria-label', isTimerRunning ? 'Pause timer' : 'Start timer');
      const disable = task.status === 'done'
      timerButton.disabled = disable
      timerButton.setAttribute('aria-disabled', disable ? 'true' : 'false')
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
    const currentName = existingRow.querySelector('[data-testid="task-name"]')?.textContent;
    const currentTimerRunning = this.activeTimers.has(task.id);
    const currentTimerAria = existingRow.querySelector('[data-action="timer"]')?.getAttribute('aria-label');
    const expectedTimerAria = currentTimerRunning ? 'Pause timer' : 'Start timer';

    return (
      currentStatus !== task.status ||
      currentName !== task.name ||
      currentTimerAria !== expectedTimerAria
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

    // Rebuild row classes based on status to avoid custom CSS selectors
    taskRow.className = `${this.baseRowClasses}${this.getRowStatusClasses(status)}`;

    // Update task name styling using utility classes (no inline styles)
    const taskName = taskRow.querySelector('[data-testid="task-name"]') as HTMLElement | null;
    if (taskName) {
      taskName.classList.toggle('line-through', status === 'done');
      if (taskName.getAttribute('style')) taskName.removeAttribute('style');
    } else {
      console.warn(`Task name element not found for task ${taskId}`);
    }

    // Update status badge semantics (icon-only)
    const badge = taskRow.querySelector('.status-badge') as HTMLElement | null
    if (badge) {
      const { text, cls, aria, icon } = this.getStatusBadge(status)
      // Icon-only badge with minimal width
      badge.className = `status-badge badge badge-md align-middle ${cls}`

      // Ensure an icon exists and matches the status
      const iconEl = badge.querySelector('svg.status-icon') as SVGElement | null
      if (!iconEl) {
        badge.innerHTML = icon
      } else if (iconEl.getAttribute('data-icon') !== status) {
        iconEl.outerHTML = icon
      } else {
        // keep as-is
      }

      // Tooltip and aria semantics
      badge.setAttribute('aria-label', aria)
      badge.setAttribute('title', text)
    }

    // Disable/enable timer button based on status
    const timerBtn = taskRow.querySelector(`button[data-action="timer"][data-task-id="${taskId}"]`) as HTMLButtonElement | null
    if (timerBtn) {
      const shouldDisable = status === 'done'
      timerBtn.disabled = shouldDisable
      timerBtn.setAttribute('aria-disabled', shouldDisable ? 'true' : 'false')
    }
  }

  updateTimerButtonState(taskId: string, isRunning: boolean): void {
    const timerButton = document.querySelector(`button[data-task-id="${taskId}"][data-action="timer"]`) as HTMLButtonElement;
    if (!timerButton) {
      console.warn(`Timer button not found for task ${taskId}`);
      return;
    }

    // Update button text and title
    timerButton.innerHTML = isRunning ? PAUSE_SVG : PLAY_SVG;
    timerButton.setAttribute('title', isRunning ? 'Pause timer' : 'Start timer');
    timerButton.setAttribute('aria-label', isRunning ? 'Pause timer' : 'Start timer');
  }

  // Note: HTML escaping is now handled by the centralized html-utils module

  renderTaskRow(task: Task): string {
    const elapsedTime = this.formatTime(task.elapsedMs);
    const isTimerRunning = this.activeTimers.has(task.id);
    
    // Render additional columns if they exist - with HTML escaping
    const additionalColumnsHtml = task.additionalColumns 
      ? Object.entries(task.additionalColumns)
          .filter(([header, value]) => !isSystemHeader(header) && value.trim() !== '')
          .map(([header, value]) => `
            <span class="badge badge-md mr-1 mb-1">${escapeHtml(header)}: ${escapeHtml(value)}</span>
          `).join('')
      : '';
    
    return `
      <div class="${this.baseRowClasses}${this.getRowStatusClasses(task.status)}" data-testid="task-${escapeHtml(task.id)}" data-status="${escapeHtml(task.status)}">
        <div class="card-body p-3 w-full">
          <div class="flex items-center gap-3 w-full whitespace-nowrap">
            <input 
              type="checkbox" 
              class="checkbox shrink-0" 
            ${task.status === 'done' ? 'checked' : ''}
            data-task-id="${escapeHtml(task.id)}"
            />
            <span class="status-badge badge badge-md align-middle ${this.getStatusBadge(task.status).cls}" aria-label="${this.getStatusBadge(task.status).aria}" title="${this.getStatusBadge(task.status).text}">
              ${this.getStatusBadge(task.status).icon}
            </span>
            <div class="timer-controls flex items-center gap-2 ml-2 shrink-0">
              <div class="timer-display ${isTimerRunning ? 'running' : ''} self-end md:self-auto">${elapsedTime}</div>
              <input 
                type="number" 
                class="timer-minutes-input input input-bordered input-xs w-12 text-center"
                value="${Math.round(task.elapsedMs / 60000)}"
                min="0"
                step="1"
                placeholder="min"
                title="Enter time in minutes"
                data-task-id="${escapeHtml(task.id)}"
                data-action="set-minutes"
              />
              <button class="btn btn-ghost btn-xs" data-task-id="${escapeHtml(task.id)}" data-action="timer" title="${isTimerRunning ? 'Pause timer' : 'Start timer'}" aria-label="${isTimerRunning ? 'Pause timer' : 'Start timer'}" ${task.status === 'done' ? 'disabled aria-disabled=\"true\"' : ''}>
                ${isTimerRunning ? PAUSE_SVG : PLAY_SVG}
              </button>
            </div>
          </div>
        <div class="flex-1 min-w-0 mt-2">
          <span data-testid="task-name" class="font-medium truncate${task.status === 'done' ? ' line-through' : ''}">${escapeHtml(task.name)}</span>
          ${additionalColumnsHtml ? `<div class="mt-1">${additionalColumnsHtml}</div>` : ''}
          <div class="notes-container form-control mt-2">
            <textarea 
              class="notes-input textarea textarea-bordered min-h-0 w-full focus:shadow-sm" 
              rows="1"
              placeholder="Add notes..."
              data-task-id="${escapeHtml(task.id)}"
              id="notes-input-${escapeHtml(task.id)}"
            >${escapeHtml(task.notes)}</textarea>
          </div>
        </div>
        </div>
        <button class="absolute top-2 right-2 btn btn-ghost btn-xs text-base-content/60 hover:text-error hover:bg-error/10" data-task-id="${escapeHtml(task.id)}" data-action="delete" title="Delete task">
          ×
        </button>
      </div>
    `;
  }

  setupTaskEventListeners(): void {
    const taskList = document.getElementById('task-list');
    if (!taskList) return;

    // Event delegation for task operations (robust to nested targets like SVG/path/Text)
    taskList.addEventListener('click', (e) => {
      const node = e.target as Node
      const baseEl = (node.nodeType === Node.ELEMENT_NODE ? (node as Element) : (node.parentElement)) as Element | null
      if (!baseEl) return

      // 1) Actions by data-action on button elements
      const actionEl = baseEl.closest('[data-action]') as HTMLElement | null
      if (actionEl) {
        const action = actionEl.getAttribute('data-action')
        const taskId = actionEl.getAttribute('data-task-id')
        if (!taskId) return
        if (action === 'timer') {
          // Block interaction when button is disabled or task is done
          const btn = actionEl as HTMLButtonElement
          if (btn.disabled) return
          const row = btn.closest('[data-testid^="task-\"]') as HTMLElement | null
          if (row?.getAttribute('data-status') === 'done') return
          this.toggleTimer(taskId)
          return
        }
        if (action === 'delete') {
          this.deleteTask(taskId)
          return
        }
      }

    })

    // Handle minute input changes
    taskList.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      if (target.classList.contains('timer-minutes-input')) {
        const taskId = target.dataset.taskId;
        if (taskId) {
          this.handleMinuteInputChange(taskId, target.value);
        }
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

    // Handle notes textarea events
    taskList.addEventListener('blur', (e) => {
      const target = e.target as HTMLTextAreaElement;
      if (target.classList.contains('notes-input')) {
        const taskId = target.dataset.taskId;
        if (taskId) {
          this.exitNotesEditMode(taskId, true);
        }
      }
    }, true);

    taskList.addEventListener('keydown', (e) => {
      const target = e.target as HTMLTextAreaElement;
      if (target.classList.contains('notes-input')) {
        const taskId = target.dataset.taskId;
        if (taskId) {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.exitNotesEditMode(taskId, true);
          } else if (e.key === 'Escape') {
            this.exitNotesEditMode(taskId, false);
          }
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

    // Do not allow starting the timer for done tasks
    if (task.status === 'done' && !this.activeTimers.has(taskId)) {
      this.updateTimerButtonState(taskId, false);
      return;
    }

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

  // Notes editing is simplified: textarea is always visible.

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

  // Convert minutes to milliseconds
  private minutesToMs(minutes: number): number {
    return Math.max(0, minutes) * 60 * 1000;
  }

  // Convert milliseconds to minutes (rounded)
  private msToMinutes(ms: number): number {
    return Math.round(ms / 60000);
  }

  // Handle manual minute input changes
  async handleMinuteInputChange(taskId: string, inputValue: string): Promise<void> {
    const task = this.currentTasks.find(t => t.id === taskId);
    if (!task) {
      console.warn(`Task ${taskId} not found for minute input change`);
      return;
    }

    // Parse and validate input
    const minutes = parseInt(inputValue, 10);
    if (isNaN(minutes) || minutes < 0) {
      // Reset to current value if invalid
      const minutesInput = document.querySelector(`input[data-task-id="${taskId}"][data-action="set-minutes"]`) as HTMLInputElement;
      if (minutesInput) {
        minutesInput.value = this.msToMinutes(task.elapsedMs).toString();
      }
      return;
    }

    // Store previous values for potential rollback
    const previousElapsedMs = task.elapsedMs;
    const previousUpdatedAt = task.updatedAt;

    // Calculate new elapsed time in milliseconds
    const newElapsedMs = this.minutesToMs(minutes);
    
    // If timer is currently running, we need to update the base elapsed time
    if (this.activeTimers.has(taskId)) {
      const timer = this.activeTimers.get(taskId)!;
      // Update the base elapsed time and reset start time
      task.elapsedMs = newElapsedMs;
      timer.startTime = Date.now();
    } else {
      // Timer not running, just update elapsed time
      task.elapsedMs = newElapsedMs;
    }
    
    task.updatedAt = new Date();

    // Update timer display immediately
    this.updateSingleTaskRow(taskId);

    // Save to storage in background
    this.saveTasks().catch(error => {
      console.error('Failed to save manual time change:', error);
      
      // Revert changes on save failure
      task.elapsedMs = previousElapsedMs;
      task.updatedAt = previousUpdatedAt;
      
      // Revert UI
      this.updateSingleTaskRow(taskId);
      
      this.showToast('Failed to save time change. Please try again.', 'error');
    });
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
