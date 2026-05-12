import { createWrap } from './_base.js';

export function build(node, ctx) {
  const { values, onChange, _reCalc, _formTick } = ctx;
  const wrap = createWrap();

  const opts = (node.options || '').split(',').map(o => o.trim()).filter(Boolean);
  if (!opts.length) {
    const msg = document.createElement('span');
    msg.className = 'radio-no-opts';
    msg.textContent = '(no options)';
    wrap.appendChild(msg);
    return wrap;
  }

  const rbName = 'radio_' + node.id;
  if (values[node.id] === undefined) values[node.id] = opts[0];

  for (const opt of opts) {
    const lbl = document.createElement('label');
    lbl.className = 'radio-label';
    const rb = document.createElement('input');
    rb.type = 'radio'; rb.name = rbName; rb.value = opt;
    rb.checked = values[node.id] === opt;
    rb.onchange = () => { if (rb.checked) { values[node.id] = opt; _reCalc(); onChange(); _formTick.value++; } };
    lbl.appendChild(rb);
    lbl.appendChild(document.createTextNode(opt));
    wrap.appendChild(lbl);
  }

  return wrap;
}
