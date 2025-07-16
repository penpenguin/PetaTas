import { LitElement, html, css, PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { Task, TimerState } from './types.js';
import { formatTime } from './utils/markdown.js';

export class TaskRow extends LitElement {
  @property({ type: Object }) task!: Task;
  @property({ type: Array }) headers: string[] = [];

  @state() private timerState: TimerState = {
    isRunning: false,
    startTime: 0,
    previousElapsed: 0
  };

  @state() private displayTime: string = '0:00';
  @state() private isEditing: boolean = false;
  @state() private editValue: string = '';

  private animationId: number = 0;
  private intersectionObserver: IntersectionObserver | null = null;
  private isVisible: boolean = true;

  static styles = css`
    :host {
      display: block;
      margin: var(--spacing-sm) var(--spacing-md);
      border-radius: var(--radius-lg);
      transition: all var(--transition-normal);
      background: var(--surface-elevated);
      border: 1px solid var(--border);
      box-shadow: var(--shadow-sm);
    }
    
    :host(:hover) {
      transform: translateY(-1px);
      box-shadow: var(--shadow-md);
      border-color: var(--border-strong);
    }
    
    :host(.completed) {
      opacity: 0.7;
      transform: none;
    }
    
    :host(.completed:hover) {
      transform: none;
      box-shadow: var(--shadow-sm);
    }

    .task-row {
      display: grid;
      grid-template-columns: auto 1fr auto auto;
      gap: var(--spacing-md);
      padding: var(--spacing-lg);
      align-items: start;
    }

    .task-cells {
      display: grid;
      gap: var(--spacing-sm);
      grid-template-columns: repeat(var(--column-count, 1), minmax(120px, 1fr));
    }

    .cell {
      padding: var(--spacing-sm) var(--spacing-md);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: var(--surface);
      font-size: 14px;
      min-height: 24px;
      color: var(--text-primary);
      line-height: 1.4;
      transition: all var(--transition-fast);
      position: relative;
      overflow: hidden;
    }
    
    .cell::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(135deg, var(--primary-500), var(--primary-600));
      opacity: 0;
      transition: opacity var(--transition-fast);
    }
    
    .task-row:hover .cell::before {
      opacity: 0.02;
    }
    
    .cell:hover {
      border-color: var(--primary-300);
      background: var(--primary-50);
    }

    .checkbox {
      margin: 0;
      cursor: pointer;
      width: 18px;
      height: 18px;
      accent-color: var(--primary-500);
      border-radius: var(--radius-sm);
      transition: all var(--transition-fast);
    }
    
    .checkbox:hover {
      transform: scale(1.1);
    }
    
    .checkbox:checked {
      background: var(--primary-500);
      border-color: var(--primary-500);
    }

    .timer-controls {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-xs);
      min-width: 140px;
    }

    .timer-display {
      font-family: 'Courier New', monospace;
      font-size: 15px;
      font-weight: 600;
      text-align: center;
      padding: var(--spacing-sm);
      background: linear-gradient(135deg, var(--gray-50), var(--gray-100));
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      min-height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-primary);
      position: relative;
      overflow: hidden;
    }
    
    .timer-display::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(135deg, var(--primary-500), var(--primary-600));
      opacity: 0;
      transition: opacity var(--transition-fast);
    }
    
    .timer-display.running {
      background: linear-gradient(135deg, var(--secondary-50), var(--secondary-100));
      border-color: var(--secondary-300);
      color: var(--secondary-700);
    }
    
    .timer-display.running::before {
      opacity: 0.1;
    }

    .timer-input {
      font-family: 'Courier New', monospace;
      font-size: 15px;
      font-weight: 600;
      text-align: center;
      padding: var(--spacing-sm);
      background: linear-gradient(135deg, var(--primary-50), var(--primary-100));
      border: 2px solid var(--primary-300);
      border-radius: var(--radius-md);
      min-height: 32px;
      color: var(--text-primary);
      outline: none;
      transition: all var(--transition-fast);
      box-sizing: border-box;
    }

    .timer-input:focus {
      border-color: var(--primary-500);
      background: linear-gradient(135deg, var(--primary-100), var(--primary-200));
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .timer-input.invalid {
      border-color: var(--danger-500);
      background: linear-gradient(135deg, var(--danger-50), var(--danger-100));
      animation: shake 0.3s ease-in-out;
    }

    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-3px); }
      75% { transform: translateX(3px); }
    }

    .timer-input::placeholder {
      color: var(--text-tertiary);
      font-size: 13px;
    }

    .timer-buttons {
      display: flex;
      gap: var(--spacing-xs);
    }

    .timer-button {
      flex: 1;
      padding: var(--spacing-xs) var(--spacing-sm);
      font-size: 12px;
      font-weight: 500;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: var(--surface-elevated);
      cursor: pointer;
      transition: all var(--transition-fast);
      position: relative;
      overflow: hidden;
      color: var(--text-secondary);
    }
    
    .timer-button::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
      transition: left 0.3s;
    }
    
    .timer-button:hover::before {
      left: 100%;
    }

    .timer-button:hover {
      background: var(--gray-100);
      border-color: var(--border-strong);
      transform: translateY(-1px);
      box-shadow: var(--shadow-sm);
    }

    .timer-button.start {
      background: linear-gradient(135deg, var(--secondary-500), var(--secondary-600));
      color: white;
      border-color: var(--secondary-600);
    }

    .timer-button.start:hover {
      background: linear-gradient(135deg, var(--secondary-600), var(--secondary-700));
      transform: translateY(-1px);
      box-shadow: var(--shadow-md);
    }

    .timer-button.stop {
      background: linear-gradient(135deg, var(--danger-500), var(--danger-600));
      color: white;
      border-color: var(--danger-600);
    }

    .timer-button.stop:hover {
      background: linear-gradient(135deg, var(--danger-600), var(--danger-700));
      transform: translateY(-1px);
      box-shadow: var(--shadow-md);
    }

    .notes {
      min-width: 200px;
      resize: vertical;
      padding: var(--spacing-sm) var(--spacing-md);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      font-family: inherit;
      font-size: 14px;
      background: var(--surface);
      color: var(--text-primary);
      transition: all var(--transition-fast);
      line-height: 1.4;
    }
    
    .notes:focus {
      border-color: var(--primary-400);
      background: var(--primary-50);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }
    
    .notes::placeholder {
      color: var(--text-tertiary);
    }

    .task-row.completed .cell {
      text-decoration: line-through;
      color: var(--text-tertiary);
      background: var(--gray-100);
    }
    
    .task-row.completed .timer-display {
      background: var(--gray-100);
      color: var(--text-tertiary);
    }
    
    .task-row.completed .notes {
      background: var(--gray-100);
      color: var(--text-tertiary);
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.timerState.previousElapsed = this.task.elapsedMs;
    this.updateDisplayTime();
    this.setupIntersectionObserver();
    
    // Add completed class to host element
    if (this.task.done) {
      this.classList.add('completed');
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stopTimer();
    this.cleanupIntersectionObserver();
  }

  protected willUpdate(changedProperties: PropertyValues): void {
    if (changedProperties.has('task')) {
      this.timerState.previousElapsed = this.task.elapsedMs;
      this.updateDisplayTime();
    }
  }

  private updateDisplayTime() {
    const currentElapsed = this.timerState.isRunning
      ? this.timerState.previousElapsed + (Date.now() - this.timerState.startTime)
      : this.timerState.previousElapsed;
    
    this.displayTime = formatTime(currentElapsed);
  }

  private parseTimeInput(input: string): number | null {
    if (!input.trim()) return 0;
    
    const timeStr = input.trim();
    const parts = timeStr.split(':').map(part => part.trim());
    
    if (parts.length === 2) {
      // M:SS format
      const minutes = parseInt(parts[0] || '0', 10);
      const seconds = parseInt(parts[1] || '0', 10);
      
      if (isNaN(minutes) || isNaN(seconds) || minutes < 0 || seconds < 0 || seconds >= 60) {
        return null;
      }
      
      return (minutes * 60 + seconds) * 1000;
    } else if (parts.length === 3) {
      // H:MM:SS format
      const hours = parseInt(parts[0] || '0', 10);
      const minutes = parseInt(parts[1] || '0', 10);
      const seconds = parseInt(parts[2] || '0', 10);
      
      if (isNaN(hours) || isNaN(minutes) || isNaN(seconds) || 
          hours < 0 || minutes < 0 || seconds < 0 || 
          minutes >= 60 || seconds >= 60) {
        return null;
      }
      
      return (hours * 3600 + minutes * 60 + seconds) * 1000;
    }
    
    return null;
  }

  private startTimer() {
    if (this.timerState.isRunning) return;

    this.timerState = {
      isRunning: true,
      startTime: Date.now(),
      previousElapsed: this.task.elapsedMs
    };

    this.animateTimer();
  }

  public stopTimer() {
    if (!this.timerState.isRunning) return;

    const newElapsed = this.timerState.previousElapsed + (Date.now() - this.timerState.startTime);
    
    this.timerState = {
      isRunning: false,
      startTime: 0,
      previousElapsed: newElapsed
    };

    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = 0;
    }

    this.updateTask({ elapsedMs: newElapsed });
  }

  private resetTimer() {
    const wasRunning = this.timerState.isRunning;
    
    if (wasRunning) {
      this.stopTimer();
    }

    this.timerState = {
      isRunning: false,
      startTime: 0,
      previousElapsed: 0
    };

    this.updateDisplayTime();
    this.updateTask({ elapsedMs: 0 });
  }

  private startEdit() {
    if (this.timerState.isRunning) {
      this.stopTimer();
    }
    
    this.isEditing = true;
    this.editValue = this.displayTime;
    
    // Focus the input after render
    this.updateComplete.then(() => {
      const input = this.shadowRoot?.querySelector('.timer-input') as HTMLInputElement;
      if (input) {
        input.focus();
        input.select();
      }
    });
  }

  private cancelEdit() {
    this.isEditing = false;
    this.editValue = '';
  }

  private saveEdit() {
    const parsedMs = this.parseTimeInput(this.editValue);
    
    if (parsedMs === null) {
      // Invalid input - show feedback and stay in edit mode
      const input = this.shadowRoot?.querySelector('.timer-input') as HTMLInputElement;
      if (input) {
        input.classList.add('invalid');
        setTimeout(() => input.classList.remove('invalid'), 500);
      }
      return;
    }

    this.timerState = {
      isRunning: false,
      startTime: 0,
      previousElapsed: parsedMs
    };

    this.updateDisplayTime();
    this.updateTask({ elapsedMs: parsedMs });
    this.isEditing = false;
    this.editValue = '';
  }

  private onEditKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.saveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.cancelEdit();
    }
  }

  private onEditInput(e: Event) {
    const input = e.target as HTMLInputElement;
    this.editValue = input.value;
    
    // Remove invalid class when user starts typing
    input.classList.remove('invalid');
  }

  private animateTimer = () => {
    if (this.timerState.isRunning && this.isVisible) {
      this.updateDisplayTime();
      this.animationId = requestAnimationFrame(this.animateTimer);
    } else if (this.timerState.isRunning && !this.isVisible) {
      // Continue timing but don't update display as frequently
      setTimeout(() => {
        if (this.timerState.isRunning) {
          this.updateDisplayTime();
          this.animateTimer();
        }
      }, 1000); // Update every second when not visible
    }
  };

  private setupIntersectionObserver() {
    if ('IntersectionObserver' in window) {
      this.intersectionObserver = new IntersectionObserver(
        (entries) => {
          this.isVisible = entries[0]?.isIntersecting ?? false;
          if (this.isVisible && this.timerState.isRunning && !this.animationId) {
            this.animateTimer();
          }
        },
        { threshold: 0.1 }
      );
      this.intersectionObserver.observe(this);
    }
  }

  private cleanupIntersectionObserver() {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }
  }

  private async updateTask(updates: Partial<Task>) {
    const updatedTask = { ...this.task, ...updates };
    
    // Update local task reference immediately for responsive UI
    this.task = updatedTask;
    
    // Dispatch event for parent to handle batched storage
    this.dispatchEvent(new CustomEvent('task-updated', {
      detail: updatedTask,
      bubbles: true
    }));
  }

  private onCheckboxChange(e: Event) {
    const checkbox = e.target as HTMLInputElement;
    this.updateTask({ done: checkbox.checked });
    
    // Update host element class
    if (checkbox.checked) {
      this.classList.add('completed');
    } else {
      this.classList.remove('completed');
    }
  }

  private onNotesChange(e: Event) {
    const textarea = e.target as HTMLTextAreaElement;
    this.updateTask({ notes: textarea.value });
  }

  private onNotesInput(e: Event) {
    const textarea = e.target as HTMLTextAreaElement;
    // Auto-resize textarea
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  }

  render() {
    return html`
      <div class="task-row ${this.task.done ? 'completed' : ''}">
        <input
          type="checkbox"
          class="checkbox"
          .checked=${this.task.done}
          @change=${this.onCheckboxChange}
        />
        
        <div class="task-cells" style="--column-count: ${this.headers.length || this.task.cells.length}">
          ${this.task.cells.map((cell, index) => html`
            <div class="cell" title="${this.headers[index] || `Column ${index + 1}`}">
              ${cell}
            </div>
          `)}
        </div>
        
        <div class="timer-controls">
          ${this.isEditing ? html`
            <input
              class="timer-input"
              type="text"
              .value=${this.editValue}
              placeholder="1:30:45 or 30:45"
              @input=${this.onEditInput}
              @keydown=${this.onEditKeyDown}
              @blur=${this.saveEdit}
            />
          ` : html`
            <div class="timer-display ${this.timerState.isRunning ? 'running' : ''}" @click=${this.startEdit}>
              ${this.displayTime}
            </div>
          `}
          <div class="timer-buttons">
            ${this.isEditing ? html`
              <button class="timer-button" @click=${this.saveEdit}>Save</button>
              <button class="timer-button" @click=${this.cancelEdit}>Cancel</button>
            ` : html`
              ${this.timerState.isRunning ? html`
                <button class="timer-button stop" @click=${this.stopTimer}>Stop</button>
              ` : html`
                <button class="timer-button start" @click=${this.startTimer}>Start</button>
              `}
              <button class="timer-button" @click=${this.resetTimer}>Reset</button>
              <button class="timer-button" @click=${this.startEdit}>Edit</button>
            `}
          </div>
        </div>
        
        <textarea
          class="notes"
          rows="1"
          placeholder="Notes..."
          .value=${this.task.notes}
          @input=${this.onNotesInput}
          @change=${this.onNotesChange}
        ></textarea>
      </div>
    `;
  }
}

// Only register the custom element if it hasn't been registered already
if (!customElements.get('task-row')) {
  customElements.define('task-row', TaskRow);
}