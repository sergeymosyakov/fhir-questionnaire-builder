import { createWrap } from './_base.js';

export function build(node, ctx) {
  const { getValue, setValue, onChange, _reCalc, _formTick } = ctx;
  const wrap = createWrap();
  wrap.className = 'ctrl-wrap ctrl-wrap--text';

  const el = document.createElement('textarea');
  el.className = 'ctrl-input--text';
  el.rows = 1;
  el.value = getValue(node.id) !== undefined ? getValue(node.id) : '';

  if (node._maxLength) el.maxLength = node._maxLength;
  if (node._minLength) el.minLength = node._minLength;
  if (node._entryFormat) el.placeholder = node._entryFormat;

  const autoResize = () => {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };

  let counter = null;
  if (node._maxLength) {
    counter = document.createElement('span');
    counter.className = 'ctrl-char-counter';
    counter.dataset.testid = 'char-counter';
    const updateCounter = () => { counter.textContent = el.value.length + '\u00A0/\u00A0' + node._maxLength; };
    updateCounter();
    el.addEventListener('input', updateCounter);
  }

  let errMinLen = null;
  if (node._minLength) {
    errMinLen = document.createElement('span');
    errMinLen.className = 'ctrl-err ctrl-err--ml';
    errMinLen.dataset.testid = 'minlength-err';
    errMinLen.textContent = 'Min\u00A0' + node._minLength + '\u00A0chars';
    const validateMinLen = () => {
      errMinLen.style.display = (el.value.length > 0 && el.value.length < node._minLength) ? 'inline' : 'none';
    };
    errMinLen.style.display = 'none';
    el.addEventListener('blur', validateMinLen);
    validateMinLen(); // restore error state after re-render if value already invalid
  }

  let _debounce = null;
  el.oninput  = () => {
    setValue(node.id, el.value);
    autoResize();
    clearTimeout(_debounce);
    _debounce = setTimeout(() => { _reCalc(); onChange(); }, 200);
  };
  el.onchange = () => { _formTick.value++; };

  wrap.appendChild(el);
  if (counter) wrap.appendChild(counter);
  if (errMinLen) wrap.appendChild(errMinLen);
  if (el.value) requestAnimationFrame(autoResize);
  return wrap;
}
