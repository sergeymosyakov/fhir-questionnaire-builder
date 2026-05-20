import { createWrap } from './_base.js';

export function build(node, ctx) {
  const { getValue, setValue, onChange, _reCalc, _formTick } = ctx;
  const wrap = createWrap();

  const el = document.createElement('input');
  el.type = 'checkbox';

  const initialVal = getValue(node.id);
  // All boolean checkboxes: indeterminate = "not yet answered" regardless of required/optional.
  // First click → true (Yes), subsequent clicks toggle true ↔ false.
  if (initialVal === undefined) {
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
