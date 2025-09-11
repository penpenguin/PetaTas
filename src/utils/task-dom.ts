import type { Task } from '@/types/task';
import { getRowStatusClasses, getStatusBadge } from '@/utils/status-utils';
import { formatHms } from '@/utils/time-utils';

export interface TimerIcons {
  play: string;
  pause: string;
}

// Update a row's visual state based on status (no DOM lookup outside the row)
export function applyRowVisualState(taskRow: HTMLElement, status: string, baseRowClasses: string): void {
  taskRow.setAttribute('data-status', status);
  taskRow.className = `${baseRowClasses}${getRowStatusClasses(status)}`;

  const taskName = taskRow.querySelector('[data-testid="task-name"]') as HTMLElement | null;
  if (taskName) {
    taskName.classList.toggle('line-through', status === 'done');
    if (taskName.getAttribute('style')) taskName.removeAttribute('style');
  }

  const badge = taskRow.querySelector('.status-badge') as HTMLElement | null;
  if (badge) {
    const { text, cls, aria, icon } = getStatusBadge(status);
    badge.className = `status-badge badge badge-md align-middle ${cls}`;
    const iconEl = badge.querySelector('svg.status-icon') as SVGElement | null;
    if (!iconEl) {
      badge.innerHTML = icon;
    } else if (iconEl.getAttribute('data-icon') !== status) {
      iconEl.outerHTML = icon;
    }
    badge.setAttribute('aria-label', aria);
    badge.classList.add('tooltip');
    badge.setAttribute('data-tip', text);
  }

  const timerBtn = taskRow.querySelector('button[data-action="timer"]') as HTMLButtonElement | null;
  if (timerBtn) {
    const shouldDisable = status === 'done';
    timerBtn.disabled = shouldDisable;
    timerBtn.setAttribute('aria-disabled', shouldDisable ? 'true' : 'false');
  }
}

// Update DOM of an existing row from a Task (no element replacement)
export function updateRowFromTask(existingRow: HTMLElement, task: Task, isTimerRunning: boolean, icons: TimerIcons): void {
  const checkbox = existingRow.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
  if (checkbox) {
    checkbox.checked = task.status === 'done';
  }

  const taskName = existingRow.querySelector('[data-testid="task-name"]') as HTMLElement | null;
  if (taskName) {
    taskName.textContent = task.name;
    taskName.classList.toggle('line-through', task.status === 'done');
    if (taskName.getAttribute('style')) taskName.removeAttribute('style');
  }

  const notesInput = existingRow.querySelector('.notes-input') as HTMLTextAreaElement | null;
  if (notesInput) {
    notesInput.value = task.notes;
  }

  const timerDisplay = existingRow.querySelector('.timer-display') as HTMLElement | null;
  if (timerDisplay) {
    timerDisplay.textContent = formatHms(task.elapsedMs);
    timerDisplay.className = `timer-display ${isTimerRunning ? 'running' : ''} self-end md:self-auto`;
  }

  const minutesInput = existingRow.querySelector('.timer-minutes-input') as HTMLInputElement | null;
  if (minutesInput) {
    minutesInput.value = Math.round(task.elapsedMs / 60000).toString();
  }

  const timerButton = existingRow.querySelector('button[data-action="timer"]') as HTMLButtonElement | null;
  if (timerButton) {
    timerButton.innerHTML = isTimerRunning ? icons.pause : icons.play;
    timerButton.classList.add('tooltip');
    timerButton.setAttribute('data-tip', isTimerRunning ? 'Pause timer' : 'Start timer');
    timerButton.setAttribute('aria-label', isTimerRunning ? 'Pause timer' : 'Start timer');
    const disable = task.status === 'done';
    timerButton.disabled = disable;
    timerButton.setAttribute('aria-disabled', disable ? 'true' : 'false');
  }

  existingRow.setAttribute('data-status', task.status);
}

// Update only the timer button state
export function setTimerButtonState(timerButton: HTMLButtonElement, isRunning: boolean, icons: TimerIcons): void {
  timerButton.innerHTML = isRunning ? icons.pause : icons.play;
  timerButton.classList.add('tooltip');
  timerButton.setAttribute('data-tip', isRunning ? 'Pause timer' : 'Start timer');
  timerButton.setAttribute('aria-label', isRunning ? 'Pause timer' : 'Start timer');
}

export default {
  applyRowVisualState,
  updateRowFromTask,
  setTimerButtonState,
};

