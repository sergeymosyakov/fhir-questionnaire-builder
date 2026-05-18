// ── Default Value (initial[]) edit modal ─────────────────────────────────────
// Centered modal for editing a node's _initialValue.
// Uses a draft pattern — changes are only committed on Apply.
// Cancel discards all edits.
//
// init(elements)                    — wire DOM once at startup
// open(node, initLink, setActive)   — populate body + show

import { parseOptions } from '../utils.js';
import { values } from '../state.js';
import { triggerCalcRecalc } from '../builder/_shared.js';

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
    values[node.id] = v;
  } else {
    delete node._initialValue;
    delete values[node.id];
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
    ctrl = document.createElement('select');
    ctrl.className = 'panel-type-sel';
    [['', '— none —'], ['true', 'Checked (Yes)'], ['false', 'Unchecked (No)']].forEach(([v, l]) => {
      const o = document.createElement('option');
      o.value = v; o.textContent = l;
      const cur = _pending.draftValue;
      if ((v === '' && cur === undefined) || String(cur) === v) o.selected = true;
      ctrl.appendChild(o);
    });
    ctrl.onchange = () => setDraft(ctrl.value === '' ? undefined : ctrl.value === 'true');

  } else if (itype === 'select' || itype === 'radio' || itype === 'open-choice') {
    ctrl = document.createElement('select');
    ctrl.className = 'panel-type-sel';
    const blank = document.createElement('option');
    blank.value = ''; blank.textContent = '— none —';
    if (!_pending.draftValue) blank.selected = true;
    ctrl.appendChild(blank);
    parseOptions(node.options || '').forEach(({ code, display }) => {
      const o = document.createElement('option');
      o.value = code; o.textContent = display || code;
      if (_pending.draftValue === code) o.selected = true;
      ctrl.appendChild(o);
    });
    ctrl.onchange = () => setDraft(ctrl.value || undefined);

  } else if (itype === 'date') {
    ctrl = document.createElement('input');
    ctrl.type  = 'date';
    ctrl.className = 'panel-inp-sm';
    ctrl.value = _pending.draftValue || '';
    ctrl.onchange = () => setDraft(ctrl.value || undefined);

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
