// ── Repeatable (item.repeats + cardinality) edit modal ───────────────────────
// Centered modal for toggling item.repeats and setting minOccurs / maxOccurs.
// Uses draft pattern — changes committed only on Apply.
//
// init(elements)                         — wire DOM once at startup
// open(node, repeatLink, setActive)      — populate body + show

import { triggerCalcRecalc } from '../builder/_shared.js';
import { getValue, setValue, deleteValue } from '../state.js';
import { initModal, setModalTitle, openModal, closeModal } from './modal-base.js';

let _el      = null;
let _pending = null;

export function init(elements) {
  _el = elements;
  initModal(elements, { onApply: _apply, onCancel: _cancel });
}

export function open(node, repeatLink, setActive) {
  _pending = {
    node,
    repeatLink,
    setActive,
    draftRepeats: !!node.repeats,
    draftMin:     node._minOccurs !== undefined ? String(node._minOccurs) : '',
    draftMax:     node._maxOccurs !== undefined ? String(node._maxOccurs) : '',
  };

  setModalTitle(_el.title, 'Repeatable', node.title || node.id || 'Item');

  _el.body.innerHTML = '';
  _renderBody(_el.body);
  openModal(_el.modal);
}

function _apply() {
  if (!_pending) return;
  const { node, repeatLink, setActive } = _pending;

  node.repeats = _pending.draftRepeats;

  if (_pending.draftRepeats) {
    const min = _pending.draftMin !== '' ? parseInt(_pending.draftMin, 10) : undefined;
    const max = _pending.draftMax !== '' ? parseInt(_pending.draftMax, 10) : undefined;
    if (min !== undefined && !isNaN(min)) node._minOccurs = min; else delete node._minOccurs;
    if (max !== undefined && !isNaN(max)) {
      node._maxOccurs = max;
      // Trim extra rows that now exceed maxOccurs
      const id = node.id;
      const currentN = getValue(id + '$$n') || 0; // extra rows; total = currentN + 1
      if (currentN + 1 > max) {
        const keepN = max - 1; // extra rows to keep
        for (let i = keepN + 1; i <= currentN; i++) deleteValue(id + '$$' + i);
        if (keepN <= 0) deleteValue(id + '$$n'); else setValue(id + '$$n', keepN);
      }
    } else {
      delete node._maxOccurs;
    }
  } else {
    delete node._minOccurs;
    delete node._maxOccurs;
  }

  setActive(repeatLink, !!node.repeats);
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

function _renderBody(container) {
  const hint = document.createElement('div');
  hint.className = 'panel-hint';
  hint.textContent = 'Allow multiple answers for this item. Use cardinality to enforce minimum and maximum answer counts.';
  container.appendChild(hint);

  const section = document.createElement('div');
  section.className = 'panel-sub-section';
  container.appendChild(section);

  // ── Repeatable toggle ───────────────────────────────────────────────────
  const toggleRow = document.createElement('div');
  toggleRow.className = 'repeat-modal-toggle-row';

  const cb = document.createElement('input');
  cb.type      = 'checkbox';
  cb.id        = '_rmToggle';
  cb.className = 'repeat-modal-cb';
  cb.checked   = _pending.draftRepeats;
  cb.dataset.testid = 'repeat-modal-toggle';

  const cbLabel = document.createElement('label');
  cbLabel.htmlFor   = '_rmToggle';
  cbLabel.className = 'repeat-modal-cb-label';
  cbLabel.textContent = 'Repeatable (item.repeats)';

  toggleRow.appendChild(cb);
  toggleRow.appendChild(cbLabel);
  section.appendChild(toggleRow);

  // ── Cardinality section (visible only when repeats = true) ──────────────
  const card = document.createElement('div');
  card.className    = 'repeat-modal-card';
  card.style.display = _pending.draftRepeats ? '' : 'none';

  const cardTitle = document.createElement('div');
  cardTitle.className   = 'repeat-modal-card-title';
  cardTitle.textContent = 'Cardinality';
  card.appendChild(cardTitle);

  const grid = document.createElement('div');
  grid.className = 'repeat-modal-grid';

  // Min row
  const minLbl = document.createElement('label');
  minLbl.textContent = 'Min answers:';
  minLbl.className   = 'repeat-modal-lbl';

  const minInp = document.createElement('input');
  minInp.type           = 'number';
  minInp.min            = '0';
  minInp.step           = '1';
  minInp.className      = 'panel-inp-sm';
  minInp.dataset.testid = 'repeat-modal-min';
  minInp.placeholder    = '0 = optional';
  minInp.value          = _pending.draftMin;
  minInp.oninput = () => { _pending.draftMin = minInp.value; };

  const minHint = document.createElement('span');
  minHint.className   = 'repeat-modal-hint';
  minHint.textContent = 'questionnaire-minOccurs';

  // Max row
  const maxLbl = document.createElement('label');
  maxLbl.textContent = 'Max answers:';
  maxLbl.className   = 'repeat-modal-lbl';

  const maxInp = document.createElement('input');
  maxInp.type           = 'number';
  maxInp.min            = '1';
  maxInp.step           = '1';
  maxInp.className      = 'panel-inp-sm';
  maxInp.dataset.testid = 'repeat-modal-max';
  maxInp.placeholder    = 'empty = \u221e';
  maxInp.value          = _pending.draftMax;
  maxInp.oninput = () => { _pending.draftMax = maxInp.value; };

  const maxHint = document.createElement('span');
  maxHint.className   = 'repeat-modal-hint';
  maxHint.textContent = 'questionnaire-maxOccurs';

  grid.appendChild(minLbl);  grid.appendChild(minInp);  grid.appendChild(minHint);
  grid.appendChild(maxLbl);  grid.appendChild(maxInp);  grid.appendChild(maxHint);
  card.appendChild(grid);
  section.appendChild(card);

  // Show/hide cardinality when checkbox changes
  cb.onchange = () => {
    _pending.draftRepeats = cb.checked;
    card.style.display = cb.checked ? '' : 'none';
  };
}
