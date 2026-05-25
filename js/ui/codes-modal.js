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
import { createCustomSelect } from './custom-select.js';

// ── Unknown extension helpers ─────────────────────────────────────────────────────

const EXT_VALUE_TYPES = [
  'valueString', 'valueBoolean', 'valueInteger', 'valueDecimal',
  'valueCode', 'valueUri', 'valueUrl', 'valueDate', 'valueDateTime', 'valueTime',
  'valueCoding', 'valueCodeableConcept', 'valueQuantity',
  'valueExpression', 'valueReference',
];

const _COMPLEX = new Set([
  'valueCoding', 'valueCodeableConcept', 'valueQuantity',
  'valueExpression', 'valueReference',
]);
const _BOOL  = new Set(['valueBoolean']);
const _INT   = new Set(['valueInteger', 'valueUnsignedInt', 'valuePositiveInt']);
const _DEC   = new Set(['valueDecimal']);

// Parse a raw FHIR extension object into a mutable draft {url, valueType, valueRaw}
function _extToDraft(ext) {
  const url = ext.url || '';
  const valueKey = Object.keys(ext).find(k => k !== 'url');
  if (!valueKey) return { url, valueType: 'valueString', valueRaw: '' };
  const val = ext[valueKey];
  const valueRaw = (val !== null && typeof val === 'object')
    ? JSON.stringify(val, null, 2)
    : String(val ?? '');
  return { url, valueType: valueKey, valueRaw };
}

// Reconstruct a FHIR extension object from a draft; returns null for blank/invalid
function _draftToExt({ url, valueType, valueRaw }) {
  if (!url.trim() || !valueType) return null;
  let value;
  if (_COMPLEX.has(valueType)) {
    try { value = JSON.parse(valueRaw); } catch { return null; }
  } else if (_BOOL.has(valueType)) {
    value = valueRaw === 'true';
  } else if (_INT.has(valueType)) {
    const n = parseInt(valueRaw, 10);
    if (isNaN(n)) return null;
    value = n;
  } else if (_DEC.has(valueType)) {
    const n = parseFloat(valueRaw);
    if (isNaN(n)) return null;
    value = n;
  } else {
    value = valueRaw;
  }
  return { url: url.trim(), [valueType]: value };
}

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
    codes:             JSON.parse(JSON.stringify(node._codes || [])),
    definition:        node._definition || '',
    supportLinks:      (node._supportLinks || []).slice(),
    unknownExtensions: (node._unknownExtensions || []).map(_extToDraft),
  };
  setModalTitle(_el.title, 'Item Properties', node.title || node.id || 'Item');
  _renderBody(_pending, _el.body);
  openModal(_el.modal);
}

