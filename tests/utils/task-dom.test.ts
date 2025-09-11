import { describe, it, expect } from 'vitest';
import { renderTaskRowHtml } from '@/utils/task-renderer';
import { applyRowVisualState, updateRowFromTask, setTimerButtonState } from '@/utils/task-dom';
import type { Task } from '@/types/task';
import { formatHms } from '@/utils/time-utils';

const BASE = 'list-row card card-compact bg-base-100 shadow-sm relative flex flex-col items-start gap-2 text-sm md:flex-row md:items-center md:gap-3 md:text-base transition-colors w-full';

const ICONS = {
  play: '<svg data-test="play"></svg>',
  pause: '<svg data-test="pause"></svg>'
};

function makeTask(partial: Partial<Task> = {}): Task {
  const now = new Date();
  return {
    id: 'task_1',
    name: 'Sample',
    status: 'todo',
    notes: 'n',
    elapsedMs: 65_000,
    createdAt: now,
    updatedAt: now,
    additionalColumns: { Detail: 'X' },
    ...partial,
  } as Task;
}

describe('utils/task-dom', () => {
  it('updateRowFromTask updates DOM safely from task', () => {
    const task = makeTask({ status: 'in-progress', notes: 'hello', elapsedMs: 90_000 });
    const html = renderTaskRowHtml(task, true, BASE);
    const host = document.createElement('div');
    host.innerHTML = html;
    const row = host.firstElementChild as HTMLElement;

    // mutate task
    task.status = 'done';
    task.name = 'Updated';
    task.notes = 'changed';
    task.elapsedMs = 5_000;

    updateRowFromTask(row, task, false, ICONS);

    const checkbox = row.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);

    const nameEl = row.querySelector('[data-testid="task-name"]') as HTMLElement;
    expect(nameEl.textContent).toBe('Updated');
    expect(nameEl.classList.contains('line-through')).toBe(true);
    expect(nameEl.getAttribute('style')).toBeFalsy();

    const notes = row.querySelector('.notes-input') as HTMLTextAreaElement;
    expect(notes.value).toBe('changed');

    const disp = row.querySelector('.timer-display') as HTMLElement;
    expect(disp.textContent).toBe(formatHms(5_000));
    expect(disp.className.includes('running')).toBe(false);

    const min = row.querySelector('.timer-minutes-input') as HTMLInputElement;
    expect(min.value).toBe('0');

    const btn = row.querySelector('button[data-action="timer"]') as HTMLButtonElement;
    expect(btn.getAttribute('aria-label')).toBe('Start timer');
    expect(btn.classList.contains('tooltip')).toBe(true);
    expect(btn.getAttribute('data-tip')).toBe('Start timer');
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute('aria-disabled')).toBe('true');

    expect(row.getAttribute('data-status')).toBe('done');
  });

  it('applyRowVisualState toggles classes and badge', () => {
    const task = makeTask({ status: 'todo' });
    const html = renderTaskRowHtml(task, false, BASE);
    const host = document.createElement('div');
    host.innerHTML = html;
    const row = host.firstElementChild as HTMLElement;

    applyRowVisualState(row, 'in-progress', BASE);
    expect(row.getAttribute('data-status')).toBe('in-progress');
    const badge = row.querySelector('.status-badge') as HTMLElement;
    expect(badge.className.includes('badge-warning')).toBe(true);
    expect(badge.classList.contains('tooltip')).toBe(true);
    expect(badge.getAttribute('data-tip')).toBe('IN PROGRESS');
  });

  it('setTimerButtonState updates aria-label and tooltip', () => {
    const button = document.createElement('button');
    setTimerButtonState(button as HTMLButtonElement, true, ICONS);
    expect(button.getAttribute('aria-label')).toBe('Pause timer');
    expect(button.classList.contains('tooltip')).toBe(true);
    expect(button.getAttribute('data-tip')).toBe('Pause timer');
    expect(button.innerHTML.includes('data-test="pause"')).toBe(true);
  });
});

