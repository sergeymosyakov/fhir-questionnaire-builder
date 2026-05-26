// Patient context — preset profiles and manual edit modal.
// Manages SDC variables: %age, %gender, %bmi, %pregnant, %smoker, %proc, %comorb
// init(els, questVariables, onAfterApply) — wire once at startup.
import { tree, effect } from '../state.js';
import { createCustomSelect } from './custom-select.js';
import { initModal, openModal, closeModal } from './modals/modal-base.js';

const PATIENT_APPLY_EVENT = 'patient-ctx-applied';

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
let _el = null;
let _questVariables = null;
let _inputs = null;

const _doAfterApply = () => {
  document.dispatchEvent(new CustomEvent('reinit-form'));
  document.dispatchEvent(new CustomEvent(PATIENT_APPLY_EVENT));
};

function _openPatientModal() {
  _el.body.innerHTML = '';
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
        onChange:  () => {},  // value read back via csel.getValue() on apply
      });
      inp = csel.el;
      inp._csel = csel;  // stash for value retrieval
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
    _el.body.appendChild(row);
  }

  openModal(_el.modal);
}

function _applyPatientModal() {
  if (!_inputs) return;
  for (const [name, { inp, def }] of Object.entries(_inputs)) {
    let raw;
    if (def.type === 'checkbox') raw = inp.checked;
    else if (inp._csel)          raw = inp._csel.getValue();
    else                          raw = inp.value;
    setEntry(_questVariables, name, toExpr(def.type, raw));
  }
  _inputs = null;
  closeModal(_el.modal);
  _doAfterApply();
}

function _cancelPatientModal() {
  _inputs = null;
  closeModal(_el.modal);
}

export function init(els, questVariables) {
  _el = els;
  _questVariables = questVariables;

  // Seed defaults for any patient vars not yet present
  for (const def of PATIENT_VARS) {
    if (!getEntry(questVariables, def.name)) {
      setEntry(questVariables, def.name, toExpr(def.type, def.default));
    }
  }

  initModal({
    modal:    _el.modal,
    closeBtn: _el.closeBtn,
    applyBtn: _el.applyBtn,
  }, { onApply: _applyPatientModal, onCancel: _cancelPatientModal });

  // ── Preset dropdown ───────────────────────────────────────────────────────
  if (_el.presetBtn && _el.presetMenu) {
    _el.presetBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (_el.presetMenu.style.display !== 'none') { _el.presetMenu.style.display = 'none'; return; }
      // Position with fixed coords — top-panel has overflow-x:auto which clips absolute children
      const rect = _el.presetBtn.getBoundingClientRect();
      _el.presetMenu.style.position = 'fixed';
      _el.presetMenu.style.top  = (rect.bottom + 2) + 'px';
      _el.presetMenu.style.left = rect.left + 'px';
      _el.presetMenu.style.display = 'block';
    });

    _el.presetMenu.addEventListener('click', e => {
      const item = e.target.closest('[data-preset]');
      if (!item) return;
      const presetId = item.dataset.preset;
      _el.presetMenu.style.display = 'none';
      if (presetId === 'custom') { _openPatientModal(); return; }
      const preset = PATIENT_PRESETS.find(p => p.id === presetId);
      if (!preset) return;
      applyPreset(preset, questVariables);
      _el.presetBtn.textContent = '\uD83D\uDC64 ' + preset.shortLabel + ' \u25BE';
      _doAfterApply();
    });

    // Close on outside click
    document.addEventListener('click', () => { _el.presetMenu.style.display = 'none'; });
  }

  // Disable when no questionnaire loaded
  effect(() => {
    const disabled = tree.length === 0;
    if (_el.presetBtn) _el.presetBtn.disabled = disabled;
  });
}

