import { createWrap } from './_base.js';
import { parseOptions } from '../utils.js';

export function build(node, ctx) {
  const { values, onChange, _reCalc, _formTick } = ctx;
  const wrap = createWrap();

  const listId = 'dl_' + node.id;
  const dl = document.createElement('datalist');
  dl.id = listId;
  // For open-choice, suggest display values (user types free text, stores display)
  for (const { display } of parseOptions(node.options)) {
    const opt = document.createElement('option');
    opt.value = display;
    dl.appendChild(opt);
  }

  const el = document.createElement('input');
  el.type = 'text';
  el.className = 'open-choice-input';
  el.setAttribute('list', listId);
  el.placeholder = 'Choose or type\u2026';
  el.value = values[node.id] !== undefined ? values[node.id] : '';
  el.oninput = () => { values[node.id] = el.value; _reCalc(); onChange(); _formTick.value++; };

  wrap.appendChild(dl);
  wrap.appendChild(el);
  return wrap;
}
