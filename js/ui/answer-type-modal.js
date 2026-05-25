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

import { questContained, tree, values, deleteValue } from '../state.js';
import { resolveContainedValueSet } from '../fhir/import.js';
import { triggerCalcRecalc, renderTree } from '../builder/_shared.js';
import { createItemNode } from '../nodes/index.js';
import { createCustomSelect } from './custom-select.js';
import { initModal, setModalTitle, openModal, closeModal } from './modal-base.js';
import {
  CHOICE_TYPES, ENTRY_FORMAT_TYPES, NUMERIC_TYPES,
  ITEM_TYPES, FHIR_R4_TYPES, BUILDER_UNITS,
  _optsWithOrdinals, _parseOptsWithOrdinals,
} from './answer-type-data.js';

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

// ── body renderer ─────────────────────────────────────────────────────────────

function _renderBody(container) {
  const hint = document.createElement('div');
  hint.className   = 'panel-hint';
  hint.textContent = 'Sets the FHIR item type. For coded-answer types you can supply a plain options list or link to a contained[] ValueSet.';
  container.appendChild(hint);

  // openLabelSection reference — declared here so the typeSel onChange closure can update it
  let openLabelSection;

  // ── Type selector ─────────────────────────────────────────────────────────
  const typeRow = document.createElement('div');
  typeRow.className = 'at-modal-type-row';
  const typeLbl = document.createElement('label');
  typeLbl.className = 'at-modal-lbl';
  typeLbl.textContent = 'Type:';
  typeLbl.dataset.tipTitle = 'Item type';
  typeLbl.dataset.tipBody  = 'The FHIR data type for answers to this item. Determines which control is rendered in the preview.';
  typeLbl.dataset.tipFhir  = 'Questionnaire.item.type';
  typeLbl.dataset.tipSpec  = 'R4';
  const typeSel = createCustomSelect({
    items:     ITEM_TYPES.map(t => ({ value: t, label: t })),
    value:     _pending.draftType,
    className: 'at-modal-type-sel sc-trigger--full',
    testid:    'type-select',
    onChange:  v => {
      _pending.draftType = v;
      choiceSection.style.display      = CHOICE_TYPES.has(_pending.draftType) ? 'block' : 'none';
      refSection.style.display         = _pending.draftType === 'reference'   ? 'block' : 'none';
      unitSection.style.display        = _pending.draftType === 'quantity'    ? 'block' : 'none';
      numericSection.style.display     = (_pending.draftType === 'integer' || _pending.draftType === 'decimal') ? 'block' : 'none';
      placeholderSection.style.display = ENTRY_FORMAT_TYPES.has(_pending.draftType) ? 'block' : 'none';
      orientationSection.style.display  = _pending.draftType === 'radio'      ? 'block' : 'none';
      displayCatSection.style.display   = _pending.draftType === 'display'    ? 'block' : 'none';
      attachSection.style.display       = _pending.draftType === 'attachment' ? 'block' : 'none';
      if (openLabelSection) openLabelSection.style.display = _pending.draftType === 'open-choice' ? 'block' : 'none';
    },
  });
  typeRow.appendChild(typeLbl);
  typeRow.appendChild(typeSel.el);
  container.appendChild(typeRow);

  // ── Choice-type: answer source section ────────────────────────────────────
  const choiceSection = document.createElement('div');
  choiceSection.style.display = CHOICE_TYPES.has(_pending.draftType) ? 'block' : 'none';
  container.appendChild(choiceSection);

  // "Answer source" radio toggle
  const sourceRow = document.createElement('div');
  sourceRow.className = 'at-modal-source-row';

  const optRadio = Object.assign(document.createElement('input'), { type: 'radio', name: '_at_src', id: '_at_src_opt', value: 'options', checked: !_pending.draftAVS });
  const avsRadio = Object.assign(document.createElement('input'), { type: 'radio', name: '_at_src', id: '_at_src_avs', value: 'valueset', checked: !!_pending.draftAVS });
  const optLbl   = Object.assign(document.createElement('label'), { htmlFor: '_at_src_opt', textContent: 'Options list', className: 'at-modal-src-lbl' });
  const avsLbl   = Object.assign(document.createElement('label'), { htmlFor: '_at_src_avs', textContent: 'ValueSet (answerValueSet)', className: 'at-modal-src-lbl' });

  sourceRow.append(optRadio, optLbl, avsRadio, avsLbl);
  choiceSection.appendChild(sourceRow);

  // ── Options sub-section ───────────────────────────────────────────────────
  const optSection = document.createElement('div');
  optSection.className = 'at-modal-sub';
  optSection.style.display = !_pending.draftAVS ? 'block' : 'none';

  const optSubLbl = document.createElement('div');
  optSubLbl.className   = 'at-modal-sub-lbl';
  optSubLbl.textContent = 'Options (code=Label or code=Label=score, comma-separated):';
  optSubLbl.dataset.tipTitle = 'Answer options';
  optSubLbl.dataset.tipBody  = 'Coded answer choices. Format: code=Label or code=Label=score (ordinal value). Comma-separated. Exported as item.answerOption[].';
  optSubLbl.dataset.tipFhir  = 'Questionnaire.item.answerOption[].valueCoding';
  optSubLbl.dataset.tipSpec  = 'R4';

  const optInp = document.createElement('textarea');
  optInp.className   = 'at-modal-opt-inp';
  optInp.dataset.testid = 'options-input';
  optInp.value       = _pending.draftOptions;
  optInp.placeholder = 'e.g. la1=Not at all=0,la2=Several days=1,la3=Always=2';
  optInp.rows        = 1;
  optInp.oninput = () => { _pending.draftOptions = optInp.value; };

  optSection.append(optSubLbl, optInp);

  // Prefixes sub-field (questionnaire-optionPrefix)
  const pfxSubLbl = document.createElement('div');
  pfxSubLbl.className   = 'at-modal-sub-lbl';
  pfxSubLbl.textContent = 'Prefixes (code=Prefix, ...)';
  pfxSubLbl.dataset.tipTitle = 'Option prefixes';
  pfxSubLbl.dataset.tipBody  = 'Display prefix shown before each answer label (e.g. A., 1.). Exported as questionnaire-optionPrefix extension on each answerOption.';
  pfxSubLbl.dataset.tipFhir  = 'Questionnaire.item.answerOption[].extension[questionnaire-optionPrefix]';
  pfxSubLbl.dataset.tipSpec  = 'R4';

  const pfxInp = document.createElement('input');
  pfxInp.type        = 'text';
  pfxInp.className   = 'at-modal-opt-inp';
  pfxInp.dataset.testid = 'option-prefix-input';
  pfxInp.value       = _pending.draftPrefixes;
  pfxInp.placeholder = 'e.g. la1=A.,la2=B.,la3=C.';
  pfxInp.oninput = () => { _pending.draftPrefixes = pfxInp.value; };

  optSection.append(pfxSubLbl, pfxInp);
  choiceSection.appendChild(optSection);

  // ── ValueSet sub-section ──────────────────────────────────────────────────
  const avsSection = document.createElement('div');
  avsSection.className = 'at-modal-sub';
  avsSection.style.display = _pending.draftAVS ? 'block' : 'none';

  const avsSubLbl = document.createElement('div');
  avsSubLbl.className   = 'at-modal-sub-lbl';
  avsSubLbl.textContent = 'ValueSet — select from contained[] or enter an external URL:';
  avsSubLbl.dataset.tipTitle = 'Answer ValueSet';
  avsSubLbl.dataset.tipBody  = 'Links coded answers to a FHIR ValueSet. Use a #id to reference a local contained[] ValueSet, or a full URL for an external terminology server.';
  avsSubLbl.dataset.tipFhir  = 'Questionnaire.item.answerValueSet';
  avsSubLbl.dataset.tipSpec  = 'R4';

  // Dropdown of contained ValueSets
  const containedVS = [...questContained].filter(r => r.resourceType === 'ValueSet');

  const avsItems = [
    { value: '', label: '\u2014 none \u2014' },
    ...containedVS.map(vs => ({ value: '#' + vs.id, label: '#' + vs.id + (vs.title ? ' \u2014 ' + vs.title : '') })),
    { value: '__ext__', label: '\u2014 external URL \u2014' },
  ];
  const isExternalAVS = !!_pending.draftAVS && !_pending.draftAVS.startsWith('#');
  const avsInitVal = isExternalAVS ? '__ext__' : (_pending.draftAVS || '');

  const avsDrop = createCustomSelect({
    items:     avsItems,
    value:     avsInitVal,
    className: 'at-modal-avs-drop sc-trigger--full',
    testid:    'avs-select',
    onChange:  v => {
      if (v === '__ext__') {
        avsUrlInp.style.display = 'block';
        _pending.draftAVS = avsUrlInp.value.trim();
      } else {
        avsUrlInp.style.display = 'none';
        _pending.draftAVS = v;
      }
    },
  });

  // Free-text input for external URLs
  const avsUrlInp = document.createElement('input');
  avsUrlInp.type        = 'text';
  avsUrlInp.className   = 'at-modal-avs-url';
  avsUrlInp.dataset.testid = 'avs-url-input';
  avsUrlInp.value       = isExternalAVS ? _pending.draftAVS : '';
  avsUrlInp.placeholder = 'http://terminology.hl7.org/ValueSet/...';
  avsUrlInp.style.display = isExternalAVS ? 'block' : 'none';
  avsUrlInp.oninput = () => { _pending.draftAVS = avsUrlInp.value.trim(); };

  avsSection.append(avsSubLbl, avsDrop.el, avsUrlInp);
  choiceSection.appendChild(avsSection);

  // ── openLabel sub-section (open-choice only) ──────────────────────────────
  openLabelSection = document.createElement('div');
  openLabelSection.className = 'at-modal-sub';
  openLabelSection.style.display = _pending.draftType === 'open-choice' ? 'block' : 'none';

  const olSubLbl = document.createElement('div');
  olSubLbl.className   = 'at-modal-sub-lbl';
  olSubLbl.textContent = 'Open label (Other prompt):';
  olSubLbl.dataset.tipTitle = 'Open-choice label';
  olSubLbl.dataset.tipBody  = 'Custom label for the free-text entry in this open-choice control. Replaces the default "Choose or type\u2026" placeholder.';
  olSubLbl.dataset.tipFhir  = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-openLabel';
  olSubLbl.dataset.tipSpec  = 'SDC';

  const olInp = document.createElement('input');
  olInp.type        = 'text';
  olInp.className   = 'at-modal-opt-inp';
  olInp.dataset.testid = 'open-label-input';
  olInp.value       = _pending.draftOpenLabel;
  olInp.placeholder = 'e.g. Other (please specify)';
  olInp.oninput = () => { _pending.draftOpenLabel = olInp.value; };

  openLabelSection.append(olSubLbl, olInp);
  choiceSection.appendChild(openLabelSection);

  // Wire radio toggles
  optRadio.onchange = () => {
    if (optRadio.checked) {
      optSection.style.display = 'block';
      avsSection.style.display = 'none';
      _pending.draftAVS = '';
    }
  };
  avsRadio.onchange = () => {
    if (avsRadio.checked) {
      optSection.style.display = 'none';
      avsSection.style.display = 'block';
      // Auto-select first contained ValueSet if nothing set yet
      if (!_pending.draftAVS) {
        if (containedVS.length) {
          _pending.draftAVS = '#' + containedVS[0].id;
          avsDrop.setValue('#' + containedVS[0].id);
        } else {
          avsDrop.setValue('__ext__');
          avsUrlInp.style.display = 'block';
          _pending.draftAVS = '';
        }
      }
    }
  };

  // ── Reference resource type ───────────────────────────────────────────────
  const refSection = document.createElement('div');
  refSection.className = 'at-modal-sub';
  refSection.style.display = _pending.draftType === 'reference' ? 'block' : 'none';

  const refLbl = document.createElement('div');
  refLbl.className   = 'at-modal-sub-lbl';
  refLbl.textContent = 'Allowed resource type:';
  refLbl.dataset.tipTitle = 'Reference resource type';
  refLbl.dataset.tipBody  = 'Restricts which FHIR resource types are valid answer references. Leave blank to allow any type.';
  refLbl.dataset.tipFhir  = 'item.extension[questionnaire-referenceResource].valueCode';
  refLbl.dataset.tipSpec  = 'R4';

  const refSel = createCustomSelect({
    items:     [
      { value: '', label: '\u2014 Any (unrestricted) \u2014' },
      ...[...new Set(FHIR_R4_TYPES)].sort().map(t => ({ value: t, label: t })),
    ],
    value:     _pending.draftRefRes || '',
    className: 'at-modal-sub-sel sc-trigger--full',
    testid:    'ref-resource-sel',
    onChange:  v => { _pending.draftRefRes = v; },
  });

  refSection.append(refLbl, refSel.el);
  container.appendChild(refSection);

  // ── Quantity unit ─────────────────────────────────────────────────────────
  const unitSection = document.createElement('div');
  unitSection.className = 'at-modal-sub';
  unitSection.style.display = _pending.draftType === 'quantity' ? 'block' : 'none';

  const unitLbl = document.createElement('div');
  unitLbl.className   = 'at-modal-sub-lbl';
  unitLbl.textContent = 'Default unit:';
  unitLbl.dataset.tipTitle = 'Quantity unit';
  unitLbl.dataset.tipBody  = 'Default UCUM unit code for this measurement field. Shown next to the numeric input in the preview.';
  unitLbl.dataset.tipFhir  = 'item.extension[questionnaire-unit].valueCoding.code';
  unitLbl.dataset.tipSpec  = 'R4';

  const unitSel = createCustomSelect({
    items:     [
      { value: '', label: '\u2014 none \u2014' },
      ...BUILDER_UNITS.map(u => ({ value: u, label: u })),
    ],
    value:     _pending.draftUnit || '',
    className: 'at-modal-sub-sel sc-trigger--full',
    testid:    'unit-sel',
    onChange:  v => { _pending.draftUnit = v; },
  });

  unitSection.append(unitLbl, unitSel.el);
  container.appendChild(unitSection);

  // ── Numeric constraints (integer / decimal) ───────────────────────────────
  const numericSection = document.createElement('div');
  numericSection.className = 'at-modal-sub';
  numericSection.style.display = (_pending.draftType === 'integer' || _pending.draftType === 'decimal') ? 'block' : 'none';

  const numericHdr = document.createElement('div');
  numericHdr.className   = 'at-modal-sub-lbl';
  numericHdr.textContent = 'Numeric constraints:';
  numericHdr.dataset.tipTitle = 'Numeric constraints';
  numericHdr.dataset.tipBody  = 'Sets the allowed value range. Violations show an error badge in preview and are enforced in QR export.';
  numericHdr.dataset.tipFhir  = 'item.extension[minValue] / item.extension[maxValue]';
  numericHdr.dataset.tipSpec  = 'R4';

  const numericGrid = document.createElement('div');
  numericGrid.className = 'at-modal-num-grid';

  const _numField = (lbl, tid, initVal, onInput) => {
    const fw = document.createElement('div');
    fw.className = 'at-modal-num-field';
    const la = document.createElement('label');
    la.className   = 'at-modal-num-lbl';
    la.textContent = lbl;
    const inp = document.createElement('input');
    inp.type = 'number'; inp.step = 'any';
    inp.className = 'at-modal-num-inp';
    inp.dataset.testid = tid;
    inp.value = initVal;
    inp.placeholder = '—';
    inp.oninput = () => onInput(inp.value);
    fw.append(la, inp);
    return fw;
  };

  numericGrid.appendChild(_numField('Min', 'min-value-input', _pending.draftMinValue, v => { _pending.draftMinValue = v; }));
  numericGrid.appendChild(_numField('Max', 'max-value-input', _pending.draftMaxValue, v => { _pending.draftMaxValue = v; }));

  // ── "Render as slider" toggle + step field ────────────────────────────────
  const sliderRow = document.createElement('div');
  sliderRow.className = 'at-modal-slider-row';

  const sliderChk = document.createElement('input');
  sliderChk.type = 'checkbox';
  sliderChk.dataset.testid = 'slider-toggle';
  sliderChk.checked = _pending.draftSliderStep !== '';

  const sliderChkLbl = document.createElement('label');
  sliderChkLbl.className = 'at-modal-slider-lbl';
  sliderChkLbl.textContent = 'Render as slider';
  sliderChkLbl.dataset.tipTitle = 'Slider';
  sliderChkLbl.dataset.tipBody  = 'Renders the numeric input as a range slider. The step value sets the slider increment. Exported as questionnaire-sliderStepValue.';
  sliderChkLbl.dataset.tipFhir  = 'item.extension[questionnaire-sliderStepValue].valueDecimal';
  sliderChkLbl.dataset.tipSpec  = 'SDC';

  const stepWrap = _numField('Step', 'slider-step-input',
    _pending.draftSliderStep !== '' ? _pending.draftSliderStep : '1',
    v => { _pending.draftSliderStep = v; });
  stepWrap.style.display = sliderChk.checked ? 'flex' : 'none';

  sliderChk.onchange = () => {
    if (sliderChk.checked) {
      if (!_pending.draftSliderStep) _pending.draftSliderStep = '1';
      stepWrap.querySelector('input').value = _pending.draftSliderStep;
      stepWrap.style.display = 'flex';
    } else {
      _pending.draftSliderStep = '';
      stepWrap.style.display = 'none';
    }
  };

  sliderRow.append(sliderChk, sliderChkLbl, stepWrap);

  const numericHint = document.createElement('div');
  numericHint.className   = 'at-modal-num-hint';
  numericHint.textContent = 'Min / Max set HTML constraints and show error badge in the preview.';

  numericSection.append(numericHdr, numericGrid, sliderRow, numericHint);
  container.appendChild(numericSection);

  // ── Placeholder hint (entryFormat) ────────────────────────────────────────
  const placeholderSection = document.createElement('div');
  placeholderSection.className = 'at-modal-sub';
  placeholderSection.style.display = ENTRY_FORMAT_TYPES.has(_pending.draftType) ? 'block' : 'none';

  const placeholderLbl = document.createElement('div');
  placeholderLbl.className   = 'at-modal-sub-lbl at-modal-sub-lbl--tip';
  placeholderLbl.textContent = 'Placeholder hint (entryFormat):';
  placeholderLbl.dataset.tipTitle = 'Entry Format';
  placeholderLbl.dataset.tipBody  = 'Text shown inside the input field before the user types. Guides the expected format (e.g. MM/DD/YYYY, (999) 999-9999). Exported as the sdc-questionnaire-entryFormat SDC extension.';
  placeholderLbl.dataset.tipFhir  = 'item.extension[sdc-questionnaire-entryFormat].valueString';
  placeholderLbl.dataset.tipSpec  = 'SDC';

  const placeholderInp = document.createElement('input');
  placeholderInp.type        = 'text';
  placeholderInp.className   = 'at-modal-placeholder-inp';
  placeholderInp.dataset.testid = 'entry-format-input';
  placeholderInp.value       = _pending.draftEntryFormat;
  placeholderInp.placeholder = 'e.g. MM/DD/YYYY, (999) 999-9999';
  placeholderInp.oninput = () => { _pending.draftEntryFormat = placeholderInp.value; };

  placeholderSection.append(placeholderLbl, placeholderInp);
  container.appendChild(placeholderSection);

  // ── Choice orientation (radio only) ──────────────────────────────────────
  const orientationSection = document.createElement('div');
  orientationSection.className = 'at-modal-sub';
  orientationSection.style.display = _pending.draftType === 'radio' ? 'block' : 'none';

  const orientLbl = document.createElement('div');
  orientLbl.className   = 'at-modal-sub-lbl at-modal-sub-lbl--tip';
  orientLbl.textContent = 'Choice orientation:';
  orientLbl.dataset.tipTitle = 'Choice Orientation';
  orientLbl.dataset.tipBody  = 'Controls whether radio buttons are stacked vertically or placed side by side horizontally. Exported as the questionnaire-choiceOrientation extension.';
  orientLbl.dataset.tipFhir  = 'item.extension[questionnaire-choiceOrientation].valueCode';
  orientLbl.dataset.tipSpec  = 'R4';

  const orientSel = createCustomSelect({
    items: [
      { value: '',           label: '\u2014 default \u2014' },
      { value: 'vertical',   label: 'Vertical (stacked)' },
      { value: 'horizontal', label: 'Horizontal (inline)' },
    ],
    value:     _pending.draftOrientation,
    className: 'at-modal-sub-sel sc-trigger--full',
    testid:    'orientation-select',
    onChange:  v => { _pending.draftOrientation = v; },
  });

  orientationSection.append(orientLbl, orientSel.el);
  container.appendChild(orientationSection);

  // ── Display category (display items only) ──────────────────────────────────
  const displayCatSection = document.createElement('div');
  displayCatSection.className = 'at-modal-sub';
  displayCatSection.style.display = _pending.draftType === 'display' ? 'block' : 'none';

  const displayCatLbl = document.createElement('div');
  displayCatLbl.className   = 'at-modal-sub-lbl at-modal-sub-lbl--tip';
  displayCatLbl.textContent = 'Display category:';
  displayCatLbl.dataset.tipTitle = 'Display Category';
  displayCatLbl.dataset.tipBody  = 'Controls the visual style of this display item. "Instructions" shows an info block, "Security" shows a warning notice, "Help" renders as a collapsible help toggle.';
  displayCatLbl.dataset.tipFhir  = 'item.extension[questionnaire-displayCategory].valueCodeableConcept.coding[0].code';
  displayCatLbl.dataset.tipSpec  = 'R4';

  const displayCatSel = createCustomSelect({
    items: [
      { value: '',             label: '\u2014 none \u2014' },
      { value: 'instructions', label: 'Instructions (\u2139 info block)' },
      { value: 'security',     label: 'Security notice (\u26A0 warning)' },
      { value: 'help',         label: 'Help (? collapsible)' },
    ],
    value:     _pending.draftDisplayCategory,
    className: 'at-modal-sub-sel sc-trigger--full',
    testid:    'display-category-select',
    onChange:  v => { _pending.draftDisplayCategory = v; },
  });

  displayCatSection.append(displayCatLbl, displayCatSel.el);
  container.appendChild(displayCatSection);

  // ── Attachment: max file size ─────────────────────────────────────────────
  const attachSection = document.createElement('div');
  attachSection.className = 'at-modal-sub';
  attachSection.style.display = _pending.draftType === 'attachment' ? 'block' : 'none';

  const maxSizeLbl = document.createElement('div');
  maxSizeLbl.className   = 'at-modal-sub-lbl at-modal-sub-lbl--tip';
  maxSizeLbl.textContent = 'Max file size (MB):';
  maxSizeLbl.dataset.tipTitle = 'Maximum file size';
  maxSizeLbl.dataset.tipBody  = 'Maximum allowed file size in megabytes. Validated when the user selects a file in preview. Exported as the maxSize FHIR extension (valueDecimal).';
  maxSizeLbl.dataset.tipFhir  = 'item.extension[maxSize].valueDecimal';
  maxSizeLbl.dataset.tipSpec  = 'R4';

  const maxSizeInp = document.createElement('input');
  maxSizeInp.type = 'number';
  maxSizeInp.min = '0.01';
  maxSizeInp.step = 'any';
  maxSizeInp.className = 'at-modal-num-inp';
  maxSizeInp.dataset.testid = 'max-file-size-input';
  maxSizeInp.value = _pending.draftMaxFileSizeMB;
  maxSizeInp.placeholder = 'e.g. 5';
  maxSizeInp.oninput = () => { _pending.draftMaxFileSizeMB = maxSizeInp.value; };

  attachSection.append(maxSizeLbl, maxSizeInp);

  const mimeTypesLbl = document.createElement('div');
  mimeTypesLbl.className   = 'at-modal-sub-lbl at-modal-sub-lbl--tip';
  mimeTypesLbl.textContent = 'Allowed MIME types:';
  mimeTypesLbl.dataset.tipTitle = 'Allowed MIME types';
  mimeTypesLbl.dataset.tipBody  = 'Comma-separated list of accepted MIME types (e.g. image/jpeg, application/pdf). Sets the accept attribute on the file input. Exported as one mimeType extension entry per value.';
  mimeTypesLbl.dataset.tipFhir  = 'item.extension[mimeType].valueCode';
  mimeTypesLbl.dataset.tipSpec  = 'R4';

  const mimeTypesInp = document.createElement('input');
  mimeTypesInp.type = 'text';
  mimeTypesInp.className = 'at-modal-placeholder-inp';
  mimeTypesInp.dataset.testid = 'mime-types-input';
  mimeTypesInp.value = _pending.draftMimeTypes;
  mimeTypesInp.placeholder = 'e.g. image/*,application/pdf';
  mimeTypesInp.rows = 1;
  mimeTypesInp.oninput = () => { _pending.draftMimeTypes = mimeTypesInp.value; };

  attachSection.append(mimeTypesLbl, mimeTypesInp);
  container.appendChild(attachSection);
}
