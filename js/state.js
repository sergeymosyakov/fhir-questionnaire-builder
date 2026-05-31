// ── State, factories, and pure utilities ───────────────────────────────────────────

// ── State ────────────────────────────────────────────────────────────────────────────
export const tree = [];

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

// FHIRPath: original FHIR Questionnaire JSON after import; null if not loaded.
export const rawFhir = { value: null };

// Questionnaire-level SDC variables: [{name, expression}]
// Populated from sdc-questionnaire-variable extensions on import.
// Also used to store patient context variables (%age, %gender, %bmi, ...).
export const questVariables = [];

// Questionnaire-level metadata — preserved across import/export and editable via Properties modal.
export const questMeta = {
  // Core (always visible in Properties modal)
  id:            '',
  url:           '',
  version:       '',
  title:         '',
  status:        'draft',
  publisher:     '',
  description:   '',
  name:          '',
  // Advanced (collapsible section in Properties modal)
  date:          '',          // Questionnaire.date — last changed; exported as-is (today if blank)
  subjectType:   [],           // Questionnaire.subjectType — array of resource type codes; empty = unrestricted
  purpose:       '',
  copyright:     '',
  approvalDate:  '',
  lastReviewDate: '',
  effectivePeriodStart: '',   // Questionnaire.effectivePeriod.start
  effectivePeriodEnd:   '',   // Questionnaire.effectivePeriod.end
  experimental:    null,       // null = not set, true/false = Questionnaire.experimental
  language:        '',          // BCP-47 language code, e.g. 'en', 'en-US'
  derivedFrom:     [],          // canonical[] — parent questionnaire URLs
  replaces:        [],          // canonical[] — questionnaires superseded by this one (extension: replaces)
  // Business identifiers — editable via Properties modal
  _rawIdentifier:   [],        // Questionnaire.identifier[] — array of { use?, system?, value? }
  // Questionnaire root fields — varying edit support (see individual comments)
  _rawText:         null,      // Questionnaire.text — FHIR Narrative { status, div } — shown read-only in Properties modal
  _rawContact:      null,      // Questionnaire.contact[] — editable via Contact section in Properties modal
  _rawUseContext:   null,      // Questionnaire.useContext[] — pass-through only; too complex for a generic editor
  _rawJurisdiction: null,      // Questionnaire.jurisdiction[] — editable via Jurisdiction section in Properties modal; full CodeableConcept[] preserved; only coding[0] shown per entry
  _rawCode:         null,      // Questionnaire.code[] root-level coding — editable via Codes section in Properties modal
  // meta.* — partially editable via Properties modal "Resource Meta" section
  _metaVersionId:   '',       // meta.versionId — editable text + Generate button
  _metaSource:      '',       // meta.source — URI; editable text input
  _metaLastUpdated: '',       // meta.lastUpdated — display only; always refreshed to now on export
  _rawMetaProfile:  [],       // meta.profile[] — canonical URLs; editable list
  _rawMetaTag:      [],       // meta.tag[] — Coding[]; editable system/code/display rows
  _rawMetaSecurity: [],       // meta.security[] — Coding[]; editable system/code/display rows
  _rawQuestExtensions: [],    // Questionnaire.extension[] — non-variable extensions, preserved for round-trip
  preferredTermServer: '',    // Questionnaire.extension[sdc-questionnaire-preferredTerminologyServer].valueUrl
};

// Questionnaire.contained[] — raw FHIR resource objects, preserved for round-trip.
export const questContained = [];

/** Reset all questMeta fields to their initial empty state. */
export function resetQuestMeta() {
  questMeta.id = ''; questMeta.url = ''; questMeta.version = '';
  questMeta.title = ''; questMeta.status = 'draft';
  questMeta.publisher = ''; questMeta.description = ''; questMeta.name = '';
  questMeta.date = ''; questMeta.subjectType = [];
  questMeta.purpose = ''; questMeta.copyright = '';
  questMeta.approvalDate = ''; questMeta.lastReviewDate = '';
  questMeta.effectivePeriodStart = ''; questMeta.effectivePeriodEnd = '';
  questMeta.experimental = null; questMeta.language = ''; questMeta.derivedFrom = [];
  questMeta.replaces = [];
  questMeta._rawIdentifier = [];
  questMeta._rawText = null;
  questMeta._rawContact = null; questMeta._rawUseContext = null; questMeta._rawJurisdiction = null;
  questMeta._rawCode = null;
  questMeta._metaVersionId = ''; questMeta._metaSource = '';
  questMeta._metaLastUpdated = ''; questMeta._rawMetaProfile = [];
  questMeta._rawMetaTag = []; questMeta._rawMetaSecurity = [];
  questMeta._rawQuestExtensions = [];
  questMeta.preferredTermServer = '';
}

// Item types that have form-value validation logic in the preview.
// CHECKABLE_TYPES: any validation exists (mandatory empty-check, format, or required-file).
// NONEMPTY_TYPES: mandatory → value must be non-empty (subset, excludes url/attachment).
export const CHECKABLE_TYPES = new Set(['checkbox', 'text', 'number', 'date', 'dateTime', 'time', 'url', 'attachment', 'open-choice', 'decimal', 'integer', 'quantity', 'reference', 'radio', 'select', 'checklist']);
export const NONEMPTY_TYPES  = new Set(['text', 'number', 'date', 'dateTime', 'time', 'open-choice', 'decimal', 'integer', 'radio', 'select', 'checklist']);

// ── ID factory ────────────────────────────────────────────────────────────────
export { resetSeq } from './id.js';


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
