import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { Task, isValidTask } from './types.js';
import { parseHTMLTable, isHTMLTable } from './utils/tableParser.js';
import { generateMarkdownTable, copyMarkdownToClipboard } from './utils/markdown.js';
import './task-row.js';
import { TaskRow } from './task-row.js';

@customElement('main-panel')
export class MainPanel extends LitElement {
  @state() private tasks: Task[] = [];
  @state() private headers: string[] = [];
  @state() private toastMessage: string = '';
  @state() private showToast: boolean = false;

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
      padding: 16px;
      border-bottom: 2px solid #e5e7eb;
      background: #f9fafb;
      flex-shrink: 0;
    }

    .header h1 {
      margin: 0 0 12px 0;
      font-size: 20px;
      font-weight: bold;
      color: #1f2937;
    }

    .header-actions {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .export-button {
      padding: 8px 16px;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      transition: background-color 0.2s;
    }

    .export-button:hover {
      background: #2563eb;
    }

    .export-button:disabled {
      background: #9ca3af;
      cursor: not-allowed;
    }

    .clear-button {
      padding: 8px 16px;
      background: #ef4444;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      transition: background-color 0.2s;
    }

    .clear-button:hover {
      background: #dc2626;
    }

    .task-count {
      font-size: 14px;
      color: #6b7280;
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
      padding: 32px;
      text-align: center;
      color: #6b7280;
    }

    .empty-state h2 {
      margin: 0 0 8px 0;
      font-size: 18px;
      color: #4b5563;
    }

    .empty-state p {
      margin: 0;
      font-size: 14px;
      line-height: 1.5;
    }

    .toast {
      position: fixed;
      top: 16px;
      right: 16px;
      background: #10b981;
      color: white;
      padding: 12px 16px;
      border-radius: 6px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      transform: translateX(100%);
      opacity: 0;
      transition: all 0.3s ease;
      z-index: 1000;
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
      background: rgba(59, 130, 246, 0.1);
      border: 2px dashed #3b82f6;
      border-radius: 8px;
      padding: 24px;
      color: #3b82f6;
      font-size: 16px;
      font-weight: bold;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s;
    }

    .paste-hint.show {
      opacity: 1;
    }

    .headers-row {
      display: grid;
      grid-template-columns: auto 1fr auto auto;
      gap: 12px;
      padding: 12px;
      background: #f3f4f6;
      border-bottom: 2px solid #e5e7eb;
      font-weight: bold;
      font-size: 14px;
      color: #374151;
    }

    .headers-cells {
      display: grid;
      gap: 8px;
      grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    }

    .header-cell {
      padding: 4px 8px;
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
  };

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
                <div class="headers-cells">
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
    `;
  }
}