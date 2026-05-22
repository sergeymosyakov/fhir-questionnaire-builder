import { createWrap } from './_base.js';

export function build(node, ctx) {
  const { getValue, setValue, onChange, _reCalc, _formTick } = ctx;
  const wrap = createWrap();
  wrap.className = 'ctrl-wrap ctrl-wrap--text';

  const el = document.createElement('textarea');
  el.className = 'ctrl-input--text';
  el.rows = 1;
  el.placeholder = node._entryFormat || 'https://';
  el.value = getValue(node.id) !== undefined ? getValue(node.id) : '';

  const autoResize = () => {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };

  const isValidUrl = v => { try { new URL(v); return true; } catch { return false; } };

  if (node._maxLength) el.maxLength = node._maxLength;
  if (node._minLength) el.minLength = node._minLength;

  const errMsg = document.createElement('span');
  errMsg.className = 'ctrl-err ctrl-err--ml';
  errMsg.textContent = 'Invalid URL';
  errMsg.style.display = 'none';

  let counter = null;
  if (node._maxLength) {
    counter = document.createElement('span');
    counter.className = 'ctrl-char-counter';
    counter.dataset.testid = 'char-counter';
    const updateCounter = () => { counter.textContent = el.value.length + '\u00A0/\u00A0' + node._maxLength; };
    updateCounter();
    el.addEventListener('input', updateCounter);
  }

  const validateErr = () => {
    if (node._minLength && el.value.length > 0 && el.value.length < node._minLength) {
      errMsg.textContent = 'Min\u00A0' + node._minLength + '\u00A0chars';
      errMsg.style.display = 'inline';
    } else {
      errMsg.textContent = 'Invalid URL';
      errMsg.style.display = (el.value === '' || isValidUrl(el.value)) ? 'none' : 'inline';
    }
  };

  let _debounce = null;
  el.oninput = () => {
    setValue(node.id, el.value);
    autoResize();
    clearTimeout(_debounce);
    _debounce = setTimeout(() => { _reCalc(); onChange(); }, 200);
  };
  el.onchange = () => { _formTick.value++; };
  el.addEventListener('blur', validateErr);
  validateErr(); // restore error state after re-render

  wrap.appendChild(el);
  wrap.appendChild(errMsg);
  if (counter) wrap.appendChild(counter);
  if (el.value) requestAnimationFrame(autoResize);
  return wrap;
}
