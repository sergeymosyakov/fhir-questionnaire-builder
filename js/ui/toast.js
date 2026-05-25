let _container = null;

function _ensureContainer() {
  if (!_container) {
    _container = document.createElement('div');
    _container.className = 'toast-container';
    document.body.appendChild(_container);
  }
  return _container;
}

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'error'|'warn'|'info'} type
 * @param {number} duration  ms before auto-dismiss
 */
export function showToast(message, type = 'error', duration = 4000) {
  const c = _ensureContainer();
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.textContent = message;
  c.appendChild(el);
  // Force reflow so CSS transition plays from opacity:0
  el.getBoundingClientRect();
  el.classList.add('toast--visible');
  setTimeout(() => {
    el.classList.remove('toast--visible');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
  }, duration);
}

export const showError = msg => showToast(msg, 'error');
export const showWarn  = msg => showToast(msg, 'warn');
export const showInfo  = msg => showToast(msg, 'info');
