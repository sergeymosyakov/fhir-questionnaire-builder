import { createWrap } from './_base.js';

export function build(node, ctx) {
  const { getValue, setValue, onChange, _reCalc, _formTick } = ctx;
  const wrap = createWrap();

  const el = document.createElement('input');
  el.type = 'time';
  el.className = 'ctrl-input ctrl-input--time';
  el.dataset.testid = 'time-input';
  const stored = getValue(node.id);
  // FHIR time is HH:MM:SS — native <input type="time"> uses HH:MM
  el.value = stored ? String(stored).slice(0, 5) : '';

  el.addEventListener('change', () => {
    const v = el.value;
    // Store as HH:MM:SS for FHIR compliance
    setValue(node.id, v ? v + ':00' : undefined);
    _reCalc();
    onChange();
    _formTick.value++;
  });

  wrap.appendChild(el);
  return wrap;
}
