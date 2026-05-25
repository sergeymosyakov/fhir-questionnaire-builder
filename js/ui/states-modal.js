// ── States modal (Required / Read-only / Hidden) ─────────────────────────────
// Centered modal for editing the three state flags on a builder node.
//
//   Required:  node.mandatory      (null / true / false)
//   Read-only: node._readOnly      (boolean; items only — row hidden for groups)
//   Hidden:    node._hidden        (boolean; items and groups)
//
// init(elements)                    — wire DOM once at startup
// open(node, statesLink, setActive) — populate body + show

import { triggerCalcRecalc } from '../builder/_shared.js';
import { createCustomSelect } from './custom-select.js';
import { initModal, setModalTitle, openModal, closeModal } from './modal-base.js';

let _el      = null;
let _pending = null; // { node, statesLink, setActive, draftMandatory, draftReadOnly, draftHidden }

// ── module API ────────────────────────────────────────────────────────────────

export function init(elements) {
  _el = elements;
  initModal(elements, { onApply: _apply, onCancel: _cancel });
}

export function open(node, statesLink, setActive) {
  _pending = {
    node, statesLink, setActive,
    draftMandatory: node.mandatory,
    draftReadOnly:  !!node._readOnly,
    draftHidden:    !!node._hidden,
  };

  setModalTitle(_el.title, 'States', node.title || node.id || 'Item');

  _el.body.innerHTML = '';
  _renderBody(_el.body, node.type === 'item');
  openModal(_el.modal);
}

// ── internals ─────────────────────────────────────────────────────────────────

function _apply() {
  if (!_pending) return;
  const { node, statesLink, setActive } = _pending;

  node.mandatory = _pending.draftMandatory;
  if (node.type === 'item') {
    node._readOnly = _pending.draftReadOnly || undefined;
  }
  node._hidden = _pending.draftHidden || undefined;

  const anyActive = node.mandatory === true || !!node._readOnly || !!node._hidden;
  setActive(statesLink, anyActive);
  triggerCalcRecalc();
  _close();
}

function _cancel() { _close(); }

function _close() {
  _pending = null;
  closeModal(_el.modal);
}

// ── body renderer ─────────────────────────────────────────────────────────────

const REQUIRED_OPTIONS = [
  ['null',  'Not set'],
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

function _renderBody(container, isItem) {
  // ── Required row ───────────────────────────────────────────────────────────
  const reqRow = document.createElement('div');
  reqRow.className = 'states-modal-row';

  const reqLbl = document.createElement('label');
  reqLbl.className   = 'states-modal-label';
  reqLbl.textContent = 'Required:';

  const reqSel = createCustomSelect({
    items:    REQUIRED_OPTIONS.map(([val, text]) => ({ value: val, label: text })),
    value:    _toKey(_pending.draftMandatory),
    onChange: v => { _pending.draftMandatory = _fromKey(v); },
    className: 'states-modal-sel sc-trigger--full',
    testid:   'states-required-sel',
  });

  reqRow.appendChild(reqLbl);
  reqRow.appendChild(reqSel.el);
  container.appendChild(reqRow);

  // ── Read-only row (items only) ─────────────────────────────────────────────
  if (isItem) {
    const roRow = document.createElement('div');
    roRow.className = 'states-modal-check-row';

    const roChk = document.createElement('input');
    roChk.type = 'checkbox';
    roChk.id   = 'statesReadOnly';
    roChk.dataset.testid = 'states-readonly-chk';
    roChk.checked = _pending.draftReadOnly;
    roChk.addEventListener('change', () => { _pending.draftReadOnly = roChk.checked; });

    const roLbl = document.createElement('label');
    roLbl.htmlFor     = 'statesReadOnly';
    roLbl.className   = 'states-modal-chk-label';
    roLbl.textContent = 'Read-only';

    const roHint = document.createElement('span');
    roHint.className   = 'states-modal-chk-hint';
    roHint.textContent = 'Value set programmatically \u2014 user cannot edit. Typically combined with a calculatedExpression.';

    roRow.appendChild(roChk);
    roRow.appendChild(roLbl);
    roRow.appendChild(roHint);
    container.appendChild(roRow);
  }

  // ── Hidden row ─────────────────────────────────────────────────────────────
  const hidRow = document.createElement('div');
  hidRow.className = 'states-modal-check-row';

  const hidChk = document.createElement('input');
  hidChk.type = 'checkbox';
  hidChk.id   = 'statesHidden';
  hidChk.dataset.testid = 'states-hidden-chk';
  hidChk.checked = _pending.draftHidden;
  hidChk.addEventListener('change', () => { _pending.draftHidden = hidChk.checked; });

  const hidLbl = document.createElement('label');
  hidLbl.htmlFor     = 'statesHidden';
  hidLbl.className   = 'states-modal-chk-label';
  hidLbl.textContent = 'Hidden';

  const hidHint = document.createElement('span');
  hidHint.className   = 'states-modal-chk-hint';
  hidHint.textContent = 'Excluded from patient view (sdc-questionnaire-hidden). Still participates in calculatedExpression logic.';

  hidRow.appendChild(hidChk);
  hidRow.appendChild(hidLbl);
  hidRow.appendChild(hidHint);
  container.appendChild(hidRow);
}
