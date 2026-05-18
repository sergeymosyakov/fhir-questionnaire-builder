import { createWrap } from './_base.js';

export function build(node, ctx) {
  const { getValue, setValue, onChange, _reCalc, _formTick } = ctx;
  const wrap = createWrap();

  const el = document.createElement('input');
  el.type    = 'checkbox';
  el.checked = !!getValue(node.id);

  el.onchange = () => {
    setValue(node.id, el.checked);
    _reCalc();
    onChange();
    _formTick.value++;
  };

  wrap.appendChild(el);
  return wrap;
}
