import { createWrap } from './_base.js';
import { parseOptions } from '../utils.js';

export function build(node, ctx) {
  const { getValue, setValue, onChange, _reCalc, _formTick } = ctx;
  const wrap = createWrap();

  const opts = parseOptions(node.options);
  if (!opts.length) {
    const msg = document.createElement('span');
    msg.className = 'radio-no-opts';
    msg.textContent = '(no options)';
    wrap.appendChild(msg);
    return wrap;
  }

  const rbName = 'radio_' + node.id;
  // Do NOT pre-select first option — required radio must be explicitly chosen

  for (const { code, display } of opts) {
    const lbl = document.createElement('label');
    lbl.className = 'radio-label';
    const rb = document.createElement('input');
    rb.type = 'radio'; rb.name = rbName; rb.value = code;
    rb.checked = getValue(node.id) === code;
    rb.onchange = () => { if (rb.checked) { setValue(node.id, code); _reCalc(); onChange(); _formTick.value++; } };
    lbl.appendChild(rb);
    lbl.appendChild(document.createTextNode(display));
    wrap.appendChild(lbl);
  }

  return wrap;
}
