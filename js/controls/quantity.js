import { createWrap } from './_base.js';

// Common medical UCUM units grouped for the dropdown
const QUANTITY_UNITS = [
  // Mass
  { label: '── Mass ──', disabled: true },
  { label: 'kg',    value: 'kg' },
  { label: 'g',     value: 'g' },
  { label: 'lb',    value: '[lb_av]' },
  { label: 'oz',    value: '[oz_av]' },
  { label: 'mg',    value: 'mg' },
  { label: 'µg',    value: 'ug' },
  // Length
  { label: '── Length ──', disabled: true },
  { label: 'cm',    value: 'cm' },
  { label: 'm',     value: 'm' },
  { label: 'mm',    value: 'mm' },
  { label: 'in',    value: '[in_i]' },
  { label: 'ft',    value: '[ft_i]' },
  // Volume
  { label: '── Volume ──', disabled: true },
  { label: 'mL',    value: 'mL' },
  { label: 'L',     value: 'L' },
  { label: 'dL',    value: 'dL' },
  // Temperature
  { label: '── Temperature ──', disabled: true },
  { label: '°C',    value: 'Cel' },
  { label: '°F',    value: '[degF]' },
  // Pressure
  { label: '── Pressure ──', disabled: true },
  { label: 'mmHg',  value: 'mm[Hg]' },
  { label: 'kPa',   value: 'kPa' },
  // Indices
  { label: '── Indices ──', disabled: true },
  { label: 'kg/m²', value: 'kg/m2' },
  { label: '%',     value: '%' },
  // Rates
  { label: '── Rates ──', disabled: true },
  { label: '/min',  value: '/min' },
  { label: 'beats/min', value: '{beats}/min' },
  { label: 'breaths/min', value: '{breaths}/min' },
  // Time
  { label: '── Time ──', disabled: true },
  { label: 'min',   value: 'min' },
  { label: 'h',     value: 'h' },
  { label: 'd',     value: 'd' },
  { label: 'wk',    value: 'wk' },
  { label: 'mo',    value: 'mo' },
  { label: 'a (year)', value: 'a' },
  // Lab
  { label: '── Lab ──', disabled: true },
  { label: 'mg/dL', value: 'mg/dL' },
  { label: 'mmol/L', value: 'mmol/L' },
  { label: 'g/dL',  value: 'g/dL' },
  { label: 'mEq/L', value: 'meq/L' },
  { label: 'IU/L',  value: 'U/L' },
  { label: 'IU',    value: '[iU]' },
];

// FHIR Quantity answer — number input + unit dropdown.
// Stores { value: number, unit: string } in values[node.id].
// node.quantityUnit — default pre-selected unit (set in builder Type panel).
export function build(node, ctx) {
  const { values, onChange, _reCalc, _formTick } = ctx;
  const wrap = createWrap();

  // Restore previous value
  const current = values[node.id];
  const initVal  = current ? (current.value  !== undefined ? current.value : '') : '';
  const initUnit = current ? (current.unit   || node.quantityUnit || '') : (node.quantityUnit || '');

  // Number input
  const numInput = document.createElement('input');
  numInput.type        = 'number';
  numInput.step        = 'any';
  numInput.placeholder = '0';
  numInput.value       = initVal;
  numInput.className   = 'qty-num-input';

  // Unit dropdown
  const unitSel = document.createElement('select');
  unitSel.className = 'qty-unit-sel';

  // Blank "— unit —" option
  const blankOpt = document.createElement('option');
  blankOpt.value = '';
  blankOpt.textContent = '— unit —';
  if (!initUnit) blankOpt.selected = true;
  unitSel.appendChild(blankOpt);

  for (const u of QUANTITY_UNITS) {
    const opt = document.createElement('option');
    if (u.disabled) {
      opt.disabled = true;
      opt.textContent = u.label;
    } else {
      opt.value = u.value;
      opt.textContent = u.label;
      if (u.value === initUnit) opt.selected = true;
    }
    unitSel.appendChild(opt);
  }

  // Required: value AND unit must both be filled
  const errMsg = document.createElement('span');
  errMsg.className = 'ctrl-err';

  const update = () => {
    const v = numInput.value.trim();
    const u = unitSel.value;
    const vNum = v !== '' ? parseFloat(v) : undefined;
    const hasVal  = vNum !== undefined && !isNaN(vNum);
    const hasUnit = !!u;

    if (hasVal && !hasUnit) {
      errMsg.textContent = 'unit is required';
      errMsg.style.display = 'inline';
    } else if (!hasVal && hasUnit) {
      errMsg.textContent = 'value is required';
      errMsg.style.display = 'inline';
    } else {
      errMsg.style.display = 'none';
    }

    values[node.id] = (hasVal && hasUnit) ? { value: vNum, unit: u } : undefined;
    _reCalc(); onChange();
  };

  numInput.oninput  = update;
  numInput.onchange = () => { _formTick.value++; };
  unitSel.onchange  = () => { update(); _formTick.value++; };

  wrap.appendChild(numInput);
  wrap.appendChild(unitSel);
  wrap.appendChild(errMsg);

  return wrap;
}
