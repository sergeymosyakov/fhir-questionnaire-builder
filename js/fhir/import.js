// ── FHIR R4 Questionnaire import ──────────────────────────────────────────────
import { tree, makeGroup, makeItem, resetSeq, rawFhir, questVariables, questContained, questMeta, setValue, clearAllValues } from '../state.js';
import { _bulkUpdate } from '../render-bus.js';
import { renderTree } from '../render-builder.js';
import { ITLH_KEY_GROUP_OR } from '../utils.js';
import { normaliseSTU3 } from './stu3-shim.js';

// ── Known extension URLs — any item.extension[] entry NOT in this set is
// collected into node._unknownExtensions for pass-through round-tripping.
export const KNOWN_ITEM_EXTENSION_URLS = new Set([
  'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-enableWhenExpression',
  'http://hl7.org/fhir/StructureDefinition/questionnaire-constraint',
  'http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl',
  'http://hl7.org/fhir/StructureDefinition/questionnaire-referenceResource',
  'http://hl7.org/fhir/StructureDefinition/questionnaire-unit',
  'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-calculatedExpression',
  'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-initialExpression',
  'http://hl7.org/fhir/StructureDefinition/minLength',
  'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-entryFormat',
  'http://hl7.org/fhir/StructureDefinition/entryFormat',
  'http://hl7.org/fhir/StructureDefinition/questionnaire-choiceOrientation',
  'http://hl7.org/fhir/StructureDefinition/questionnaire-displayCategory',
  'http://hl7.org/fhir/StructureDefinition/minValue',
  'http://hl7.org/fhir/StructureDefinition/maxValue',
  'http://hl7.org/fhir/StructureDefinition/questionnaire-minOccurs',
  'http://hl7.org/fhir/StructureDefinition/questionnaire-maxOccurs',
  'http://hl7.org/fhir/StructureDefinition/questionnaire-sliderStepValue',
  'http://hl7.org/fhir/StructureDefinition/questionnaire-supportLink',
  'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-hidden',
  'http://hl7.org/fhir/StructureDefinition/questionnaire-hidden',
  'http://hl7.org/fhir/5.0/StructureDefinition/extension-Questionnaire.item.disabledDisplay',
  'http://hl7.org/fhir/StructureDefinition/maxSize',
  'http://hl7.org/fhir/StructureDefinition/mimeType',
]);

function _collectUnknownExtensions(fhirItem) {
  const unknown = (fhirItem.extension || []).filter(e => !KNOWN_ITEM_EXTENSION_URLS.has(e.url));
  return unknown.length ? unknown.map(e => JSON.parse(JSON.stringify(e))) : null;
}

// Walk the tree and pre-populate values[] from node._initialValue / _initialValues
function applyInitialValues(nodes) {
  for (const node of nodes) {
    if (node.repeats && node._initialValues && node._initialValues.length > 1) {
      // Multiple initial values for a repeating item — populate repeat rows
      // $$n = number of extra rows (beyond the primary). Row 0 → base id, rows 1..n → $$1..$$n.
      setValue(node.id, node._initialValues[0]);
      for (let i = 1; i < node._initialValues.length; i++) {
        setValue(node.id + '$$' + i, node._initialValues[i]);
      }
      setValue(node.id + '$$n', node._initialValues.length - 1);
    } else if (node._initialValue !== undefined) {
      setValue(node.id, node._initialValue);
    }
    if (node.type === 'group') applyInitialValues(node.children);
  }
}

// FHIR item.type → our itemType
function fhirTypeToItemType(t) {
  if (t === 'boolean')                                  return 'checkbox';
  if (t === 'integer')                                        return 'integer';
  if (t === 'decimal')                                         return 'decimal';
  if (t === 'quantity')                                 return 'quantity';
  if (t === 'choice')                                   return 'select';
  if (t === 'open-choice')                              return 'open-choice';
  if (t === 'display')                                  return 'display';
  if (t === 'date')              return 'date';
  if (t === 'dateTime')          return 'dateTime';
  if (t === 'time')              return 'time';
  if (t === 'url')                                      return 'url';
  if (t === 'attachment')                               return 'attachment';
  if (t === 'reference')                                return 'reference';
  return 'text'; // string, text
}

