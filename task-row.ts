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

  private animationId: number = 0;
  private intersectionObserver: IntersectionObserver | null = null;
  private isVisible: boolean = true;

  static styles = css`
    :host {
      display: block;
      border-bottom: 1px solid #e5e7eb;
    }

    .task-row {
      display: grid;
      grid-template-columns: auto 1fr auto auto;
      gap: 12px;
      padding: 12px;
      align-items: start;
    }

    .task-cells {
      display: grid;
      gap: 8px;
      grid-template-columns: repeat(var(--column-count, 1), minmax(100px, 1fr));
    }

    .cell {
      padding: 4px 8px;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      background: #f9fafb;
      font-size: 14px;
      min-height: 20px;
    }

    .checkbox {
      margin: 0;
      cursor: pointer;
    }

    .timer-controls {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 120px;
    }

    .timer-display {
      font-family: 'Courier New', monospace;
      font-size: 14px;
      font-weight: bold;
      text-align: center;
      padding: 4px;
      background: #f3f4f6;
      border-radius: 4px;
      min-height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .timer-buttons {
      display: flex;
      gap: 2px;
    }

    .timer-button {
      flex: 1;
      padding: 4px 8px;
      font-size: 12px;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      background: white;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .timer-button:hover {
      background: #f3f4f6;
    }

    .timer-button.start {
      background: #10b981;
      color: white;
      border-color: #059669;
    }

    .timer-button.start:hover {
      background: #059669;
    }

    .timer-button.stop {
      background: #ef4444;
      color: white;
      border-color: #dc2626;
    }

    .timer-button.stop:hover {
      background: #dc2626;
    }

    .notes {
      min-width: 200px;
      resize: vertical;
      padding: 8px;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      font-family: inherit;
      font-size: 14px;
    }

    .task-row.completed {
      opacity: 0.6;
    }

    .task-row.completed .cell {
      text-decoration: line-through;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.timerState.previousElapsed = this.task.elapsedMs;
    this.updateDisplayTime();
    this.setupIntersectionObserver();
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
        
        <div class="task-cells" style="--column-count: ${this.task.cells.length}">
          ${this.task.cells.map((cell, index) => html`
            <div class="cell" title="${this.headers[index] || `Column ${index + 1}`}">
              ${cell}
            </div>
          `)}
        </div>
        
        <div class="timer-controls">
          <div class="timer-display">${this.displayTime}</div>
          <div class="timer-buttons">
            ${this.timerState.isRunning ? html`
              <button class="timer-button stop" @click=${this.stopTimer}>Stop</button>
            ` : html`
              <button class="timer-button start" @click=${this.startTimer}>Start</button>
            `}
            <button class="timer-button" @click=${this.resetTimer}>Reset</button>
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