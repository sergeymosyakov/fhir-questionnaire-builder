// ── Status badge: live PASS / FAIL indicator with issue dropdown ──────────────
// API:
//   init(elements, navigateFn)  — wire up { btn, dropdown, wrap }; navigateFn(id)
//   update({ visible, ctx })    — visible: eval results; ctx: { fp, qr, envVars }
//                                 Computes mandatory/calc/constraint/range criteria internally.
import { isMandatory, calcFormOk, evalConstraints, answerStore, CHECKABLE_TYPES } from '../state.js';
import { AppEvents } from '../events.js';

let _btn        = null;
let _dropdown   = null;
let _wrap       = null;
let _open       = false;

export function init() {
  _btn        = document.querySelector('[data-mount="status-badge-btn"]');
  _dropdown   = document.querySelector('[data-mount="status-dropdown"]');
  _wrap       = document.querySelector('[data-mount="status-badge-wrap"]');

  _btn.addEventListener('click', e => {
    e.stopPropagation();
    _open = !_open;
    _dropdown.style.display = _open ? 'block' : 'none';
  });

  document.addEventListener('click', () => {
    if (_open) _close();
  });
}

export function update({ visible, ctx }) {
  if (!_btn) return;

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
  const calcAllOk  = calcItems.every(r => answerStore.get(r.node.id) === true);

  const constraintItems   = activeItems.filter(r => r.node.constraint?.length);
  const hasConstraints    = constraintItems.length > 0;
  const constraintsAllOk  = constraintItems.every(r => evalConstraints(r.node, fp, qr, cEnv));

  const rangeItems = activeItems.filter(r =>
    !isMandatory(r.node) && (r.node._minValue !== undefined || r.node._maxValue !== undefined)
  );
  const hasRange   = rangeItems.length > 0;
  const rangeAllOk = rangeItems.every(r => calcFormOk(r.node));

  const hasCriteria = hasMandatory || hasCalc || hasConstraints || hasRange;

  if (!anyVisible || !hasCriteria) {
    _wrap.style.display = 'none';
    _close();
    return;
  }

  const formItemsOk = visible.filter(r => !r.disabled && !r.hidden).every(res => {
    if (res.node.type === 'item') return res.ok && calcFormOk(res.node);
    return res.ok;
  });
  const finalOk = (hasMandatory ? formItemsOk : true) && (hasCalc ? calcAllOk : true) &&
    (!hasConstraints || constraintsAllOk) &&
    (!hasRange || rangeAllOk) &&
    hasCriteria;

  const failingItems = [
    ...mandatoryItems.filter(r => !r.ok || !calcFormOk(r.node)).map(r => ({ title: r.node.title, id: r.node.id })),
    ...calcItems.filter(r => answerStore.get(r.node.id) !== true).map(r => ({ title: r.node.title, id: r.node.id })),
    ...constraintItems.filter(r => !evalConstraints(r.node, fp, qr, cEnv)).map(r => ({ title: r.node.title, id: r.node.id })),
    ...rangeItems.filter(r => !calcFormOk(r.node)).map(r => ({ title: r.node.title, id: r.node.id })),
  ];

  _wrap.style.display = 'inline-flex';

  if (finalOk) {
    _btn.className   = 'status-badge status-badge--pass';
    _btn.textContent = '\u2713 PASS';
  } else {
    const n = failingItems.length;
    _btn.className   = 'status-badge status-badge--fail';
    _btn.textContent = '\u2717 FAIL \u00b7 ' + n + ' issue' + (n !== 1 ? 's' : '');
  }

  _renderList(failingItems);
}

function _close() {
  _open = false;
  if (_dropdown) _dropdown.style.display = 'none';
}

function _renderList(items) {
  if (!_dropdown) return;
  _dropdown.innerHTML = '';

  if (items.length === 0) {
    const msg = document.createElement('div');
    msg.className   = 'status-dropdown-msg';
    msg.textContent = 'All criteria met';
    _dropdown.appendChild(msg);
    return;
  }

  const hdr = document.createElement('div');
  hdr.className   = 'status-dropdown-header';
  hdr.textContent = items.length + ' issue' + (items.length !== 1 ? 's' : '') + ' to resolve';
  _dropdown.appendChild(hdr);

  items.forEach((item, i) => {
    const row = document.createElement('div');
    row.className = 'status-dropdown-row';
    row.dataset.tipTitle = 'Click to navigate';
    row.addEventListener('click', e => {
      e.stopPropagation();
      _close();
      document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_NAVIGATE, { detail: { id: item.id } }));
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

    _dropdown.appendChild(row);
  });
}

// Self-initialize on import
if (typeof document !== 'undefined') init();
