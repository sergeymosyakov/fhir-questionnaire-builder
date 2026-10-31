import { FHIR } from './urls/fhir.js';
import { splitCodes } from './checklist-codec.js';
// ── QuestionnaireResponse builder ─────────────────────────────────────────────
// Builds a minimal QR from the original FHIR Questionnaire JSON + current values.
// Used as context for FHIRPath calculatedExpression evaluation.
//
// FHIR QR nesting rules:
//   group items  → children in item[] directly (no answer)
//   non-group with children → answer[0].valueX + answer[0].item[]
//   leaf questions → answer[0].valueX (only when answered)

const ORDINAL_URL = FHIR.ordinalValue;

// Build a single QR answer object for one value, typed by the FHIR item's type.
// Exported so calculatedExpression evaluation can write results back into the QR
// using the exact same value-mapping rules as the initial QR build.
// Returns null when the value has no valid QR representation (callers omit the answer).
export function buildAnswer(fhirItem, v) {
  const t = fhirItem.type || 'string';
  // The store holds file-chip metadata only; a loaded QR keeps its original Attachment for verbatim re-export
  if (t === 'attachment') return v?.attachment ? { valueAttachment: JSON.parse(JSON.stringify(v.attachment)) } : null;
  // A cleared control stores '' / null; an empty valueX is invalid FHIR and would make answer.exists() true
  if (t !== 'boolean' && (v === '' || v === null || v === undefined)) return null;
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
      (o.valueString !== undefined && String(o.valueString) === codeStr) ||
      (o.valueInteger !== undefined && String(o.valueInteger) === codeStr) ||
      (o.valueDate !== undefined && o.valueDate === codeStr) ||
      (o.valueTime !== undefined && o.valueTime === codeStr)
    );
    // Options that are not codings answer with the same value[x] type
    if (opt && !opt.valueCoding) {
      const key = ['valueString', 'valueInteger', 'valueDate', 'valueTime'].find(k => opt[k] !== undefined);
      if (key) return { [key]: opt[key] };
    }
    if (opt && opt.valueCoding) {
      if (opt.valueCoding.system)  coding.system  = opt.valueCoding.system;
      if (opt.valueCoding.display) coding.display = opt.valueCoding.display;
      const ordExt =
        (opt.extension        || []).find(e => e.url === ORDINAL_URL) ||
        (opt.valueCoding.extension || []).find(e => e.url === ORDINAL_URL);
      if (ordExt !== undefined)
        coding.extension = [{ url: ORDINAL_URL, valueDecimal: ordExt.valueDecimal }];
    }
    // Free text typed into an open-choice that matches no defined option is a valueString
    if (t === 'open-choice' && !opt && (fhirItem.answerOption || []).length) return { valueString: codeStr };
    return { valueCoding: coding };
  }
  if (t === 'integer')  return { valueInteger: parseInt(v, 10) || 0 };
  if (t === 'decimal')   return { valueDecimal: parseFloat(v) || 0 };
  if (t === 'quantity') {
    // A cleared quantity keeps its unit but has no value; 0 is a real value
    const qv = parseFloat(v?.value);
    if (isNaN(qv)) return null;
    return { valueQuantity: {
      value: qv, unit: v?.unit || '',
      ...(v?.system ? { system: v.system } : {}), ...(v?.code ? { code: v.code } : {}),
    } };
  }
  if (t === 'url')       return { valueUri: String(v) };
  if (t === 'reference') {
    // ref-1 needs a reference or identifier; a display alone is not an answer
    if (!v?.reference) return null;
    return { valueReference: { reference: String(v.reference), ...(v.display ? { display: String(v.display) } : {}) } };
  }
  return { valueString: String(v) };
}

// A repeating group emits one QR item per stored instance map; everything else emits exactly one item.
function buildQRItems(fhirItem, values) {
  const inst = Object.hasOwn(values, fhirItem.linkId) ? values[fhirItem.linkId] : undefined;
  if (fhirItem.type === 'group' && fhirItem.repeats && Array.isArray(inst) && inst.length
      && inst.every(i => i && typeof i === 'object' && !Array.isArray(i))) {
    return inst.map(map => buildQRItem(fhirItem, map));
  }
  return [buildQRItem(fhirItem, values)];
}

// A checklist stores all its selections in one encoded string: check-box, or atable when repeating (otherwise atable is a radio)
const isChecklistItem = fhirItem => (fhirItem.extension || []).some(e => {
  if (e.url !== FHIR.itemControl) return false;
  const code = e.valueCodeableConcept?.coding?.[0]?.code;
  return code === 'check-box' || (code === 'atable' && !!fhirItem.repeats);
});

function buildQRItem(fhirItem, values) {
  const qrItem = { linkId: fhirItem.linkId };
  const children = fhirItem.item || [];
  const t = fhirItem.type || 'string';
  const rows = Object.hasOwn(values, fhirItem.linkId) ? values[fhirItem.linkId] : undefined;
  const val  = rows ? rows[0] : undefined;

  // Collect all defined answer rows (repeat rows are plain array elements).
  function allVals() {
    return (rows || []).filter(v => v !== undefined);
  }

  const makeAnswer = (v) => buildAnswer(fhirItem, v);

  if (t === 'group') {
    if (children.length > 0) {
      qrItem.item = children.flatMap(child => buildQRItems(child, values));
    }
  } else if (children.length > 0) {
    const answerObj = (val !== undefined && makeAnswer(val)) || {};
    answerObj.item = children.flatMap(child => buildQRItems(child, values));
    qrItem.answer = [answerObj];
  } else {
    const vs = allVals();
    // Checklist (check-box itemControl): value is encoded comma-separated codes → split into individual answers
    if ((t === 'choice' || t === 'open-choice') && isChecklistItem(fhirItem) && vs.length === 1 && typeof vs[0] === 'string') {
      qrItem.answer = splitCodes(vs[0]).map(makeAnswer);
    } else if (vs.length > 0) {
      qrItem.answer = vs.map(makeAnswer);
    }
    if (qrItem.answer) {
      qrItem.answer = qrItem.answer.filter(Boolean);
      if (!qrItem.answer.length) delete qrItem.answer;
    }
  }

  return qrItem;
}

export function buildQR(fhirJson, values) {
  return {
    resourceType: 'QuestionnaireResponse',
    questionnaire: fhirJson.url || fhirJson.id || '',
    status: 'in-progress',
    item: (fhirJson.item || []).flatMap(item => buildQRItems(item, values))
  };
}
