// ── Item Codes edit modal ─────────────────────────────────────────────────────
// Centered modal for editing a node's _codes[] array (FHIR item.code[]).
// Uses a draft pattern — changes committed only on Apply, discarded on Cancel.
//
// init(elements)               — wire DOM once at startup (called from app.js)
// open(node, link, setActive)  — populate body + show modal

import { initModal, setModalTitle, openModal, closeModal } from './modal-base.js';

let _el      = null;
let _pending = null; // { node, link, setActive, draft }

export function init(elements) {
  _el = elements;
  initModal(elements, { onApply: _apply, onCancel: _cancel });
}

export function open(node, link, setActive) {
  const draft = JSON.parse(JSON.stringify(node._codes || []));
  _pending = { node, link, setActive, draft };
  setModalTitle(_el.title, 'Codes (item.code[])', node.title || node.id || 'Item');
  _renderBody(draft, _el.body);
  openModal(_el.modal);
}

function _apply() {
  if (!_pending) return;
  const { node, draft, link, setActive } = _pending;
  const filtered = draft.filter(c => c.code.trim());
  if (filtered.length) node._codes = filtered;
  else delete node._codes;
  setActive(link, !!(node._codes && node._codes.length));
  _close();
}

function _cancel() { _close(); }

function _close() {
  if (_el) closeModal(_el.modal);
  _pending = null;
}

// ── Body renderer ─────────────────────────────────────────────────────────────

function _renderBody(draft, container) {
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
      inp.dataset.testid = `code-${field}-${idx}`;
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
    removeBtn.dataset.testid = `code-remove-${idx}`;
    removeBtn.onclick = () => { draft.splice(idx, 1); _renderBody(draft, container); };
    row.appendChild(removeBtn);

    container.appendChild(row);
  });

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'codes-add-btn';
  addBtn.dataset.testid = 'codes-add-btn';
  addBtn.textContent = '+ Add code';
  addBtn.onclick = () => { draft.push({ system: '', code: '', display: '' }); _renderBody(draft, container); };
  container.appendChild(addBtn);
}
