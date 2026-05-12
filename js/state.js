// ── Reactive state, factories, and pure utilities ────────────────────────────
// Re-export effect so other modules don't need to know the CDN URL.
export { ref, reactive, effect } from 'https://unpkg.com/@vue/reactivity@3/dist/reactivity.esm-browser.js';
import { ref, reactive } from 'https://unpkg.com/@vue/reactivity@3/dist/reactivity.esm-browser.js';

// ── Reactive state ────────────────────────────────────────────────────────────
// FHIR Patient R4 fields relevant for Questionnaire logic
export const age      = ref(30);
export const gender   = ref('male');       // male | female | other | unknown
export const bmi      = ref(42);
export const pregnant = ref(false);        // boolean (Extension: pregnancyStatus)
export const smoker   = ref(false);        // boolean (Observation: tobacco-use)
export const proc     = ref('43644');      // procedure code (Claim.procedure)
export const comorb   = ref('');           // comma-separated condition codes / display names
export const tree     = reactive([]);

// Plain (non-reactive) store for current form values in preview.
// Not reactive on purpose — avoids re-triggering effect() on every keystroke.
export const values = {};

// Tracks which node IDs were pre-filled by conditionRule (vs manually edited).
export const autoFilledIds = new Set();

// Reactive tick: incremented when a checkbox/select changes in the preview.
// Causes effect() to re-run → re-evaluates enableWhen visibility conditions.
export const _formTick = ref(0);

// FHIRPath: original FHIR Questionnaire JSON after import; null if not loaded.
export const rawFhir = ref(null);
// True after Test button clicked, reset on any form value change.
export const calcTested = ref(false);

// Item types that have form-value validation logic in the preview.
// CHECKABLE_TYPES: any validation exists (mandatory empty-check, format, or required-file).
// NONEMPTY_TYPES: mandatory → value must be non-empty (subset, excludes url/attachment).
export const CHECKABLE_TYPES = new Set(['checkbox', 'text', 'number', 'date', 'url', 'attachment']);
export const NONEMPTY_TYPES  = new Set(['text', 'number', 'date']);

// ── ID factory ────────────────────────────────────────────────────────────────
let _seq = 1;
export const nextId   = () => 'n' + (_seq++);
export const resetSeq = () => { _seq = 1; };

// ── Data factories ────────────────────────────────────────────────────────────
export const makeGroup = title => ({
  id: nextId(), type: 'group',
  title: title || 'New Group',
  visibilityRule: '', conditionRule: '', mandatory: null,
  logicWithParent: 'AND', children: []
});

// mandatory: null = not set (acts as required), true = required, false = optional.
// If template is provided, copies all settings from it (except id and title).
export const makeItem = (title, template) => {
  if (template) {
    return {
      id: nextId(), type: 'item',
      title: title || 'New Item',
      visibilityRule: '',                    // do not inherit: specific to source item
      mandatory:      template.mandatory,
      conditionRule:  template.conditionRule,
      itemType:       template.itemType,
      options:        template.options,
      successValue:   template.successValue
    };
  }
  return {
    id: nextId(), type: 'item',
    title: title || 'New Item',
    visibilityRule: '', mandatory: null,
    conditionRule: '', itemType: 'text',
    options: '', successValue: ''
  };
};

// Helper: null mandatory behaves as true (required unless explicitly set false)
export const isMandatory = node => node.mandatory !== false;

// ── Rule evaluation ───────────────────────────────────────────────────────────
// Exposed variables (FHIR Patient R4 context):
//   age, gender, bmi, pregnant, smoker, proc, comorb, values
export const evalRule = (rule, ctx) => {
  if (!rule || !rule.trim()) return true;
  try {
    return !!new Function(
      'age', 'gender', 'bmi', 'pregnant', 'smoker', 'proc', 'comorb', 'values',
      'return (' + rule + ');'
    )(ctx.age, ctx.gender, ctx.bmi, ctx.pregnant, ctx.smoker, ctx.proc, ctx.comorb, values);
  } catch (_) { return false; }
};

// ── Form-value success check ──────────────────────────────────────────────────
function _isValidUrl(s) {
  try { new URL(s); return true; } catch { return false; }
}

export const calcFormOk = node => {
  // ReadOnly calc node: if Test was run, the result is the evaluated FHIRPath value
  // Only boolean (checkbox) calc nodes participate in pass/fail
  if (node._calculatedExpr && node._readOnly && calcTested.value) {
    if (node.itemType !== 'checkbox') return true;
    return values[node.id] === true;
  }
  // checkbox: mandatory without conditionRule → must be checked by the user
  if (node.itemType === 'checkbox' && isMandatory(node) && !node.conditionRule) {
    return values[node.id] === true;
  }
  // url: validate format regardless of required (must come before mandatory===false early return)
  if (node.itemType === 'url') {
    const val = values[node.id];
    if (!val || val === '') return !isMandatory(node);
    return _isValidUrl(val);
  }
  // attachment: required means a file must be chosen
  if (node.itemType === 'attachment') {
    if (!isMandatory(node)) return true;
    const val = values[node.id];
    return val != null;
  }
  if (node.mandatory === false) return true;
  // No successValue but mandatory → text/number/date must be non-empty
  if (isMandatory(node) && NONEMPTY_TYPES.has(node.itemType)) {
    const val = values[node.id];
    return val !== undefined && val !== '' && val !== null;
  }
  return true;
};

// ── Pure utilities ────────────────────────────────────────────────────────────
export const escAttr = s => (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');

export function findAndRemove(id, nodes) {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === id) { nodes.splice(i, 1); return; }
    if (nodes[i].type === 'group') findAndRemove(id, nodes[i].children);
  }
}

// Returns true if nodeId is anywhere inside group's subtree (recursive).
export function isDescendant(nodeId, group) {
  for (const ch of group.children) {
    if (ch.id === nodeId) return true;
    if (ch.type === 'group' && isDescendant(nodeId, ch)) return true;
  }
  return false;
}
