const CONF = {
  error: { title: 'Error',   icon: '!' },
  warn:  { title: 'Warning', icon: '!' },
  info:  { title: 'Info',    icon: 'i' },
};

function _close(backdrop, onKey) {
  document.removeEventListener('keydown', onKey, true);
  backdrop.style.opacity = '0'; // runtime: animate out
  backdrop.addEventListener('transitionend', () => backdrop.remove(), { once: true });
}

/**
 * Show a notification dialog that reuses shared .modal-* classes.
 * @param {string} message
 * @param {'error'|'warn'|'info'} type
 */
export function showToast(message, type = 'error') {
  const cfg = CONF[type] || CONF.error;

  // Backdrop — reuses .modal-backdrop (fixed, flex-center, dark overlay)
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop notif-backdrop';
  backdrop.style.opacity = '0'; // runtime: animation start state

  // Box — reuses .modal-box (surface bg, border, shadow, flex-column)
  const box = document.createElement('div');
  box.className = `modal-box notif-box notif--${type}`;
  box.setAttribute('role', 'alertdialog');
  box.setAttribute('aria-modal', 'true');

  // Header — reuses .modal-header
  const header = document.createElement('div');
  header.className = 'modal-header';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'notif-header-title';

  const iconEl = document.createElement('span');
  iconEl.className = 'notif-title-icon';
  iconEl.textContent = cfg.icon;

  const labelEl = document.createElement('span');
  labelEl.className = 'modal-title-label';
  labelEl.textContent = cfg.title;

  titleWrap.append(iconEl, labelEl);
  header.appendChild(titleWrap);

  // Body — reuses .modal-body
  const body = document.createElement('div');
  body.className = 'modal-body';
  body.textContent = message;

  // Footer — reuses .modal-footer + .modal-btn--apply
  const footer = document.createElement('div');
  footer.className = 'modal-footer';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'modal-btn modal-btn--apply';
  btn.textContent = 'OK';

  footer.appendChild(btn);
  box.append(header, body, footer);
  backdrop.appendChild(box);
  document.body.appendChild(backdrop);

  // Animate in (opacity is runtime-dynamic)
  backdrop.getBoundingClientRect(); // force reflow
  backdrop.style.opacity = '1';
  btn.focus();

  const onKey = e => {
    if (e.key === 'Escape' || e.key === 'Enter') _close(backdrop, onKey);
  };
  document.addEventListener('keydown', onKey, true);
  btn.onclick = () => _close(backdrop, onKey);
  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) _close(backdrop, onKey);
  });
}

export const showError = msg => showToast(msg, 'error');
export const showWarn  = msg => showToast(msg, 'warn');
export const showInfo  = msg => showToast(msg, 'info');
