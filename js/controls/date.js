import { createWrap } from './_base.js';

export function build(node, ctx) {
  const { values, onChange, _reCalc, _formTick } = ctx;
  const wrap = createWrap();

  const el = document.createElement('input');
  el.type = 'date';
  el.className = 'ctrl-input--date';
  el.value = values[node.id] !== undefined ? values[node.id] : '';
  el.oninput = () => { values[node.id] = el.value; _reCalc(); onChange(); _formTick.value++; };

  wrap.appendChild(el);
  return wrap;
}
