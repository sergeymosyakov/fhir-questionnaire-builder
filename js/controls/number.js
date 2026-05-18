import { createWrap } from './_base.js';

export function build(node, ctx) {
  const { getValue, setValue, onChange, _reCalc, _formTick } = ctx;
  const wrap = createWrap();

  const el = document.createElement('input');
  el.type = 'number';
  el.className = 'ctrl-input--number';
  el.value = getValue(node.id) !== undefined ? getValue(node.id) : '';
  el.oninput  = () => { setValue(node.id, el.value === '' ? undefined : parseFloat(el.value)); _reCalc(); onChange(); };
  el.onchange = () => { _formTick.value++; };

  wrap.appendChild(el);
  return wrap;
}
