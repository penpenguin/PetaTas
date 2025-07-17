import { LitElement, html, css, PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { Task, TimerState } from '../types/types.js';
import { formatTime } from '../utils/markdown.js';
import { 
  parseTimeInput,
  createTimerState, 
  startTimer, 
  stopTimer, 
  resetTimer, 
  getCurrentElapsed 
} from '../utils/timer.js';

export class TaskRow extends LitElement {
  @property({ type: Object }) task!: Task;
  @property({ type: Array }) headers: string[] = [];

  @state() private timerState: TimerState = createTimerState();

  @state() private displayTime: string = '0:00';
  @state() private isEditing: boolean = false;
  @state() private editValue: string = '';

  private animationId: number = 0;
  private intersectionObserver: IntersectionObserver | null = null;
  private isVisible: boolean = true;

  static styles = css`
    :host {
      display: block;
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
    const currentElapsed = getCurrentElapsed(this.timerState);
    this.displayTime = formatTime(currentElapsed);
  }

  private startTimerHandler() {
    if (this.timerState.isRunning) return;

    this.timerState = startTimer(this.timerState, this.task.elapsedMs);
    this.animateTimer();
  }

  public stopTimer() {
    if (!this.timerState.isRunning) return;

    const result = stopTimer(this.timerState);
    this.timerState = result.state;

    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = 0;
    }

    this.updateTask({ elapsedMs: result.elapsedMs });
  }

  private resetTimerHandler() {
    const wasRunning = this.timerState.isRunning;
    
    if (wasRunning) {
      this.stopTimer();
    }

    this.timerState = resetTimer();
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
    const parsedMs = parseTimeInput(this.editValue);
    
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
      <div class="task-row card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300 border border-base-300 ${this.task.done ? 'opacity-70' : ''}">
        <div class="card-body p-4">
          <div class="grid grid-cols-[auto_1fr_auto_auto] gap-4 items-start">
            <input
              type="checkbox"
              class="checkbox checkbox-primary"
              .checked=${this.task.done}
              @change=${this.onCheckboxChange}
            />
            
            <div class="task-cells grid gap-2" style="grid-template-columns: repeat(${this.headers.length || this.task.cells.length}, minmax(120px, 1fr))">
              ${this.task.cells.map((cell, index) => html`
                <div class="task-cell" title="${this.headers[index] || `Column ${index + 1}`}">
                  ${cell}
                </div>
              `)}
            </div>
            
            <div class="timer-controls flex flex-col gap-2 min-w-[140px]">
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
              <div class="timer-buttons flex gap-1">
                ${this.isEditing ? html`
                  <button class="btn btn-sm btn-primary" @click=${this.saveEdit}>Save</button>
                  <button class="btn btn-sm btn-ghost" @click=${this.cancelEdit}>Cancel</button>
                ` : html`
                  ${this.timerState.isRunning ? html`
                    <button class="btn btn-sm btn-error" @click=${this.stopTimer}>Stop</button>
                  ` : html`
                    <button class="btn btn-sm btn-success" @click=${this.startTimerHandler}>Start</button>
                  `}
                  <button class="btn btn-sm btn-ghost" @click=${this.resetTimerHandler}>Reset</button>
                  <button class="btn btn-sm btn-outline" @click=${this.startEdit}>Edit</button>
                `}
              </div>
            </div>
            
            <textarea
              class="textarea textarea-bordered w-full min-w-[200px] ${this.task.done ? 'bg-base-200 text-base-content/60' : ''}"
              rows="1"
              placeholder="Notes..."
              .value=${this.task.notes}
              @input=${this.onNotesInput}
              @change=${this.onNotesChange}
            ></textarea>
          </div>
        </div>
      </div>
    `;
  }
}

// Only register the custom element if it hasn't been registered already
if (!customElements.get('task-row')) {
  customElements.define('task-row', TaskRow);
}