// ── QuestionnaireResponse builder ─────────────────────────────────────────────
// Builds a minimal QR from the original FHIR Questionnaire JSON + current values.
// Used as context for FHIRPath calculatedExpression evaluation.
//
// FHIR QR nesting rules:
//   group items  → children in item[] directly (no answer)
//   non-group with children → answer[0].valueX + answer[0].item[]
//   leaf questions → answer[0].valueX (only when answered)

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
    if (t === 'boolean')                     return { valueBoolean: v === true };
    if (t === 'choice' || t === 'open-choice') return { valueCoding: { code: String(v) } };
    if (t === 'integer')                     return { valueInteger: parseInt(v) || 0 };
    if (t === 'decimal' || t === 'quantity') return { valueDecimal: parseFloat(v) || 0 };
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
