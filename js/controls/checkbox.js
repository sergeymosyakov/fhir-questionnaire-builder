import { createWrap } from './_base.js';

export function build(node, ctx) {
  const { values, onChange, _reCalc, _formTick } = ctx;
  const wrap = createWrap();

  const el = document.createElement('input');
  el.type    = 'checkbox';
  el.checked = !!values[node.id];

  el.onchange = () => {
    values[node.id] = el.checked;
    _reCalc();
    onChange();
    _formTick.value++;
  };

  wrap.appendChild(el);
  return wrap;
}
