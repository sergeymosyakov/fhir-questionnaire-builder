import { createWrap } from './_base.js';
import { parseOptions } from '../utils.js';

export function build(node, ctx) {
  const { values, onChange, _reCalc, _formTick } = ctx;
  const wrap = createWrap();

  const el = document.createElement('select');
  const opts = parseOptions(node.options);

  // Empty placeholder — user must make an explicit choice
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '— select —';
  placeholder.disabled = true;
  el.appendChild(placeholder);

  for (const { code, display } of opts) {
    const opt = document.createElement('option');
    opt.value = code; opt.textContent = display;
    el.appendChild(opt);
  }
  if (values[node.id]) el.value = values[node.id];
  else el.value = ''; // show placeholder

  el.onchange = () => { values[node.id] = el.value; _reCalc(); onChange(); _formTick.value++; };

  wrap.appendChild(el);
  return wrap;
}
