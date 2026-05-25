// ── Questionnaire Variables panel ─────────────────────────────────────────────
// Collapsible card (above tree) + edit modal for sdc-questionnaire-variable.
// init(elements, variablesArray) — wire DOM and reactive array once at startup.
// refresh() — re-render chip list and card visibility (call after import/reset).
import { initModal, openModal, closeModal } from './modal-base.js';

let _el   = null;  // resolved DOM nodes
let _vars = null;  // reference to reactive questVariables array
let _collapsed = false;
let _draft     = null; // working copy while modal is open; null when closed

export function init(elements, variablesArray) {
  _el   = elements;
  _vars = variablesArray;

  _el.toggle.addEventListener('click', _toggleCollapse);
  _el.editBtn.addEventListener('click', _openModal);
  if (_el.reinitBtn) _el.reinitBtn.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('reinit-form'));
  });
  initModal({
    modal:     _el.modal,
    closeBtn:  _el.closeBtn,
    cancelBtn: _el.cancelBtn,
    applyBtn:  _el.applyBtn,
  }, { onApply: _applyModal, onCancel: _closeModal });

  document.addEventListener('questionnaire-loaded', refresh);
  document.addEventListener('questionnaire-cleared', refresh);

  refresh();
}

export function refresh() {
  _el.count.textContent = _vars.length > 0 ? String(_vars.length) : '';
  _el.count.style.display = _vars.length > 0 ? '' : 'none';
  _renderChips();
}

// ── Card ──────────────────────────────────────────────────────────────────────

function _toggleCollapse() {
  _collapsed = !_collapsed;
  _el.toggle.setAttribute('aria-expanded', String(!_collapsed));
  _el.chipList.style.display = _collapsed ? 'none' : '';
  // rotate the arrow in toggle via CSS class
  _el.toggle.classList.toggle('variables-card-toggle--collapsed', _collapsed);
}

function _renderChips() {
  _el.chipList.innerHTML = '';
  for (const v of _vars) {
    if (!v.name) continue;
    const chip = document.createElement('span');
    chip.className = 'variables-chip';
    chip.dataset.tipTitle = '%' + v.name;
    chip.dataset.tipBody  = v.expression || '(no expression)';
    chip.dataset.tipFhir  = 'Questionnaire.extension[sdc-questionnaire-variable]';
    chip.dataset.tipSpec  = 'SDC';
    chip.textContent = '%' + v.name;
    _el.chipList.appendChild(chip);
  }
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function _openModal() {
  // Deep-copy current vars into draft; all edits go to draft until Apply.
  _draft = _vars.map(v => ({ name: v.name, expression: v.expression }));
  _renderModalBody();
  openModal(_el.modal);
}

function _closeModal() {
  // Cancel: discard draft, close without touching _vars.
  _draft = null;
  closeModal(_el.modal);
}

function _applyModal() {
  // Remove fully empty rows from draft.
  for (let i = _draft.length - 1; i >= 0; i--) {
    if (!_draft[i].name.trim() && !_draft[i].expression.trim()) _draft.splice(i, 1);
  }
  // Block if any variable has expression but no name.
  const invalid = _draft.some(v => !v.name.trim());
  if (invalid) {
    _renderModalBody(true);
    return;
  }
  // Commit draft → reactive _vars.
  _vars.splice(0, _vars.length, ..._draft.map(v => ({ name: v.name, expression: v.expression })));
  _draft = null;
  closeModal(_el.modal);
  refresh();
  document.dispatchEvent(new CustomEvent('reinit-form'));
}

function _renderModalBody(showErrors = false) {
  _el.modalBody.innerHTML = '';

  if (_draft.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'variables-modal-empty';
    empty.textContent = 'No variables defined. Use "+ Add Variable" to create one.';
    _el.modalBody.appendChild(empty);
  }

  for (let i = 0; i < _draft.length; i++) {
    _el.modalBody.appendChild(_makeRow(i, showErrors));
  }

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'variables-add-btn';
  addBtn.textContent = '+ Add Variable';
  addBtn.addEventListener('click', () => {
      _draft.push({ name: '', expression: '' });
      _renderModalBody();
    });
  _el.modalBody.appendChild(addBtn);
}

function _makeRow(index, showErrors = false) {
  const row = document.createElement('div');
  row.className = 'variables-row';

  // Name field: "%varName"
  const nameWrap = document.createElement('div');
  nameWrap.className = 'variables-name-wrap';

  const prefix = document.createElement('span');
  prefix.className = 'variables-name-prefix';
  prefix.textContent = '%';
  nameWrap.appendChild(prefix);

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'variables-name-input';
  nameInput.placeholder = 'variableName';
  nameInput.value = _draft[index].name;
  nameInput.spellcheck = false;
  nameInput.addEventListener('input', e => { _draft[index].name = e.target.value.replace(/\s/g, ''); });
  nameWrap.appendChild(nameInput);
  if (showErrors && !_draft[index].name.trim()) {
    nameInput.classList.add('variables-name-input--error');
    const err = document.createElement('span');
    err.className = 'variables-name-error';
    err.textContent = 'Name is required';
    nameWrap.appendChild(err);
  }
  row.appendChild(nameWrap);

  // Expression field
  const exprInput = document.createElement('textarea');
  exprInput.className = 'variables-expr-input';
  exprInput.placeholder = 'FHIRPath expression, e.g. item.where(linkId=\'weight\').answer.valueDecimal';
  exprInput.value = _draft[index].expression;
  exprInput.rows = 3;
  exprInput.spellcheck = false;
  exprInput.addEventListener('input', e => { _draft[index].expression = e.target.value; });
  row.appendChild(exprInput);

  // Delete button
  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'variables-delete-btn';
  deleteBtn.dataset.tipTitle = 'Remove variable';
  deleteBtn.textContent = '×';
  deleteBtn.addEventListener('click', () => {
    _draft.splice(index, 1);
    _renderModalBody();
  });
  row.appendChild(deleteBtn);

  return row;
}
