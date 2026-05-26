// ── Modal base class ──────────────────────────────────────────────────────────
// Each modal builds its own DOM and appends itself to document.body.
// Subclass and override open(), _apply(), _cancel() as needed.
//
// Constructor options:
//   cancelLabel: string|null  — cancel/close btn text; null = omit  (default: 'Cancel')
//   applyLabel:  string|null  — apply btn text;         null = omit  (default: 'Apply')
//   maxWidth:    string|null  — CSS max-width for the modal box      (default: null)
//   bodyClass:   string|null  — extra CSS class on .modal-body       (default: null)

// Single shared Escape handler — closes the topmost open modal.
const _registry = new Map(); // backdrop → cancel callback
if (typeof document !== 'undefined') document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  let topCancel = null, topZ = -1;
  for (const [backdrop, cancel] of _registry) {
    if (backdrop.style.display === 'none') continue;
    const z = parseInt(getComputedStyle(backdrop).zIndex, 10) || 0;
    if (z > topZ) { topZ = z; topCancel = cancel; }
  }
  if (topCancel) topCancel();
});

function _mk(tag, className) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  return el;
}

export class Modal {
  /** Builder services injected at app startup via Modal.configure(). */
  static _svc = {
    triggerCalcRecalc: null,  // () => void
    refreshExprIcons:  null,  // () => void
    getLastCtx:        null,  // () => {qr, env}
    questMeta:         null,  // reactive metadata object
    tree:              null,  // reactive tree array
    values:            null,  // reactive values map
    getValue:          null,  // (key) => any
    setValue:          null,  // (key, val) => void
    deleteValue:       null,  // (key) => void
    questContained:    null,  // reactive contained[] array
  };

  /** Called once at startup (builder/index.js) to inject app-layer services. */
  static configure(services) {
    Object.assign(Modal._svc, services);
  }

  constructor({ cancelLabel = 'Cancel', applyLabel = 'Apply', maxWidth = null, bodyClass = null } = {}) {
    this.backdrop = _mk('div', 'modal-backdrop');
    this.backdrop.style.display = 'none';

    const box = _mk('div', 'modal-box');
    if (maxWidth) box.style.maxWidth = maxWidth;

    const header = _mk('div', 'modal-header');
    this.title    = _mk('span');
    this.closeBtn = _mk('button', 'modal-close');
    this.closeBtn.type = 'button';
    this.closeBtn.title = 'Close';
    this.closeBtn.textContent = '\u2715';
    header.append(this.title, this.closeBtn);

    this.body   = _mk('div', bodyClass ? `modal-body ${bodyClass}` : 'modal-body');
    this.footer = _mk('div', 'modal-footer');

    this.cancelBtn = null;
    this.applyBtn  = null;

    if (cancelLabel !== null) {
      this.cancelBtn = _mk('button', 'modal-btn modal-btn--cancel');
      this.cancelBtn.type = 'button';
      this.cancelBtn.textContent = cancelLabel;
      this.footer.appendChild(this.cancelBtn);
    }
    if (applyLabel !== null) {
      this.applyBtn = _mk('button', 'modal-btn modal-btn--apply');
      this.applyBtn.type = 'button';
      this.applyBtn.textContent = applyLabel;
      this.footer.appendChild(this.applyBtn);
    }

    box.append(header, this.body, this.footer);
    this.backdrop.appendChild(box);

    this.closeBtn.addEventListener('click',  () => this._cancel());
    if (this.cancelBtn) this.cancelBtn.addEventListener('click', () => this._cancel());
    if (this.applyBtn)  this.applyBtn.addEventListener('click',  () => this._apply());
    this.backdrop.addEventListener('click', e => { if (e.target === this.backdrop) this._cancel(); });
    _registry.set(this.backdrop, () => this._cancel());

    document.body.appendChild(this.backdrop);
  }

  open()  { this.backdrop.style.display = 'flex'; }
  close() { this.backdrop.style.display = 'none'; }

  /** Render the standard two-part title: bold label + muted subject. */
  setTitle(label, subject) {
    this.title.innerHTML = '';
    const l = _mk('span', 'modal-title-label');
    l.textContent = label;
    this.title.appendChild(l);
    if (subject) {
      const s = _mk('span', 'modal-title-subject');
      s.textContent = ' \u2014 ' + subject;
      this.title.appendChild(s);
    }
  }

  _apply()  { this.close(); }
  _cancel() { this.close(); }
}
