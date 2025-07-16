import { LitElement, html, css } from 'lit';
import { state } from 'lit/decorators.js';
import { Task, isValidTask } from './types.js';
import { parseHTMLTable, isHTMLTable } from './utils/tableParser.js';
import { generateMarkdownTable, copyMarkdownToClipboard } from './utils/markdown.js';
import './task-row.js';
import { TaskRow } from './task-row.js';

export class MainPanel extends LitElement {
  @state() private tasks: Task[] = [];
  @state() private headers: string[] = [];
  @state() private toastMessage: string = '';
  @state() private showToast: boolean = false;
  @state() private showConfirmDialog: boolean = false;
  @state() private confirmDialogConfig: {
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    onConfirm: () => void;
  } | null = null;

  private port: chrome.runtime.Port | null = null;
  private saveTimeout: number | null = null;
  private pendingUpdates = new Set<string>();

  static styles = css`
    :host {
      display: block;
      height: 100vh;
      overflow: hidden;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.loadTasks();
    this.setupEventListeners();
    this.connectToBackground();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListeners();
    
    // Clear pending save timeout and save immediately if needed
    if (this.saveTimeout !== null) {
      clearTimeout(this.saveTimeout);
      if (this.pendingUpdates.size > 0) {
        this.saveTasks();
      }
    }
    
    if (this.port) {
      this.port.disconnect();
    }
  }

  private setupEventListeners() {
    document.addEventListener('paste', this.handlePaste);
    this.addEventListener('task-updated', this.handleTaskUpdate as any);
  }

  private removeEventListeners() {
    document.removeEventListener('paste', this.handlePaste);
    this.removeEventListener('task-updated', this.handleTaskUpdate as any);
  }

  private connectToBackground() {
    try {
      this.port = chrome.runtime.connect({ name: 'panel' });
    } catch (error) {
      console.error('Failed to connect to background script:', error);
    }
  }

  private async loadTasks() {
    try {
      const result = await chrome.storage.sync.get(['tasks', 'headers']);
      
      // Validate and recover data
      const recoveredData = this.validateAndRecoverData({
        tasks: result.tasks || [],
        headers: result.headers || []
      });
      
      this.tasks = recoveredData.tasks;
      this.headers = recoveredData.headers;
      
      // If recovery occurred, save the corrected data
      if (recoveredData.wasRecovered) {
        await this.saveTasks();
        this.showToastMessage('Data corruption detected and recovered');
      }
    } catch (error) {
      console.error('Failed to load tasks:', error);
      this.showToastMessage('Failed to load saved data');
      // Initialize with empty data on failure
      this.tasks = [];
      this.headers = [];
    }
  }

  private validateAndRecoverData(data: any): { tasks: Task[], headers: string[], wasRecovered: boolean } {
    let wasRecovered = false;
    let validTasks: Task[] = [];
    let validHeaders: string[] = [];
    
    // Validate tasks
    if (Array.isArray(data.tasks)) {
      for (const task of data.tasks) {
        if (isValidTask(task)) {
          validTasks.push(task);
        } else {
          wasRecovered = true;
          console.warn('Invalid task detected and removed:', task);
        }
      }
    } else {
      wasRecovered = true;
    }
    
    // Validate headers
    if (Array.isArray(data.headers) && data.headers.every((h: any) => typeof h === 'string')) {
      validHeaders = data.headers;
    } else if (data.headers !== undefined) {
      wasRecovered = true;
      console.warn('Invalid headers detected and reset');
    }
    
    return { tasks: validTasks, headers: validHeaders, wasRecovered };
  }

  private handlePaste = async (e: ClipboardEvent) => {
    e.preventDefault();
    
    const htmlData = e.clipboardData?.getData('text/html');
    if (!htmlData || !isHTMLTable(htmlData)) {
      this.showToastMessage('No table found in clipboard');
      return;
    }

    const parsed = parseHTMLTable(htmlData);
    if (!parsed || parsed.rows.length === 0) {
      this.showToastMessage('Failed to parse table');
      return;
    }

    // Check if tasks already exist and show confirmation dialog
    if (this.tasks.length > 0) {
      this.showConfirmationDialog({
        title: 'Replace Existing Tasks?',
        message: `You currently have ${this.tasks.length} task${this.tasks.length === 1 ? '' : 's'}. Pasting will replace all existing tasks with ${parsed.rows.length} new task${parsed.rows.length === 1 ? '' : 's'} from the clipboard. This action cannot be undone.`,
        confirmText: 'Replace Tasks',
        cancelText: 'Cancel',
        onConfirm: () => this.processPasteData(parsed)
      });
    } else {
      // No existing tasks, proceed directly
      await this.processPasteData(parsed);
    }
  };

  private async processPasteData(parsed: { rows: string[][], headers: string[] }) {
    // Stop all running timers before adding new tasks
    await this.stopAllTimers();

    // Convert parsed rows to tasks
    const newTasks: Task[] = parsed.rows.map((row, index) => ({
      id: `task-${Date.now()}-${index}`,
      cells: row,
      done: false,
      notes: '',
      elapsedMs: 0
    }));

    this.tasks = newTasks;
    this.headers = parsed.headers;

    // Save to storage
    await this.saveTasks();
    
    this.showToastMessage(`Added ${newTasks.length} tasks from table`);
  }

  private handleTaskUpdate = (e: Event) => {
    const customEvent = e as CustomEvent;
    const updatedTask = customEvent.detail as Task;
    const index = this.tasks.findIndex(t => t.id === updatedTask.id);
    if (index !== -1) {
      this.tasks[index] = updatedTask;
      this.requestUpdate();
      
      // Add to pending updates and schedule batched save
      this.pendingUpdates.add(updatedTask.id);
      this.scheduleBatchedSave();
    }
  };

  private async saveTasks() {
    try {
      // Check storage quota before saving
      const usage = await chrome.storage.sync.getBytesInUse();
      const quota = chrome.storage.sync.QUOTA_BYTES;
      
      if (usage > quota * 0.9) { // Warn at 90% capacity
        console.warn('Storage quota nearly exceeded:', usage, '/', quota);
        this.showToastMessage('Storage nearly full - consider clearing old tasks');
      }
      
      await chrome.storage.sync.set({
        tasks: this.tasks,
        headers: this.headers
      });
      this.pendingUpdates.clear();
    } catch (error) {
      console.error('Failed to save tasks:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('QUOTA_EXCEEDED')) {
          this.showToastMessage('Storage quota exceeded - please clear some tasks');
        } else if (error.message.includes('MAX_ITEMS')) {
          this.showToastMessage('Too many tasks - please clear some items');
        } else {
          this.showToastMessage('Failed to save changes: ' + error.message);
        }
      } else {
        this.showToastMessage('Failed to save changes');
      }
    }
  }

  private scheduleBatchedSave() {
    // Clear existing timeout
    if (this.saveTimeout !== null) {
      clearTimeout(this.saveTimeout);
    }
    
    // Schedule new save after debounce period
    this.saveTimeout = setTimeout(() => {
      this.saveTasks();
      this.saveTimeout = null;
    }, 500); // 500ms debounce
  }

  private async stopAllTimers() {
    // Find all task-row elements and stop their timers
    const taskRows = this.shadowRoot?.querySelectorAll('task-row');
    taskRows?.forEach((row) => {
      const taskRow = row as TaskRow;
      if (taskRow.stopTimer) {
        taskRow.stopTimer();
      }
    });
  }

  private async exportToMarkdown() {
    if (this.tasks.length === 0) {
      this.showToastMessage('No tasks to export');
      return;
    }

    const markdown = generateMarkdownTable(this.headers, this.tasks);
    const success = await copyMarkdownToClipboard(markdown);
    
    if (success) {
      this.showToastMessage('Markdown copied to clipboard!');
    } else {
      this.showToastMessage('Failed to copy markdown');
    }
  }

  private async clearAllTasks() {
    if (this.tasks.length === 0) return;
    
    if (confirm('Are you sure you want to clear all tasks? This cannot be undone.')) {
      await this.stopAllTimers();
      this.tasks = [];
      this.headers = [];
      await this.saveTasks();
      this.showToastMessage('All tasks cleared');
    }
  }

  private showToastMessage(message: string) {
    this.toastMessage = message;
    this.showToast = true;
    setTimeout(() => {
      this.showToast = false;
    }, 3000);
  }

  private showConfirmationDialog(config: {
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    onConfirm: () => void;
  }) {
    this.confirmDialogConfig = config;
    this.showConfirmDialog = true;
  }

  private hideConfirmationDialog() {
    this.showConfirmDialog = false;
    this.confirmDialogConfig = null;
  }

  private handleDialogConfirm() {
    if (this.confirmDialogConfig?.onConfirm) {
      this.confirmDialogConfig.onConfirm();
    }
    this.hideConfirmationDialog();
  }

  private handleDialogCancel() {
    this.hideConfirmationDialog();
  }

  render() {
    const completedCount = this.tasks.filter(t => t.done).length;
    
    return html`
      <div class="flex flex-col h-full">
        <div class="navbar bg-base-200 border-b-2 border-base-300 flex-shrink-0">
          <div class="navbar-start">
            <h1 class="text-xl font-bold text-primary">PetaTas</h1>
          </div>
          <div class="navbar-end">
            <div class="flex items-center gap-2">
              <div class="badge badge-outline">
                ${this.tasks.length} tasks (${completedCount} completed)
              </div>
              <button 
                class="btn btn-primary btn-sm" 
                @click=${this.exportToMarkdown}
                ?disabled=${this.tasks.length === 0}
              >
                Export Markdown
              </button>
              <button 
                class="btn btn-error btn-sm" 
                @click=${this.clearAllTasks}
                ?disabled=${this.tasks.length === 0}
              >
                Clear All
              </button>
            </div>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto">
          ${this.tasks.length === 0 ? html`
            <div class="hero min-h-full">
              <div class="hero-content text-center">
                <div class="max-w-md">
                  <h2 class="text-2xl font-bold">No tasks yet</h2>
                  <p class="py-6">
                    Copy a table from any application and paste it here<br>
                    to convert it into a task list with timers.
                  </p>
                </div>
              </div>
            </div>
          ` : html`
            ${this.headers.length > 0 ? html`
              <div class="grid grid-cols-[auto_1fr_auto_auto] gap-4 p-4 bg-base-200 border-b-2 border-base-300 font-semibold text-sm sticky top-0 z-10">
                <div class="text-base-content/70 uppercase tracking-wider">Done</div>
                <div class="grid gap-2" style="grid-template-columns: repeat(${this.headers.length}, minmax(100px, 1fr))">
                  ${this.headers.map(header => html`
                    <div class="text-base-content/70 uppercase tracking-wider">${header}</div>
                  `)}
                </div>
                <div class="text-base-content/70 uppercase tracking-wider">Timer</div>
                <div class="text-base-content/70 uppercase tracking-wider">Notes</div>
              </div>
            ` : ''}
            
            ${this.tasks.map(task => html`
              <task-row 
                .task=${task} 
                .headers=${this.headers}
              ></task-row>
            `)}
          `}
        </div>
      </div>

      <div class="toast toast-end ${this.showToast ? 'toast-start' : ''}">
        <div class="alert alert-success">
          <span>${this.toastMessage}</span>
        </div>
      </div>

      ${this.showConfirmDialog && this.confirmDialogConfig ? html`
        <div class="modal modal-open">
          <div class="modal-box">
            <h3 class="font-bold text-lg">${this.confirmDialogConfig.title}</h3>
            <p class="py-4">${this.confirmDialogConfig.message}</p>
            <div class="modal-action">
              <button class="btn btn-ghost" @click=${this.handleDialogCancel}>
                ${this.confirmDialogConfig.cancelText}
              </button>
              <button class="btn btn-error" @click=${this.handleDialogConfirm}>
                ${this.confirmDialogConfig.confirmText}
              </button>
            </div>
          </div>
        </div>
      ` : ''}
    `;
  }
}

// Only register the custom element if it hasn't been registered already
if (!customElements.get('main-panel')) {
  customElements.define('main-panel', MainPanel);
}