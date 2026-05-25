const ICONS = { error: '⛔', warn: '⚠️', info: 'ℹ️' };
const LABELS = { error: 'OK', warn: 'OK', info: 'OK' };

function _close(backdrop, dialog) {
  dialog.classList.remove('notif-dialog--visible');
  dialog.addEventListener('transitionend', () => {
    dialog.remove();
    backdrop.remove();
  }, { once: true });
}

/**
 * Show a centered notification dialog.
 * @param {string} message
 * @param {'error'|'warn'|'info'} type
 */
export function showToast(message, type = 'error') {
  const backdrop = document.createElement('div');
  backdrop.className = 'notif-backdrop';

  const dialog = document.createElement('div');
  dialog.className = `notif-dialog notif-dialog--${type}`;
  dialog.setAttribute('role', 'alertdialog');
  dialog.setAttribute('aria-modal', 'true');

  const icon = document.createElement('div');
  icon.className = 'notif-dialog__icon';
  icon.textContent = ICONS[type] || '⛔';

  const msg = document.createElement('div');
  msg.className = 'notif-dialog__msg';
  msg.textContent = message;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'notif-dialog__btn';
  btn.textContent = LABELS[type];
  btn.onclick = () => _close(backdrop, dialog);

  backdrop.addEventListener('mousedown', () => _close(backdrop, dialog));

  const onKey = e => {
    if (e.key === 'Escape' || e.key === 'Enter') {
      document.removeEventListener('keydown', onKey, true);
      _close(backdrop, dialog);
    }
  };
  document.addEventListener('keydown', onKey, true);

  dialog.append(icon, msg, btn);
  document.body.append(backdrop, dialog);

  // Force reflow so CSS transition plays
  dialog.getBoundingClientRect();
  dialog.classList.add('notif-dialog--visible');
  btn.focus();
}

export const showError = msg => showToast(msg, 'error');
export const showWarn  = msg => showToast(msg, 'warn');
export const showInfo  = msg => showToast(msg, 'info');
