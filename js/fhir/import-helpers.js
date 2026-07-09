// ── FHIR import: pure helper functions ───────────────────────────────────────
// No side-effects, no state imports. Used by import-item.js and import.js.
import { ITLH_KEY_GROUP_OR } from '../utils.js';import {
  ITEM_ANSWER_CONSTRAINT_EXTENSION_URL,
  ITEM_DISABLED_DISPLAY_EXTENSION_URL,
} from './format-registry.js';
// ── Known extension URLs — any item.extension[] entry NOT in this set is
// collected into node._unknownExtensions for pass-through round-tripping.
export const KNOWN_ITEM_EXTENSION_URLS = new Set([
  'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-enableWhenExpression',
  'http://hl7.org/fhir/StructureDefinition/questionnaire-constraint',
  'http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl',
  'http://hl7.org/fhir/StructureDefinition/questionnaire-referenceResource',
  'http://hl7.org/fhir/StructureDefinition/questionnaire-unit',
  'http://hl7.org/fhir/StructureDefinition/questionnaire-unitValueSet',
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
  'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-observationExtract',
  'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-collapsible',
  'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-openLabel',
  'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-isSubject',
  'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-columnCount',
  ITEM_DISABLED_DISPLAY_EXTENSION_URL,
  ITEM_ANSWER_CONSTRAINT_EXTENSION_URL,
  'http://hl7.org/fhir/StructureDefinition/maxSize',
  'http://hl7.org/fhir/StructureDefinition/mimeType',
  'http://hl7.org/fhir/StructureDefinition/designNote',
  'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-answerExpression',
  'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-candidateExpression',
  'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-preferredTerminologyServer',
  'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-choiceColumn',
  'http://hl7.org/fhir/StructureDefinition/questionnaire-unitOption',
  'http://hl7.org/fhir/StructureDefinition/regex',
  'http://hl7.org/fhir/StructureDefinition/questionnaire-usageMode',
  'http://hl7.org/fhir/StructureDefinition/questionnaire-referenceFilter',
  'http://hl7.org/fhir/StructureDefinition/questionnaire-referenceProfile',
  'http://hl7.org/fhir/StructureDefinition/questionnaire-signatureRequired',
  'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-itemMedia',
  'http://hl7.org/fhir/StructureDefinition/itemWeight',
  'http://hl7.org/fhir/StructureDefinition/questionnaire-baseType',
  'http://hl7.org/fhir/StructureDefinition/questionnaire-fhirType',
]);

// ── SDC answer-source expressions ─────────────────────────────────────────────
// FHIRPath expressions that resolve to a list of answer options at render time.
// answerExpression → the permitted answer set; candidateExpression → suggested
// candidate answers. Both are mutually exclusive with a static answerOption[]
// source and share the same import (ext → prop), export (prop → ext), render and
// validation handling. Shared by import-item.js and export.js.
export const ANSWER_SOURCE_EXPR_EXTS = [
  { url: 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-answerExpression',    prop: '_answerExpression' },
  { url: 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-candidateExpression', prop: '_candidateExpression' },
];

export function _collectUnknownExtensions(fhirItem) {
  const unknown = (fhirItem.extension || []).filter(e => !KNOWN_ITEM_EXTENSION_URLS.has(e.url));
  return unknown.length ? unknown.map(e => JSON.parse(JSON.stringify(e))) : null;
}

// FHIR item.type → our itemType
export function fhirTypeToItemType(t) {
  if (t === 'boolean')                                  return 'checkbox';
  if (t === 'integer')                                        return 'integer';
  if (t === 'decimal')                                         return 'decimal';
  if (t === 'quantity')                                 return 'quantity';
  if (t === 'choice' || t === 'coding')                  return 'select'; // 'coding' = DSTU2 legacy
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
// For non-valueCoding types, produces a plain string so the editor shows something.
export function fhirOptsToStr(opts) {
  return (opts || []).map(o => {
    if (o.valueCoding) {
      const code    = o.valueCoding.code    || '';
      const display = o.valueCoding.display || '';
      if (code && display && code !== display) return code + '=' + display;
      return display || code;
    }
    if (o.valueString    !== undefined) return o.valueString;
    if (o.valueInteger   !== undefined) return String(o.valueInteger);
    if (o.valueDate      !== undefined) return o.valueDate;
    if (o.valueTime      !== undefined) return o.valueTime;
    if (o.valueReference) {
      return (typeof o.valueReference === 'string'
        ? o.valueReference
        : (o.valueReference.reference || ''));
    }
    return '';
  }).filter(Boolean).join(', ');
}

// Returns true if any option uses a non-Coding value type.
// When true, _rawAnswerOptions must be stored on import for round-trip fidelity.
export function hasNonCodingOpts(opts) {
  return (opts || []).some(o => !o.valueCoding);
}

// Build linkId → question text map for human-friendly display
export function buildLinkIdMap(items, map = {}) {
  for (const item of items || []) {
    map[item.linkId] = item.text || item.linkId || '';
    buildLinkIdMap(item.item, map);
  }
  return map;
}

// FHIR enableWhen[] -> human-readable label string
export function humanEnableWhen(enableWhen, enableBehavior, linkIdMap) {
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
    else if (ew.answerQuantity !== undefined) val = (ew.answerQuantity.value ?? '?') + (ew.answerQuantity.unit || ew.answerQuantity.code ? ' ' + (ew.answerQuantity.unit || ew.answerQuantity.code) : '');
    else if (ew.answerCoding)                 val = ew.answerCoding.display || ew.answerCoding.code || '?';
    else val = '?';
    const opLabel = { '=': '=', '!=': '\u2260', '>': '>', '<': '<', '>=': '\u2265', '<=': '\u2264' }[ew.operator] || ew.operator;
    return '\u00AB' + qText + '\u00BB ' + opLabel + ' ' + val;
  });
  return parts.join(joiner);
}

// Apply enableWhen, enableBehavior, enableWhenExpression to a node from a FHIR item
export function applyVisibility(node, fhirItem, linkIdMap) {
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
export function applyConstraints(node, fhirItem) {
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