// answerOption[] → comma-separated options string in "code=display" format.
function fhirOptsToStr(opts) {
  return (opts || []).map(o => {
    if (o.valueCoding) {
      const code    = o.valueCoding.code    || '';
      const display = o.valueCoding.display || '';
      if (code && display && code !== display) return code + '=' + display;
      return display || code;
    }
    return o.valueString || (o.valueInteger !== undefined ? String(o.valueInteger) : '');
  }).filter(Boolean).join(', ');
}

// Build linkId → question text map for human-friendly display
function buildLinkIdMap(items, map = {}) {
  for (const item of items || []) {
    map[item.linkId] = item.text || item.linkId || '';
    buildLinkIdMap(item.item, map);
  }
  return map;
}

// FHIR enableWhen[] -> human-readable label string
function humanEnableWhen(enableWhen, enableBehavior, linkIdMap) {
  if (!enableWhen || !enableWhen.length) return '';
  const joiner = enableBehavior === 'any' ? ' OR ' : ' AND ';
  const parts = enableWhen.map(ew => {
    const qText = (linkIdMap && linkIdMap[ew.question]) || ew.question;
    if (ew.operator === 'exists') return '\u00AB' + qText + '\u00BB has answer';
    let val;
    if      (ew.answerBoolean  !== undefined) val = ew.answerBoolean ? 'Yes' : 'No';
    else if (ew.answerString   !== undefined) val = '\u00AB' + ew.answerString + '\u00BB';
    else if (ew.answerInteger  !== undefined) val = ew.answerInteger;
    else if (ew.answerDecimal  !== undefined) val = ew.answerDecimal;
    else if (ew.answerCoding)                 val = ew.answerCoding.display || ew.answerCoding.code || '?';
    else val = '?';
    const opLabel = { '=': '=', '!=': '\u2260', '>': '>', '<': '<', '>=': '\u2265', '<=': '\u2264' }[ew.operator] || ew.operator;
    return '\u00AB' + qText + '\u00BB ' + opLabel + ' ' + val;
  });
  return parts.join(joiner);
}

// Apply enableWhen, enableBehavior, enableWhenExpression to a node from a FHIR item
function applyVisibility(node, fhirItem, linkIdMap) {
  // Standard enableWhen[] → stored structurally
  if (fhirItem.enableWhen && fhirItem.enableWhen.length) {
    node.enableWhen     = fhirItem.enableWhen.map(ew => ({ ...ew }));
    node.enableBehavior = fhirItem.enableBehavior === 'any' ? 'any' : 'all';
    node._enableWhenText = humanEnableWhen(fhirItem.enableWhen, fhirItem.enableBehavior, linkIdMap);
  }
  // SDC enableWhenExpression → FHIRPath condition
  const eweExt = (fhirItem.extension || []).find(
    e => e.url === 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-enableWhenExpression'
  );
  if (eweExt && eweExt.valueExpression) {
    node.enableWhenExpression = eweExt.valueExpression.expression || '';
  }
}

// Import FHIR questionnaire-constraint[] into node.constraint[]
// Returns true if the system OR-group key was detected (logicWithParent should be set to 'OR').
function applyConstraints(node, fhirItem) {
  const constraints = (fhirItem.extension || []).filter(
    e => e.url === 'http://hl7.org/fhir/StructureDefinition/questionnaire-constraint'
  );
  if (!constraints.length) return false;
  let hasOrGroup = false;
  node.constraint = constraints.map(ext => ({
    key:        ext.extension?.find(e => e.url === 'key')?.valueId || '',
    expression: ext.extension?.find(e => e.url === 'expression')?.valueString || '',
    human:      ext.extension?.find(e => e.url === 'human')?.valueString || '',
    severity:   ext.extension?.find(e => e.url === 'severity')?.valueCode || 'error',
  })).filter(c => {
    if (c.key === ITLH_KEY_GROUP_OR) { hasOrGroup = true; return false; }
    return c.expression;
  });
  return hasOrGroup;
}

