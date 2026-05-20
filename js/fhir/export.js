// ── FHIR R4 Questionnaire export ──────────────────────────────────────────────
import { tree, questVariables, questContained, rawFhir, questMeta } from '../state.js';
import { parseOptions, ITLH_KEY_GROUP_OR } from '../utils.js';

function itemTypeToFHIRType(t) {
  if (t === 'checkbox')    return 'boolean';
  if (t === 'integer')       return 'integer';
  if (t === 'decimal')        return 'decimal';
  if (t === 'number')         return 'decimal'; // legacy fallback
  if (t === 'quantity')    return 'quantity';
  if (t === 'select' || t === 'radio') return 'choice';
  if (t === 'open-choice') return 'open-choice';
  if (t === 'display')     return 'display';
  if (t === 'date')        return 'date';
  if (t === 'dateTime')    return 'dateTime';
  if (t === 'time')        return 'time';
  if (t === 'url')         return 'url';
  if (t === 'attachment')  return 'attachment';
  if (t === 'reference')   return 'reference';
  return 'string';
}

// Build questionnaire-constraint extensions from node.constraint[]
function buildConstraintExtensions(constraint) {
  if (!constraint || !constraint.length) return [];
  return constraint
    .filter(c => c.expression)
    .map(c => ({
      url: 'http://hl7.org/fhir/StructureDefinition/questionnaire-constraint',
      extension: [
        ...(c.key        ? [{ url: 'key',        valueId:     c.key }]      : []),
        ...(c.severity   ? [{ url: 'severity',   valueCode:   c.severity }] : []),
        { url: 'expression', valueString: c.expression },
        ...(c.human      ? [{ url: 'human',      valueString: c.human }]    : []),
      ]
    }));
}

