import { createWrap } from './_base.js';

export function build(node, ctx) {
  const { values, onChange, _reCalc, _formTick } = ctx;
  const wrap = createWrap();
  wrap.className = 'ctrl-wrap ctrl-wrap--text';

  const el = document.createElement('textarea');
  el.className = 'ctrl-input--text';
  el.rows = 1;
  el.value = values[node.id] !== undefined ? values[node.id] : '';

  const autoResize = () => {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };

  let _debounce = null;
  el.oninput  = () => {
    values[node.id] = el.value;
    autoResize();
    clearTimeout(_debounce);
    _debounce = setTimeout(() => { _reCalc(); onChange(); }, 200);
  };
  el.onchange = () => { _formTick.value++; };

  if (el.value) autoResize();

  wrap.appendChild(el);
  return wrap;
}
