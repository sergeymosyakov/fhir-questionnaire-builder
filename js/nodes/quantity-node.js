// ── QuantityNode ──────────────────────────────────────────────────────────────
// Numeric value + unit input. itemType: 'quantity'
// Optional FHIR-imported: quantityUnit (default unit code)
import { ItemNode } from './item-node.js';
import { createWrap } from './base-node.js';
import { createCustomSelect } from '../ui/custom-select.js';

const QUANTITY_UNITS = [
  { label: '── Mass ──', disabled: true },
  { label: 'kg', value: 'kg' }, { label: 'g', value: 'g' },
  { label: 'lb', value: '[lb_av]' }, { label: 'oz', value: '[oz_av]' },
  { label: 'mg', value: 'mg' }, { label: 'µg', value: 'ug' },
  { label: '── Length ──', disabled: true },
  { label: 'cm', value: 'cm' }, { label: 'm', value: 'm' },
  { label: 'mm', value: 'mm' }, { label: 'in', value: '[in_i]' }, { label: 'ft', value: '[ft_i]' },
  { label: '── Volume ──', disabled: true },
  { label: 'mL', value: 'mL' }, { label: 'L', value: 'L' }, { label: 'dL', value: 'dL' },
  { label: '── Temperature ──', disabled: true },
  { label: '°C', value: 'Cel' }, { label: '°F', value: '[degF]' },
  { label: '── Pressure ──', disabled: true },
  { label: 'mmHg', value: 'mm[Hg]' }, { label: 'kPa', value: 'kPa' },
  { label: '── Indices ──', disabled: true },
  { label: 'kg/m²', value: 'kg/m2' }, { label: '%', value: '%' },
  { label: '── Rates ──', disabled: true },
  { label: '/min', value: '/min' }, { label: 'beats/min', value: '{beats}/min' },
  { label: 'breaths/min', value: '{breaths}/min' },
  { label: '── Time ──', disabled: true },
  { label: 'min', value: 'min' }, { label: 'h', value: 'h' }, { label: 'd', value: 'd' },
  { label: 'wk', value: 'wk' }, { label: 'mo', value: 'mo' }, { label: 'a (year)', value: 'a' },
  { label: '── Lab ──', disabled: true },
  { label: 'mg/dL', value: 'mg/dL' }, { label: 'mmol/L', value: 'mmol/L' },
  { label: 'g/dL', value: 'g/dL' }, { label: 'mEq/L', value: 'meq/L' },
  { label: 'IU/L', value: 'U/L' }, { label: 'IU', value: '[iU]' },
];

export class QuantityNode extends ItemNode {
  constructor(data = {}) {
    super(data);
    this.itemType = 'quantity';
  }

  buildControl(ctx) {
    const node = this;
    const { getValue, setValue, onChange, _reCalc, _formTick } = ctx;
    const wrap = createWrap();

    const current  = getValue(node.id);
    const initVal  = current ? (current.value  !== undefined ? current.value : '') : '';
    const initUnit = current ? (current.unit   || node.quantityUnit || '') : (node.quantityUnit || '');

    const numInput = document.createElement('input');
    numInput.type        = 'number';
    numInput.step        = 'any';
    numInput.placeholder = node._entryFormat || '0';
    numInput.value       = initVal;
    numInput.className   = 'qty-num-input';

    const unitItems = [
      { value: '', label: '\u2014 unit \u2014' },
      ...QUANTITY_UNITS.filter(u => !u.disabled).map(u => ({ value: u.value, label: u.label })),
    ];
    const unitSel = createCustomSelect({
      items:    unitItems,
      value:    initUnit || '',
      className: 'qty-unit-sel',
      onChange: () => { update(); _formTick.value++; },
    });

    const errMsg = document.createElement('span');
    errMsg.className = 'ctrl-err';

    const update = () => {
      const v = numInput.value.trim();
      const u = unitSel.getValue();
      const vNum   = v !== '' ? parseFloat(v) : undefined;
      const hasVal  = vNum !== undefined && !isNaN(vNum);
      const hasUnit = !!u;
      if (hasVal && !hasUnit) { errMsg.textContent = 'unit is required'; errMsg.style.display = 'inline'; }
      else if (!hasVal && hasUnit) { errMsg.textContent = 'value is required'; errMsg.style.display = 'inline'; }
      else { errMsg.style.display = 'none'; }
      setValue(node.id, (hasVal && hasUnit) ? { value: vNum, unit: u } : undefined);
      _reCalc(); onChange();
    };

    numInput.oninput  = update;
    numInput.onchange = () => { _formTick.value++; };

    wrap.appendChild(numInput);
    wrap.appendChild(unitSel.el);
    wrap.appendChild(errMsg);
    return wrap;
  }
}
