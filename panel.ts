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

    .panel-container {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .header {
      padding: var(--spacing-xl) var(--spacing-lg);
      border-bottom: 2px solid var(--border-strong);
      background: linear-gradient(135deg, var(--primary-50), var(--primary-100));
      flex-shrink: 0;
      position: relative;
      overflow: hidden;
    }
    
    .header::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(135deg, var(--primary-500), var(--primary-600));
      opacity: 0.03;
      pointer-events: none;
    }

    .header h1 {
      margin: 0 0 var(--spacing-md) 0;
      font-size: 24px;
      font-weight: 700;
      color: var(--primary-800);
      background: linear-gradient(135deg, var(--primary-600), var(--primary-800));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .header-actions {
      display: flex;
      gap: var(--spacing-sm);
      align-items: center;
      flex-wrap: wrap;
    }

    .export-button {
      padding: var(--spacing-sm) var(--spacing-lg);
      background: linear-gradient(135deg, var(--primary-500), var(--primary-600));
      color: white;
      border: 1px solid var(--primary-600);
      border-radius: var(--radius-md);
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all var(--transition-normal);
      position: relative;
      overflow: hidden;
      box-shadow: var(--shadow-sm);
    }
    
    .export-button::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
      transition: left 0.5s;
    }
    
    .export-button:hover::before {
      left: 100%;
    }

    .export-button:hover {
      background: linear-gradient(135deg, var(--primary-600), var(--primary-700));
      transform: translateY(-1px);
      box-shadow: var(--shadow-md);
    }

    .export-button:disabled {
      background: var(--gray-400);
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
      opacity: 0.5;
    }
    
    .export-button:disabled::before {
      display: none;
    }

    .clear-button {
      padding: var(--spacing-sm) var(--spacing-lg);
      background: linear-gradient(135deg, var(--danger-500), var(--danger-600));
      color: white;
      border: 1px solid var(--danger-600);
      border-radius: var(--radius-md);
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all var(--transition-normal);
      position: relative;
      overflow: hidden;
      box-shadow: var(--shadow-sm);
    }
    
    .clear-button::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
      transition: left 0.5s;
    }
    
    .clear-button:hover::before {
      left: 100%;
    }

    .clear-button:hover {
      background: linear-gradient(135deg, var(--danger-600), var(--danger-700));
      transform: translateY(-1px);
      box-shadow: var(--shadow-md);
    }
    
    .clear-button:disabled {
      background: var(--gray-400);
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
      opacity: 0.5;
    }
    
    .clear-button:disabled::before {
      display: none;
    }

    .task-count {
      font-size: 14px;
      color: var(--text-secondary);
      font-weight: 500;
      padding: var(--spacing-xs) var(--spacing-sm);
      background: rgba(255, 255, 255, 0.8);
      border-radius: var(--radius-full);
      border: 1px solid var(--border);
      backdrop-filter: blur(8px);
    }

    .content {
      flex: 1;
      overflow-y: auto;
      padding: 0;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: var(--spacing-2xl);
      text-align: center;
      color: var(--text-secondary);
      background: radial-gradient(circle at center, rgba(59, 130, 246, 0.05), transparent);
    }

    .empty-state h2 {
      margin: 0 0 var(--spacing-sm) 0;
      font-size: 20px;
      color: var(--text-primary);
      font-weight: 600;
    }

    .empty-state p {
      margin: 0;
      font-size: 15px;
      line-height: 1.6;
      max-width: 300px;
      color: var(--text-secondary);
    }

    .toast {
      position: fixed;
      top: var(--spacing-lg);
      right: var(--spacing-lg);
      background: linear-gradient(135deg, var(--secondary-500), var(--secondary-600));
      color: white;
      padding: var(--spacing-md) var(--spacing-lg);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg);
      transform: translateX(100%);
      opacity: 0;
      transition: all var(--transition-slow) ease;
      z-index: 1000;
      font-weight: 500;
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .toast.show {
      transform: translateX(0);
      opacity: 1;
    }

    .paste-hint {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(59, 130, 246, 0.05);
      border: 2px dashed var(--primary-400);
      border-radius: var(--radius-xl);
      padding: var(--spacing-2xl);
      color: var(--primary-600);
      font-size: 16px;
      font-weight: 600;
      pointer-events: none;
      opacity: 0;
      transition: opacity var(--transition-normal);
      backdrop-filter: blur(4px);
    }

    .paste-hint.show {
      opacity: 1;
    }

    .headers-row {
      display: grid;
      grid-template-columns: auto 1fr auto auto;
      gap: var(--spacing-md);
      padding: var(--spacing-md);
      background: linear-gradient(135deg, var(--gray-50), var(--gray-100));
      border-bottom: 2px solid var(--border-strong);
      font-weight: 600;
      font-size: 14px;
      color: var(--text-primary);
      position: sticky;
      top: 0;
      z-index: 10;
      backdrop-filter: blur(8px);
    }

    .headers-cells {
      display: grid;
      gap: 8px;
      grid-template-columns: repeat(var(--column-count, 1), minmax(100px, 1fr));
    }

    .header-cell {
      padding: var(--spacing-xs) var(--spacing-sm);
      color: var(--text-secondary);
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-size: 12px;
    }

    .dialog-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
      opacity: 0;
      backdrop-filter: blur(4px);
      transition: opacity var(--transition-normal);
    }

    .dialog-overlay.show {
      opacity: 1;
    }

    .dialog {
      background: var(--surface-elevated);
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-xl);
      max-width: 480px;
      width: 90%;
      margin: var(--spacing-lg);
      transform: scale(0.95) translateY(10px);
      transition: transform var(--transition-normal);
      border: 1px solid var(--border);
      overflow: hidden;
    }

    .dialog-overlay.show .dialog {
      transform: scale(1) translateY(0);
    }

    .dialog-header {
      padding: var(--spacing-xl) var(--spacing-xl) var(--spacing-lg);
      background: linear-gradient(135deg, var(--primary-50), var(--primary-100));
      border-bottom: 1px solid var(--border);
    }

    .dialog-title {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: var(--primary-800);
      line-height: 1.3;
    }

    .dialog-content {
      padding: var(--spacing-lg) var(--spacing-xl);
    }

    .dialog-message {
      margin: 0;
      font-size: 15px;
      line-height: 1.5;
      color: var(--text-primary);
    }

    .dialog-actions {
      padding: var(--spacing-lg) var(--spacing-xl) var(--spacing-xl);
      display: flex;
      gap: var(--spacing-md);
      justify-content: flex-end;
    }

    .dialog-button {
      padding: var(--spacing-sm) var(--spacing-lg);
      border-radius: var(--radius-md);
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all var(--transition-fast);
      border: 1px solid;
      position: relative;
      overflow: hidden;
    }

    .dialog-button::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
      transition: left 0.3s;
    }

    .dialog-button:hover::before {
      left: 100%;
    }

    .dialog-button.cancel {
      background: var(--surface);
      color: var(--text-secondary);
      border-color: var(--border);
    }

    .dialog-button.cancel:hover {
      background: var(--gray-100);
      border-color: var(--border-strong);
      transform: translateY(-1px);
      box-shadow: var(--shadow-sm);
    }

    .dialog-button.confirm {
      background: linear-gradient(135deg, var(--danger-500), var(--danger-600));
      color: white;
      border-color: var(--danger-600);
    }

    .dialog-button.confirm:hover {
      background: linear-gradient(135deg, var(--danger-600), var(--danger-700));
      transform: translateY(-1px);
      box-shadow: var(--shadow-md);
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
      <div class="panel-container">
        <div class="header">
          <h1>PetaTas</h1>
          <div class="header-actions">
            <span class="task-count">
              ${this.tasks.length} tasks (${completedCount} completed)
            </span>
            <button 
              class="export-button" 
              @click=${this.exportToMarkdown}
              ?disabled=${this.tasks.length === 0}
            >
              Export Markdown
            </button>
            <button 
              class="clear-button" 
              @click=${this.clearAllTasks}
              ?disabled=${this.tasks.length === 0}
            >
              Clear All
            </button>
          </div>
        </div>

        <div class="content">
          ${this.tasks.length === 0 ? html`
            <div class="empty-state">
              <h2>No tasks yet</h2>
              <p>
                Copy a table from any application and paste it here<br>
                to convert it into a task list with timers.
              </p>
            </div>
          ` : html`
            ${this.headers.length > 0 ? html`
              <div class="headers-row">
                <div class="header-cell">Done</div>
                <div class="headers-cells" style="--column-count: ${this.headers.length}">
                  ${this.headers.map(header => html`
                    <div class="header-cell">${header}</div>
                  `)}
                </div>
                <div class="header-cell">Timer</div>
                <div class="header-cell">Notes</div>
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

      <div class="toast ${this.showToast ? 'show' : ''}">
        ${this.toastMessage}
      </div>

      ${this.showConfirmDialog && this.confirmDialogConfig ? html`
        <div class="dialog-overlay ${this.showConfirmDialog ? 'show' : ''}" @click=${this.handleDialogCancel}>
          <div class="dialog" @click=${(e: Event) => e.stopPropagation()}>
            <div class="dialog-header">
              <h3 class="dialog-title">${this.confirmDialogConfig.title}</h3>
            </div>
            <div class="dialog-content">
              <p class="dialog-message">${this.confirmDialogConfig.message}</p>
            </div>
            <div class="dialog-actions">
              <button class="dialog-button cancel" @click=${this.handleDialogCancel}>
                ${this.confirmDialogConfig.cancelText}
              </button>
              <button class="dialog-button confirm" @click=${this.handleDialogConfirm}>
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