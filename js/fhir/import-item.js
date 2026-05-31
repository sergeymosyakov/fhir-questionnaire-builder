// ── FHIR import: item node builders ──────────────────────────────────────────
// Converts FHIR Questionnaire.item into our internal node tree.
import { createGroupNode, createItemNode } from '../nodes/index.js';
import {
  fhirTypeToItemType,
  fhirOptsToStr,
  hasNonCodingOpts,
  applyVisibility,
  applyConstraints,
  resolveContainedValueSet,
  _collectUnknownExtensions,
} from './import-helpers.js';

// Build our item node from a FHIR leaf question
function fhirQuestionToItem(fhirItem, linkIdMap, contained) {
  // Determine itemType before construction so the correct class is instantiated.
  let itemType = fhirTypeToItemType(fhirItem.type || 'string');

  // questionnaire-itemControl: detect control code for all item types
  const itemCtrl = (fhirItem.extension || []).find(
    e => e.url === 'http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl'
  );
  const ctrlCode = itemCtrl?.valueCodeableConcept?.coding?.[0]?.code;

  // Choice-type control variants
  if (itemType === 'select' || itemType === 'open-choice') {
    if (ctrlCode === 'radio-button') itemType = 'radio';
    else if (ctrlCode === 'check-box') itemType = 'checklist';
    else if (ctrlCode === 'autocomplete' || ctrlCode === 'drop-down') {
      // store for round-trip; rendering adapts in ChoiceNode
    }
  }

  const node = createItemNode(itemType, {
    id:        fhirItem.linkId,
    title:     fhirItem.text || fhirItem.linkId || 'Item',
    mandatory: !!fhirItem.required,
  });

  node.options = fhirOptsToStr(fhirItem.answerOption);

  // Preserve full answerOption array when needed:
  //  - non-valueCoding types (valueString, valueInteger, etc.) for round-trip
  //  - choiceColumn requires access to full Coding properties (system, code, display)
  const hasChoiceCol = (fhirItem.extension || []).some(
    e => e.url === 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-choiceColumn'
  );
  if (fhirItem.answerOption && (hasNonCodingOpts(fhirItem.answerOption) || hasChoiceCol)) {
    node._rawAnswerOptions = JSON.parse(JSON.stringify(fhirItem.answerOption));
  }

  // Preserve non-type-changing itemControl codes for round-trip + rendering
  if (ctrlCode && ctrlCode !== 'radio-button' && ctrlCode !== 'check-box') {
    node._itemControl = ctrlCode;
  }

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
    // questionnaire-unitValueSet: ValueSet of selectable units
    const unitVsExt = (fhirItem.extension || []).find(
      e => e.url === 'http://hl7.org/fhir/StructureDefinition/questionnaire-unitValueSet'
    );
    if (unitVsExt?.valueCanonical) node._unitValueSet = unitVsExt.valueCanonical;
    // questionnaire-unitOption: explicit list of selectable units (0..*)
    const unitOptExts = (fhirItem.extension || []).filter(
      e => e.url === 'http://hl7.org/fhir/StructureDefinition/questionnaire-unitOption'
    );
    if (unitOptExts.length) {
      node._unitOptions = unitOptExts
        .filter(e => e.valueCoding)
        .map(e => ({ system: e.valueCoding.system, code: e.valueCoding.code, display: e.valueCoding.display }));
    }
  }

  const rs = fhirItem._text?.extension?.find(x => x.url && x.url.includes('rendering-style'));
  if (rs) node._renderStyle = rs.valueString || '';
  const rx = fhirItem._text?.extension?.find(x => x.url && x.url.includes('rendering-xhtml'));
  if (rx) node._renderXhtml = rx.valueString || '';
  const rm = fhirItem._text?.extension?.find(x => x.url && x.url.includes('rendering-markdown'));
  if (rm) node._renderMarkdown = rm.valueMarkdown || rm.valueString || '';

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

  // SDC answerExpression — dynamic answer options computed via FHIRPath
  const answerExprExt = (fhirItem.extension || []).find(
    e => e.url === 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-answerExpression'
  );
  if (answerExprExt?.valueExpression) {
    node._answerExpression = answerExprExt.valueExpression.expression || '';
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

  // sdc-questionnaire-choiceColumn (0..* — multi-column display for choice/open-choice/reference)
  const choiceColExts = (fhirItem.extension || []).filter(
    e => e.url === 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-choiceColumn'
  );
  if (choiceColExts.length) {
    node._choiceColumns = choiceColExts.map(ext => {
      const sub = ext.extension || [];
      const col = {};
      const pathExt = sub.find(s => s.url === 'path');
      if (pathExt?.valueString) col.path = pathExt.valueString;
      const labelExt = sub.find(s => s.url === 'label');
      if (labelExt?.valueString) col.label = labelExt.valueString;
      const widthExt = sub.find(s => s.url === 'width');
      if (widthExt?.valueQuantity) col.width = widthExt.valueQuantity;
      const forDisplayExt = sub.find(s => s.url === 'forDisplay');
      if (forDisplayExt?.valueBoolean !== undefined) col.forDisplay = forDisplayExt.valueBoolean;
      return col;
    });
  }

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

  // maxDecimalPlaces
  const maxDecExt = (fhirItem.extension || []).find(
    e => e.url === 'http://hl7.org/fhir/StructureDefinition/maxDecimalPlaces'
  );
  if (maxDecExt?.valueInteger !== undefined) node._maxDecimalPlaces = maxDecExt.valueInteger;

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

  // sdc-questionnaire-openLabel (open-choice items only)
  if (node.itemType === 'open-choice') {
    const openLabelExt = (fhirItem.extension || []).find(
      e => e.url === 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-openLabel'
    );
    if (openLabelExt?.valueString) node._openLabel = openLabelExt.valueString;
  }

  // sdc-questionnaire-preferredTerminologyServer — per-item terminology server override
  const prefTermExt = (fhirItem.extension || []).find(
    e => e.url === 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-preferredTerminologyServer'
  );
  if (prefTermExt?.valueUrl) node._preferredTermServer = prefTermExt.valueUrl;

  // sdc-questionnaire-shortText — abbreviated label for summary views
  const shortTextExt = (fhirItem.extension || []).find(
    e => e.url === 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-shortText'
  );
  if (shortTextExt?.valueString) node._shortText = shortTextExt.valueString;

  // designNote — author-facing internal note
  const designNoteExt = (fhirItem.extension || []).find(
    e => e.url === 'http://hl7.org/fhir/StructureDefinition/designNote'
  );
  if (designNoteExt?.valueMarkdown) node._designNote = designNoteExt.valueMarkdown;
  else if (designNoteExt?.valueString) node._designNote = designNoteExt.valueString;

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
export function fhirItemToNode(fhirItem, linkIdMap, contained) {
  const t = fhirItem.type || 'string';

  if (t === 'group') {
    const node = createGroupNode({
      id:        fhirItem.linkId,
      title:     fhirItem.text || fhirItem.linkId || 'Group',
      mandatory: !!fhirItem.required,
    });
    applyVisibility(node, fhirItem, linkIdMap);
    const hasOrGroup = applyConstraints(node, fhirItem);
    if (hasOrGroup) node.logicWithParent = 'OR';
    const rs = fhirItem._text?.extension?.find(x => x.url && x.url.includes('rendering-style'));
    if (rs) node._renderStyle = rs.valueString || '';
    const rx = fhirItem._text?.extension?.find(x => x.url && x.url.includes('rendering-xhtml'));
    if (rx) node._renderXhtml = rx.valueString || '';
    const rm = fhirItem._text?.extension?.find(x => x.url && x.url.includes('rendering-markdown'));
    if (rm) node._renderMarkdown = rm.valueMarkdown || rm.valueString || '';
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
    // sdc-questionnaire-collapsible
    const collapsibleExt = (fhirItem.extension || []).find(
      e => e.url === 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-collapsible'
    );
    if (collapsibleExt?.valueCode) node._collapsible = collapsibleExt.valueCode;
    // sdc-questionnaire-preferredTerminologyServer — per-item terminology server override (groups)
    const groupPrefTermExt = (fhirItem.extension || []).find(
      e => e.url === 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-preferredTerminologyServer'
    );
    if (groupPrefTermExt?.valueUrl) node._preferredTermServer = groupPrefTermExt.valueUrl;
    // sdc-questionnaire-shortText (groups)
    const groupShortTextExt = (fhirItem.extension || []).find(
      e => e.url === 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-shortText'
    );
    if (groupShortTextExt?.valueString) node._shortText = groupShortTextExt.valueString;
    // designNote — author-facing internal note (groups)
    const groupDesignNoteExt = (fhirItem.extension || []).find(
      e => e.url === 'http://hl7.org/fhir/StructureDefinition/designNote'
    );
    if (groupDesignNoteExt?.valueMarkdown) node._designNote = groupDesignNoteExt.valueMarkdown;
    else if (groupDesignNoteExt?.valueString) node._designNote = groupDesignNoteExt.valueString;
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
    const wrapper = createGroupNode({
      id:        fhirItem.linkId ? fhirItem.linkId + '-grp' : undefined,
      title:     fhirItem.text || fhirItem.linkId || 'Group',
      mandatory: !!fhirItem.required,
    });
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
