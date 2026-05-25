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

  if (node._choiceOrientation === 'vertical') wrap.classList.add('ctrl-wrap--vertical');
  else if (node._choiceOrientation === 'horizontal') wrap.classList.add('ctrl-wrap--horizontal');

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
    if (node._optionPrefixes && node._optionPrefixes[code] !== undefined) {
      const pfx = document.createElement('span');
      pfx.className = 'option-prefix';
      pfx.textContent = node._optionPrefixes[code] + '\u00A0';
      lbl.appendChild(pfx);
    }
    lbl.appendChild(document.createTextNode(display));
    if (node._optionOrdinals && node._optionOrdinals[code] !== undefined) {
      const ord = document.createElement('span');
      ord.className = 'option-ordinal';
      ord.textContent = '\u00A0(' + node._optionOrdinals[code] + ')';
      lbl.appendChild(ord);
    }
    wrap.appendChild(lbl);
  }

  return wrap;
}
