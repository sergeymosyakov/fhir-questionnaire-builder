// ── Questionnaire Variables panel ─────────────────────────────────────────────
// Collapsible card (above tree) + edit modal for sdc-questionnaire-variable.
// configure({questVariables}) — call once at startup; then refresh() on events.
import { Modal } from './modals/modal-base.js';

let _questVariables = null;
export function configure({ questVariables }) {
  _questVariables = questVariables;
  refresh();
}

let _collapsed = false;
let _draft     = null; // working copy while modal is open; null when closed

const _el = {
  card:      document.getElementById('variablesCard'),
  toggle:    document.getElementById('variablesCardToggle'),
  chipList:  document.getElementById('variablesCardChips'),
  count:     document.getElementById('variablesCardCount'),
  editBtn:   document.getElementById('variablesEditBtn'),
  reinitBtn: document.getElementById('variablesReinitBtn'),
};

const _modal = new Modal();
_modal.title.textContent = 'Questionnaire Variables';
_modal._apply  = _applyModal;
_modal._cancel = _closeModal;

_el.toggle.addEventListener('click', _toggleCollapse);
_el.editBtn.addEventListener('click', _openModal);
if (_el.reinitBtn) _el.reinitBtn.addEventListener('click', () => {
  document.dispatchEvent(new CustomEvent('reinit-form'));
});

document.addEventListener('questionnaire-loaded', refresh);
document.addEventListener('questionnaire-cleared', refresh);
document.addEventListener('patient-ctx-applied', refresh);

export function refresh() {
  if (!_questVariables) return;
  _el.count.textContent = _questVariables.length > 0 ? String(_questVariables.length) : '';
  _el.count.style.display = _questVariables.length > 0 ? '' : 'none';
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
  for (const v of _questVariables) {
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
  _draft = _questVariables.map(v => ({ name: v.name, expression: v.expression }));
  _renderModalBody();
  _modal.open();
}

function _closeModal() {
  // Cancel: discard draft, close without touching questVariables.
  _draft = null;
  _modal.close();
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
  // Commit draft → reactive _questVariables.
  _questVariables.splice(0, _questVariables.length, ..._draft.map(v => ({ name: v.name, expression: v.expression })));
  _draft = null;
  _modal.close();
  refresh();
  document.dispatchEvent(new CustomEvent('reinit-form'));
}

function _renderModalBody(showErrors = false) {
  _modal.body.innerHTML = '';

  if (_draft.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'variables-modal-empty';
    empty.textContent = 'No variables defined. Use "+ Add Variable" to create one.';
    _modal.body.appendChild(empty);
  }

  for (let i = 0; i < _draft.length; i++) {
    _modal.body.appendChild(_makeRow(i, showErrors));
  }

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'variables-add-btn';
  addBtn.textContent = '+ Add Variable';
  addBtn.addEventListener('click', () => {
    _draft.push({ name: '', expression: '' });
    _renderModalBody();
  });
  _modal.body.appendChild(addBtn);
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
