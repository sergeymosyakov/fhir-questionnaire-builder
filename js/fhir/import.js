// ── FHIR R4 Questionnaire import ──────────────────────────────────────────────
import { tree, values, makeGroup, makeItem, resetSeq, rawFhir, calcTested } from '../state.js';
import { renderTree } from '../render-builder.js';

// Read our custom extension value from a FHIR item
function extractExtension(fhirItem, key) {
  const ext = (fhirItem.extension || []).find(
    e => e.url === 'http://logicbuilder.example.org/extension/' + key
  );
  return ext ? (ext.valueString || '') : '';
}

// FHIR enableWhen[] → JS expression string using values['linkId']
function enableWhenToExpr(enableWhen) {
  if (!enableWhen || !enableWhen.length) return '';
  return enableWhen.map(ew => {
    const q = `values['${ew.question}']`;
    let val;
    if      (ew.answerBoolean  !== undefined) val = ew.answerBoolean;
    else if (ew.answerString   !== undefined) val = `'${ew.answerString}'`;
    else if (ew.answerInteger  !== undefined) val = ew.answerInteger;
    else if (ew.answerDecimal  !== undefined) val = ew.answerDecimal;
    else if (ew.answerCoding)                 val = `'${ew.answerCoding.code || ew.answerCoding.display || ''}'`;
    else val = true;
    if (ew.operator === 'exists') return val ? `${q} !== undefined` : `${q} === undefined`;
    const jsOp = ew.operator === '=' ? '==' : ew.operator;
    return `${q} ${jsOp} ${val}`;
  }).join(' && ');
}

// FHIR item.type → our itemType
export function fhirTypeToItemType(t) {
  if (t === 'boolean')                                        return 'checkbox';
  if (t === 'integer' || t === 'decimal' || t === 'quantity') return 'number';
  if (t === 'choice'  || t === 'open-choice')                 return 'select';
  if (t === 'display')                                        return 'display';
  if (t === 'date' || t === 'dateTime' || t === 'time')       return 'date';
  if (t === 'url')                                            return 'url';
  if (t === 'attachment')                                     return 'attachment';
  return 'text'; // string, text, reference
}

