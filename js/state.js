// ── State, factories, and pure utilities ───────────────────────────────────────────

// ── Document state ────────────────────────────────────────────────────────────
// The currently loaded FHIR Questionnaire document — tree, rawFhir, metadata,
// contained resources, and SDC variables — lives in QuestDocument.
// Import questDoc wherever document state is needed.
export { questDoc } from './fhir/quest-document.js';

// ── Answer store ──────────────────────────────────────────────────────────────
// Plain (non-reactive) store for current form values in preview.
// Not reactive on purpose — answer values never trigger re-renders.
// Do not access this directly — use getValue / setValue / deleteValue / clearAllValues.
export const values = {};

// ── Values API ────────────────────────────────────────────────────────────────
// The single source of truth for answer access. When repeats support is added
// the internal storage will change; all callers that use this API will be safe.

/** Return the primary (first) answer for a linkId. */
export const getValue   = id  => values[id];

/** Set the primary answer for a linkId. */
export const setValue   = (id, val) => { values[id] = val; };

/** Delete the answer for a linkId. */
export const deleteValue = id => { delete values[id]; };

/** Wipe the entire answer store (used on import / reset). */
export const clearAllValues = () => { Object.keys(values).forEach(k => delete values[k]); };

/** Return all answers for a linkId: primary + repeat rows ($$1, $$2, …). */
export function getAllValues(id) {
  const result = [];
  if (values[id] !== undefined) result.push(values[id]);
  const n = values[id + '$$n'] || 0;
  for (let i = 1; i <= n; i++) {
    if (values[id + '$$' + i] !== undefined) result.push(values[id + '$$' + i]);
  }
  return result;
}

// ── ID factory ────────────────────────────────────────────────────────────────
export { resetSeq } from './id.js';

// Item types that have form-value validation logic in the preview.
// CHECKABLE_TYPES: any validation exists (mandatory empty-check, format, or required-file).
// NONEMPTY_TYPES: mandatory → value must be non-empty (subset, excludes url/attachment).
export const CHECKABLE_TYPES = new Set(['checkbox', 'text', 'number', 'date', 'dateTime', 'time', 'url', 'attachment', 'open-choice', 'decimal', 'integer', 'quantity', 'reference', 'radio', 'select', 'checklist']);
export const NONEMPTY_TYPES  = new Set(['text', 'number', 'date', 'dateTime', 'time', 'open-choice', 'decimal', 'integer', 'radio', 'select', 'checklist']);


// Helper: follows FHIR spec — required defaults to false; only true when explicitly set
export const isMandatory = node => node.mandatory === true;

// ── Form-value success check ──────────────────────────────────────────────────
function _isValidUrl(s) {
  try { new URL(s); return true; } catch { return false; }
}

// Evaluate FHIR questionnaire-constraint[] against current value.
// Returns true if all error-severity constraints pass (or there are none).
export function evalConstraints(node, fp, qr, varEnv) {
  if (!node.constraint || !node.constraint.length) return true;
  if (!fp || !qr) return true; // cannot evaluate — treated as pass (no evaluator available)
  const env = { resource: qr, ...varEnv };
  for (const c of node.constraint) {
    if (!c.expression || c.severity !== 'error') continue;
    try {
      const result = fp.evaluate(qr, c.expression, env);
      if (!result || result.length === 0 || result[0] === false) return false;
    } catch { return false; }
  }
  return true;
}

export const calcFormOk = node => {
  // ReadOnly calc node: evaluated value is always current (auto-calc)
  // Only boolean (checkbox) calc nodes participate in pass/fail
  if (node._calculatedExpr && node._readOnly) {
    if (node.itemType !== 'checkbox') return true;
    return getValue(node.id) === true;
  }
  // checkbox: mandatory → must have been explicitly answered (true = yes, false = no)
  // undefined means the user has not interacted yet → still invalid
  if (node.itemType === 'checkbox' && isMandatory(node)) {
    const val = getValue(node.id);
    return val === true || val === false;
  }
  // url: validate format regardless of required
  if (node.itemType === 'url') {
    const val = getValue(node.id);
    if (!val || val === '') return !isMandatory(node);
    if (!_isValidUrl(val)) return false;
    if (node._regex) { try { if (!new RegExp(node._regex).test(val)) return false; } catch { /* invalid regex — skip */ } }
    return true;
  }
  // attachment: required means a file must be chosen; also enforce maxFileSizeMB
  if (node.itemType === 'attachment') {
    const val = getValue(node.id);
    if (val && node._maxFileSizeMB !== undefined) {
      if (val.size > node._maxFileSizeMB * 1024 * 1024) return false;
    }
    if (!isMandatory(node)) return true;
    return val != null;
  }
  // integer/decimal/number: check min/max range (regardless of required)
  if (node.itemType === 'integer' || node.itemType === 'decimal' || node.itemType === 'number') {
    const val = getValue(node.id);
    if (val !== undefined && val !== '' && val !== null) {
      const num = Number(val);
      if (!isFinite(num)) return false; // non-numeric input is always invalid
      if (node._minValue !== undefined && num < Number(node._minValue)) return false;
      if (node._maxValue !== undefined && num > Number(node._maxValue)) return false;
      if (node._maxDecimalPlaces !== undefined) {
        const parts = String(val).split('.');
        if (parts.length > 1 && parts[1].length > node._maxDecimalPlaces) return false;
      }
    }
    if (isMandatory(node)) return val !== undefined && val !== '' && val !== null;
    return true;
  }
  if (node.mandatory === false) return true;
  // reference: mandatory → { reference: "Type/id" } must be present
  if (node.itemType === 'reference') {
    if (!isMandatory(node)) return true;
    const val = getValue(node.id);
    return val != null && typeof val === 'object' && !!val.reference;
  }
  // quantity: mandatory → { value: number, unit: string } must be present
  if (node.itemType === 'quantity') {
    if (!isMandatory(node)) return true;
    const val = getValue(node.id);
    return val != null && typeof val === 'object' && val.value !== undefined && !!val.unit;
  }
  // minLength: non-empty value must meet minimum length
  if (node._minLength) {
    const val = getValue(node.id);
    if (val && String(val).length > 0 && String(val).length < node._minLength) return false;
  }
  // regex: non-empty value must match pattern
  if (node._regex) {
    const val = getValue(node.id);
    if (val && String(val).length > 0) { try { if (!new RegExp(node._regex).test(String(val))) return false; } catch { /* invalid regex — skip */ } }
  }
  // mandatory text/number/date/etc → must be non-empty
  if (isMandatory(node) && NONEMPTY_TYPES.has(node.itemType)) {
    const val = getValue(node.id);
    return val !== undefined && val !== '' && val !== null;
  }
  return true;
};

// ── Pure utilities ────────────────────────────────────────────────────────────
// All utility functions are in js/utils.js — import directly from there.
