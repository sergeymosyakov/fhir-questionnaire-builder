// ── Read-only edit modal ──────────────────────────────────────────────────────
// Centered modal for toggling a node's readOnly flag.
// Uses draft pattern — changes are only committed on Apply. Cancel discards.
//
// init(elements)                       — wire DOM once at startup
// open(node, roLink, setActive)        — populate body + show

import { triggerCalcRecalc } from '../builder/_shared.js';
import { createCustomSelect } from './custom-select.js';

const OPTIONS = [
  ['false', 'No \u2014 editable'],
  ['true',  'Yes \u2014 read-only'],
];

let _el      = null;
let _pending = null; // { node, roLink, setActive, draftValue }

// ── module API ────────────────────────────────────────────────────────────────

export function init(elements) {
  _el = elements;
  _el.closeBtn.addEventListener('click', _cancel);
  _el.cancelBtn.addEventListener('click', _cancel);
  _el.applyBtn.addEventListener('click', _apply);
  _el.modal.addEventListener('click', e => { if (e.target === _el.modal) _cancel(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && _el.modal.style.display !== 'none') _cancel();
  });
}

export function open(node, roLink, setActive) {
  _pending = { node, roLink, setActive, draftValue: !!node._readOnly };

  _el.title.innerHTML = '';
  const labelEl = document.createElement('span');
  labelEl.className   = 'modal-title-label';
  labelEl.textContent = 'Read-only';
  const subjectEl = document.createElement('span');
  subjectEl.className   = 'modal-title-subject';
  subjectEl.textContent = ' \u2014 ' + (node.title || node.id || 'Item');
  _el.title.appendChild(labelEl);
  _el.title.appendChild(subjectEl);

  _el.body.innerHTML = '';
  _renderBody(_el.body);
  _el.modal.style.display = 'flex';
}

// ── internals ─────────────────────────────────────────────────────────────────

function _apply() {
  if (!_pending) return;
  const { node, roLink, setActive } = _pending;
  node._readOnly = _pending.draftValue || undefined;
  setActive(roLink, !!node._readOnly);
  triggerCalcRecalc();
  _close();
}

function _cancel() { _close(); }

function _close() {
  _pending = null;
  _el.modal.style.display = 'none';
}

// ── body renderer ─────────────────────────────────────────────────────────────

function _renderBody(container) {
  const hint = document.createElement('div');
  hint.className   = 'panel-hint';
  hint.textContent = 'Marks this field as read-only \u2014 the user cannot edit it. Typically combined with a calculatedExpression.';
  container.appendChild(hint);

  const row = document.createElement('div');
  row.className = 'required-modal-row';

  const lbl = document.createElement('label');
  lbl.className   = 'required-modal-label';
  lbl.textContent = 'Read-only:';

  const sel = createCustomSelect({
    items:    OPTIONS.map(([val, text]) => ({ value: val, label: text })),
    value:    _pending.draftValue ? 'true' : 'false',
    onChange: v => { _pending.draftValue = v === 'true'; },
    className: 'required-modal-sel sc-trigger--full',
    testid:   'readonly-sel',
  });

  row.appendChild(lbl);
  row.appendChild(sel.el);
  container.appendChild(row);
}
