import { createWrap } from './_base.js';

export function build(node, ctx) {
  const { values, onChange, _reCalc, _formTick } = ctx;
  const wrap = createWrap();

  const opts = (node.options || '').split(',').map(o => o.trim()).filter(Boolean);
  if (!opts.length) {
    const msg = document.createElement('span');
    msg.style.cssText = 'font-size:11px;color:var(--c-text-2)';
    msg.textContent = '(no options)';
    wrap.appendChild(msg);
    return wrap;
  }

  const rbName = 'radio_' + node.id;
  if (values[node.id] === undefined) values[node.id] = opts[0];

  for (const opt of opts) {
    const lbl = document.createElement('label');
    lbl.style.cssText = 'display:inline-flex;align-items:center;gap:3px;margin-right:10px;font-size:13px;cursor:pointer;';
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
