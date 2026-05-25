import { createWrap } from './_base.js';

export function build(node, ctx) {
  const { getValue, setValue, onChange, _reCalc, _formTick } = ctx;
  const wrap = createWrap();

  // ── Slider mode: render <input type="range"> when _sliderStep is set ─────
  if (node._sliderStep !== undefined) {
    const sl = document.createElement('input');
    sl.type  = 'range';
    sl.className = 'ctrl-input--slider';
    sl.dataset.testid = 'slider-input';
    sl.min  = node._minValue   !== undefined ? String(node._minValue)   : '0';
    sl.max  = node._maxValue   !== undefined ? String(node._maxValue)   : '100';
    sl.step = String(node._sliderStep);
    const initVal = getValue(node.id);
    sl.value = initVal !== undefined && initVal !== '' ? String(initVal) : sl.min;

    const valLabel = document.createElement('span');
    valLabel.className = 'ctrl-slider-value';
    valLabel.dataset.testid = 'slider-value';
    valLabel.textContent = sl.value;

    sl.oninput = () => {
      const v = parseFloat(sl.value);
      setValue(node.id, v);
      valLabel.textContent = sl.value;
      _reCalc();
      onChange();
    };
    sl.onchange = () => { _formTick.value++; };

    wrap.appendChild(sl);
    wrap.appendChild(valLabel);
    return wrap;
  }

  // ── Number input mode ─────────────────────────────────────────────────────
  const el = document.createElement('input');
  el.type = 'number';
  el.className = 'ctrl-input--number';
  el.value = getValue(node.id) !== undefined ? getValue(node.id) : '';

  if (node._minValue !== undefined) el.min = String(node._minValue);
  if (node._maxValue !== undefined) el.max = String(node._maxValue);
  if (node._entryFormat) el.placeholder = node._entryFormat;

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
