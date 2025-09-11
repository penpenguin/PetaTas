export type ToastType = 'success' | 'error' | 'warning';

export function showToast(message: string, type: ToastType = 'success'): void {
  const toastContainer = document.getElementById('toast-container');
  if (!toastContainer) return;

  const toast = document.createElement('div');
  toast.className = `alert alert-${type} shadow-lg`;
  toast.innerHTML = `
    <div>
      <span>${message}</span>
    </div>
  `;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

export default showToast;

