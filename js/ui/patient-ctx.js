// Patient context — preset profiles and manual edit modal.
// Manages SDC variables: %age, %gender, %bmi, %pregnant, %smoker, %proc, %comorb
// configure({tree, effect, questVariables}) — call once at startup.
import { createCustomSelect } from './custom-select.js';
import { Modal } from './modals/modal-base.js';
import { PatientPresetMenu } from './menus/patient-preset-menu.js';
import { AppEvents } from '../events.js';

let _tree = null, _effect = null, _questVariables = null;
export function configure({ tree, effect, questVariables }) {
  _tree = tree; _effect = effect; _questVariables = questVariables;
  // Seed defaults for any patient vars not yet present
  for (const def of PATIENT_VARS) {
    if (!getEntry(_questVariables, def.name)) {
      setEntry(_questVariables, def.name, toExpr(def.type, def.default));
    }
  }
  // Disable preset button reactively when no questionnaire is loaded
  _effect(() => presetMenu.setDisabled(_tree.length === 0));
  // Wire preset handlers
  presetMenu.setHandlers({
    onPreset: preset => { applyPreset(preset, _questVariables); _doAfterApply(); },
    onCustom: () => _modal.open(),
  });
}

const PATIENT_VARS = [
  { name: 'age',      type: 'number',   label: 'Age (years)',    default: 30 },
  { name: 'gender',   type: 'select',   label: 'Biological sex', default: 'male',
    options: [['male','Male'],['female','Female'],['other','Other'],['unknown','Unknown']] },
  { name: 'bmi',      type: 'number',   label: 'BMI (kg/m\u00B2)', default: 42 },
  { name: 'pregnant', type: 'checkbox', label: 'Pregnant',       default: false },
  { name: 'smoker',   type: 'checkbox', label: 'Smoker',         default: false },
  { name: 'proc',     type: 'text',     label: 'Procedure code', default: '43644' },
  { name: 'comorb',   type: 'text',     label: 'Comorbidities',  default: '' },
];

// ── Patient presets ───────────────────────────────────────────────────────────
export const PATIENT_PRESETS = [
  {
    id: 'adult-male',
    label: 'Adult Male (35 \u00B7 BMI\u202F24)',
    shortLabel: 'Adult Male',
    values: { age: 35, gender: 'male', bmi: 24, pregnant: false, smoker: false, proc: '43644', comorb: '' },
  },
  {
    id: 'adult-female',
    label: 'Adult Female (28 \u00B7 BMI\u202F22)',
    shortLabel: 'Adult Female',
    values: { age: 28, gender: 'female', bmi: 22, pregnant: false, smoker: false, proc: '43644', comorb: '' },
  },
  {
    id: 'obese-male',
    label: 'Obese Male (45 \u00B7 BMI\u202F38 \u00B7 smoker)',
    shortLabel: 'Obese Male',
    values: { age: 45, gender: 'male', bmi: 38, pregnant: false, smoker: true, proc: '43644', comorb: 'diabetes, hypertension' },
  },
  {
    id: 'child',
    label: 'Child (10 \u00B7 BMI\u202F16)',
    shortLabel: 'Child',
    values: { age: 10, gender: 'male', bmi: 16, pregnant: false, smoker: false, proc: '', comorb: '' },
  },
  {
    id: 'pregnant-female',
    label: 'Pregnant Female (30 \u00B7 BMI\u202F26)',
    shortLabel: 'Pregnant F',
    values: { age: 30, gender: 'female', bmi: 26, pregnant: true, smoker: false, proc: '', comorb: '' },
  },
];

function toExpr(type, val) {
  if (type === 'number') return String(parseFloat(val) || 0);
  if (type === 'checkbox') return val ? 'true' : 'false';
  const s = String(val ?? '');
  return "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

function fromExpr(type, expr) {
  if (!expr) return type === 'number' ? 0 : type === 'checkbox' ? false : '';
  if (type === 'number') return parseFloat(expr) || 0;
  if (type === 'checkbox') return expr.trim() === 'true';
  const m = expr.match(/^'(.*)'$/s);
  return m ? m[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\') : expr;
}

function getEntry(qv, name) {
  return qv.find(v => v.name === name);
}

function setEntry(qv, name, expression) {
  const idx = qv.findIndex(v => v.name === name);
  if (idx >= 0) qv[idx].expression = expression;
  else qv.push({ name, expression });
}

function applyPreset(preset, questVariables) {
  for (const def of PATIENT_VARS) {
    const val = preset.values[def.name];
    if (val !== undefined) setEntry(questVariables, def.name, toExpr(def.type, val));
  }
}

// ── Module-level state ────────────────────────────────────────────────────────
let _inputs = null;

class PatientModal extends Modal {
  getName() { return 'patientCtxModal'; }
  constructor() {
    super({ cancelLabel: null });
    this.title.textContent = 'Patient Context';
    this.body.insertAdjacentHTML('beforebegin',
      '<div class="patient-ctx-hint">Values are available in FHIRPath expressions as ' +
      '<code>%age</code>, <code>%gender</code>, <code>%bmi</code>, ' +
      '<code>%pregnant</code>, <code>%smoker</code>, <code>%proc</code>, <code>%comorb</code>.</div>');
  }

  open() {
    this.body.innerHTML = '';
    _inputs = {};
    for (const def of PATIENT_VARS) {
      const row = document.createElement('div');
      row.className = 'patient-ctx-row';
      const lbl = document.createElement('span');
      lbl.className = 'patient-ctx-lbl';
      lbl.textContent = def.label;
      const entry = getEntry(_questVariables, def.name);
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
      _inputs[def.name] = { inp, def };
      row.appendChild(lbl);
      row.appendChild(inp);
      this.body.appendChild(row);
    }
    super.open();
  }

  _apply() {
    if (!_inputs) return;
    for (const [name, { inp, def }] of Object.entries(_inputs)) {
      let raw;
      if (def.type === 'checkbox') raw = inp.checked;
      else if (inp._csel)          raw = inp._csel.getValue();
      else                          raw = inp.value;
      setEntry(_questVariables, name, toExpr(def.type, raw));
    }
    _inputs = null;
    this.close();
    _doAfterApply();
  }

  _cancel() {
    _inputs = null;
    this.close();
  }
}

const _modal = new PatientModal();

// ── Preset dropdown ───────────────────────────────────────────────────────────
export const presetMenu = new PatientPresetMenu(PATIENT_PRESETS);

export function mount(mountEl) {
  mountEl.replaceWith(presetMenu.el);
}

const _doAfterApply = () => {
  document.dispatchEvent(new CustomEvent(AppEvents.REINIT_FORM));
  document.dispatchEvent(new CustomEvent(AppEvents.PATIENT_CTX_APPLIED));
};
