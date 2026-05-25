// ── CheckboxNode ──────────────────────────────────────────────────────────────
// Boolean yes/no input. itemType: 'checkbox'
// Optional FHIR-imported: _calculatedExpr (read-only computed boolean)
import { ItemNode } from './item-node.js';
import { createWrap } from '../controls/_base.js';

export class CheckboxNode extends ItemNode {
  constructor(data = {}) {
    super(data);
    this.itemType = 'checkbox';
  }

  buildControl(ctx) {
    const node = this;
    const { getValue, setValue, onChange, _reCalc, _formTick } = ctx;
    const wrap = createWrap();

    const el = document.createElement('input');
    el.type = 'checkbox';

    const initialVal = getValue(node.id);
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
}
