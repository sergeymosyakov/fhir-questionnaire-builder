import { createWrap } from './_base.js';

export function build(node, ctx) {
  const { values, onChange, _reCalc, _formTick } = ctx;
  const wrap = createWrap();

  const el = document.createElement('select');
  let firstOpt = null;
  for (const o of (node.options || '').split(',')) {
    const t = o.trim(); if (!t) continue;
    const opt = document.createElement('option');
    opt.value = t; opt.textContent = t;
    if (!firstOpt) firstOpt = t;
    el.appendChild(opt);
  }
  if (values[node.id] !== undefined) el.value = values[node.id];
  else if (firstOpt) { values[node.id] = firstOpt; }

  el.onchange = () => { values[node.id] = el.value; _reCalc(); onChange(); _formTick.value++; };

  wrap.appendChild(el);
  return wrap;
}
