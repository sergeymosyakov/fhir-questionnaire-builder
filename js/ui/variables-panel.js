// ── Questionnaire Variables panel ─────────────────────────────────────────────
// Collapsible card (above tree) + edit modal for sdc-questionnaire-variable.
// configure({questVariables, mountEl}) — call once at startup.
import { Modal } from './modals/modal-base.js';
import { AppEvents } from '../events.js';

const _CARD_HTML = `
<div class="variables-card-header">
  <button type="button" class="variables-card-toggle" data-testid="variables-card-toggle" aria-expanded="true"
    data-tip-title="Collapse / expand" data-tip-body="Toggle the Variables card open or closed.">
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor"
      stroke-width="1.8" stroke-linecap="round"><path d="M2 3.5 L5 6.5 L8 3.5"/></svg>
  </button>
  <span class="variables-card-title"
    data-tip-title="Questionnaire Variables"
    data-tip-body="SDC questionnaire-level FHIRPath variables. Defined once at the root and referenced as %varName inside any calculatedExpression. Imported and exported as sdc-questionnaire-variable extensions."
    data-tip-fhir="Questionnaire.extension[sdc-questionnaire-variable]"
    data-tip-spec="SDC · optional">Variables</span>
  <span class="variables-card-count" data-testid="variables-card-count"></span>
  <button data-testid="variables-reinit-btn" type="button" class="variables-reinit-btn"
    data-tip-title="Re-init" data-tip-body="Re-evaluate all questionnaire-level variables and item initialExpression fields.">&#x21BA; Re-init</button>
  <button type="button" class="variables-edit-btn" data-testid="variables-edit-btn">Edit</button>
</div>
<div class="variables-card-chips" data-testid="variables-card-chips"></div>`;

let _questVariables = null;
let _collapsed = false;
let _draft     = null; // working copy while modal is open; null when closed
const _el = { card: null, toggle: null, chipList: null, count: null, editBtn: null, reinitBtn: null };

export function init() {
  const mountEl = document.querySelector('[data-mount="variables-panel"]');
  // Build card DOM from template
  const card = document.createElement('div');
  card.className = 'variables-card';
  card.dataset.testid = 'variables-card';
  card.style.display = 'none';
  card.innerHTML = _CARD_HTML;
  mountEl.replaceWith(card);
  _el.card      = card;
  _el.toggle    = card.querySelector('.variables-card-toggle');
  _el.chipList  = card.querySelector('.variables-card-chips');
  _el.count     = card.querySelector('.variables-card-count');
  _el.editBtn   = card.querySelector('.variables-edit-btn');
  _el.reinitBtn = card.querySelector('.variables-reinit-btn');
  // Wire listeners
  const modal = new VariablesModal();
  _el.toggle.addEventListener('click', _toggleCollapse);
  _el.editBtn.addEventListener('click', () => modal.open());
  _el.reinitBtn.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent(AppEvents.REINIT_FORM));
  });
  document.addEventListener(AppEvents.APP_CONTEXT_READY, e => { _questVariables = e.detail.questDoc?.variables ?? null; });
  document.addEventListener(AppEvents.QUESTIONNAIRE_LOADED, e => { _questVariables = e.detail.questDoc?.variables ?? null; _el.card.style.display = ''; refresh(); });
  document.addEventListener(AppEvents.QUESTIONNAIRE_NEW,    () => { _el.card.style.display = ''; });
  document.addEventListener(AppEvents.QUESTIONNAIRE_CLEARED, () => { _questVariables = null; _el.card.style.display = 'none'; refresh(); });
  document.addEventListener(AppEvents.PATIENT_CTX_APPLIED, refresh);
  refresh();
}

// Self-initialize when the module is imported (DOM is ready at this point)
if (typeof document !== 'undefined') { init(); }

class VariablesModal extends Modal {
  getName() { return 'variablesModal'; }
  constructor() {
    super();
    this.setTitle('Questionnaire Variables');
  }

  open() {
    if (!_questVariables) return;
    _draft = _questVariables.map(v => ({ name: v.name, expression: v.expression }));
    this._renderBody();
    super.open();
  }

  _apply() {
    for (let i = _draft.length - 1; i >= 0; i--) {
      if (!_draft[i].name.trim() && !_draft[i].expression.trim()) _draft.splice(i, 1);
    }
    if (_draft.some(v => !v.name.trim())) { this._renderBody(true); return; }
    _questVariables.splice(0, _questVariables.length, ..._draft.map(v => ({ name: v.name, expression: v.expression })));
    _draft = null;
    this.close();
    refresh();
    document.dispatchEvent(new CustomEvent(AppEvents.REINIT_FORM));
  }

  _cancel() {
    _draft = null;
    this.close();
  }

  _renderBody(showErrors = false) {
    this.body.innerHTML = '';
    if (_draft.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'variables-modal-empty';
      empty.textContent = 'No variables defined. Use “+ Add Variable” to create one.';
      this.body.appendChild(empty);
    }
    for (let i = 0; i < _draft.length; i++) this.body.appendChild(this._makeRow(i, showErrors));
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'variables-add-btn';
    addBtn.textContent = '+ Add Variable';
    addBtn.addEventListener('click', () => { _draft.push({ name: '', expression: '' }); this._renderBody(); });
    this.body.appendChild(addBtn);
  }

  _makeRow(index, showErrors = false) {
    const row = document.createElement('div');
    row.className = 'variables-row';
    const nameWrap = document.createElement('div');
    nameWrap.className = 'variables-name-wrap';
    const pfx = document.createElement('span');
    pfx.className = 'variables-name-prefix';
    pfx.textContent = '%';
    nameWrap.appendChild(pfx);
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
    const exprInput = document.createElement('textarea');
    exprInput.className = 'variables-expr-input';
    exprInput.placeholder = "FHIRPath expression, e.g. item.where(linkId='weight').answer.valueDecimal";
    exprInput.value = _draft[index].expression;
    exprInput.rows = 3;
    exprInput.spellcheck = false;
    exprInput.addEventListener('input', e => { _draft[index].expression = e.target.value; });
    row.appendChild(exprInput);
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'variables-delete-btn';
    deleteBtn.dataset.tipTitle = 'Remove variable';
    deleteBtn.textContent = '×';
    deleteBtn.addEventListener('click', () => { _draft.splice(index, 1); this._renderBody(); });
    row.appendChild(deleteBtn);
    return row;
  }
}

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