// answerOption[] → comma-separated display/code string for our options field
function fhirOptsToStr(opts) {
  return (opts || []).map(o => {
    if (o.valueCoding) return o.valueCoding.display || o.valueCoding.code || '';
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

// FHIR enableWhen[] → readable string like: "«Diet program» = Yes"
function humanEnableWhen(enableWhen, linkIdMap) {
  if (!enableWhen || !enableWhen.length) return '';
  const parts = enableWhen.map(ew => {
    const qText = linkIdMap[ew.question] || ew.question;
    if (ew.operator === 'exists') return `«${qText}» есть ответ`;
    let val;
    if      (ew.answerBoolean  !== undefined) val = ew.answerBoolean ? 'Yes' : 'No';
    else if (ew.answerString   !== undefined) val = `«${ew.answerString}»`;
    else if (ew.answerInteger  !== undefined) val = ew.answerInteger;
    else if (ew.answerDecimal  !== undefined) val = ew.answerDecimal;
    else if (ew.answerCoding)                 val = ew.answerCoding.display || ew.answerCoding.code || '?';
    else val = '?';
    const opLabel = { '=': '=', '!=': '≠', '>': '>', '<': '<', '>=': '≥', '<=': '≤' }[ew.operator] || ew.operator;
    return `«${qText}» ${opLabel} ${val}`;
  });
  return parts.join(' AND ');
}

// Build our item node from a FHIR leaf question
function fhirQuestionToItem(fhirItem, linkIdMap) {
  const node = makeItem(fhirItem.text || fhirItem.linkId || 'Item');
  node.id             = fhirItem.linkId || node.id;
  node.mandatory      = fhirItem.required === undefined ? null : !!fhirItem.required;
  node.visibilityRule = extractExtension(fhirItem, 'visibilityRule') || enableWhenToExpr(fhirItem.enableWhen);
  node.conditionRule  = extractExtension(fhirItem, 'conditionRule')  || '';
  node.itemType       = fhirTypeToItemType(fhirItem.type || 'string');
  // questionnaire-itemControl: radio-button → use 'radio' instead of 'select'
  if (node.itemType === 'select') {
    const itemCtrl = (fhirItem.extension || []).find(
      e => e.url === 'http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl'
    );
    const ctrlCode = itemCtrl && itemCtrl.valueCodeableConcept &&
      itemCtrl.valueCodeableConcept.coding && itemCtrl.valueCodeableConcept.coding[0] &&
      itemCtrl.valueCodeableConcept.coding[0].code;
    if (ctrlCode === 'radio-button') node.itemType = 'radio';
  }
  node.options        = fhirOptsToStr(fhirItem.answerOption);
  const sv = extractExtension(fhirItem, 'successValue');
  if (sv) node.successValue = sv;
  if (fhirItem.enableWhen && fhirItem.enableWhen.length && linkIdMap) {
    node._enableWhenText = humanEnableWhen(fhirItem.enableWhen, linkIdMap);
  }
  const rs = fhirItem._text && fhirItem._text.extension
    && fhirItem._text.extension.find(x => x.url && x.url.includes('rendering-style'));
  if (rs) node._renderStyle = rs.valueString || '';
  // SDC calculatedExpression
  const calcExpr = (fhirItem.extension || []).find(
    e => e.url === 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-calculatedExpression'
  );
  if (calcExpr && calcExpr.valueExpression) {
    node._calculatedExpr = calcExpr.valueExpression.expression || '';
  }
  node._readOnly = !!fhirItem.readOnly;
  return node;
}

// Recursive FHIR item → our node.
// Non-group questions with nested items are wrapped in a synthetic group
// (FHIR allows nesting under any item; our model only allows children under groups).
function fhirItemToNode(fhirItem, linkIdMap) {
  const t = fhirItem.type || 'string';

  if (t === 'group') {
    const node = makeGroup(fhirItem.text || fhirItem.linkId || 'Group');
    node.id              = fhirItem.linkId || node.id;
    node.mandatory       = fhirItem.required === undefined ? null : !!fhirItem.required;
    node.logicWithParent = fhirItem.enableBehavior === 'any' ? 'OR' : 'AND';
    node.visibilityRule  = extractExtension(fhirItem, 'visibilityRule') || enableWhenToExpr(fhirItem.enableWhen);
    node.conditionRule   = extractExtension(fhirItem, 'conditionRule')  || '';
    if (fhirItem.enableWhen && fhirItem.enableWhen.length && linkIdMap) {
      node._enableWhenText = humanEnableWhen(fhirItem.enableWhen, linkIdMap);
    }
    const rs = fhirItem._text && fhirItem._text.extension
      && fhirItem._text.extension.find(x => x.url && x.url.includes('rendering-style'));
    if (rs) node._renderStyle = rs.valueString || '';
    for (const child of fhirItem.item || []) {
      const n = fhirItemToNode(child, linkIdMap);
      if (n) node.children.push(n);
    }
    return node;
  }

  // Question with nested sub-items → wrap in synthetic group
  if ((fhirItem.item || []).length > 0) {
    const wrapper = makeGroup(fhirItem.text || fhirItem.linkId || 'Group');
    wrapper.id             = (fhirItem.linkId || wrapper.id) + '-grp';
    wrapper.mandatory      = fhirItem.required === undefined ? null : !!fhirItem.required;
    wrapper.visibilityRule = extractExtension(fhirItem, 'visibilityRule') || enableWhenToExpr(fhirItem.enableWhen);
    wrapper.conditionRule  = extractExtension(fhirItem, 'conditionRule')  || '';
    if (fhirItem.enableWhen && fhirItem.enableWhen.length && linkIdMap) {
      wrapper._enableWhenText = humanEnableWhen(fhirItem.enableWhen, linkIdMap);
    }
    wrapper.children.push(fhirQuestionToItem(fhirItem, linkIdMap));
    for (const child of fhirItem.item) {
      const n = fhirItemToNode(child, linkIdMap);
      if (n) wrapper.children.push(n);
    }
    return wrapper;
  }

  return fhirQuestionToItem(fhirItem, linkIdMap);
}

// Main import entry point
export function importFHIR(fhirJson) {
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
  calcTested.value = false;
  resetSeq();
  const linkIdMap = buildLinkIdMap(q.item);
  for (const item of q.item || []) {
    const n = fhirItemToNode(item, linkIdMap);
    if (n) tree.push(n);
  }
  renderTree();
}