// Extract options string from a contained[] ValueSet referenced by '#id'
export function resolveContainedValueSet(contained, ref) {
  if (!ref || !ref.startsWith('#')) return '';
  const id = ref.slice(1);
  const vs = (contained || []).find(r => r.resourceType === 'ValueSet' && r.id === id);
  if (!vs) return '';
  const parts = [];
  for (const inc of vs.compose?.include || []) {
    for (const c of inc.concept || []) {
      if (c.code) parts.push(c.code + (c.display ? '=' + c.display : ''));
    }
  }
  return parts.join(',');
}

// Build our item node from a FHIR leaf question
function fhirQuestionToItem(fhirItem, linkIdMap, contained) {
  const node = makeItem(fhirItem.text || fhirItem.linkId || 'Item');
  node.id        = fhirItem.linkId || node.id;
  node.mandatory = fhirItem.required === undefined ? null : !!fhirItem.required;
  node.itemType  = fhirTypeToItemType(fhirItem.type || 'string');

  // questionnaire-itemControl: radio-button → use 'radio' instead of 'select'
  if (node.itemType === 'select' || node.itemType === 'open-choice') {
    const itemCtrl = (fhirItem.extension || []).find(
      e => e.url === 'http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl'
    );
    const ctrlCode = itemCtrl?.valueCodeableConcept?.coding?.[0]?.code;
    if (ctrlCode === 'radio-button') node.itemType = 'radio';
  }

  node.options = fhirOptsToStr(fhirItem.answerOption);

  // ordinalValue — may sit on answerOption.extension (FHIR R4) or on valueCoding.extension (older style)
  const ordinals = {};
  for (const opt of fhirItem.answerOption || []) {
    if (opt.valueCoding) {
      const code = opt.valueCoding.code || opt.valueCoding.display || '';
      const ordExt =
        (opt.extension || []).find(
          e => e.url === 'http://hl7.org/fhir/StructureDefinition/ordinalValue'
        ) ||
        (opt.valueCoding.extension || []).find(
          e => e.url === 'http://hl7.org/fhir/StructureDefinition/ordinalValue'
        );
      if (ordExt && ordExt.valueDecimal !== undefined && code) {
        ordinals[code] = ordExt.valueDecimal;
      }
    }
  }
  if (Object.keys(ordinals).length) node._optionOrdinals = ordinals;

  // questionnaire-optionPrefix — per-option display prefix (e.g. 'A.', '1.')
  const prefixes = {};
  for (const opt of fhirItem.answerOption || []) {
    if (opt.valueCoding) {
      const code = opt.valueCoding.code || opt.valueCoding.display || '';
      const pfxExt = (opt.extension || []).find(
        e => e.url === 'http://hl7.org/fhir/StructureDefinition/questionnaire-optionPrefix'
      );
      if (pfxExt?.valueString && code) prefixes[code] = pfxExt.valueString;
    }
  }
  if (Object.keys(prefixes).length) node._optionPrefixes = prefixes;

  applyVisibility(node, fhirItem, linkIdMap);
  applyConstraints(node, fhirItem);

  // reference: allowed resource type from standard extension
  if (node.itemType === 'reference') {
    const refResExt = (fhirItem.extension || []).find(
      e => e.url === 'http://hl7.org/fhir/StructureDefinition/questionnaire-referenceResource'
    );
    if (refResExt && refResExt.valueCode) node.referenceResource = refResExt.valueCode;
  }
  // quantity: default unit from standard extension (questionnaire-unit)
  if (node.itemType === 'quantity') {
    const unitExt = (fhirItem.extension || []).find(
      e => e.url === 'http://hl7.org/fhir/StructureDefinition/questionnaire-unit'
    );
    if (unitExt?.valueCoding?.code) node.quantityUnit = unitExt.valueCoding.code;
  }

  const rs = fhirItem._text?.extension?.find(x => x.url && x.url.includes('rendering-style'));
  if (rs) node._renderStyle = rs.valueString || '';
  const rx = fhirItem._text?.extension?.find(x => x.url && x.url.includes('rendering-xhtml'));
  if (rx) node._renderXhtml = rx.valueString || '';

  // SDC calculatedExpression
  const calcExpr = (fhirItem.extension || []).find(
    e => e.url === 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-calculatedExpression'
  );
  if (calcExpr?.valueExpression) {
    node._calculatedExpr = calcExpr.valueExpression.expression || '';
  }

  // SDC initialExpression
  const initExpr = (fhirItem.extension || []).find(
    e => e.url === 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-initialExpression'
  );
  if (initExpr?.valueExpression) {
    node._initialExpr = initExpr.valueExpression.expression || '';
  }

  // maxLength
  if (fhirItem.maxLength) node._maxLength = fhirItem.maxLength;

  // minLength (SDC extension)
  const minLenExt = (fhirItem.extension || []).find(
    e => e.url === 'http://hl7.org/fhir/StructureDefinition/minLength'
  );
  if (minLenExt?.valueInteger !== undefined) node._minLength = minLenExt.valueInteger;

  // sdc-questionnaire-entryFormat (SDC) or entryFormat (R4 element-definition ext)
  const entryFmtExt = (fhirItem.extension || []).find(
    e => e.url === 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-entryFormat' ||
         e.url === 'http://hl7.org/fhir/StructureDefinition/entryFormat'
  );
  if (entryFmtExt?.valueString) node._entryFormat = entryFmtExt.valueString;

  // questionnaire-choiceOrientation
  const choiceOrientExt = (fhirItem.extension || []).find(
    e => e.url === 'http://hl7.org/fhir/StructureDefinition/questionnaire-choiceOrientation'
  );
  if (choiceOrientExt?.valueCode) node._choiceOrientation = choiceOrientExt.valueCode;

  // questionnaire-displayCategory (display items only)
  if (node.itemType === 'display') {
    const dcExt = (fhirItem.extension || []).find(
      e => e.url === 'http://hl7.org/fhir/StructureDefinition/questionnaire-displayCategory'
    );
    const dcCode = dcExt?.valueCodeableConcept?.coding?.[0]?.code;
    if (dcCode) node._displayCategory = dcCode;
  }

  // questionnaire-minValue / questionnaire-maxValue (SDC R4 extensions)
  const minValExt = (fhirItem.extension || []).find(
    e => e.url === 'http://hl7.org/fhir/StructureDefinition/minValue'
  );
  if (minValExt) {
    const v = minValExt.valueDecimal ?? minValExt.valueInteger;
    if (v !== undefined) node._minValue = v;
  }
  const maxValExt = (fhirItem.extension || []).find(
    e => e.url === 'http://hl7.org/fhir/StructureDefinition/maxValue'
  );
  if (maxValExt) {
    const v = maxValExt.valueDecimal ?? maxValExt.valueInteger;
    if (v !== undefined) node._maxValue = v;
  }

  // minOccurs / maxOccurs cardinality extensions
  const minOccExt = (fhirItem.extension || []).find(
    e => e.url === 'http://hl7.org/fhir/StructureDefinition/questionnaire-minOccurs'
  );
  if (minOccExt?.valueInteger !== undefined) node._minOccurs = minOccExt.valueInteger;
  const maxOccExt = (fhirItem.extension || []).find(
    e => e.url === 'http://hl7.org/fhir/StructureDefinition/questionnaire-maxOccurs'
  );
  if (maxOccExt?.valueInteger !== undefined) node._maxOccurs = maxOccExt.valueInteger;

  // questionnaire-sliderStepValue
  const sliderExt = (fhirItem.extension || []).find(
    e => e.url === 'http://hl7.org/fhir/StructureDefinition/questionnaire-sliderStepValue'
  );
  if (sliderExt) {
    const v = sliderExt.valueDecimal ?? sliderExt.valueInteger;
    if (v !== undefined) node._sliderStep = v;
  }

  // maxSize (attachment items only — maximum file size in MB)
  const maxSizeExt = (fhirItem.extension || []).find(
    e => e.url === 'http://hl7.org/fhir/StructureDefinition/maxSize'
  );
  if (maxSizeExt?.valueDecimal !== undefined) node._maxFileSizeMB = maxSizeExt.valueDecimal;

  // mimeType (attachment items only — 0..* allowed MIME types as valueCode)
  const mimeTypes = (fhirItem.extension || [])
    .filter(e => e.url === 'http://hl7.org/fhir/StructureDefinition/mimeType' && e.valueCode)
    .map(e => e.valueCode);
  if (mimeTypes.length) node._mimeTypes = mimeTypes;

  // questionnaire-supportLink (0..* URI links to external help/reference)
  const supportLinks = (fhirItem.extension || [])
    .filter(e => e.url === 'http://hl7.org/fhir/StructureDefinition/questionnaire-supportLink' && e.valueUri)
    .map(e => e.valueUri);
  if (supportLinks.length) node._supportLinks = supportLinks;

  // sdc-questionnaire-hidden (SDC) or questionnaire-hidden (R4 standard) — alias fallback
  const hiddenExt = (fhirItem.extension || []).find(
    e => e.url === 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-hidden' ||
         e.url === 'http://hl7.org/fhir/StructureDefinition/questionnaire-hidden'
  );
  if (hiddenExt?.valueBoolean === true) node._hidden = true;

  // disabledDisplay (R4B native field or R4 extension backport)
  if (fhirItem.disabledDisplay) node._disabledDisplay = fhirItem.disabledDisplay;
  const ddExt = (fhirItem.extension || []).find(
    e => e.url === 'http://hl7.org/fhir/5.0/StructureDefinition/extension-Questionnaire.item.disabledDisplay'
  );
  if (ddExt?.valueCode) node._disabledDisplay = ddExt.valueCode;

  node._readOnly = !!fhirItem.readOnly;
  if (fhirItem.repeats) node.repeats = true;
  if (fhirItem.prefix) node._prefix = fhirItem.prefix;
  if (fhirItem.definition) node._definition = fhirItem.definition;
  if (fhirItem.code && fhirItem.code.length) node._codes = fhirItem.code;
  if (fhirItem.answerValueSet) {
    node._answerValueSet = fhirItem.answerValueSet;
    const resolved = resolveContainedValueSet(contained, fhirItem.answerValueSet);
    if (resolved) node.options = resolved;
  }

  // item.initial[] → _initialValue / _initialValues (multi-row for repeating items)
  if (fhirItem.initial && fhirItem.initial.length) {
    const extractVal = init => {
      if (init.valueBoolean  !== undefined) return init.valueBoolean;
      if (init.valueDecimal  !== undefined) return String(init.valueDecimal);
      if (init.valueInteger  !== undefined) return String(init.valueInteger);
      if (init.valueDate     !== undefined) return init.valueDate;
      if (init.valueDateTime !== undefined) return init.valueDateTime;
      if (init.valueTime     !== undefined) return init.valueTime;
      if (init.valueString   !== undefined) return init.valueString;
      if (init.valueUri      !== undefined) return init.valueUri;
      if (init.valueCoding)                 return init.valueCoding.code || init.valueCoding.display || '';
      if (init.valueQuantity)               return {
        value: init.valueQuantity.value !== undefined ? String(init.valueQuantity.value) : '',
        unit:  init.valueQuantity.unit || '',
      };
      return undefined;
    };
    if (node.repeats && fhirItem.initial.length > 1) {
      const vals = fhirItem.initial.map(extractVal).filter(v => v !== undefined);
      node._initialValues = vals;
      node._initialValue  = vals[0];
    } else {
      const val = extractVal(fhirItem.initial[0]);
      if (val !== undefined) node._initialValue = val;
    }
  }
  // answerOption[].initialSelected → _initialSelected (round-trip flag)
  for (const opt of fhirItem.answerOption || []) {
    if (opt.initialSelected) {
      let code;
      if (opt.valueCoding)              code = opt.valueCoding.code || opt.valueCoding.display || '';
      else if (opt.valueString  !== undefined) code = opt.valueString;
      else if (opt.valueInteger !== undefined) code = String(opt.valueInteger);
      if (code !== undefined) {
        node._initialSelected = code;
        // Pre-fill initial value from initialSelected when item.initial[] is absent
        if (node._initialValue === undefined) node._initialValue = code;
        break;
      }
    }
  }
  // Preserve any unrecognised extensions for round-trip pass-through
  const unknownExts = _collectUnknownExtensions(fhirItem);
  if (unknownExts) node._unknownExtensions = unknownExts;
  return node;
}

