import { MODAL_REGISTRY } from '../modal-registry.js';
// ── Answer Type edit modal ────────────────────────────────────────────────────
// Centered modal for editing item type, options, and answerValueSet.
// For choice types (select / radio / open-choice) the user picks the answer
// source: either a plain "options list" or a ValueSet reference.  When a local
// #vs-id is chosen the resolved concepts are stored in node.options so the
// preview can render real answers; export.js skips answerOption when
// _answerValueSet is present.
//
// Uses draft pattern — changes are only committed on Apply. Cancel discards.
//
// init(elements)                       — wire DOM once at startup
// open(node, typeLink, setActive)      — populate body + show

import { tree, values, deleteValue } from '../../state.js';
import { triggerCalcRecalc, renderTree } from '../../builder/_shared.js';
import { createItemNode } from '../../nodes/index.js';
import { createCustomSelect } from '../custom-select.js';
import { initModal, setModalTitle, openModal, closeModal } from '../modal-base.js';
import { ITEM_TYPES } from './data.js';
import { SECTION_REGISTRY } from './sections.js';

let _el      = null;
let _pending = null;

// Replace a node in the reactive tree array (recursive, in-place splice).
function _replaceInTree(treeArr, nodeId, newNode) {
  for (let i = 0; i < treeArr.length; i++) {
    if (treeArr[i].id === nodeId) { treeArr.splice(i, 1, newNode); return true; }
    if (treeArr[i].children && _replaceInTree(treeArr[i].children, nodeId, newNode)) return true;
  }
  return false;
}

// ── module API ────────────────────────────────────────────────────────────────

export function init(elements) {
  _el = elements;
  initModal(elements, { onApply: _apply, onCancel: _cancel });
}

export function open(node, typeLink, setActive) {
  _pending = Object.assign(
    { node, typeLink, setActive, draftType: node.itemType },
    ...SECTION_REGISTRY.map(s => s.initDraft(node)),
  );

  setModalTitle(_el.title, 'Answer Type', node.title || node.id || 'Item');

  _el.body.innerHTML = '';
  _renderBody(_el.body);
  openModal(_el.modal);
}

// ── internals ─────────────────────────────────────────────────────────────────

function _apply() {
  if (!_pending) return;
  let node = _pending.node;

  // Clear stored answers when type changes
  if (node.itemType !== _pending.draftType) {
    const id = node.id;
    deleteValue(id);
    const n = values[id + '$$n'] || 0;
    for (let i = 1; i <= n; i++) deleteValue(id + '$$' + i);
    delete values[id + '$$n'];
  }

  // Replace node in tree with a new instance of the correct class.
  // Copies all own properties (id, title, enableWhen, etc.) then overrides itemType.
  const newNode = createItemNode(_pending.draftType, { id: node.id });
  Object.assign(newNode, node, { itemType: _pending.draftType });
  _replaceInTree(tree, node.id, newNode);
  node = newNode; // rebind to the new correctly-typed instance

  // checkbox / display cannot be repeatable
  if ((node.itemType === 'checkbox' || node.itemType === 'display') && node.repeats) {
    node.repeats = false;
    delete node._minOccurs;
    delete node._maxOccurs;
  }

  SECTION_REGISTRY.forEach(s => s.commit(_pending, node));

  // Re-render builder (creates correct row for new type; handles repeatLink visibility etc.)
  renderTree();
  triggerCalcRecalc();
  _close();
}

function _cancel() { _close(); }

function _close() {
  _pending = null;
  closeModal(_el.modal);
}

// ── body renderer ─────────────────────────────────────────────────────────────────

function _renderBody(container) {
  const hint = document.createElement('div');
  hint.className   = 'panel-hint';
  hint.textContent = 'Sets the FHIR item type. For coded-answer types you can supply a plain options list or link to a contained[] ValueSet.';
  container.appendChild(hint);

  // ── Type selector ─────────────────────────────────────────────────────────
  const typeRow = document.createElement('div');
  typeRow.className = 'at-modal-type-row';
  const typeLbl = document.createElement('label');
  typeLbl.className        = 'at-modal-lbl';
  typeLbl.textContent      = 'Type:';
  typeLbl.dataset.tipTitle = 'Item type';
  typeLbl.dataset.tipBody  = 'The FHIR data type for answers to this item. Determines which control is rendered in the preview.';
  typeLbl.dataset.tipFhir  = 'Questionnaire.item.type';
  typeLbl.dataset.tipSpec  = 'R4';

  // Build all sections up-front; type selector onChange updates their visibility
  const built = SECTION_REGISTRY.map(s => ({ s, el: s.build(_pending) }));

  const typeSel = createCustomSelect({
    items:     ITEM_TYPES.map(t => ({ value: t, label: t })),
    value:     _pending.draftType,
    className: 'at-modal-type-sel sc-trigger--full',
    testid:    'type-select',
    onChange:  v => {
      _pending.draftType = v;
      built.forEach(({ s, el }) => {
        el.style.display = s.isVisible(v) ? '' : 'none';
        s.onTypeChange(v);
      });
    },
  });
  typeRow.appendChild(typeLbl);
  typeRow.appendChild(typeSel.el);
  container.appendChild(typeRow);

  // ── Sections (self-registered) ──────────────────────────────────────────────
  built.forEach(({ s, el }) => {
    el.style.display = s.isVisible(_pending.draftType) ? '' : 'none';
    container.appendChild(el);
  });
}

MODAL_REGISTRY.set('answerType', { open });
