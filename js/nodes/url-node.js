// ── UrlNode ───────────────────────────────────────────────────────────────────
// URI input with format validation. itemType: 'url'
// Optional FHIR-imported: _entryFormat, _maxLength, _minLength
import { ItemNode } from './item-node.js';
import { NODE_REGISTRY } from './registry.js';
import { BaseNode, createWrap } from './base-node.js';

export class UrlNode extends ItemNode {
  constructor(data = {}) {
    super(data);
    this.itemType = 'url';
  }

  buildControl(ctx) {
    const node = this;
    const { getValue, setValue, onChange, _reCalc } = ctx;
    const wrap = createWrap();
    wrap.className = 'ctrl-wrap ctrl-wrap--text';

    const el = document.createElement('textarea');
    el.className = 'ctrl-input--text';
    el.rows = 1;
    el.placeholder = node._entryFormat || 'https://';
    el.value = getValue(node.id) !== undefined ? getValue(node.id) : '';

    const autoResize = () => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; };
    const isValidUrl = v => { try { new URL(v); return true; } catch { return false; } };

    if (node._maxLength) el.maxLength = node._maxLength;
    if (node._minLength) el.minLength = node._minLength;

    const errMsg = document.createElement('span');
    errMsg.className = 'ctrl-err ctrl-err--ml';
    errMsg.textContent = 'Invalid URL';
    errMsg.style.display = 'none';

    const validateErr = () => {
      if (node._minLength && el.value.length > 0 && el.value.length < node._minLength) {
        errMsg.textContent = 'Min\u00A0' + node._minLength + '\u00A0chars';
        errMsg.style.display = 'inline';
      } else {
        errMsg.textContent = 'Invalid URL';
        errMsg.style.display = (el.value === '' || isValidUrl(el.value)) ? 'none' : 'inline';
      }
    };
    if (node._minLenInteracted || (el.value && !isValidUrl(el.value))) validateErr();

    let counter = null;
    if (node._maxLength) {
      counter = document.createElement('span');
      counter.className = 'ctrl-char-counter';
      counter.dataset.testid = 'char-counter';
      const updateCounter = () => { counter.textContent = el.value.length + '\u00A0/\u00A0' + node._maxLength; };
      updateCounter();
      el.addEventListener('input', updateCounter);
    }

    let _debounce = null;
    el.oninput = () => {
      setValue(node.id, el.value);
      autoResize();
      clearTimeout(_debounce);
      _debounce = setTimeout(() => { _reCalc(); onChange(); }, 200);
    };
    el.onchange = () => { BaseNode.notifyChanged(); };
    el.addEventListener('blur', () => { node._minLenInteracted = true; validateErr(); });

    wrap.appendChild(el);
    wrap.appendChild(errMsg);
    if (counter) wrap.appendChild(counter);
    if (el.value) requestAnimationFrame(autoResize);
    return wrap;
  }
}

NODE_REGISTRY.set('url',         UrlNode);
