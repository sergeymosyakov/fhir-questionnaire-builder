// ── Item Properties modal ─────────────────────────────────────────────────────
// Centered modal for editing item-level metadata:
//   Core      (always visible): item.definition URL
//   Codes     (collapsible)   : item.code[] — system / code / display rows
//
// Uses a draft pattern — changes committed only on Apply, discarded on Cancel.
//
// init(elements)               — wire DOM once at startup (called from app.js)
// open(node, link, setActive)  — populate body + show modal

import { initModal, setModalTitle, openModal, closeModal } from './modal-base.js';

let _el      = null;
let _pending = null; // { node, link, setActive, codes, definition }

export function init(elements) {
  _el = elements;
  initModal(elements, { onApply: _apply, onCancel: _cancel });
}

export function open(node, link, setActive) {
  _pending = {
    node,
    link,
    setActive,
    codes:      JSON.parse(JSON.stringify(node._codes || [])),
    definition: node._definition || '',
  };
  setModalTitle(_el.title, 'Item Properties', node.title || node.id || 'Item');
  _renderBody(_pending, _el.body);
  openModal(_el.modal);
}

function _apply() {
  if (!_pending) return;
  const { node, codes, definition, link, setActive } = _pending;

  // definition
  if (definition.trim()) node._definition = definition.trim();
  else delete node._definition;

  // codes
  const filtered = codes.filter(c => c.code.trim());
  if (filtered.length) node._codes = filtered;
  else delete node._codes;

  setActive(link, !!(node._codes?.length) || !!node._definition);
  _close();
}

function _cancel() { _close(); }

function _close() {
  if (_el) closeModal(_el.modal);
  _pending = null;
}

// ── Body renderer ─────────────────────────────────────────────────────────────

function _renderBody(pending, container) {
  container.innerHTML = '';

  // ── Core: definition ──────────────────────────────────────────────────────
  const defRow = document.createElement('div');
  defRow.className = 'meta-modal-row';

  const defLbl = document.createElement('label');
  defLbl.className = 'meta-modal-lbl';
  defLbl.htmlFor = 'itemPropsDefInput';
  defLbl.textContent = 'Definition';

  const defInp = document.createElement('input');
  defInp.type = 'url';
  defInp.id = 'itemPropsDefInput';
  defInp.className = 'meta-modal-inp';
  defInp.placeholder = 'https://...StructureDefinition#element';
  defInp.dataset.testid = 'item-props-definition';
  defInp.value = pending.definition;
  defInp.oninput = () => { pending.definition = defInp.value; };

  defRow.appendChild(defLbl);
  defRow.appendChild(defInp);
  container.appendChild(defRow);

  // ── Codes (collapsible) ───────────────────────────────────────────────────
  const codesSection = document.createElement('div');
  codesSection.className = 'meta-modal-advanced';

  const codesToggle = document.createElement('button');
  codesToggle.type      = 'button';
  codesToggle.className = 'meta-modal-adv-toggle';
  codesToggle.dataset.testid = 'item-props-codes-toggle';
  let codesOpen = true;

  const codesBody = document.createElement('div');
  codesBody.className = 'meta-modal-adv-body';
  codesBody.style.display = codesOpen ? '' : 'none';
  renderCodesEditor(pending.codes, codesBody, 'code');

  const _setCodesLabel = () => {
    const count = pending.codes.filter(c => c.code.trim()).length;
    const badge = count ? ` (${count})` : '';
    codesToggle.textContent = (codesOpen ? '\u25BC' : '\u25BA') + ' Codes' + badge;
  };
  _setCodesLabel();

  codesToggle.addEventListener('click', () => {
    codesOpen = !codesOpen;
    codesBody.style.display = codesOpen ? '' : 'none';
    _setCodesLabel();
  });

  // Refresh badge after add/remove inside the editor
  codesBody.addEventListener('input', _setCodesLabel);
  codesBody.addEventListener('click', () => setTimeout(_setCodesLabel, 0));

  codesSection.append(codesToggle, codesBody);
  container.appendChild(codesSection);
}

/**
 * Shared codes editor — renders system/code/display rows + Add button.
 * Reusable across modals (item codes, questionnaire codes).
 * @param {object[]} draft   — mutable array of {system, code, display}
 * @param {Element}  container — cleared and repopulated
 * @param {string}   prefix  — testid prefix, e.g. 'code' or 'meta-code'
 */
export function renderCodesEditor(draft, container, prefix = 'code') {
  container.innerHTML = '';

  if (draft.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'codes-empty-msg';
    empty.textContent = 'No codes. Add one below.';
    container.appendChild(empty);
  }

  draft.forEach((c, idx) => {
    const row = document.createElement('div');
    row.className = 'codes-row';

    const mkInput = (placeholder, field) => {
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.value = c[field] || '';
      inp.placeholder = placeholder;
      inp.className = 'codes-inp';
      inp.dataset.testid = `${prefix}-${field}-${idx}`;
      inp.oninput = () => { draft[idx][field] = inp.value; };
      return inp;
    };

    row.appendChild(mkInput('system URL', 'system'));
    row.appendChild(mkInput('code *', 'code'));
    row.appendChild(mkInput('display', 'display'));

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'codes-remove-btn';
    removeBtn.textContent = '\u00D7';
    removeBtn.title = 'Remove';
    removeBtn.dataset.testid = `${prefix}-remove-${idx}`;
    removeBtn.onclick = () => { draft.splice(idx, 1); renderCodesEditor(draft, container, prefix); };
    row.appendChild(removeBtn);

    container.appendChild(row);
  });

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'codes-add-btn';
  addBtn.dataset.testid = `${prefix}s-add-btn`;
  addBtn.textContent = '+ Add code';
  addBtn.onclick = () => { draft.push({ system: '', code: '', display: '' }); renderCodesEditor(draft, container, prefix); };
  container.appendChild(addBtn);
}
