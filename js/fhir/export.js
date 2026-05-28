// ── FHIR R4 Questionnaire export ──────────────────────────────────────────────
import { tree, questVariables, questContained, rawFhir, questMeta } from '../state.js';
import { parseOptions, ITLH_KEY_GROUP_OR } from '../utils.js';
import { downloadJSON } from './download.js';

// Escape text for embedding in XHTML
function _esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Generate FHIR Narrative div from a fully-built Questionnaire object
export function generateNarrativeDiv(q) {
  const meta = [];
  meta.push(`<tr><td><b>Status</b></td><td>${_esc(q.status)}</td></tr>`);
  if (q.date)        meta.push(`<tr><td><b>Date</b></td><td>${_esc(q.date)}</td></tr>`);
  if (q.version)     meta.push(`<tr><td><b>Version</b></td><td>${_esc(q.version)}</td></tr>`);
  if (q.publisher)   meta.push(`<tr><td><b>Publisher</b></td><td>${_esc(q.publisher)}</td></tr>`);
  if (q.description) meta.push(`<tr><td><b>Description</b></td><td>${_esc(q.description)}</td></tr>`);

  const rows = [];
  function collectItems(items, depth) {
    for (const item of items || []) {
      const pad = '\u00a0\u00a0\u00a0\u00a0'.repeat(depth);
      rows.push(`<tr><td>${_esc(item.linkId)}</td><td>${pad}${_esc(item.text)}</td><td>${_esc(item.type)}</td></tr>`);
      if (item.item) collectItems(item.item, depth + 1);
    }
  }
  collectItems(q.item, 0);

  const parts = [
    '<div xmlns="http://www.w3.org/1999/xhtml">',
    `<h2>${_esc(q.title || q.id || 'Questionnaire')}</h2>`,
    `<table><tbody>${meta.join('')}</tbody></table>`,
  ];
  if (rows.length) {
    parts.push(`<table><thead><tr><th>LinkId</th><th>Text</th><th>Type</th></tr></thead><tbody>${rows.join('')}</tbody></table>`);
  }
  parts.push('</div>');
  return parts.join('');
}

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

  // item.initial[] — multi-value for repeating items; single value otherwise
  if (node.type === 'item') {
    const t = itemTypeToFHIRType(node.itemType);
    const buildInitEntry = v => {
      if (t === 'boolean')  return { valueBoolean:  typeof v === 'boolean' ? v : v === 'true' };
      if (t === 'decimal')  { const n = parseFloat(v); return isFinite(n) ? { valueDecimal: n } : null; }
      if (t === 'integer')  { const n = parseInt(v, 10); return isFinite(n) ? { valueInteger: n } : null; }
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
      .map(c => `%resource.item.where(linkId='${c.id.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}').answer.exists()`)
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
  // answerExpression (SDC) — dynamic answer options
  if (node._answerExpression)
    ext.push({ url: 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-answerExpression', valueExpression: { language: 'text/fhirpath', expression: node._answerExpression } });
  // radio-button itemControl
  if (node.itemType === 'radio')
    ext.push({ url: 'http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl', valueCodeableConcept: { coding: [{ system: 'http://hl7.org/fhir/questionnaire-item-control', code: 'radio-button' }] } });

  // _renderStyle / _renderXhtml / _renderMarkdown → _text.extension[]
  const _textExts = [];
  if (node._renderStyle)    _textExts.push({ url: 'http://hl7.org/fhir/StructureDefinition/rendering-style',    valueString:   node._renderStyle });
  if (node._renderXhtml)    _textExts.push({ url: 'http://hl7.org/fhir/StructureDefinition/rendering-xhtml',    valueString:   node._renderXhtml });
  if (node._renderMarkdown) _textExts.push({ url: 'http://hl7.org/fhir/StructureDefinition/rendering-markdown', valueMarkdown: node._renderMarkdown });
  if (_textExts.length) fhirItem._text = { extension: _textExts };

  if (node.type === 'group') {
    fhirItem.item = node.children.map(nodeToFHIRItem);
  } else if ((node.itemType === 'select' || node.itemType === 'radio' || node.itemType === 'open-choice') && node.options && !node._answerValueSet && !node._answerExpression) {
    fhirItem.answerOption = parseOptions(node.options)
      .map(({ code, display }) => {
        const coding = { code, display };
        const answerOpt = { valueCoding: coding };
        const optExts = [];
        if (node._optionOrdinals && node._optionOrdinals[code] !== undefined) {
          optExts.push({ url: 'http://hl7.org/fhir/StructureDefinition/ordinalValue', valueDecimal: node._optionOrdinals[code] });
        }
        if (node._optionPrefixes && node._optionPrefixes[code] !== undefined) {
          optExts.push({ url: 'http://hl7.org/fhir/StructureDefinition/questionnaire-optionPrefix', valueString: node._optionPrefixes[code] });
        }
        if (optExts.length) answerOpt.extension = optExts;
        if (node._initialSelected === code) answerOpt.initialSelected = true;
        return answerOpt;
      });
  }

  // maxLength (text/url/open-choice types)
  if (node._maxLength !== undefined && node._maxLength !== null) fhirItem.maxLength = node._maxLength;

  // minLength (SDC extension)
  if (node._minLength !== undefined && node._minLength !== null) {
    ext.push({ url: 'http://hl7.org/fhir/StructureDefinition/minLength', valueInteger: node._minLength });
  }

  // maxSize (attachment items only — maximum file size in MB)
  if (node._maxFileSizeMB !== undefined && node._maxFileSizeMB !== null) {
    ext.push({ url: 'http://hl7.org/fhir/StructureDefinition/maxSize', valueDecimal: node._maxFileSizeMB });
  }

  // mimeType (attachment items only — 0..* allowed MIME types)
  if (node._mimeTypes && node._mimeTypes.length) {
    for (const mime of node._mimeTypes) {
      if (mime) ext.push({ url: 'http://hl7.org/fhir/StructureDefinition/mimeType', valueCode: mime });
    }
  }

  // sdc-questionnaire-entryFormat
  if (node._entryFormat) {
    ext.push({ url: 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-entryFormat', valueString: node._entryFormat });
  }

  // questionnaire-choiceOrientation
  if (node._choiceOrientation) {
    ext.push({ url: 'http://hl7.org/fhir/StructureDefinition/questionnaire-choiceOrientation', valueCode: node._choiceOrientation });
  }

  // questionnaire-supportLink (0..* URI)
  if (node._supportLinks && node._supportLinks.length) {
    for (const uri of node._supportLinks) {
      if (uri) ext.push({ url: 'http://hl7.org/fhir/StructureDefinition/questionnaire-supportLink', valueUri: uri });
    }
  }

  // sdc-questionnaire-hidden
  if (node._hidden) {
    ext.push({ url: 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-hidden', valueBoolean: true });
  }

  // sdc-questionnaire-collapsible (groups only)
  if (node.type === 'group' && node._collapsible) {
    ext.push({ url: 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-collapsible', valueCode: node._collapsible });
  }

  // sdc-questionnaire-openLabel (open-choice items only)
  if (node.itemType === 'open-choice' && node._openLabel) {
    ext.push({ url: 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-openLabel', valueString: node._openLabel });
  }

  // sdc-questionnaire-preferredTerminologyServer — per-item terminology server override
  if (node._preferredTermServer) {
    ext.push({ url: 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-preferredTerminologyServer', valueUrl: node._preferredTermServer });
  }

  // designNote — author-facing internal note (not shown to end users)
  if (node._designNote) {
    ext.push({ url: 'http://hl7.org/fhir/StructureDefinition/designNote', valueMarkdown: node._designNote });
  }

  // questionnaire-displayCategory
  if (node._displayCategory) {
    ext.push({
      url: 'http://hl7.org/fhir/StructureDefinition/questionnaire-displayCategory',
      valueCodeableConcept: { coding: [{ code: node._displayCategory }] },
    });
  }

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
  // maxDecimalPlaces
  if (node._maxDecimalPlaces !== undefined) {
    ext.push({ url: 'http://hl7.org/fhir/StructureDefinition/maxDecimalPlaces', valueInteger: node._maxDecimalPlaces });
  }
  // questionnaire-sliderStepValue
  if (node._sliderStep !== undefined) {
    const isInt = Number.isInteger(node._sliderStep);
    ext.push({ url: 'http://hl7.org/fhir/StructureDefinition/questionnaire-sliderStepValue', [isInt ? 'valueInteger' : 'valueDecimal']: node._sliderStep });
  }
  // Pass-through: unknown extensions collected on import or added via Props modal
  if (node._unknownExtensions && node._unknownExtensions.length) {
    ext.push(...node._unknownExtensions.map(e => JSON.parse(JSON.stringify(e))));
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
  if (questMeta.subjectType?.length) q.subjectType = [...questMeta.subjectType];
  if (questMeta._rawIdentifier?.length) q.identifier = JSON.parse(JSON.stringify(questMeta._rawIdentifier));
  // Narrative — always written: preserved from import if available, otherwise auto-generated
  q.text = questMeta._rawText
    ? { status: questMeta._rawText.status, div: questMeta._rawText.div }
    : { status: 'generated', div: generateNarrativeDiv(q) };
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
  const REPLACES_EXT_URL = 'http://hl7.org/fhir/StructureDefinition/replaces';
  const questExt = [
    ...vars.map(v => ({
      url: SDC_VAR_URL,
      valueExpression: { name: v.name, language: 'text/fhirpath', expression: v.expression }
    })),
    ...(questMeta.replaces || []).filter(u => u.trim()).map(u => ({
      url: REPLACES_EXT_URL,
      valueCanonical: u.trim()
    })),
    ...(questMeta.preferredTermServer?.trim() ? [{
      url: 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-preferredTerminologyServer',
      valueUrl: questMeta.preferredTermServer.trim()
    }] : []),
    ...(questMeta._rawQuestExtensions || []).map(e => JSON.parse(JSON.stringify(e))),
  ];
  if (questExt.length) q.extension = questExt;
  if (questContained.length) {
    q.contained = questContained.map(r => JSON.parse(JSON.stringify(r)));
  }

  // meta.* — write back if any field has content; lastUpdated always refreshed to now
  const hasMetaContent = questMeta._metaVersionId || questMeta._metaSource || questMeta._metaLastUpdated ||
    questMeta._rawMetaProfile?.length || questMeta._rawMetaTag?.length || questMeta._rawMetaSecurity?.length;
  if (hasMetaContent) {
    q.meta = { lastUpdated: new Date().toISOString() };
    if (questMeta._metaVersionId)           q.meta.versionId = questMeta._metaVersionId;
    if (questMeta._metaSource)              q.meta.source    = questMeta._metaSource;
    if (questMeta._rawMetaProfile?.length)  q.meta.profile   = questMeta._rawMetaProfile;
    if (questMeta._rawMetaTag?.length)      q.meta.tag       = questMeta._rawMetaTag;
    if (questMeta._rawMetaSecurity?.length) q.meta.security  = questMeta._rawMetaSecurity;
  }

  return q;
}

export function exportFHIR(fileName) {
  downloadJSON(buildFHIRObject(), fileName || 'questionnaire.json');
}