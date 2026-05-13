// ── Questionnaire Variables panel ─────────────────────────────────────────────
// Collapsible card (above tree) + edit modal for sdc-questionnaire-variable.
// init(elements, variablesArray) — wire DOM and reactive array once at startup.
// refresh() — re-render chip list and card visibility (call after import/reset).

let _el   = null;  // resolved DOM nodes
let _vars = null;  // reference to reactive questVariables array
let _collapsed = false;

export function init(elements, variablesArray) {
  _el   = elements;
  _vars = variablesArray;

  _el.toggle.addEventListener('click', _toggleCollapse);
  _el.editBtn.addEventListener('click', _openModal);
  _el.closeBtn.addEventListener('click', _closeModal);
  _el.modal.addEventListener('click', e => { if (e.target === _el.modal) _closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && _el.modal.style.display !== 'none') _closeModal(); });

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
    chip.title = v.expression || '(no expression)';
    chip.textContent = '%' + v.name;
    _el.chipList.appendChild(chip);
  }
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function _openModal() {
  _renderModalBody();
  _el.modal.style.display = 'flex';
}

function _closeModal() {
  // Remove fully empty rows
  for (let i = _vars.length - 1; i >= 0; i--) {
    if (!_vars[i].name.trim() && !_vars[i].expression.trim()) _vars.splice(i, 1);
  }
  // Block close if any remaining variable has no name
  const invalid = _vars.some(v => !v.name.trim());
  if (invalid) {
    _renderModalBody(true);
    return;
  }
  _el.modal.style.display = 'none';
  refresh();
}

function _renderModalBody(showErrors = false) {
  _el.modalBody.innerHTML = '';

  if (_vars.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'variables-modal-empty';
    empty.textContent = 'No variables defined. Use "+ Add Variable" to create one.';
    _el.modalBody.appendChild(empty);
  }

  for (let i = 0; i < _vars.length; i++) {
    _el.modalBody.appendChild(_makeRow(i, showErrors));
  }

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'variables-add-btn';
  addBtn.textContent = '+ Add Variable';
  addBtn.addEventListener('click', () => {
    _vars.push({ name: '', expression: '' });
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
  nameInput.value = _vars[index].name;
  nameInput.spellcheck = false;
  nameInput.addEventListener('input', e => { _vars[index].name = e.target.value.replace(/\s/g, ''); });
  nameWrap.appendChild(nameInput);
  if (showErrors && !_vars[index].name.trim()) {
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
  exprInput.value = _vars[index].expression;
  exprInput.rows = 2;
  exprInput.spellcheck = false;
  exprInput.addEventListener('input', e => { _vars[index].expression = e.target.value; });
  row.appendChild(exprInput);

  // Delete button
  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'variables-delete-btn';
  deleteBtn.title = 'Remove variable';
  deleteBtn.textContent = '×';
  deleteBtn.addEventListener('click', () => {
    _vars.splice(index, 1);
    _renderModalBody();
  });
  row.appendChild(deleteBtn);

  return row;
}
