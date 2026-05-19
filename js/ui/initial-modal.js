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

let _el      = null;
let _pending = null; // { node, initLink, setActive, draftValue }

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

export function open(node, initLink, setActive) {
  _pending = { node, initLink, setActive, draftValue: node._initialValue };

  _el.title.innerHTML = '';
  const labelEl = document.createElement('span');
  labelEl.className   = 'modal-title-label';
  labelEl.textContent = 'Default Value';
  const subjectEl = document.createElement('span');
  subjectEl.className   = 'modal-title-subject';
  subjectEl.textContent = '\u2014 ' + (node.title || node.id || 'Item');
  _el.title.appendChild(labelEl);
  _el.title.appendChild(subjectEl);

  _el.body.innerHTML = '';
  _renderBody(node, _el.body);
  _el.modal.style.display = 'flex';
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
  _el.modal.style.display = 'none';
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
