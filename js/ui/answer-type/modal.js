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

import { questContained, tree, values, deleteValue } from '../../state.js';
import { resolveContainedValueSet } from '../../fhir/import.js';
import { triggerCalcRecalc, renderTree } from '../../builder/_shared.js';
import { createItemNode } from '../../nodes/index.js';
import { createCustomSelect } from '../custom-select.js';
import { initModal, setModalTitle, openModal, closeModal } from '../modal-base.js';
import {
  CHOICE_TYPES, ENTRY_FORMAT_TYPES, NUMERIC_TYPES,
  ITEM_TYPES,
  _optsWithOrdinals, _parseOptsWithOrdinals,
} from './data.js';
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
  _pending = {
    node, typeLink, setActive,
    draftType:        node.itemType,
    draftOptions:     _optsWithOrdinals(node),
    draftAVS:         node._answerValueSet || '',
    draftRefRes:      node.referenceResource || '',
    draftUnit:        node.quantityUnit || '',
    draftMinValue:    node._minValue    !== undefined ? String(node._minValue)    : '',
    draftMaxValue:    node._maxValue    !== undefined ? String(node._maxValue)    : '',
    draftSliderStep:  node._sliderStep  !== undefined ? String(node._sliderStep)  : '',
    draftEntryFormat:     node._entryFormat || '',
    draftOrientation:     node._choiceOrientation || '',
    draftDisplayCategory: node._displayCategory || '',
    draftMaxFileSizeMB:   node._maxFileSizeMB !== undefined ? String(node._maxFileSizeMB) : '',
    draftMimeTypes:       node._mimeTypes ? node._mimeTypes.join(', ') : '',
    draftPrefixes:        node._optionPrefixes
      ? Object.entries(node._optionPrefixes).map(([code, pfx]) => `${code}=${pfx}`).join(',')
      : '',
    draftOpenLabel:       node._openLabel || '',
  };

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

  if (CHOICE_TYPES.has(node.itemType)) {
    if (_pending.draftAVS) {
      node._answerValueSet = _pending.draftAVS;
      // Resolve local #vs-id → options string for preview rendering
      node.options = resolveContainedValueSet(questContained, _pending.draftAVS);
      delete node._optionOrdinals;
      delete node._optionPrefixes;
    } else {
      delete node._answerValueSet;
      // Extract ordinals from draft, store clean "code=Label" in node.options
      const _parsedOrds = _parseOptsWithOrdinals(_pending.draftOptions);
      const _newOrdinals = {};
      node.options = _parsedOrds.map(({ code, display, ordinal }) => {
        if (ordinal !== undefined) _newOrdinals[code] = ordinal;
        return code + '=' + display;
      }).join(',');
      if (Object.keys(_newOrdinals).length) node._optionOrdinals = _newOrdinals;
      else delete node._optionOrdinals;

      // option prefixes
      const _newPrefixes = {};
      (_pending.draftPrefixes || '').split(',').forEach(s => {
        const idx = s.indexOf('=');
        if (idx < 1) return;
        const code = s.slice(0, idx).trim();
        const pfx  = s.slice(idx + 1).trim();
        if (code && pfx) _newPrefixes[code] = pfx;
      });
      if (Object.keys(_newPrefixes).length) node._optionPrefixes = _newPrefixes;
      else delete node._optionPrefixes;
    }
  } else {
    // Non-choice type: clear choice-specific state
    delete node._answerValueSet;
    delete node._optionOrdinals;
    delete node._optionPrefixes;
    node.options = '';
  }

  node.referenceResource = (node.itemType === 'reference' && _pending.draftRefRes) ? _pending.draftRefRes : undefined;
  node.quantityUnit      = (node.itemType === 'quantity'  && _pending.draftUnit)   ? _pending.draftUnit   : undefined;

  // Numeric constraints: min/max/slider step (integer and decimal only)
  if (NUMERIC_TYPES.has(node.itemType)) {
    const _pf    = s => { const n = parseFloat(s); return isNaN(n) ? undefined : n; };
    const _round = node.itemType === 'integer';
    const minV   = _pf(_pending.draftMinValue);
    const maxV   = _pf(_pending.draftMaxValue);
    const stepV  = _pf(_pending.draftSliderStep);
    if (minV  !== undefined)              node._minValue   = _round ? Math.round(minV)  : minV;  else delete node._minValue;
    if (maxV  !== undefined)              node._maxValue   = _round ? Math.round(maxV)  : maxV;  else delete node._maxValue;
    if (stepV !== undefined && stepV > 0) node._sliderStep = _round ? Math.round(stepV) : stepV; else delete node._sliderStep;
  } else {
    delete node._minValue;
    delete node._maxValue;
    delete node._sliderStep;
  }

  // entryFormat placeholder hint (text-like types)
  if (ENTRY_FORMAT_TYPES.has(node.itemType) && _pending.draftEntryFormat.trim()) {
    node._entryFormat = _pending.draftEntryFormat.trim();
  } else {
    delete node._entryFormat;
  }

  // choiceOrientation (radio items only)
  if (node.itemType === 'radio' && _pending.draftOrientation) {
    node._choiceOrientation = _pending.draftOrientation;
  } else {
    delete node._choiceOrientation;
  }

  // displayCategory (display items only)
  if (node.itemType === 'display' && _pending.draftDisplayCategory) {
    node._displayCategory = _pending.draftDisplayCategory;
  } else {
    delete node._displayCategory;
  }

  // maxFileSizeMB (attachment items only)
  if (node.itemType === 'attachment' && _pending.draftMaxFileSizeMB !== '') {
    const mb = parseFloat(_pending.draftMaxFileSizeMB);
    if (!isNaN(mb) && mb > 0) node._maxFileSizeMB = mb; else delete node._maxFileSizeMB;
  } else {
    delete node._maxFileSizeMB;
  }

  // mimeTypes (attachment items only)
  if (node.itemType === 'attachment') {
    const mimes = _pending.draftMimeTypes.split(',').map(s => s.trim()).filter(s => s.length > 0);
    if (mimes.length) node._mimeTypes = mimes; else delete node._mimeTypes;
  } else {
    delete node._mimeTypes;
  }

  // openLabel (open-choice items only)
  if (node.itemType === 'open-choice' && _pending.draftOpenLabel.trim()) {
    node._openLabel = _pending.draftOpenLabel.trim();
  } else {
    delete node._openLabel;
  }

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
