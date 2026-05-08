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

  if (t === 'group') {
    // Groups: children go directly under item[], no answer
    if (children.length > 0) {
      qrItem.item = children.map(child => buildQRItem(child, values));
    }
  } else if (children.length > 0) {
    // Non-group question with sub-items: answer contains value + nested items
    const answerObj = {};
    if (t === 'boolean') {
      // Only add valueBoolean if explicitly answered
      if (val !== undefined) answerObj.valueBoolean = val === true;
    } else if (t === 'string' || t === 'text') {
      if (val !== undefined) answerObj.valueString = String(val);
    }
    answerObj.item = children.map(child => buildQRItem(child, values));
    qrItem.answer = [answerObj];
  } else if (val !== undefined) {
    // Leaf question with a value
    if (t === 'boolean') {
      qrItem.answer = [{ valueBoolean: val === true }];
    } else if (t === 'choice' || t === 'open-choice') {
      qrItem.answer = [{ valueCoding: { code: String(val) } }];
    } else if (t === 'integer') {
      qrItem.answer = [{ valueInteger: parseInt(val) || 0 }];
    } else if (t === 'decimal' || t === 'quantity') {
      qrItem.answer = [{ valueDecimal: parseFloat(val) || 0 }];
    } else {
      qrItem.answer = [{ valueString: String(val) }];
    }
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
