import { createWrap } from './_base.js';
import { parseOptions } from '../utils.js';

export function build(node, ctx) {
  const { values, onChange, _reCalc, _formTick } = ctx;
  const wrap = createWrap();

  const el = document.createElement('select');
  const opts = parseOptions(node.options);
  let firstCode = null;
  for (const { code, display } of opts) {
    const opt = document.createElement('option');
    opt.value = code; opt.textContent = display;
    if (!firstCode) firstCode = code;
    el.appendChild(opt);
  }
  if (values[node.id] !== undefined) el.value = values[node.id];
  else if (firstCode) { values[node.id] = firstCode; }

  el.onchange = () => { values[node.id] = el.value; _reCalc(); onChange(); _formTick.value++; };

  wrap.appendChild(el);
  return wrap;
}
