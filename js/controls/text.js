import { createWrap } from './_base.js';

export function build(node, ctx) {
  const { values, onChange } = ctx;
  const wrap = createWrap();

  const el = document.createElement('input');
  el.type = 'text';
  el.className = 'ctrl-input--text';
  el.value = values[node.id] !== undefined ? values[node.id] : '';
  el.oninput = () => { values[node.id] = el.value; onChange(); };

  wrap.appendChild(el);
  return wrap;
}
