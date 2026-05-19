// ── Read-only edit modal ──────────────────────────────────────────────────────
// Centered modal for toggling a node's readOnly flag.
// Uses draft pattern — changes are only committed on Apply. Cancel discards.
//
// init(elements)                       — wire DOM once at startup
// open(node, roLink, setActive)        — populate body + show

import { triggerCalcRecalc } from '../builder/_shared.js';
import { createCustomSelect } from './custom-select.js';
import { initModal, setModalTitle, openModal, closeModal } from './modal-base.js';

const OPTIONS = [
  ['false', 'No \u2014 editable'],
  ['true',  'Yes \u2014 read-only'],
];

let _el      = null;
let _pending = null; // { node, roLink, setActive, draftValue }

// ── module API ────────────────────────────────────────────────────────────────

export function init(elements) {
  _el = elements;
  initModal(elements, { onApply: _apply, onCancel: _cancel });
}

export function open(node, roLink, setActive) {
  _pending = { node, roLink, setActive, draftValue: !!node._readOnly };

  setModalTitle(_el.title, 'Read-only', node.title || node.id || 'Item');

  _el.body.innerHTML = '';
  _renderBody(_el.body);
  openModal(_el.modal);
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
  closeModal(_el.modal);
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
