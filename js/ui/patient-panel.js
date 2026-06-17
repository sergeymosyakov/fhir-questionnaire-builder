// ── PatientProfile ────────────────────────────────────────────────────────────
// UI component for patient preset selection and manual variable editing.
// Does NOT know about questDoc or questVariables directly.
// Communicates via VARIABLES_APPLY event — receiver merges into questDoc.variables.
//
// Usage:
//   const profile = new PatientProfile();
//   profile.mount(document.getElementById('patientPresetWrap'));
import { createCustomSelect } from './custom-select.js';
import { Modal } from './modals/modal-base.js';
import { PatientPresetMenu } from './menus/patient-preset-menu.js';
import { AppEvents } from '../events.js';

// ── Variable definitions ──────────────────────────────────────────────────────
const PATIENT_VARS = [
  { name: 'age',      type: 'number',   label: 'Age (years)',      default: 30 },
  { name: 'gender',   type: 'select',   label: 'Biological sex',   default: 'male',
    options: [['male','Male'],['female','Female'],['other','Other'],['unknown','Unknown']] },
  { name: 'bmi',      type: 'number',   label: 'BMI (kg/m\u00B2)', default: 42 },
  { name: 'pregnant', type: 'checkbox', label: 'Pregnant',         default: false },
  { name: 'smoker',   type: 'checkbox', label: 'Smoker',           default: false },
  { name: 'proc',     type: 'text',     label: 'Procedure code',   default: '43644' },
  { name: 'comorb',   type: 'text',     label: 'Comorbidities',    default: '' },
];

// ── Presets ───────────────────────────────────────────────────────────────────
const PATIENT_PRESETS = [
  { id: 'adult-male',      label: 'Adult Male (35 \u00B7 BMI\u202F24)',           shortLabel: 'Adult Male',   values: { age: 35, gender: 'male',   bmi: 24, pregnant: false, smoker: false, proc: '43644', comorb: '' } },
  { id: 'adult-female',    label: 'Adult Female (28 \u00B7 BMI\u202F22)',         shortLabel: 'Adult Female', values: { age: 28, gender: 'female', bmi: 22, pregnant: false, smoker: false, proc: '43644', comorb: '' } },
  { id: 'obese-male',      label: 'Obese Male (45 \u00B7 BMI\u202F38 \u00B7 smoker)', shortLabel: 'Obese Male',  values: { age: 45, gender: 'male',   bmi: 38, pregnant: false, smoker: true,  proc: '43644', comorb: 'diabetes, hypertension' } },
  { id: 'child',           label: 'Child (10 \u00B7 BMI\u202F16)',                shortLabel: 'Child',        values: { age: 10, gender: 'male',   bmi: 16, pregnant: false, smoker: false, proc: '',      comorb: '' } },
  { id: 'pregnant-female', label: 'Pregnant Female (30 \u00B7 BMI\u202F26)',      shortLabel: 'Pregnant F',   values: { age: 30, gender: 'female', bmi: 26, pregnant: true,  smoker: false, proc: '',      comorb: '' } },
];

