import { createWrap } from './_base.js';

export function build(node, ctx) {
  const { getValue, setValue, onChange, _reCalc, _formTick } = ctx;
  const wrap = createWrap();

  const el = document.createElement('input');
  el.type = 'number';
  el.className = 'ctrl-input--number';
  el.value = getValue(node.id) !== undefined ? getValue(node.id) : '';

  if (node._minValue !== undefined) el.min = String(node._minValue);
  if (node._maxValue !== undefined) el.max = String(node._maxValue);

  const errMsg = document.createElement('span');
  errMsg.className = 'ctrl-err ctrl-err--ml';
  errMsg.style.display = 'none';

  const validate = v => {
    if (v === undefined || v === '' || v === null) { errMsg.style.display = 'none'; return; }
    const num = Number(v);
    if (node._minValue !== undefined && num < node._minValue) {
      errMsg.textContent = 'Min: ' + node._minValue;
      errMsg.style.display = 'inline';
    } else if (node._maxValue !== undefined && num > node._maxValue) {
      errMsg.textContent = 'Max: ' + node._maxValue;
      errMsg.style.display = 'inline';
    } else {
      errMsg.style.display = 'none';
    }
  };

  el.oninput = () => {
    const v = el.value === '' ? undefined : parseFloat(el.value);
    setValue(node.id, v);
    validate(v);
    _reCalc();
    onChange();
  };
  el.onchange = () => { _formTick.value++; };

  validate(getValue(node.id));

  wrap.appendChild(el);
  if (node._minValue !== undefined || node._maxValue !== undefined) wrap.appendChild(errMsg);
  return wrap;
}
