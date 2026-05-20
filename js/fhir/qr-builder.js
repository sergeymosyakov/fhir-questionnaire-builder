// ── QuestionnaireResponse builder ─────────────────────────────────────────────
// Builds a minimal QR from the original FHIR Questionnaire JSON + current values.
// Used as context for FHIRPath calculatedExpression evaluation.
//
// FHIR QR nesting rules:
//   group items  → children in item[] directly (no answer)
//   non-group with children → answer[0].valueX + answer[0].item[]
//   leaf questions → answer[0].valueX (only when answered)

const ORDINAL_URL = 'http://hl7.org/fhir/StructureDefinition/ordinalValue';

function buildQRItem(fhirItem, values) {
  const qrItem = { linkId: fhirItem.linkId };
  const children = fhirItem.item || [];
  const t = fhirItem.type || 'string';
  const val = values[fhirItem.linkId];

  // Collect all answer values: primary + repeat rows ($$1, $$2, …)
  function allVals() {
    const id = fhirItem.linkId;
    const n  = values[id + '$$n'] || 0;
    const vs = val !== undefined ? [val] : [];
    for (let i = 1; i <= n; i++) {
      const v = values[id + '$$' + i];
      if (v !== undefined) vs.push(v);
    }
    return vs;
  }

  function makeAnswer(v) {
    if (t === 'boolean')  return { valueBoolean: v === true };
    if (t === 'date')     return { valueDate: String(v) };
    if (t === 'dateTime') return { valueDateTime: String(v) };
    if (t === 'time')     return { valueTime: String(v) };
    if (t === 'choice' || t === 'open-choice') {
      const codeStr = String(v);
      const coding  = { code: codeStr };
      // Enrich from answerOption: system, display, ordinalValue extension
      const opt = (fhirItem.answerOption || []).find(o =>
        (o.valueCoding && o.valueCoding.code === codeStr) ||
        (o.valueString !== undefined && String(o.valueString) === codeStr)
      );
      if (opt && opt.valueCoding) {
        if (opt.valueCoding.system)  coding.system  = opt.valueCoding.system;
        if (opt.valueCoding.display) coding.display = opt.valueCoding.display;
        const ordExt =
          (opt.extension        || []).find(e => e.url === ORDINAL_URL) ||
          (opt.valueCoding.extension || []).find(e => e.url === ORDINAL_URL);
        if (ordExt !== undefined)
          coding.extension = [{ url: ORDINAL_URL, valueDecimal: ordExt.valueDecimal }];
      }
      return { valueCoding: coding };
    }
    if (t === 'integer')                     return { valueInteger: parseInt(v) || 0 };
    if (t === 'decimal' || t === 'quantity') return { valueDecimal: parseFloat(v) || 0 };
    if (t === 'reference')  return { valueReference: { reference: String(v?.reference || '') } };
    return { valueString: String(v) };
  }

  if (t === 'group') {
    if (children.length > 0) {
      qrItem.item = children.map(child => buildQRItem(child, values));
    }
  } else if (children.length > 0) {
    const answerObj = {};
    if (t === 'boolean') {
      if (val !== undefined) answerObj.valueBoolean = val === true;
    } else if (t === 'string' || t === 'text') {
      if (val !== undefined) answerObj.valueString = String(val);
    }
    answerObj.item = children.map(child => buildQRItem(child, values));
    qrItem.answer = [answerObj];
  } else {
    const vs = allVals();
    if (vs.length > 0) qrItem.answer = vs.map(makeAnswer);
  }

  return qrItem;
}

export function buildQR(fhirJson, values) {
  return {
    resourceType: 'QuestionnaireResponse',
    questionnaire: fhirJson.url || fhirJson.id || '',
    status: 'in-progress',
    item: (fhirJson.item || []).map(item => buildQRItem(item, values))
  };
}
