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
export const testMode = ref(false);
export const tree     = reactive([]);

// Plain (non-reactive) store for current form values in preview.
// Not reactive on purpose — avoids re-triggering effect() on every keystroke.
export const values = {};

// Tracks which node IDs were pre-filled by conditionRule (vs manually edited).
export const autoFilledIds = new Set();

// Reactive tick: incremented when a checkbox/select changes in the preview.
// Causes effect() to re-run → re-evaluates enableWhen visibility conditions.
export const _formTick = ref(0);

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
export const calcFormOk = node => {
  if (node.mandatory === false || node.successValue === '') return true;
  const val = values[node.id];
  if (node.itemType === 'checkbox') return String(!!val) === node.successValue;
  return String(val !== undefined ? val : '') === String(node.successValue);
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
