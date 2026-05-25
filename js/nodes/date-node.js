// ── DateNode / DateTimeNode / TimeNode ────────────────────────────────────────
// Temporal input controls.
// Optional FHIR-imported: _entryFormat
import { ItemNode } from './item-node.js';
import { createWrap } from '../controls/_base.js';
import { createDatePicker } from '../ui/date-picker.js';

export class DateNode extends ItemNode {
  constructor(data = {}) {
    super(data);
    this.itemType = 'date';
  }

  buildControl(ctx) {
    const node = this;
    const { getValue, setValue, onChange, _reCalc, _formTick } = ctx;
    const wrap = createWrap();
    const dp = createDatePicker({
      value:    getValue(node.id) || '',
      onChange: v => { setValue(node.id, v || undefined); _reCalc(); onChange(); _formTick.value++; },
      className: 'ctrl-input--date',
      testid:   'date-input',
    });
    wrap.appendChild(dp.el);
    return wrap;
  }
}

export class DateTimeNode extends ItemNode {
  constructor(data = {}) {
    super(data);
    this.itemType = 'dateTime';
  }

  buildControl(ctx) {
    const node = this;
    const { getValue, setValue, onChange, _reCalc, _formTick } = ctx;
    const wrap = createWrap();
    const dp = createDatePicker({
      value:    getValue(node.id) || '',
      onChange: v => { setValue(node.id, v || undefined); _reCalc(); onChange(); _formTick.value++; },
      withTime:  true,
      className: 'ctrl-input--date',
      testid:   'datetime-input',
    });
    wrap.appendChild(dp.el);
    return wrap;
  }
}

export class TimeNode extends ItemNode {
  constructor(data = {}) {
    super(data);
    this.itemType = 'time';
  }

  buildControl(ctx) {
    const node = this;
    const { getValue, setValue, onChange, _reCalc, _formTick } = ctx;
    const wrap = createWrap();

    const el = document.createElement('input');
    el.type = 'time';
    el.className = 'ctrl-input ctrl-input--time';
    el.dataset.testid = 'time-input';
    const stored = getValue(node.id);
    el.value = stored ? String(stored).slice(0, 5) : '';

    el.addEventListener('change', () => {
      const v = el.value;
      setValue(node.id, v ? v + ':00' : undefined);
      _reCalc(); onChange(); _formTick.value++;
    });

    wrap.appendChild(el);
    return wrap;
  }
}
