// ── Required (mandatory) edit modal ──────────────────────────────────────────
// Centered modal for editing a node's mandatory flag.
// Uses a draft pattern — changes are only committed on Apply.
// Cancel discards all edits.
//
// init(elements)                       — wire DOM once at startup
// open(node, mandLink, setActive)      — populate body + show

import { createCustomSelect } from './custom-select.js';
import { initModal, setModalTitle, openModal, closeModal } from './modal-base.js';

let _el      = null;
let _pending = null; // { node, mandLink, setActive, draftValue }

// ── value helpers ─────────────────────────────────────────────────────────────

const OPTIONS = [
  ['null',  'Not set (acts as required)'],
  ['true',  'Yes \u2014 required'],
  ['false', 'No \u2014 optional'],
];

function _toKey(v) {
  if (v === true)  return 'true';
  if (v === false) return 'false';
  return 'null';
}

function _fromKey(k) {
  if (k === 'true')  return true;
  if (k === 'false') return false;
  return null;
}

// ── module API ────────────────────────────────────────────────────────────────

export function init(elements) {
  _el = elements;
  initModal(elements, { onApply: _apply, onCancel: _cancel });
}

export function open(node, mandLink, setActive) {
  _pending = { node, mandLink, setActive, draftValue: node.mandatory };

  setModalTitle(_el.title, 'Required', node.title || node.id || 'Item');

  _el.body.innerHTML = '';
  _renderBody(_el.body);
  openModal(_el.modal);
}

function _apply() {
  if (!_pending) return;
  const { node, mandLink, setActive } = _pending;
  node.mandatory = _pending.draftValue;
  setActive(mandLink, node.mandatory === true);
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
  hint.textContent = 'Whether this item must be answered. Required items show \u2714/\u2718 validation in the preview and affect the final PASS/FAIL result.';
  container.appendChild(hint);

  const row = document.createElement('div');
  row.className = 'required-modal-row';

  const lbl = document.createElement('label');
  lbl.className   = 'required-modal-label';
  lbl.textContent = 'Required:';

  const sel = createCustomSelect({
    items:    OPTIONS.map(([val, text]) => ({ value: val, label: text })),
    value:    _toKey(_pending.draftValue),
    onChange: v => { _pending.draftValue = _fromKey(v); },
    className: 'required-modal-sel sc-trigger--full',
    testid:   'required-sel',
  });

  row.appendChild(lbl);
  row.appendChild(sel.el);
  container.appendChild(row);
}
