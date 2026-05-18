import { createWrap } from './_base.js';

export function build(node, ctx) {
  const { getValue, setValue, onChange, _reCalc, _formTick } = ctx;
  const wrap = createWrap();
  wrap.className = 'ctrl-wrap ctrl-wrap--text';

  const el = document.createElement('textarea');
  el.className = 'ctrl-input--text';
  el.rows = 1;
  el.placeholder = 'https://';
  el.value = getValue(node.id) !== undefined ? getValue(node.id) : '';

  const autoResize = () => {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };

  const isValidUrl = v => { try { new URL(v); return true; } catch { return false; } };

  const errMsg = document.createElement('span');
  errMsg.className = 'ctrl-err ctrl-err--ml';
  errMsg.textContent = 'Invalid URL';
  errMsg.style.display = 'none';

  let _debounce = null;
  el.oninput = () => {
    setValue(node.id, el.value);
    autoResize();
    clearTimeout(_debounce);
    _debounce = setTimeout(() => { _reCalc(); onChange(); }, 200);
  };
  el.onchange = () => { _formTick.value++; };
  el.addEventListener('blur', () => {
    errMsg.style.display = (el.value === '' || isValidUrl(el.value)) ? 'none' : '';
  });

  if (el.value) autoResize();

  wrap.appendChild(el);
  wrap.appendChild(errMsg);
  return wrap;
}
