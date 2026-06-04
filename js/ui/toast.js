const CONF = {
  error: { title: 'Error',   icon: '!' },
  warn:  { title: 'Warning', icon: '!' },
  info:  { title: 'Info',    icon: 'i' },
};

function _close(backdrop, onKey) {
  document.removeEventListener('keydown', onKey, true);
  backdrop.style.opacity = '0'; // runtime: animate out
  backdrop.addEventListener('transitionend', () => backdrop.remove(), { once: true });
  // Fallback: if no CSS transition is defined, transitionend never fires — remove manually.
  setTimeout(() => { if (backdrop.isConnected) backdrop.remove(); }, 300);
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

/**
 * Show a prompt dialog (replaces window.prompt).
 * @param {string} label       — dialog title
 * @param {string} defaultValue — pre-filled input value
 * @param {(value: string|null) => void} onConfirm — called with trimmed value or null on cancel
 */
export function showPrompt(label, defaultValue, onConfirm) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.style.opacity = '0';

  const box = document.createElement('div');
  box.className = 'modal-box';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');

  const header = document.createElement('div');
  header.className = 'modal-header';
  const titleEl = document.createElement('span');
  titleEl.className = 'modal-title-label';
  titleEl.textContent = label;
  header.appendChild(titleEl);

  const body = document.createElement('div');
  body.className = 'modal-body';
  const input = document.createElement('input');
  input.type = 'text';
  input.value = defaultValue;
  input.className = 'modal-text-input';
  body.appendChild(input);

  const footer = document.createElement('div');
  footer.className = 'modal-footer';
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'modal-btn';
  cancelBtn.textContent = 'Cancel';
  const applyBtn = document.createElement('button');
  applyBtn.type = 'button';
  applyBtn.className = 'modal-btn modal-btn--apply';
  applyBtn.textContent = 'Save';
  applyBtn.dataset.testid = 'prompt-save';
  footer.append(cancelBtn, applyBtn);

  box.append(header, body, footer);
  backdrop.appendChild(box);
  document.body.appendChild(backdrop);

  backdrop.getBoundingClientRect(); // force reflow
  backdrop.style.opacity = '1';
  input.select();

  const close = () => {
    document.removeEventListener('keydown', onKey, true);
    backdrop.style.opacity = '0';
    backdrop.addEventListener('transitionend', () => backdrop.remove(), { once: true });
    // Fallback: if no CSS transition is defined, transitionend never fires — remove manually.
    setTimeout(() => { if (backdrop.isConnected) backdrop.remove(); }, 300);
  };
  const confirm = () => { close(); onConfirm(input.value.trim() || defaultValue); };
  const cancel  = () => { close(); onConfirm(null); };

  const onKey = e => {
    if (e.key === 'Enter')  { e.preventDefault(); confirm(); }
    if (e.key === 'Escape') cancel();
  };
  document.addEventListener('keydown', onKey, true);
  applyBtn.onclick  = confirm;
  cancelBtn.onclick = cancel;
  backdrop.addEventListener('click', e => { if (e.target === backdrop) cancel(); });
}