// Recursive FHIR item → our node.
function fhirItemToNode(fhirItem, linkIdMap, contained) {
  const t = fhirItem.type || 'string';

  if (t === 'group') {
    const node = makeGroup(fhirItem.text || fhirItem.linkId || 'Group');
    node.id        = fhirItem.linkId || node.id;
    node.mandatory = fhirItem.required === undefined ? null : !!fhirItem.required;
    applyVisibility(node, fhirItem, linkIdMap);
    const hasOrGroup = applyConstraints(node, fhirItem);
    if (hasOrGroup) node.logicWithParent = 'OR';
    const rs = fhirItem._text?.extension?.find(x => x.url && x.url.includes('rendering-style'));
    if (rs) node._renderStyle = rs.valueString || '';
    const rx = fhirItem._text?.extension?.find(x => x.url && x.url.includes('rendering-xhtml'));
    if (rx) node._renderXhtml = rx.valueString || '';
    if (fhirItem.prefix) node._prefix = fhirItem.prefix;
    if (fhirItem.definition) node._definition = fhirItem.definition;
    if (fhirItem.code && fhirItem.code.length) node._codes = fhirItem.code;
    const groupSupportLinks = (fhirItem.extension || [])
      .filter(e => e.url === 'http://hl7.org/fhir/StructureDefinition/questionnaire-supportLink' && e.valueUri)
      .map(e => e.valueUri);
    if (groupSupportLinks.length) node._supportLinks = groupSupportLinks;
    const groupHiddenExt = (fhirItem.extension || []).find(
      e => e.url === 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-hidden' ||
           e.url === 'http://hl7.org/fhir/StructureDefinition/questionnaire-hidden'
    );
    if (groupHiddenExt?.valueBoolean === true) node._hidden = true;
    // Preserve any unrecognised extensions for round-trip pass-through
    const groupUnknown = _collectUnknownExtensions(fhirItem);
    if (groupUnknown) node._unknownExtensions = groupUnknown;
    for (const child of fhirItem.item || []) {
      const n = fhirItemToNode(child, linkIdMap, contained);
      if (n) node.children.push(n);
    }
    return node;
  }

  // Question with nested sub-items → wrap in synthetic group
  if ((fhirItem.item || []).length > 0) {
    const wrapper = makeGroup(fhirItem.text || fhirItem.linkId || 'Group');
    wrapper.id        = (fhirItem.linkId || wrapper.id) + '-grp';
    wrapper.mandatory = fhirItem.required === undefined ? null : !!fhirItem.required;
    applyVisibility(wrapper, fhirItem, linkIdMap);
    wrapper.children.push(fhirQuestionToItem(fhirItem, linkIdMap, contained));
    for (const child of fhirItem.item) {
      const n = fhirItemToNode(child, linkIdMap, contained);
      if (n) wrapper.children.push(n);
    }
    return wrapper;
  }

  return fhirQuestionToItem(fhirItem, linkIdMap, contained);
}

