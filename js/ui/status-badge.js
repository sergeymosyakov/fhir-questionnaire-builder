// ── Status badge: live PASS / FAIL indicator with issue dropdown ──────────────
// StatusBadge is instantiable per surface (app shell OR embedded widget): pass
// its DOM elements, the session bus (for navigate clicks) and a getStore fn.
// The module also self-inits one app-shell instance bound to the shared
// [data-mount] nodes and re-exports update() so existing callers keep working.
import { AppEvents, EventState } from '../events.js';
import { defaultBus } from '../core/events/bus.js';
import { isMandatory, calcFormOk, evalConstraints, CHECKABLE_TYPES } from '../fhir/form-checks.js';

export class StatusBadge {
  /**
   * @param {object}   opts
   * @param {object}   opts.els       { btn, dropdown, wrap }
   * @param {EventBus} [opts.bus]     channel for BUILDER_NAVIGATE (defaults to page bus)
   * @param {Function} [opts.getStore] returns the answerStore for the surface
   */
  constructor({ els, bus = defaultBus, getStore } = {}) {
    this._btn      = els.btn;
    this._dropdown = els.dropdown;
    this._wrap     = els.wrap;
    this._bus      = bus;
    this._getStore = getStore || (() => EventState.get(AppEvents.APP_CONTEXT_READY)?.answerStore);
    this._open     = false;
    this._ac       = new AbortController();

    // Announce PASS/FAIL changes to screen readers (a11y).
    this._btn.setAttribute('aria-live', 'polite');
    this._btn.setAttribute('aria-atomic', 'true');

    this._btn.addEventListener('click', e => {
      e.stopPropagation();
      this._open = !this._open;
      this._dropdown.style.display = this._open ? 'block' : 'none';
    }, { signal: this._ac.signal });
    document.addEventListener('click', () => { if (this._open) this._close(); }, { signal: this._ac.signal });
  }

  /** Remove the document-level (outside-click) listener this badge owns. */
  destroy() { this._ac.abort(); }

  update({ visible, ctx }) {
    if (!this._btn) return;

    const store = this._getStore();
    if (!store) return; // no answer store yet

    const anyVisible = visible.length > 0;
    const fp   = ctx?.fp   ?? null;
    const qr   = ctx?.qr   ?? null;
    const cEnv = ctx?.envVars ?? {};

    const activeItems = visible.filter(r => !r.disabled && !r.hidden && r.node.type === 'item');

    const mandatoryItems = activeItems.filter(r =>
      isMandatory(r.node) && CHECKABLE_TYPES.has(r.node.itemType)
    );
    const hasMandatory = mandatoryItems.length > 0;

    const calcItems = activeItems.filter(r =>
      r.node._calculatedExpr && r.node._readOnly && r.node.itemType === 'checkbox'
    );
    const hasCalc    = calcItems.length > 0;
    const calcAllOk  = calcItems.every(r => store?.get(r.node.id) === true);

    const constraintItems   = activeItems.filter(r => r.node.constraint?.length);
    const hasConstraints    = constraintItems.length > 0;
    const constraintsAllOk  = constraintItems.every(r => evalConstraints(r.node, fp, qr, cEnv));

    const rangeItems = activeItems.filter(r =>
      !isMandatory(r.node) && (r.node._minValue !== undefined || r.node._maxValue !== undefined)
    );
    const hasRange   = rangeItems.length > 0;
    const rangeAllOk = rangeItems.every(r => calcFormOk(r.node, store));

    const hasCriteria = hasMandatory || hasCalc || hasConstraints || hasRange;

    if (!anyVisible || !hasCriteria) {
      this._wrap.style.display = 'none';
      this._close();
      return;
    }

    const formItemsOk = visible.filter(r => !r.disabled && !r.hidden).every(res => {
      if (res.node.type === 'item') return res.ok && calcFormOk(res.node, store);
      return res.ok;
    });
    const finalOk = (hasMandatory ? formItemsOk : true) && (hasCalc ? calcAllOk : true) &&
      (!hasConstraints || constraintsAllOk) &&
      (!hasRange || rangeAllOk) &&
      hasCriteria;

    const failingItems = [
      ...mandatoryItems.filter(r => !r.ok || !calcFormOk(r.node, store)).map(r => ({ title: r.node.title, id: r.node.id })),
      ...calcItems.filter(r => store?.get(r.node.id) !== true).map(r => ({ title: r.node.title, id: r.node.id })),
      ...constraintItems.filter(r => !evalConstraints(r.node, fp, qr, cEnv)).map(r => ({ title: r.node.title, id: r.node.id })),
      ...rangeItems.filter(r => !calcFormOk(r.node, store)).map(r => ({ title: r.node.title, id: r.node.id })),
    ];

    this._wrap.style.display = 'inline-flex';

    if (finalOk) {
      this._btn.className   = 'status-badge status-badge--pass';
      this._btn.textContent = '\u2713 PASS';
    } else {
      const n = failingItems.length;
      this._btn.className   = 'status-badge status-badge--fail';
      this._btn.textContent = '\u2717 FAIL \u00b7 ' + n + ' issue' + (n !== 1 ? 's' : '');
    }

    this._renderList(failingItems);
  }