// ── Converters ────────────────────────────────────────────────────────────────
function toExpr(type, val) {
  if (type === 'number')   return String(parseFloat(val) || 0);
  if (type === 'checkbox') return val ? 'true' : 'false';
  const s = String(val ?? '');
  return "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

function fromExpr(type, expr) {
  if (!expr)               return type === 'number' ? 0 : type === 'checkbox' ? false : '';
  if (type === 'number')   return parseFloat(expr) || 0;
  if (type === 'checkbox') return expr.trim() === 'true';
  const m = expr.match(/^'(.*)'$/s);
  return m ? m[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\') : expr;
}

/** Dispatch VARIABLES_APPLY with a variables array. */
function _applyVars(variables) {
  document.dispatchEvent(new CustomEvent(AppEvents.VARIABLES_APPLY, { detail: { variables } }));
}

/** Build variables array from a preset values object. */
function _presetToVars(preset) {
  return PATIENT_VARS
    .filter(def => def.name in preset.values)
    .map(def => ({ name: def.name, expression: toExpr(def.type, preset.values[def.name]) }));
}

/** Build variables array that seeds missing patient vars with defaults. */
function _defaultVars(existingNames) {
  return PATIENT_VARS
    .filter(def => !existingNames.has(def.name))
    .map(def => ({ name: def.name, expression: toExpr(def.type, def.default) }));
}

// ── Manual-edit modal ─────────────────────────────────────────────────────────
class PatientEditModal extends Modal {
  getName() { return 'patientCtxModal'; }

  /** @type {Object.<string, {inp: HTMLElement, def: object}> | null} */
  _inputs = null;

  constructor() {
    super({ cancelLabel: null });
    this.title.textContent = 'Patient Context';
    this.body.insertAdjacentHTML('beforebegin',
      '<div class="patient-ctx-hint">Values are available in FHIRPath expressions as ' +
      '<code>%age</code>, <code>%gender</code>, <code>%bmi</code>, ' +
      '<code>%pregnant</code>, <code>%smoker</code>, <code>%proc</code>, <code>%comorb</code>.</div>');
  }

  open(currentVars) {
    this._currentVars = currentVars;
    this.body.innerHTML = '';
    this._inputs = {};
    for (const def of PATIENT_VARS) {
      const row = document.createElement('div');
      row.className = 'patient-ctx-row';
      const lbl = document.createElement('span');
      lbl.className = 'patient-ctx-lbl';
      lbl.textContent = def.label;
      const entry = currentVars.find(v => v.name === def.name);
      const current = entry ? fromExpr(def.type, entry.expression) : def.default;
      let inp;
      if (def.type === 'checkbox') {
        inp = document.createElement('input');
        inp.type = 'checkbox';
        inp.className = 'patient-ctx-cb';
        inp.checked = !!current;
      } else if (def.type === 'select') {
        const csel = createCustomSelect({
          items:     def.options.map(([val, label]) => ({ value: val, label })),
          value:     current,
          className: 'patient-ctx-sel sc-trigger--full',
          onChange:  () => {},
        });
        inp = csel.el;
        inp._csel = csel;
      } else {
        inp = document.createElement('input');
        inp.type = def.type === 'number' ? 'number' : 'text';
        inp.className = 'patient-ctx-inp';
        inp.value = current;
        if (def.name === 'comorb') inp.placeholder = 'e.g. diabetes, hypertension';
      }
      this._inputs[def.name] = { inp, def };
      row.appendChild(lbl);
      row.appendChild(inp);
      this.body.appendChild(row);
    }
    super.open();
  }

  _apply() {
    if (!this._inputs) return;
    const variables = [];
    for (const [name, { inp, def }] of Object.entries(this._inputs)) {
      let raw;
      if (def.type === 'checkbox') raw = inp.checked;
      else if (inp._csel)          raw = inp._csel.getValue();
      else                          raw = inp.value;
      variables.push({ name, expression: toExpr(def.type, raw) });
    }
    this._inputs = null;
    this.close();
    _applyVars(variables);
    document.dispatchEvent(new CustomEvent(AppEvents.PATIENT_CTX_APPLIED));
    document.dispatchEvent(new CustomEvent(AppEvents.REINIT_FORM));
  }

  _cancel() {
    this._inputs = null;
    this.close();
  }
}

// ── PatientProfile ─────────────────────────────────────────────────────────
export class PatientProfile {
  constructor() {
    this._modal = new PatientEditModal();
    this._presetMenu = new PatientPresetMenu(PATIENT_PRESETS);
    this._currentVars = [];  // snapshot of last known questDoc.variables for modal open

    // Seed defaults when document becomes available
    const _seedDefaults = (vars) => {
      this._currentVars = vars ?? [];
      const existingNames = new Set(this._currentVars.map(v => v.name));
      const defaults = _defaultVars(existingNames);
      if (defaults.length > 0) _applyVars(defaults);
    };

    document.addEventListener(AppEvents.APP_CONTEXT_READY, e => {
      _seedDefaults(e.detail.questDoc?.variables);
      this._presetMenu.setDisabled(false);
    });
    document.addEventListener(AppEvents.QUESTIONNAIRE_LOADED, e => {
      _seedDefaults(e.detail.questDoc?.variables);
      this._presetMenu.setDisabled(false);
    });
    document.addEventListener(AppEvents.QUESTIONNAIRE_NEW, () => {
      this._presetMenu.setDisabled(false);
    });
    document.addEventListener(AppEvents.QUESTIONNAIRE_CLEARED, () => {
      this._currentVars = [];
      this._presetMenu.setDisabled(true);
    });
    // Keep local snapshot current so modal can read existing values
    document.addEventListener(AppEvents.VARIABLES_APPLY, e => {
      for (const { name, expression } of e.detail.variables) {
        const idx = this._currentVars.findIndex(v => v.name === name);
        if (idx >= 0) this._currentVars[idx].expression = expression;
        else this._currentVars.push({ name, expression });
      }
    });

    this._presetMenu.setHandlers({
      onPreset: preset => {
        _applyVars(_presetToVars(preset));
        document.dispatchEvent(new CustomEvent(AppEvents.PATIENT_CTX_APPLIED));
        document.dispatchEvent(new CustomEvent(AppEvents.REINIT_FORM));
      },
      onCustom: () => this._modal.open(this._currentVars),
    });
  }

  /** Insert the preset menu into the DOM. */
  mount(mountEl) {
    mountEl.replaceWith(this._presetMenu.el);
  }
}