// Exported for unit testing
export { fhirTypeToItemType, fhirOptsToStr, humanEnableWhen, applyVisibility, _collectUnknownExtensions };

// Main import entry point
export function importFHIR(fhirJson, renderFn) {
  let q = fhirJson;
  if (typeof q === 'string') {
    try { q = JSON.parse(q); } catch (e) { alert('Invalid JSON:\n' + e.message); return; }
  }
  if (!q || q.resourceType !== 'Questionnaire') {
    alert('Not a FHIR Questionnaire resource (resourceType must be "Questionnaire").');
    return;
  }
  q = normaliseSTU3(q); // no-op for R4; converts STU3 fields to R4 equivalents
  tree.splice(0);
  clearAllValues();
  rawFhir.value = q;
  resetSeq();

  // Populate questionnaire-level metadata
  questMeta.id          = q.id          || '';
  questMeta.url         = q.url         || '';
  questMeta.version     = q.version     || '';
  questMeta.title       = q.title       || '';
  questMeta.status      = q.status      || 'draft';
  questMeta.publisher   = q.publisher   || '';
  questMeta.description = q.description || '';
  questMeta.name        = q.name        || '';
  questMeta.date        = q.date        || '';
  questMeta.subjectType = Array.isArray(q.subjectType) && q.subjectType.length
    ? q.subjectType.join(', ')
    : 'Patient';
  questMeta.purpose        = q.purpose        || '';
  questMeta.copyright      = q.copyright      || '';
  questMeta.approvalDate   = q.approvalDate   || '';
  questMeta.lastReviewDate = q.lastReviewDate || '';
  questMeta.effectivePeriodStart = q.effectivePeriod?.start || '';
  questMeta.effectivePeriodEnd   = q.effectivePeriod?.end   || '';
  questMeta.experimental      = q.experimental !== undefined ? q.experimental : null;
  questMeta.language          = q.language || '';
  questMeta._rawIdentifier   = Array.isArray(q.identifier)   ? JSON.parse(JSON.stringify(q.identifier)) : [];
  questMeta._rawText         = q.text && q.text.status && q.text.div ? { status: q.text.status, div: q.text.div } : null;
  questMeta._rawContact      = Array.isArray(q.contact)      ? q.contact      : null;
  questMeta._rawUseContext   = Array.isArray(q.useContext)   ? q.useContext   : null;
  questMeta._rawJurisdiction = Array.isArray(q.jurisdiction) ? q.jurisdiction : null;
  questMeta._rawCode         = Array.isArray(q.code)         ? q.code         : null;
  questMeta.derivedFrom      = Array.isArray(q.derivedFrom)  ? [...q.derivedFrom] : [];
  questMeta._metaVersionId   = q.meta?.versionId  || '';
  questMeta._metaSource      = q.meta?.source      || '';
  questMeta._metaLastUpdated = q.meta?.lastUpdated || '';
  questMeta._rawMetaProfile  = Array.isArray(q.meta?.profile)  ? [...q.meta.profile]  : [];
  questMeta._rawMetaTag      = Array.isArray(q.meta?.tag)      ? JSON.parse(JSON.stringify(q.meta.tag))      : [];
  questMeta._rawMetaSecurity = Array.isArray(q.meta?.security) ? JSON.parse(JSON.stringify(q.meta.security)) : [];

  // Read questionnaire-level SDC variables
  const SDC_VAR_URL = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-variable';
  questVariables.splice(0);

  // Questionnaire.contained[] — preserve raw resources for round-trip
  questContained.splice(0);
  if (Array.isArray(q.contained)) {
    for (const r of q.contained) questContained.push(r);
  }
  for (const ext of q.extension || []) {
    if (ext.url === SDC_VAR_URL && ext.valueExpression) {
      questVariables.push({
        name:       ext.valueExpression.name       || '',
        expression: ext.valueExpression.expression || ''
      });
    }
  }
  // Preserve non-variable questionnaire-level extensions for round-trip
  const nonVarExts = (q.extension || []).filter(e => e.url !== SDC_VAR_URL);
  questMeta._rawQuestExtensions = nonVarExts.length ? JSON.parse(JSON.stringify(nonVarExts)) : [];

  _bulkUpdate.value = true;
  try {
    const linkIdMap = buildLinkIdMap(q.item);
    for (const item of q.item || []) {
      const n = fhirItemToNode(item, linkIdMap, q.contained);
      if (n) tree.push(n);
    }
    applyInitialValues(tree); // must run before _bulkUpdate=false so effect() sees filled values[]
  } finally {
    _bulkUpdate.value = false;
  }
  if (renderFn) renderFn(); else renderTree();
}


