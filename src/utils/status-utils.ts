// Status → UI helpers used by the panel client

// Inline SVG icons for small status badges
export const STATUS_TODO_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="status-icon w-4 h-4 align-middle" aria-hidden="true" focusable="false" data-icon="todo"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
export const STATUS_INPROGRESS_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="status-icon w-4 h-4 align-middle" aria-hidden="true" focusable="false" data-icon="in-progress"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
export const STATUS_DONE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="status-icon w-4 h-4 align-middle" aria-hidden="true" focusable="false" data-icon="done"><path d="M20 6L9 17l-5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export function getRowStatusClasses(status: string): string {
  switch (status) {
    case 'in-progress':
      return ' border-l-4 border-warning';
    case 'done':
      return ' border-l-4 border-success';
    default:
      return ' border-l-4 border-base-300';
  }
}

export function getStatusBadge(status: string): { text: string; cls: string; aria: string; icon: string } {
  switch (status) {
    case 'in-progress':
      return { text: 'IN PROGRESS', cls: 'badge-warning', aria: 'Status: IN PROGRESS', icon: STATUS_INPROGRESS_SVG };
    case 'done':
      return { text: 'DONE', cls: 'badge-success', aria: 'Status: DONE', icon: STATUS_DONE_SVG };
    default:
      return { text: 'TODO', cls: 'badge-ghost', aria: 'Status: TODO', icon: STATUS_TODO_SVG };
  }
}