  _close() {
    this._open = false;
    if (this._dropdown) this._dropdown.style.display = 'none';
  }

  _renderList(items) {
    if (!this._dropdown) return;
    this._dropdown.innerHTML = '';

    // Mobile-only (CSS hides it at desktop) — the bottom-sheet variant has no
    // other obvious dismiss affordance besides tapping outside.
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'status-dropdown-close';
    closeBtn.dataset.testid = 'status-dropdown-close';
    closeBtn.dataset.tipTitle = 'Close';
    closeBtn.textContent = '\u2715';
    closeBtn.addEventListener('click', e => { e.stopPropagation(); this._close(); });
    this._dropdown.appendChild(closeBtn);

    if (items.length === 0) {
      const msg = document.createElement('div');
      msg.className   = 'status-dropdown-msg';
      msg.textContent = 'All criteria met';
      this._dropdown.appendChild(msg);
      return;
    }

    const hdr = document.createElement('div');
    hdr.className   = 'status-dropdown-header';
    hdr.textContent = items.length + ' issue' + (items.length !== 1 ? 's' : '') + ' to resolve';
    this._dropdown.appendChild(hdr);

    items.forEach((item, i) => {
      const row = document.createElement('div');
      row.className = 'status-dropdown-row';
      row.dataset.tipTitle = 'Click to navigate';
      row.addEventListener('click', e => {
        e.stopPropagation();
        this._close();
        this._bus.dispatch(AppEvents.BUILDER_NAVIGATE, { id: item.id });
      });

      const num = document.createElement('span');
      num.className   = 'status-dropdown-num';
      num.textContent = (i + 1) + '.';
      row.appendChild(num);

      const label = document.createElement('span');
      label.className = 'status-dropdown-label';
      label.textContent = item.title;
      row.appendChild(label);

      const arrow = document.createElement('span');
      arrow.className = 'status-dropdown-arrow';
      arrow.textContent = '\u2197';
      row.appendChild(arrow);

      this._dropdown.appendChild(row);
    });
  }
}

// ── App-shell singleton ─────────────────────────────────────────────────────────
let _appInstance = null;

export function init() {
  const els = {
    btn:      document.querySelector('[data-mount="status-badge-btn"]'),
    dropdown: document.querySelector('[data-mount="status-dropdown"]'),
    wrap:     document.querySelector('[data-mount="status-badge-wrap"]'),
  };
  if (!els.btn) return; // no app-shell badge DOM (e.g. widget-only page)
  _appInstance = new StatusBadge({ els, bus: defaultBus });
}

export function update(arg) {
  _appInstance?.update(arg);
}

// Self-initialize the app-shell instance on import.
if (typeof document !== 'undefined') init();