function nodeToFHIRItem(node) {
  const fhirItem = {
    linkId: node.id,
    text:   node.title,
    type:   node.type === 'group' ? 'group' : itemTypeToFHIRType(node.itemType)
  };

  if (node._prefix) fhirItem.prefix = node._prefix;
  if (node._definition) fhirItem.definition = node._definition;
  if (node._codes && node._codes.length) fhirItem.code = node._codes;
  if (node.mandatory === true)  fhirItem.required = true;
  else if (node.mandatory === false) fhirItem.required = false;

  // item.initial[] — multi-value for repeating items; single value otherwise
  if (node.type === 'item') {
    const t = itemTypeToFHIRType(node.itemType);
    const buildInitEntry = v => {
      if (t === 'boolean')  return { valueBoolean:  typeof v === 'boolean' ? v : v === 'true' };
      if (t === 'decimal')  return { valueDecimal:  parseFloat(v) };
      if (t === 'integer')  return { valueInteger:  parseInt(v, 10) };
      if (t === 'date')     return { valueDate:     String(v) };
      if (t === 'dateTime') return { valueDateTime: String(v) };
      if (t === 'time')     return { valueTime:     String(v) };
      if (t === 'url')      return { valueUri:      String(v) };
      if (t === 'choice')   return { valueCoding:   { code: String(v), display: String(v) } };
      return { valueString: String(v) };
    };
    if (node.repeats && node._initialValues && node._initialValues.length > 1) {
      const entries = node._initialValues.map(buildInitEntry).filter(Boolean);
      if (entries.length) fhirItem.initial = entries;
    } else if (node._initialValue !== undefined && node._initialValue !== '') {
      const entry = buildInitEntry(node._initialValue);
      if (entry) fhirItem.initial = [entry];
    }
  }

  // ── Standard R4 enableWhen[] ──────────────────────────────────────────────
  if (node.enableWhen && node.enableWhen.length) {
    fhirItem.enableWhen = node.enableWhen.map(ew => ({ ...ew }));
    if (node.enableBehavior === 'any') fhirItem.enableBehavior = 'any';
  }

  // ── SDC extensions ────────────────────────────────────────────────────────
  const ext = [];

  // enableWhenExpression (SDC FHIRPath condition)
  if (node.enableWhenExpression) {
    ext.push({
      url: 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-enableWhenExpression',
      valueExpression: { language: 'text/fhirpath', expression: node.enableWhenExpression }
    });
  }
  // questionnaire-constraint[] — user rules (strip any stale system key first)
  const userConstraints = (node.constraint || []).filter(c => c.key !== ITLH_KEY_GROUP_OR);
  ext.push(...buildConstraintExtensions(userConstraints));

  // OR-group: auto-generate constraint so round-trip restores logicWithParent
  if (node.type === 'group' && node.logicWithParent === 'OR' && node.children.length > 0) {
    const fp = node.children
      .map(c => `%resource.item.where(linkId='${c.id}').answer.exists()`)
      .join(' or ');
    ext.push({
      url: 'http://hl7.org/fhir/StructureDefinition/questionnaire-constraint',
      extension: [
        { url: 'key',        valueId:     ITLH_KEY_GROUP_OR },
        { url: 'severity',   valueCode:   'error' },
        { url: 'human',      valueString: 'At least one item in this group must be completed' },
        { url: 'expression', valueString: fp },
      ]
    });
  }

  // reference resource type
  if (node.itemType === 'reference' && node.referenceResource)
    ext.push({ url: 'http://hl7.org/fhir/StructureDefinition/questionnaire-referenceResource', valueCode: node.referenceResource });
  // quantity unit
  if (node.itemType === 'quantity' && node.quantityUnit)
    ext.push({ url: 'http://hl7.org/fhir/StructureDefinition/questionnaire-unit', valueCoding: { system: 'http://unitsofmeasure.org', code: node.quantityUnit } });
  // calculatedExpression
  if (node._calculatedExpr)
    ext.push({ url: 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-calculatedExpression', valueExpression: { language: 'text/fhirpath', expression: node._calculatedExpr } });
  // initialExpression
  if (node._initialExpr)
    ext.push({ url: 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-initialExpression', valueExpression: { language: 'text/fhirpath', expression: node._initialExpr } });
  // radio-button itemControl
  if (node.itemType === 'radio')
    ext.push({ url: 'http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl', valueCodeableConcept: { coding: [{ system: 'http://hl7.org/fhir/questionnaire-item-control', code: 'radio-button' }] } });

  // _renderStyle → _text.extension[rendering-style]
  if (node._renderStyle) {
    fhirItem._text = {
      extension: [{ url: 'http://hl7.org/fhir/StructureDefinition/rendering-style', valueString: node._renderStyle }]
    };
  }

  if (node.type === 'group') {
    fhirItem.item = node.children.map(nodeToFHIRItem);
  } else if ((node.itemType === 'select' || node.itemType === 'radio' || node.itemType === 'open-choice') && node.options && !node._answerValueSet) {
    fhirItem.answerOption = parseOptions(node.options)
      .map(({ code, display }) => {
        const coding = { code, display };
        const answerOpt = { valueCoding: coding };
        if (node._optionOrdinals && node._optionOrdinals[code] !== undefined) {
          answerOpt.extension = [{ url: 'http://hl7.org/fhir/StructureDefinition/ordinalValue', valueDecimal: node._optionOrdinals[code] }];
        }
        if (node._initialSelected === code) answerOpt.initialSelected = true;
        return answerOpt;
      });
  }

  // maxLength (text/url/open-choice types)
  if (node._maxLength) fhirItem.maxLength = node._maxLength;

  // questionnaire-minValue / questionnaire-maxValue
  if (node._minValue !== undefined) {
    const isInt = Number.isInteger(node._minValue);
    ext.push({ url: 'http://hl7.org/fhir/StructureDefinition/minValue', [isInt ? 'valueInteger' : 'valueDecimal']: node._minValue });
  }
  if (node._maxValue !== undefined) {
    const isInt = Number.isInteger(node._maxValue);
    ext.push({ url: 'http://hl7.org/fhir/StructureDefinition/maxValue', [isInt ? 'valueInteger' : 'valueDecimal']: node._maxValue });
  }
  if (node.type === 'item' && node._answerValueSet) fhirItem.answerValueSet = node._answerValueSet;

  if (node._readOnly) fhirItem.readOnly = true;
  if (node._disabledDisplay) fhirItem.disabledDisplay = node._disabledDisplay;
  if (node.repeats)   fhirItem.repeats  = true;
  // minOccurs / maxOccurs cardinality extensions
  if (node.repeats && node._minOccurs !== undefined)
    ext.push({ url: 'http://hl7.org/fhir/StructureDefinition/questionnaire-minOccurs', valueInteger: node._minOccurs });
  if (node.repeats && node._maxOccurs !== undefined)
    ext.push({ url: 'http://hl7.org/fhir/StructureDefinition/questionnaire-maxOccurs', valueInteger: node._maxOccurs });
  // questionnaire-sliderStepValue
  if (node._sliderStep !== undefined) {
    const isInt = Number.isInteger(node._sliderStep);
    ext.push({ url: 'http://hl7.org/fhir/StructureDefinition/questionnaire-sliderStepValue', [isInt ? 'valueInteger' : 'valueDecimal']: node._sliderStep });
  }
  if (ext.length) fhirItem.extension = ext;

  return fhirItem;
}

export function buildFHIRObject() {
  const SDC_VAR_URL = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-variable';
  const q = {
    resourceType: 'Questionnaire',
    id:     questMeta.id     || 'logic-builder-export',
    status: questMeta.status || 'draft',
    item:   tree.map(nodeToFHIRItem)
  };
  if (questMeta.url)         q.url         = questMeta.url;
  if (questMeta.version)     q.version     = questMeta.version;
  q.title = questMeta.title || (rawFhir.value && rawFhir.value.title) || 'Untitled Questionnaire';
  if (questMeta.name)        q.name        = questMeta.name;
  if (questMeta.publisher)   q.publisher   = questMeta.publisher;
  if (questMeta.description) q.description = questMeta.description;
  if (questMeta.experimental !== null) q.experimental = questMeta.experimental;
  if (questMeta.language)    q.language    = questMeta.language;
  if (questMeta.purpose)     q.purpose     = questMeta.purpose;
  if (questMeta.copyright)   q.copyright   = questMeta.copyright;
  if (questMeta.approvalDate)   q.approvalDate   = questMeta.approvalDate;
  if (questMeta.lastReviewDate) q.lastReviewDate = questMeta.lastReviewDate;
  q.date = questMeta.date || new Date().toISOString().split('T')[0];
  q.subjectType = questMeta.subjectType
    ? questMeta.subjectType.split(',').map(s => s.trim()).filter(Boolean)
    : ['Patient'];
  if (questMeta._rawContact)      q.contact     = questMeta._rawContact;
  if (questMeta._rawUseContext)   q.useContext  = questMeta._rawUseContext;
  if (questMeta._rawJurisdiction) q.jurisdiction = questMeta._rawJurisdiction;
  if (questMeta._rawCode)              q.code        = questMeta._rawCode;
  if (questMeta.derivedFrom?.length)   q.derivedFrom = questMeta.derivedFrom;
  if (questMeta.effectivePeriodStart || questMeta.effectivePeriodEnd) {
    const ep = {};
    if (questMeta.effectivePeriodStart) ep.start = questMeta.effectivePeriodStart;
    if (questMeta.effectivePeriodEnd)   ep.end   = questMeta.effectivePeriodEnd;
    q.effectivePeriod = ep;
  }
  const vars = questVariables.filter(v => v.name && v.expression);
  if (vars.length) {
    q.extension = vars.map(v => ({
      url: SDC_VAR_URL,
      valueExpression: { name: v.name, language: 'text/fhirpath', expression: v.expression }
    }));
  }
  if (questContained.length) {
    q.contained = questContained.map(r => JSON.parse(JSON.stringify(r)));
  }
  return q;
}

export function exportFHIR(fileName) {
  const q = buildFHIRObject();
  const blob = new Blob([JSON.stringify(q, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName || 'questionnaire.json';
  a.click();
  URL.revokeObjectURL(a.href);
}