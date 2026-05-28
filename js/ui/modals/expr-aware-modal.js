// ── ExprAwareModal ─────────────────────────────────────────────────────────────
// Intermediate base for modals that display live FHIRPath expression icons
// ([data-expr-icon] elements). Collects icon elements when open() is called and
// evaluates them on every REFRESH_EXPR_ICONS event (form value changes, typing).
import { Modal } from './modal-base.js';
import { AppEvents } from '../../events.js';

export class ExprAwareModal extends Modal {
  constructor(options) {
    super(options);
    this._exprIconEls = [];
    if (typeof document !== 'undefined') {
      document.addEventListener(AppEvents.REFRESH_EXPR_ICONS, () => this._refreshExprIcons());
    }
  }

  /** Called by subclasses via super.open() after body content is built. */
  open(...args) {
    super.open(...args);
    this._exprIconEls = Array.from(this.body.querySelectorAll('[data-expr-icon]'));
    this._refreshExprIcons();
  }

  close() {
    this._exprIconEls = [];
    super.close();
  }

  _refreshExprIcons() {
    if (!this._exprIconEls.length) return;
    const { fp, qr, env } = Modal._svc.getLastCtx?.() || {};
    if (!fp) return;
    for (const el of this._exprIconEls) {
      const expr = el.dataset.exprIcon;
      if (!expr) { el.className = 'expr-live-icon'; el.textContent = ''; continue; }
      try {
        const raw = fp.evaluate(qr || {}, expr, env || {});
        const ok  = Array.isArray(raw) ? (raw.length > 0 && raw[0] !== false) : Boolean(raw);
        el.className  = 'expr-live-icon ' + (ok ? 'expr-live-icon--ok' : 'expr-live-icon--fail');
        el.textContent = ok ? '\u2713' : '\u2717';
      } catch {
        el.className  = 'expr-live-icon expr-live-icon--err';
        el.textContent = '?';
      }
    }
  }
}
