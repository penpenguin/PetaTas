import type { Task } from '@/types/task';
import { getRowStatusClasses, getStatusBadge } from '@/utils/status-utils';
import { escapeHtml, escapeHtmlAttribute } from '@/utils/html-utils';
import { isSystemHeader } from '@/utils/system-columns';
import { formatHms } from '@/utils/time-utils';

// Render a single task row as HTML string.
// Pure with respect to inputs; no DOM or storage side effects.
export function renderTaskRowHtml(task: Task, isTimerRunning: boolean, baseRowClasses: string): string {
  const elapsedTime = formatHms(task.elapsedMs);

  const additionalColumnsHtml = task.additionalColumns
    ? (Object.entries(task.additionalColumns as Record<string, string>))
        .filter(([header, value]) => !isSystemHeader(header) && value.trim() !== '')
        .map(([header, value]) => {
          const label = `${escapeHtml(header)}: ${escapeHtml(value)}`;
          const title = `${escapeHtmlAttribute(header)}: ${escapeHtmlAttribute(value)}`;
          return `
            <span class="badge badge-md mr-1 mb-1 align-middle max-w-full tooltip" data-tip="${title}">
              <span class="inline-block truncate max-w-full">${label}</span>
            </span>
          `;
        })
        .join('')
    : '';

  const status = getStatusBadge(task.status);

  return `
      <div class="${baseRowClasses}${getRowStatusClasses(task.status)}" data-testid="task-${escapeHtml(task.id)}" data-status="${escapeHtml(task.status)}">
        <div class="card-body px-2 py-3 w-full">
          <div class="flex items-center gap-3 w-full whitespace-nowrap">
            <input 
              type="checkbox" 
              class="checkbox shrink-0" 
            ${task.status === 'done' ? 'checked' : ''}
            data-task-id="${escapeHtml(task.id)}"
            />
            <span class="status-badge badge badge-md align-middle ${status.cls} tooltip" aria-label="${status.aria}" data-tip="${status.text}">
              ${status.icon}
            </span>
            <div class="timer-controls flex items-center gap-2 ml-2 shrink-0">
              <div class="timer-display ${isTimerRunning ? 'running' : ''} self-end md:self-auto">${elapsedTime}</div>
              <input 
                type="number" 
                class="timer-minutes-input input input-bordered input-xs w-12 text-center tooltip"
                value="${Math.round(task.elapsedMs / 60000)}"
                min="0"
                step="1"
                placeholder="min"
                data-tip="Enter time in minutes"
                data-task-id="${escapeHtml(task.id)}"
                data-action="set-minutes"
              />
              <button class="btn btn-ghost btn-xs tooltip" data-task-id="${escapeHtml(task.id)}" data-action="timer" data-tip="${isTimerRunning ? 'Pause timer' : 'Start timer'}" aria-label="${isTimerRunning ? 'Pause timer' : 'Start timer'}" ${task.status === 'done' ? 'disabled aria-disabled="true"' : ''}>
                ${isTimerRunning ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-4 h-4" aria-hidden="true" focusable="false"><path d="M6 5h4v14H6zM14 5h4v14h-4z" fill="currentColor"/></svg>' : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-4 h-4" aria-hidden="true" focusable="false"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>'}
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
        <button class="absolute top-2 right-2 btn btn-ghost btn-xs text-base-content/60 hover:text-error hover:bg-error/10 tooltip" data-task-id="${escapeHtml(task.id)}" data-action="delete" data-tip="Delete">
          ×
        </button>
      </div>
    `;
}

export default renderTaskRowHtml;
