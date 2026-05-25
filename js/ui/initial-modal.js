import { MODAL_REGISTRY } from './modal-registry.js';
// ── Default Value (initial[]) edit modal ─────────────────────────────────────
// Centered modal for editing a node's _initialValue.
// Uses a draft pattern — changes are only committed on Apply.
// Cancel discards all edits.
//
// init(elements)                    — wire DOM once at startup
// open(node, initLink, setActive)   — populate body + show

import { parseOptions } from '../utils.js';
import { setValue, deleteValue } from '../state.js';
import { triggerCalcRecalc } from '../builder/_shared.js';
import { createCustomSelect } from './custom-select.js';
import { createDatePicker } from './date-picker.js';
import { initModal, setModalTitle, openModal, closeModal } from './modal-base.js';

let _el      = null;
let _pending = null; // { node, initLink, setActive, draftValue }

export function init(elements) {
  _el = elements;
  initModal(elements, { onApply: _apply, onCancel: _cancel });
}

export function open(node, initLink, setActive) {
  _pending = { node, initLink, setActive, draftValue: node._initialValue };

  setModalTitle(_el.title, 'Default Value', node.title || node.id || 'Item');

  _el.body.innerHTML = '';
  _renderBody(node, _el.body);
  openModal(_el.modal);
}

function _apply() {
  if (!_pending) return;
  const { node, initLink, setActive } = _pending;
  const v = _pending.draftValue;
  if (v !== undefined && v !== '') {
    node._initialValue = v;
    setValue(node.id, v);
  } else {
    delete node._initialValue;
    deleteValue(node.id);
  }
  setActive(initLink, node._initialValue !== undefined && node._initialValue !== '');
  triggerCalcRecalc();
  _close();
}

function _cancel() {
  _close();
}

function _close() {
  _pending = null;
  closeModal(_el.modal);
}

function _renderBody(node, container) {
  const hint = document.createElement('div');
  hint.className = 'panel-hint';
  hint.textContent = 'Pre-filled when the form loads. User can edit unless readOnly.';
  container.appendChild(hint);

  const itype = node.itemType;

  if (itype === 'display' || itype === 'attachment') {
    const na = document.createElement('div');
    na.className = 'panel-hint';
    na.style.marginTop = '8px';
    na.textContent = 'Not applicable for this item type.';
    container.appendChild(na);
    return;
  }

  const wrap = document.createElement('div');
  wrap.className = 'panel-sub-section';
  container.appendChild(wrap);

  const lbl = document.createElement('label');
  lbl.className   = 'initial-modal-label';
  lbl.textContent = 'Default value:';
  lbl.dataset.tipTitle = 'item.initial';
  lbl.dataset.tipBody  = 'Pre-filled value when the form loads. Exported as item.initial[0].value[x] in the FHIR Questionnaire. User can edit unless the item is read-only.';
  lbl.dataset.tipFhir  = 'Questionnaire.item.initial[].value[x]';
  lbl.dataset.tipSpec  = 'R4';
  wrap.appendChild(lbl);

  const setDraft = v => { _pending.draftValue = v; };

  let ctrl;
  if (itype === 'checkbox') {
    const cbSel = createCustomSelect({
      items: [{ value: '', label: '\u2014 none \u2014' }, { value: 'true', label: 'Checked (Yes)' }, { value: 'false', label: 'Unchecked (No)' }],
      value: _pending.draftValue === undefined ? '' : String(_pending.draftValue),
      className: 'sc-trigger--full',
      onChange: v => setDraft(v === '' ? undefined : v === 'true'),
    });
    ctrl = cbSel.el;

  } else if (itype === 'select' || itype === 'radio' || itype === 'open-choice') {
    const optSel = createCustomSelect({
      items: [
        { value: '', label: '\u2014 none \u2014' },
        ...parseOptions(node.options || '').map(({ code, display }) => ({ value: code, label: display || code })),
      ],
      value:     _pending.draftValue || '',
      className: 'sc-trigger--full',
      onChange:  v => setDraft(v || undefined),
    });
    ctrl = optSel.el;

  } else if (itype === 'date') {
    const dp = createDatePicker({
      value:    _pending.draftValue || '',
      onChange: v => setDraft(v || undefined),
      className: 'sc-trigger--full',
    });
    ctrl = dp.el;

  } else if (itype === 'dateTime') {
    const dp = createDatePicker({
      value:    _pending.draftValue || '',
      onChange: v => setDraft(v || undefined),
      withTime:  true,
      className: 'sc-trigger--full',
    });
    ctrl = dp.el;

  } else if (itype === 'time') {
    ctrl = document.createElement('input');
    ctrl.type = 'time';
    ctrl.className = 'panel-inp-sm ctrl-input--time';
    // FHIR time stored as HH:MM:SS — native input uses HH:MM
    ctrl.value = _pending.draftValue ? String(_pending.draftValue).slice(0, 5) : '';
    ctrl.addEventListener('change', () => {
      setDraft(ctrl.value ? ctrl.value + ':00' : undefined);
    });

  } else if (['number', 'integer', 'decimal', 'quantity'].includes(itype)) {
    ctrl = document.createElement('input');
    ctrl.type  = 'number';
    ctrl.className = 'panel-inp-sm';
    ctrl.value = _pending.draftValue !== undefined ? _pending.draftValue : '';
    ctrl.oninput = () => setDraft(ctrl.value !== '' ? ctrl.value : undefined);

  } else if (itype === 'text') {
    ctrl = document.createElement('textarea');
    ctrl.className = 'panel-inp-textarea';
    ctrl.rows  = 3;
    ctrl.value = _pending.draftValue !== undefined ? String(_pending.draftValue) : '';
    ctrl.oninput = () => setDraft(ctrl.value || undefined);

  } else {
    // url, reference, open-choice free-text fallback, and other string-like types
    ctrl = document.createElement('input');
    ctrl.type  = 'text';
    ctrl.className = 'panel-inp-sm';
    ctrl.value = _pending.draftValue !== undefined ? String(_pending.draftValue) : '';
    ctrl.oninput = () => setDraft(ctrl.value || undefined);
  }

  wrap.appendChild(ctrl);
}

MODAL_REGISTRY.set('initial', { open });
