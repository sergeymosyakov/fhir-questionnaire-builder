// ── FHIR R4 Questionnaire import ──────────────────────────────────────────────
import { tree, values, makeGroup, makeItem, resetSeq, rawFhir, _bulkUpdate, questVariables } from '../state.js';
import { renderTree } from '../render-builder.js';
import { ITLH_KEY_GROUP_OR } from '../utils.js';

// Walk the tree and pre-populate values[] from node._initialValue
function applyInitialValues(nodes) {
  for (const node of nodes) {
    if (node._initialValue !== undefined) values[node.id] = node._initialValue;
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
  if (t === 'date' || t === 'dateTime' || t === 'time') return 'date';
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

// Build our item node from a FHIR leaf question
function fhirQuestionToItem(fhirItem, linkIdMap) {
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

  node._readOnly = !!fhirItem.readOnly;
  if (fhirItem.prefix) node._prefix = fhirItem.prefix;
  if (fhirItem.code && fhirItem.code.length) node._codes = fhirItem.code;

  // item.initial[0] → _initialValue
  if (fhirItem.initial && fhirItem.initial.length) {
    const init = fhirItem.initial[0];
    if      (init.valueBoolean  !== undefined) node._initialValue = init.valueBoolean;
    else if (init.valueDecimal  !== undefined) node._initialValue = String(init.valueDecimal);
    else if (init.valueInteger  !== undefined) node._initialValue = String(init.valueInteger);
    else if (init.valueDate     !== undefined) node._initialValue = init.valueDate;
    else if (init.valueDateTime !== undefined) node._initialValue = init.valueDateTime;
    else if (init.valueTime     !== undefined) node._initialValue = init.valueTime;
    else if (init.valueString   !== undefined) node._initialValue = init.valueString;
    else if (init.valueUri      !== undefined) node._initialValue = init.valueUri;
    else if (init.valueCoding)                 node._initialValue = init.valueCoding.code || init.valueCoding.display || '';
    else if (init.valueQuantity)               node._initialValue = init.valueQuantity.value !== undefined ? String(init.valueQuantity.value) : '';
  }
  return node;
}

// Recursive FHIR item → our node.
function fhirItemToNode(fhirItem, linkIdMap) {
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
    if (fhirItem.prefix) node._prefix = fhirItem.prefix;
    if (fhirItem.code && fhirItem.code.length) node._codes = fhirItem.code;
    for (const child of fhirItem.item || []) {
      const n = fhirItemToNode(child, linkIdMap);
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
    wrapper.children.push(fhirQuestionToItem(fhirItem, linkIdMap));
    for (const child of fhirItem.item) {
      const n = fhirItemToNode(child, linkIdMap);
      if (n) wrapper.children.push(n);
    }
    return wrapper;
  }

  return fhirQuestionToItem(fhirItem, linkIdMap);
}

// Exported for unit testing
export { fhirTypeToItemType, fhirOptsToStr, humanEnableWhen, applyVisibility };

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
  tree.splice(0);
  Object.keys(values).forEach(k => delete values[k]);
  rawFhir.value = q;
  resetSeq();

  // Read questionnaire-level SDC variables
  const SDC_VAR_URL = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-variable';
  questVariables.splice(0);
  for (const ext of q.extension || []) {
    if (ext.url === SDC_VAR_URL && ext.valueExpression) {
      questVariables.push({
        name:       ext.valueExpression.name       || '',
        expression: ext.valueExpression.expression || ''
      });
    }
  }

  _bulkUpdate.value = true;
  try {
    const linkIdMap = buildLinkIdMap(q.item);
    for (const item of q.item || []) {
      const n = fhirItemToNode(item, linkIdMap);
      if (n) tree.push(n);
    }
    applyInitialValues(tree); // must run before _bulkUpdate=false so effect() sees filled values[]
  } finally {
    _bulkUpdate.value = false;
  }
  if (renderFn) renderFn(); else renderTree();
}


