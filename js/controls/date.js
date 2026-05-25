import { createWrap } from './_base.js';
import { createDatePicker } from '../ui/date-picker.js';

export function build(node, ctx) {
  const { getValue, setValue, onChange, _reCalc, _formTick } = ctx;
  const wrap = createWrap();

  const dp = createDatePicker({
    value:    getValue(node.id) || '',
    onChange: v => {
      setValue(node.id, v || undefined);
      _reCalc();
      onChange();
      _formTick.value++;
    },
    className: 'ctrl-input--date',
    testid:   'date-input',
  });

  wrap.appendChild(dp.el);
  return wrap;
}
