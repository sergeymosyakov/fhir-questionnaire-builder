import { createWrap } from './_base.js';

export function build(node, ctx) {
  const { values, onChange, _reCalc, _formTick } = ctx;
  const wrap = createWrap();

  const el = document.createElement('input');
  el.type = 'url';
  el.className = 'ctrl-input--url';
  el.placeholder = 'https://';
  el.value = values[node.id] !== undefined ? values[node.id] : '';
  el.oninput = () => { values[node.id] = el.value; _reCalc(); onChange(); _formTick.value++; };

  const errMsg = document.createElement('span');
  errMsg.className = 'ctrl-err ctrl-err--ml';
  errMsg.textContent = 'Invalid URL';
  el.addEventListener('blur', () => {
    const valid = el.value === '' || el.checkValidity();
    errMsg.style.display = valid ? 'none' : '';
  });

  wrap.appendChild(el);
  wrap.appendChild(errMsg);
  return wrap;
}
