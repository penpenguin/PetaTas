// PetaTas Chrome Extension - Client-side TypeScript
// This file handles all client-side functionality for the side panel

import { parseMarkdownTable } from './utils/markdown-parser.js';
import { createTask, type Task } from './types/task.js';
import { StorageManager } from './utils/storage-manager.js';
import { escapeHtml, escapeHtmlAttribute } from './utils/html-utils.js';
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
  private isSubmittingTask = false;
  
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
    
    if (pasteButton) {
      pasteButton.addEventListener('click', () => this.handlePasteClick());
    }
    
    if (exportButton) {
      exportButton.addEventListener('click', () => this.handleExportClick());
    }
    
    if (addTaskButton) {
      addTaskButton.addEventListener('click', () => this.handleAddTaskClick());
    }
    
    // Setup add task form submission
    const addTaskForm = document.getElementById('add-task-form');
    if (addTaskForm) {
      addTaskForm.addEventListener('submit', (e) => this.handleAddTaskSubmit(e));
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

      // Convert to tasks using the createTask function with extension columns ignored
      const newTasks: Task[] = parsedTable.rows.map(row => 
        createTask(parsedTable.headers, row, true)
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
    
    // Extension columns that should be handled specially
    const extensionColumns = new Set(['status', 'notes', 'timer']);
    
    this.currentTasks.forEach(task => {
      // Check if name field exists (from name, task, title headers)
      if (task.name) {
        allColumns.set('name', {type: 'text', isExtension: false, priority: 1});
      }
      
      // Check notes field
      if (task.notes !== undefined) {
        allColumns.set('notes', {type: 'textarea', isExtension: true, priority: 100});
      }
      
      // Add additional columns
      if (task.additionalColumns) {
        Object.keys(task.additionalColumns).forEach(header => {
          if (!allColumns.has(header)) {
            allColumns.set(header, {
              type: 'text', 
              isExtension: extensionColumns.has(header.toLowerCase()), 
              priority: 50
            });
          }
        });
      }
    });

    // Sort columns: main field first, then additional columns, then notes last
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
      
      Object.entries(fieldValues).forEach(([fieldName, value]) => {
        if (value) { // Only include non-empty values
          headers.push(fieldName);
          values.push(value);
        }
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
    
    try {
      // Add task to the array
      this.currentTasks.push(task);
      
      // Save to storage
      await this.saveTasks();
      
      // Re-render tasks to show the new task
      this.renderTasks();
    } catch (error) {
      // Complete rollback on any error
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
    
    // Field name should only contain safe characters
    const safeFieldNamePattern = /^[a-zA-Z0-9_\-\s]+$/;
    if (!safeFieldNamePattern.test(fieldName)) {
      console.warn(`Unsafe field name: ${fieldName}`);
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
    const taskName = existingRow.querySelector('.task-name');
    if (taskName) {
      taskName.textContent = task.name;
    }
    
    // Update notes display and input
    const notesDisplay = existingRow.querySelector('.notes-display');
    const notesInput = existingRow.querySelector('.notes-input') as HTMLTextAreaElement;
    if (notesDisplay && notesInput) {
      notesDisplay.textContent = task.notes || 'Add notes...';
      notesDisplay.className = `notes-display text-sm text-gray-500 cursor-pointer hover:bg-gray-100 rounded-[var(--rounded-box)] px-2 py-1 transition-colors ${task.notes ? '' : 'italic text-gray-400'}`;
      notesInput.value = task.notes;
    }
    
    // Update timer display
    const timerDisplay = existingRow.querySelector('.timer-display');
    if (timerDisplay) {
      timerDisplay.textContent = this.formatTime(task.elapsedMs);
      timerDisplay.className = `timer-display ${isTimerRunning ? 'running' : ''}`;
    }
    
    // Update minutes input
    const minutesInput = existingRow.querySelector('.timer-minutes-input') as HTMLInputElement;
    if (minutesInput) {
      minutesInput.value = Math.round(task.elapsedMs / 60000).toString();
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
            <div class="text-xs text-gray-600 bg-gray-100 rounded-[var(--rounded-badge)] px-2 py-1 inline-block mr-1 mb-1">
              <strong>${escapeHtml(header)}:</strong> ${escapeHtml(value)}
            </div>
          `).join('')
      : '';
    
    return `
      <div class="list-row relative" data-testid="task-${escapeHtml(task.id)}" data-status="${escapeHtml(task.status)}">
        <button class="delete-button absolute top-2 right-2 btn btn-ghost btn-xs text-gray-500 hover:text-red-500 hover:bg-red-50" data-task-id="${escapeHtml(task.id)}" data-action="delete" title="Delete task">
          ×
        </button>
        <input 
          type="checkbox" 
          class="checkbox" 
          ${task.status === 'done' ? 'checked' : ''}
          data-task-id="${escapeHtml(task.id)}"
        />
        <div class="list-col-grow">
          <span class="task-name">${escapeHtml(task.name)}</span>
          ${additionalColumnsHtml ? `<div class="mt-1">${additionalColumnsHtml}</div>` : ''}
          <div class="notes-container mt-2">
            <textarea 
              class="notes-input hidden w-full bg-transparent border border-gray-300 rounded-[var(--rounded-box)] px-2 py-1 text-sm resize-none outline-none focus:border-primary focus:ring-1 focus:ring-primary" 
              rows="2"
              placeholder="Add notes..."
              data-task-id="${escapeHtml(task.id)}"
              id="notes-input-${escapeHtml(task.id)}"
            >${escapeHtml(task.notes)}</textarea>
            <div 
              class="notes-display text-sm text-gray-500 cursor-pointer hover:bg-gray-100 rounded-[var(--rounded-box)] px-2 py-1 transition-colors ${task.notes ? '' : 'italic text-gray-400'}" 
              data-task-id="${escapeHtml(task.id)}"
              id="notes-display-${escapeHtml(task.id)}"
              title="Click to edit notes"
            >
              ${task.notes ? escapeHtml(task.notes) : 'Add notes...'}
            </div>
          </div>
        </div>
        <div class="timer-controls flex items-center gap-2">
          <div class="timer-display ${isTimerRunning ? 'running' : ''}">${elapsedTime}</div>
          <input 
            type="number" 
            class="timer-minutes-input w-16 text-xs border rounded-[var(--rounded-btn)] px-1 py-0.5 text-center"
            value="${Math.round(task.elapsedMs / 60000)}"
            min="0"
            step="1"
            placeholder="min"
            title="Enter time in minutes"
            data-task-id="${escapeHtml(task.id)}"
            data-action="set-minutes"
          />
          <button class="btn btn-ghost btn-xs" data-task-id="${escapeHtml(task.id)}" data-action="timer">
            ${isTimerRunning ? '⏸️' : '▶️'}
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
      } else if (target.classList.contains('notes-display')) {
        this.enterNotesEditMode(taskId);
      }
    });

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

  enterNotesEditMode(taskId: string): void {
    const notesDisplay = document.getElementById(`notes-display-${taskId}`);
    const notesInput = document.getElementById(`notes-input-${taskId}`) as HTMLTextAreaElement;
    
    if (!notesDisplay || !notesInput) {
      console.warn(`Notes elements not found for task ${taskId}`);
      return;
    }

    // Hide display, show input
    notesDisplay.classList.add('hidden');
    notesInput.classList.remove('hidden');
    
    // Focus and select the input
    notesInput.focus();
    notesInput.select();
  }

  exitNotesEditMode(taskId: string, save: boolean): void {
    const notesDisplay = document.getElementById(`notes-display-${taskId}`);
    const notesInput = document.getElementById(`notes-input-${taskId}`) as HTMLTextAreaElement;
    const task = this.currentTasks.find(t => t.id === taskId);
    
    if (!notesDisplay || !notesInput || !task) {
      console.warn(`Notes elements or task not found for task ${taskId}`);
      return;
    }

    if (save) {
      // Update task notes
      const newNotes = notesInput.value.trim();
      const oldNotes = task.notes;
      
      if (newNotes !== oldNotes) {
        task.notes = newNotes;
        task.updatedAt = new Date();
        
        // Update display text
        notesDisplay.textContent = newNotes || 'Add notes...';
      notesDisplay.className = `notes-display text-sm text-gray-500 cursor-pointer hover:bg-gray-100 rounded-[var(--rounded-box)] px-2 py-1 transition-colors ${newNotes ? '' : 'italic text-gray-400'}`;
        
        // Save to storage
        this.saveTasks().catch(error => {
          console.error('Failed to save notes changes:', error);
          // Revert changes on save failure
          task.notes = oldNotes;
          notesDisplay.textContent = oldNotes || 'Add notes...';
          notesDisplay.className = `notes-display text-sm text-gray-500 cursor-pointer hover:bg-gray-100 rounded-[var(--rounded-box)] px-2 py-1 transition-colors ${oldNotes ? '' : 'italic text-gray-400'}`;
          notesInput.value = oldNotes;
          this.showToast('Failed to save notes. Please try again.', 'error');
        });
      }
    } else {
      // Revert to original value
      notesInput.value = task.notes;
    }

    // Show display, hide input
    notesDisplay.classList.remove('hidden');
    notesInput.classList.add('hidden');
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
