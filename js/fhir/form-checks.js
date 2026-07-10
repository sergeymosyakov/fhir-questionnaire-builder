// ── Form validation checks ────────────────────────────────────────────────────
// Pure functions — no state, no side-effects.
// store (AnswerStore) is passed explicitly as a parameter.
//
// Usage:
//   import { calcFormOk, isMandatory, evalConstraints,
//            CHECKABLE_TYPES, NONEMPTY_TYPES } from './form-checks.js';

// Item types that have form-value validation logic in the preview.
// CHECKABLE_TYPES: any validation exists (mandatory empty-check, format, or required-file).
// NONEMPTY_TYPES: mandatory → value must be non-empty (subset, excludes url/attachment).
export const CHECKABLE_TYPES = new Set(['checkbox', 'text', 'number', 'date', 'dateTime', 'time', 'url', 'attachment', 'open-choice', 'decimal', 'integer', 'quantity', 'reference', 'radio', 'select', 'checklist']);
export const NONEMPTY_TYPES  = new Set(['text', 'number', 'date', 'dateTime', 'time', 'open-choice', 'decimal', 'integer', 'radio', 'select', 'checklist']);

/** follows FHIR spec — required defaults to false; only true when explicitly set */
export const isMandatory = node => node.mandatory === true;

// Evaluate FHIR questionnaire-constraint[] against current value.
// Returns true if all error-severity constraints pass (or there are none).
export function evalConstraints(node, fp, qr, varEnv) {
  if (!node.constraint || !node.constraint.length) return true;
  if (!fp || !qr) return true;
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

function _isValidUrl(s) {
  try { new URL(s); return true; } catch { return false; }
}

/**
 * Check whether a node's current answer satisfies all validation rules.
 * @param {object} node  — tree node
 * @param {object} store — AnswerStore instance (get(id) / data)
 * @param {Array}  [path] — instance path for a field inside a repeating group
 */
export function calcFormOk(node, store, path) {
  if (path && path.length) {
    const base = store;                                    // scope all reads to the instance
    store = { get: id => base.get(id, path) };
  }
  if (node._calculatedExpr && node._readOnly) {
    if (node.itemType !== 'checkbox') return true;
    return store.get(node.id) === true;
  }
  if (node.itemType === 'checkbox' && isMandatory(node)) {
    const val = store.get(node.id);
    return val === true || val === false;
  }
  if (node.itemType === 'url') {
    const val = store.get(node.id);
    if (!val || val === '') return !isMandatory(node);
    if (!_isValidUrl(val)) return false;
    if (node._regex) { try { if (!new RegExp(node._regex).test(val)) return false; } catch { /* invalid regex — skip */ } }
    return true;
  }
  if (node.itemType === 'attachment') {
    const val = store.get(node.id);
    if (val && node._maxFileSizeMB !== undefined) {
      if (val.size > node._maxFileSizeMB * 1024 * 1024) return false;
    }
    if (!isMandatory(node)) return true;
    return val != null;
  }
  if (node.itemType === 'integer' || node.itemType === 'decimal' || node.itemType === 'number') {
    const val = store.get(node.id);
    if (val !== undefined && val !== '' && val !== null) {
      const num = Number(val);
      if (!isFinite(num)) return false;
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
  if (node.itemType === 'reference') {
    if (!isMandatory(node)) return true;
    const val = store.get(node.id);
    return val != null && typeof val === 'object' && !!val.reference;
  }
  if (node.itemType === 'quantity') {
    if (!isMandatory(node)) return true;
    const val = store.get(node.id);
    return val != null && typeof val === 'object' && val.value !== undefined && !!val.unit;
  }
  if (node._minLength) {
    const val = store.get(node.id);
    if (val && String(val).length > 0 && String(val).length < node._minLength) return false;
  }
  if (node._regex) {
    const val = store.get(node.id);
    if (val && String(val).length > 0) { try { if (!new RegExp(node._regex).test(String(val))) return false; } catch { /* invalid regex — skip */ } }
  }
  if (isMandatory(node) && NONEMPTY_TYPES.has(node.itemType)) {
    const val = store.get(node.id);
    return val !== undefined && val !== '' && val !== null;
  }
  return true;
}