function _apply() {
  if (!_pending) return;
  const { node, codes, definition, supportLinks, unknownExtensions, link, setActive } = _pending;

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

  // unknown extensions: convert each draft back to a FHIR extension object
  const parsedExts = unknownExtensions.map(_draftToExt).filter(Boolean);
  if (parsedExts.length) node._unknownExtensions = parsedExts;
  else delete node._unknownExtensions;

  const isActive = !!(node._codes?.length) || !!node._definition ||
                   !!(node._supportLinks?.length) || !!(node._unknownExtensions?.length);
  setActive(link, isActive);
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
  defLbl.dataset.tipTitle = 'Item definition';
  defLbl.dataset.tipBody  = 'URL that identifies a specific element of a FHIR StructureDefinition this item maps to. Used for structured data capture profiling.';
  defLbl.dataset.tipFhir  = 'Questionnaire.item.definition';
  defLbl.dataset.tipSpec  = 'R4';

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
  codesToggle.dataset.tipTitle = 'Item codes';
  codesToggle.dataset.tipBody  = 'Coding(s) that identify the meaning of this question in a clinical terminology (e.g. LOINC, SNOMED CT).';
  codesToggle.dataset.tipFhir  = 'Questionnaire.item.code';
  codesToggle.dataset.tipSpec  = 'R4';
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
  slToggle.dataset.tipTitle = 'Support links';
  slToggle.dataset.tipBody  = 'URLs shown as "More info ↗" buttons in patient-facing view. Useful for linking to help pages or patient education material.';
  slToggle.dataset.tipFhir  = 'item.extension[questionnaire-supportLink].valueUri';
  slToggle.dataset.tipSpec  = 'R4';
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

  // ── Unknown Extensions (collapsible) ───────────────────────────────────────────────
  const extSection = document.createElement('div');
  extSection.className = 'meta-modal-advanced';

  const extToggle = document.createElement('button');
  extToggle.type      = 'button';
  extToggle.className = 'meta-modal-adv-toggle';
  extToggle.dataset.testid = 'item-props-ext-toggle';
  extToggle.dataset.tipTitle = 'Custom extensions';
  extToggle.dataset.tipBody  = 'Pass-through FHIR extensions not natively supported by the builder. Preserved as-is in the exported Questionnaire JSON.';
  extToggle.dataset.tipFhir  = 'Questionnaire.item.extension[]';
  extToggle.dataset.tipSpec  = 'R4';
  let extOpen = pending.unknownExtensions.length > 0;

  const extBody = document.createElement('div');
  extBody.className = 'meta-modal-adv-body';
  extBody.style.display = extOpen ? '' : 'none';

  const _setExtLabel = () => {
    const count = pending.unknownExtensions.filter(d => d.url.trim()).length;
    const badge = count ? ` (${count})` : '';
    extToggle.textContent = (extOpen ? '\u25BC' : '\u25BA') + ' Extensions' + badge;
  };

  const _renderExtRows = () => {
    extBody.innerHTML = '';

    if (pending.unknownExtensions.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'codes-empty-msg';
      empty.textContent = 'No custom extensions. Add one below.';
      extBody.appendChild(empty);
    }

    pending.unknownExtensions.forEach((draft, idx) => {
      const card = document.createElement('div');
      card.className = 'ext-card';

      // ─ URL row ──────────────────────────────────────────────────────
      const urlRow = document.createElement('div');
      urlRow.className = 'ext-url-row';

      const urlInp = document.createElement('input');
      urlInp.type = 'text';
      urlInp.className = 'ext-url-input';
      urlInp.placeholder = 'http://example.com/fhir/StructureDefinition/ext-name';
      urlInp.dataset.testid = `item-props-ext-url-${idx}`;
      urlInp.value = draft.url;
      urlInp.oninput = () => { pending.unknownExtensions[idx].url = urlInp.value; _setExtLabel(); };

      const rmBtn = document.createElement('button');
      rmBtn.type = 'button';
      rmBtn.className = 'codes-remove-btn';
      rmBtn.textContent = '\u00D7';
      rmBtn.dataset.tipTitle = 'Remove';
      rmBtn.dataset.testid = `item-props-ext-rm-${idx}`;
      rmBtn.onclick = () => { pending.unknownExtensions.splice(idx, 1); _renderExtRows(); _setExtLabel(); };

      urlRow.append(urlInp, rmBtn);

      // ─ Type row ──────────────────────────────────────────────────
      const typeRow = document.createElement('div');
      typeRow.className = 'ext-type-row';

      const typeLbl = document.createElement('span');
      typeLbl.className = 'ext-field-lbl';
      typeLbl.textContent = 'Type';

      const typeItems = (EXT_VALUE_TYPES.includes(draft.valueType)
        ? EXT_VALUE_TYPES
        : [...EXT_VALUE_TYPES, draft.valueType]
      ).map(t => ({ value: t, label: _COMPLEX.has(t) ? t + ' (JSON)' : t }));

      const typeSel = createCustomSelect({
        items:    typeItems,
        value:    draft.valueType,
        testid:   `item-props-ext-type-${idx}`,
        className: 'sc-trigger--sm ext-type-trigger',
      });

      typeRow.append(typeLbl, typeSel.el);

      // ─ Value row ────────────────────────────────────────────────
      const valRow = document.createElement('div');
      valRow.className = 'ext-val-row';

      const valLbl = document.createElement('span');
      valLbl.className = 'ext-field-lbl';
      valLbl.textContent = 'Value';

      const valContainer = document.createElement('div');
      valContainer.className = 'ext-val-container';

      const _renderValInput = (valueType, valueRaw) => {
        valContainer.innerHTML = '';
        if (_BOOL.has(valueType)) {
          const boolSel = createCustomSelect({
            items:    [{ value: 'true', label: 'true' }, { value: 'false', label: 'false' }],
            value:    valueRaw === 'false' ? 'false' : 'true',
            testid:   `item-props-ext-val-${idx}`,
            className: 'sc-trigger--sm',
            onChange: v => { pending.unknownExtensions[idx].valueRaw = v; },
          });
          valContainer.appendChild(boolSel.el);
        } else if (_COMPLEX.has(valueType) || valueType === 'valueString') {
          const ta = document.createElement('textarea');
          ta.className = 'ext-val-textarea';
          ta.rows = _COMPLEX.has(valueType) ? 3 : 1;
          ta.spellcheck = false;
          ta.dataset.testid = `item-props-ext-val-${idx}`;
          ta.placeholder = _COMPLEX.has(valueType) ? 'JSON object…' : 'value';
          ta.value = valueRaw;
          ta.oninput = () => { pending.unknownExtensions[idx].valueRaw = ta.value; };
          valContainer.appendChild(ta);
        } else {
          const inp = document.createElement('input');
          inp.type = (_INT.has(valueType) || _DEC.has(valueType)) ? 'number' : 'text';
          if (_DEC.has(valueType)) inp.step = 'any';
          inp.className = 'ext-val-input';
          inp.dataset.testid = `item-props-ext-val-${idx}`;
          inp.placeholder = 'value';
          inp.value = valueRaw;
          inp.oninput = () => { pending.unknownExtensions[idx].valueRaw = inp.value; };
          valContainer.appendChild(inp);
        }
      };

      _renderValInput(draft.valueType, draft.valueRaw);

      typeSel.setOnChange((newType) => {
        pending.unknownExtensions[idx].valueType = newType;
        pending.unknownExtensions[idx].valueRaw  = '';
        _renderValInput(newType, '');
      });

      valRow.append(valLbl, valContainer);
      card.append(urlRow, typeRow, valRow);
      extBody.appendChild(card);
    });

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'codes-add-btn';
    addBtn.dataset.testid = 'item-props-ext-add';
    addBtn.textContent = '+ Add extension';
    addBtn.onclick = () => {
      pending.unknownExtensions.push({ url: '', valueType: 'valueString', valueRaw: '' });
      _renderExtRows();
      _setExtLabel();
      extBody.querySelector('[data-testid^="item-props-ext-url-"]:last-of-type')?.focus();
    };
    extBody.appendChild(addBtn);
  };

  _renderExtRows();
  _setExtLabel();

  extToggle.addEventListener('click', () => {
    extOpen = !extOpen;
    extBody.style.display = extOpen ? '' : 'none';
    _setExtLabel();
  });

  extSection.append(extToggle, extBody);
  container.appendChild(extSection);
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
    removeBtn.dataset.tipTitle = 'Remove';
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
