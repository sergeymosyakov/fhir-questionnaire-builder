import { createWrap } from './_base.js';

export function build(node, ctx) {
  const { getValue, setValue, onChange, _reCalc, _formTick } = ctx;
  const wrap = createWrap();

  const el = document.createElement('input');
  el.type = 'checkbox';

  const initialVal = getValue(node.id);
  // Required boolean with no answer yet → tristate: indeterminate = "not answered"
  // First click → true (Yes), subsequent clicks toggle true ↔ false normally.
  if (initialVal === undefined && node.mandatory !== false) {
    el.indeterminate = true;
    el.dataset.testid = 'checkbox-indeterminate';
  } else {
    el.checked = initialVal === true;
  }

  el.onchange = () => {
    setValue(node.id, el.checked);
    _reCalc();
    onChange();
    _formTick.value++;
  };

  wrap.appendChild(el);
  return wrap;
}
