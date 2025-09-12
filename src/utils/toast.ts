export type ToastType = 'success' | 'error' | 'warning';

export function showToast(message: string, type: ToastType = 'success'): void {
  const toastContainer = document.getElementById('toast-container');
  if (!toastContainer) return;

  const toast = document.createElement('div');
  const base = `alert alert-${type} shadow-lg`;
  // UX: force success toast to be green regardless of theme palette
  const successColor = type === 'success' ? ' bg-green-600 text-white' : '';
  toast.className = base + successColor;

  const inner = document.createElement('div');
  const span = document.createElement('span');
  span.textContent = message;
  inner.appendChild(span);
  toast.appendChild(inner);

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

export default showToast;
