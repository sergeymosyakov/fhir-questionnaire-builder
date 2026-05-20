// ── Reactive state, factories, and pure utilities ────────────────────────────
// Re-export effect so other modules don't need to know the CDN URL.
import { ref, reactive, effect as _effect } from 'https://unpkg.com/@vue/reactivity@3/dist/reactivity.esm-browser.js';
export { _effect as effect };
export { ref, reactive };

// ── Reactive state ────────────────────────────────────────────────────────────
export const tree = reactive([]);

// Plain (non-reactive) store for current form values in preview.
// Not reactive on purpose — avoids re-triggering effect() on every keystroke.
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

// Reactive tick: incremented when a checkbox/select changes in the preview.
// Causes effect() to re-run → re-evaluates enableWhen visibility conditions.
export const _formTick = ref(0);

// Bulk-update guard: set to true before mass tree mutations (renumber, import).
// The preview effect() returns early while true, then re-runs once on reset.
export const _bulkUpdate = ref(false);

// Show/hide FHIR linkId badges in preview.
export const showLinkId = ref(true);

// Show/hide item.prefix badges in preview.
export const showPrefix = ref(true);

// Show/hide all metadata badges in preview (optional, required, logic, calc).
// When false, calculated fields render as plain text.
export const showBadges = ref(true);

// FHIRPath: original FHIR Questionnaire JSON after import; null if not loaded.
export const rawFhir = ref(null);

// Questionnaire-level SDC variables: [{name, expression}]
// Populated from sdc-questionnaire-variable extensions on import.
// Also used to store patient context variables (%age, %gender, %bmi, ...).
export const questVariables = reactive([]);

// Questionnaire-level metadata — preserved across import/export and editable via Properties modal.
export const questMeta = reactive({
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
  subjectType:   'Patient',   // comma-separated, e.g. 'Patient, Practitioner'
  purpose:       '',
  copyright:     '',
  approvalDate:  '',
  lastReviewDate: '',
  // Pass-through: preserved from import, written back on export, no editing UI
  _rawContact:      null,
  _rawUseContext:   null,
  _rawJurisdiction: null,
});

// Questionnaire.contained[] — raw FHIR resource objects, preserved for round-trip.
export const questContained = reactive([]);

// Item types that have form-value validation logic in the preview.
// CHECKABLE_TYPES: any validation exists (mandatory empty-check, format, or required-file).
// NONEMPTY_TYPES: mandatory → value must be non-empty (subset, excludes url/attachment).
export const CHECKABLE_TYPES = new Set(['checkbox', 'text', 'number', 'date', 'dateTime', 'time', 'url', 'attachment', 'open-choice', 'decimal', 'integer', 'quantity', 'reference', 'radio', 'select']);
export const NONEMPTY_TYPES  = new Set(['text', 'number', 'date', 'dateTime', 'time', 'open-choice', 'decimal', 'integer', 'radio', 'select']);

// ── ID factory ────────────────────────────────────────────────────────────────
let _seq = 1;
export const nextId   = () => 'n' + (_seq++);
export const resetSeq = () => { _seq = 1; };

// ── Data factories ────────────────────────────────────────────────────────────
export const makeGroup = title => ({
  id: nextId(), type: 'group',
  title: title || 'New Group',
  // FHIR R4 standard visibility
  enableWhen:           [],    // [{question, operator, answerBoolean|String|Integer|Decimal|Coding}]
  enableBehavior:       'all', // 'all' (AND) | 'any' (OR)
  // SDC enableWhenExpression — FHIRPath for complex conditions (e.g. "%age > 18")
  enableWhenExpression: '',
  mandatory: null,
  logicWithParent: 'AND', children: []
});

// mandatory: null = not set (acts as required), true = required, false = optional.
// If template is provided, copies all settings from it (except id and title).
export const makeItem = (title, template) => {
  if (template) {
    return {
      id: nextId(), type: 'item',
      title: title || 'New Item',
      enableWhen:           [],
      enableBehavior:       'all',
      enableWhenExpression: '',
      mandatory:      template.mandatory,
      repeats:        template.repeats || false,
      itemType:       template.itemType,
      options:        template.options,
      // FHIR questionnaire-constraint: [{key, expression, human, severity}]
      constraint:     template.constraint ? [...template.constraint] : []
    };
  }
  return {
    id: nextId(), type: 'item',
    title: title || 'New Item',
    enableWhen:           [],
    enableBehavior:       'all',
    enableWhenExpression: '',
    mandatory: null,
    repeats:   false,
    itemType: 'text',
    options: '',
    constraint: []
  };
};

// Helper: null mandatory behaves as true (required unless explicitly set false)
export const isMandatory = node => node.mandatory !== false;

// ── Form-value success check ──────────────────────────────────────────────────
function _isValidUrl(s) {
  try { new URL(s); return true; } catch { return false; }
}

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

export const calcFormOk = node => {
  // ReadOnly calc node: evaluated value is always current (auto-calc)
  // Only boolean (checkbox) calc nodes participate in pass/fail
  if (node._calculatedExpr && node._readOnly) {
    if (node.itemType !== 'checkbox') return true;
    return getValue(node.id) === true;
  }
  // checkbox: mandatory → must be checked by the user
  if (node.itemType === 'checkbox' && isMandatory(node)) {
    return getValue(node.id) === true;
  }
  // url: validate format regardless of required
  if (node.itemType === 'url') {
    const val = getValue(node.id);
    if (!val || val === '') return !isMandatory(node);
    return _isValidUrl(val);
  }
  // attachment: required means a file must be chosen
  if (node.itemType === 'attachment') {
    if (!isMandatory(node)) return true;
    return getValue(node.id) != null;
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
  // integer/decimal/number: check min/max range (regardless of required)
  if (node.itemType === 'integer' || node.itemType === 'decimal' || node.itemType === 'number') {
    const val = getValue(node.id);
    if (val !== undefined && val !== '' && val !== null) {
      const num = Number(val);
      if (!isNaN(num)) {
        if (node._minValue !== undefined && num < Number(node._minValue)) return false;
        if (node._maxValue !== undefined && num > Number(node._maxValue)) return false;
      }
    }
    if (isMandatory(node)) return val !== undefined && val !== '' && val !== null;
    return true;
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
