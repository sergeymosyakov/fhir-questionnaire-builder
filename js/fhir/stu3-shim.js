// ── FHIR STU3 → R4 normalisation shim ────────────────────────────────────────
// Accepts a raw Questionnaire JSON object and returns an R4-compatible copy.
// If the input is already R4 the object is returned unchanged (no-op).
//
// Conversions applied (item-level, recursive):
//   item.option[]          → item.answerOption[]
//   item.options (Ref)     → item.answerValueSet (canonical URL)
//   enableWhen.hasAnswer   → enableWhen.operator + answerBoolean
//   enableWhen answer[x]   → enableWhen.operator: '=' + answer[x]  (STU3 implicit equality)
//   item.initial<Type>     → item.initial: [{ value<Type>: ... }]

// ── Detection ─────────────────────────────────────────────────────────────────

function _isStu3Version(ver) {
  return typeof ver === 'string' && (ver.startsWith('3.') || ver.startsWith('1.'));
}

function _itemHasStu3Fields(item) {
  if (!item) return false;
  if (Array.isArray(item.option) && item.option.length) return true;
  if (item.options) return true;
  for (const ew of item.enableWhen || []) {
    if (ew.hasAnswer !== undefined) return true;
    // STU3 enableWhen had no operator field — any answer[x] without operator is STU3
    if (!('operator' in ew) && _hasStu3AnswerField(ew)) return true;
  }
  if (_hasStu3InitialField(item)) return true;
  for (const child of item.item || []) {
    if (_itemHasStu3Fields(child)) return true;
  }
  return false;
}

function _hasStu3AnswerField(ew) {
  return Object.keys(ew).some(k => k.startsWith('answer'));
}

const STU3_INITIAL_KEYS = [
  'initialBoolean', 'initialDecimal', 'initialInteger', 'initialDate',
  'initialDateTime', 'initialTime', 'initialString', 'initialUri',
  'initialAttachment', 'initialCoding', 'initialQuantity', 'initialReference',
];

function _hasStu3InitialField(item) {
  return STU3_INITIAL_KEYS.some(k => item[k] !== undefined);
}

export function isSTU3(fhirJson) {
  if (!fhirJson || fhirJson.resourceType !== 'Questionnaire') return false;
  if (_isStu3Version(fhirJson.fhirVersion)) return true;
  if (_isStu3Version(fhirJson.meta?.fhirVersion)) return true;
  for (const item of fhirJson.item || []) {
    if (_itemHasStu3Fields(item)) return true;
  }
  return false;
}

// ── Per-field conversions ──────────────────────────────────────────────────────

// item.option[] → item.answerOption[]
// STU3 option entries are identical in shape to R4 answerOption entries
function _convertOptions(item) {
  if (Array.isArray(item.option) && !Array.isArray(item.answerOption)) {
    item.answerOption = item.option;
    delete item.option;
  }
}

// item.options (STU3 Reference to ValueSet) → item.answerValueSet (R4 canonical)
function _convertOptionsRef(item) {
  if (item.options && typeof item.options === 'object' && item.options.reference) {
    item.answerValueSet = item.options.reference;
    delete item.options;
  }
}

// enableWhen: STU3 → R4 operator model
// STU3: { question, hasAnswer: bool } or { question, answer<Type>: val }  (no operator)
// R4:   { question, operator, answer<Type> }
function _convertEnableWhen(ewArray) {
  if (!Array.isArray(ewArray)) return ewArray;
  return ewArray.map(ew => {
    const out = { ...ew };
    // hasAnswer → exists operator
    if (out.hasAnswer !== undefined) {
      out.operator = 'exists';
      out.answerBoolean = out.hasAnswer;
      delete out.hasAnswer;
      return out;
    }
    // No operator but has answer[x] → implicit equality
    if (!out.operator) {
      const answerKey = Object.keys(out).find(k => k.startsWith('answer'));
      if (answerKey) out.operator = '=';
    }
    return out;
  });
}

// item.initial<Type> → item.initial: [{ value<Type>: ... }]
// In STU3 an item had at most one initial value stored as a typed field on the item.
const STU3_INITIAL_MAP = {
  initialBoolean:    'valueBoolean',
  initialDecimal:    'valueDecimal',
  initialInteger:    'valueInteger',
  initialDate:       'valueDate',
  initialDateTime:   'valueDateTime',
  initialTime:       'valueTime',
  initialString:     'valueString',
  initialUri:        'valueUri',
  initialAttachment: 'valueAttachment',
  initialCoding:     'valueCoding',
  initialQuantity:   'valueQuantity',
  initialReference:  'valueReference',
};

function _convertInitial(item) {
  if (Array.isArray(item.initial)) return; // already R4 format
  for (const [stu3Key, r4Key] of Object.entries(STU3_INITIAL_MAP)) {
    if (item[stu3Key] !== undefined) {
      item.initial = [{ [r4Key]: item[stu3Key] }];
      delete item[stu3Key];
      return;
    }
  }
}

// ── Recursive item normalisation ──────────────────────────────────────────────

function _normaliseItem(item) {
  _convertOptions(item);
  _convertOptionsRef(item);
  if (item.enableWhen) item.enableWhen = _convertEnableWhen(item.enableWhen);
  _convertInitial(item);
  for (const child of item.item || []) _normaliseItem(child);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Normalise a FHIR STU3 Questionnaire to R4-compatible shape.
 * Returns the original object unchanged if it is already R4.
 * Always operates on a deep clone to avoid mutating the caller's input.\n * Returns the original object unchanged if it is already R4 (no clone needed).
 *
 * @param {object} fhirJson - raw Questionnaire JSON
 * @returns {object} R4-compatible Questionnaire JSON
 */
export function normaliseSTU3(fhirJson) {
  if (!isSTU3(fhirJson)) return fhirJson;
  const q = JSON.parse(JSON.stringify(fhirJson)); // deep clone
  for (const item of q.item || []) _normaliseItem(item);
  return q;
}
