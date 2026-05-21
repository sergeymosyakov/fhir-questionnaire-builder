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
import { triggerCalcRecalc } from '../builder/_shared.js';

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
    codes:        JSON.parse(JSON.stringify(node._codes || [])),
    definition:   node._definition || '',
    supportLinks: (node._supportLinks || []).slice(),
  };
  setModalTitle(_el.title, 'Item Properties', node.title || node.id || 'Item');
  _renderBody(_pending, _el.body);
  openModal(_el.modal);
}

function _apply() {
  if (!_pending) return;
  const { node, codes, definition, supportLinks, link, setActive } = _pending;

  // definition
  if (definition.trim()) node._definition = definition.trim();
  else delete node._definition;

  // codes
  const filtered = codes.filter(c => c.code.trim());
  if (filtered.length) node._codes = filtered;
  else delete node._codes;

  // support links
  const filteredLinks = supportLinks.filter(u => u.trim());
  if (filteredLinks.length) node._supportLinks = filteredLinks;
  else delete node._supportLinks;

  setActive(link, !!(node._codes?.length) || !!node._definition || !!(node._supportLinks?.length));
  triggerCalcRecalc();
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

  // ── Support Links (collapsible) ───────────────────────────────────────────
  const slSection = document.createElement('div');
  slSection.className = 'meta-modal-advanced';

  const slToggle = document.createElement('button');
  slToggle.type      = 'button';
  slToggle.className = 'meta-modal-adv-toggle';
  slToggle.dataset.testid = 'item-props-sl-toggle';
  let slOpen = (pending.supportLinks.length > 0);

  const slBody = document.createElement('div');
  slBody.className = 'meta-modal-adv-body';
  slBody.style.display = slOpen ? '' : 'none';

  const _renderSlRows = () => {
    slBody.innerHTML = '';
    pending.supportLinks.forEach((url, idx) => {
      const row = document.createElement('div');
      row.className = 'support-link-row';

      const inp = document.createElement('input');
      inp.type = 'url';
      inp.className = 'support-link-input';
      inp.placeholder = 'https://example.com/help';
      inp.value = url;
      inp.dataset.testid = 'support-link-input';
      inp.oninput = () => { pending.supportLinks[idx] = inp.value; _setSlLabel(); };

      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'codes-remove-btn';
      rm.textContent = '\u00D7';
      rm.dataset.testid = 'support-link-rm';
      rm.onclick = () => { pending.supportLinks.splice(idx, 1); _renderSlRows(); _setSlLabel(); };

      row.append(inp, rm);
      slBody.appendChild(row);
    });

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'codes-add-btn';
    addBtn.dataset.testid = 'support-link-add';
    addBtn.textContent = '+ Add link';
    addBtn.onclick = () => {
      pending.supportLinks.push('');
      _renderSlRows();
      _setSlLabel();
      slBody.querySelector('input:last-of-type')?.focus();
    };
    slBody.appendChild(addBtn);
  };

  const _setSlLabel = () => {
    const count = pending.supportLinks.filter(u => u.trim()).length;
    const badge = count ? ` (${count})` : '';
    slToggle.textContent = (slOpen ? '\u25BC' : '\u25BA') + ' Support Links' + badge;
  };

  _renderSlRows();
  _setSlLabel();

  slToggle.addEventListener('click', () => {
    slOpen = !slOpen;
    slBody.style.display = slOpen ? '' : 'none';
    _setSlLabel();
  });

  slSection.append(slToggle, slBody);
  container.appendChild(slSection);
}

/**
 * Shared codes editor — renders system/code/display rows + Add button.
 * Reusable across modals (item codes, questionnaire codes).
 * @param {object[]} draft   — mutable array of {system, code, display}
 * @param {Element}  container — cleared and repopulated
 * @param {string}   prefix  — testid prefix, e.g. 'code' or 'meta-code'
 */
export function renderCodesEditor(draft, container, prefix = 'code', label = 'code') {
  container.innerHTML = '';

  if (draft.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'codes-empty-msg';
    empty.textContent = `No ${label}s. Add one below.`;
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
    removeBtn.onclick = () => { draft.splice(idx, 1); renderCodesEditor(draft, container, prefix, label); };
    row.appendChild(removeBtn);

    container.appendChild(row);
  });

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'codes-add-btn';
  addBtn.dataset.testid = `${prefix}s-add-btn`;
  addBtn.textContent = `+ Add ${label}`;
  addBtn.onclick = () => { draft.push({ system: '', code: '', display: '' }); renderCodesEditor(draft, container, prefix, label); };
  container.appendChild(addBtn);
}
