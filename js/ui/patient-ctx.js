// Patient context popup — seeds and manages SDC variables used as FHIRPath context:
//   %age, %gender, %bmi, %pregnant, %smoker, %proc, %comorb
// Values are stored as literal FHIRPath expressions in the questVariables reactive array.
import { _formTick, tree, effect } from '../state.js';

// Dispatched after Apply so other modules (variables-panel) can refresh.
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
  if (idx >= 0) {
    qv[idx].expression = expression;
  } else {
    qv.push({ name, expression });
  }
}

export function init(els, questVariables) {
  // Seed defaults for any patient ctx vars not already in the array
  for (const def of PATIENT_VARS) {
    if (!getEntry(questVariables, def.name)) {
      setEntry(questVariables, def.name, toExpr(def.type, def.default));
    }
  }

  const { btn, modal, closeBtn, applyBtn, body } = els;

  const open = () => {
    body.innerHTML = '';
    const inputs = {};

    for (const def of PATIENT_VARS) {
      const row = document.createElement('div');
      row.className = 'patient-ctx-row';

      const lbl = document.createElement('span');
      lbl.className = 'patient-ctx-lbl';
      lbl.textContent = def.label;

      const entry = getEntry(questVariables, def.name);
      const current = entry ? fromExpr(def.type, entry.expression) : def.default;

      let inp;
      if (def.type === 'checkbox') {
        inp = document.createElement('input');
        inp.type = 'checkbox';
        inp.className = 'patient-ctx-cb';
        inp.checked = !!current;
      } else if (def.type === 'select') {
        inp = document.createElement('select');
        inp.className = 'patient-ctx-sel';
        for (const [val, label] of def.options) {
          const o = document.createElement('option');
          o.value = val; o.textContent = label;
          if (current === val) o.selected = true;
          inp.appendChild(o);
        }
      } else {
        inp = document.createElement('input');
        inp.type = def.type === 'number' ? 'number' : 'text';
        inp.className = 'patient-ctx-inp';
        inp.value = current;
        if (def.name === 'comorb') inp.placeholder = 'e.g. diabetes, hypertension';
      }

      inputs[def.name] = { inp, def };
      row.appendChild(lbl);
      row.appendChild(inp);
      body.appendChild(row);
    }

    applyBtn.onclick = () => {
      for (const [name, { inp, def }] of Object.entries(inputs)) {
        const raw = def.type === 'checkbox' ? inp.checked : inp.value;
        setEntry(questVariables, name, toExpr(def.type, raw));
      }
      modal.style.display = 'none';
      _formTick.value++; // trigger preview re-evaluation with new variable values
      document.dispatchEvent(new CustomEvent(PATIENT_APPLY_EVENT));
    };

    modal.style.display = 'flex';
  };

  btn.addEventListener('click', open);
  closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });
  modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });

  // Show button only when a questionnaire is loaded
  effect(() => { btn.disabled = tree.length === 0; });
}
