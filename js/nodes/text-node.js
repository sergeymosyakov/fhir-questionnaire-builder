// ── TextNode ──────────────────────────────────────────────────────────────────
// Free-text single/multi-line input. itemType: 'text'
// Optional FHIR-imported: _maxLength, _minLength, _entryFormat, _minLenInteracted
import { ItemNode } from './item-node.js';
import { NODE_REGISTRY } from './registry.js';
import { createWrap } from './base-node.js';

export class TextNode extends ItemNode {
  constructor(data = {}) {
    super(data);
    this.itemType = 'text';
  }

  buildControl(ctx) {
    const node = this;
    const { getValue, setValue, onChange, _reCalc, _formTick } = ctx;
    const wrap = createWrap();
    wrap.className = 'ctrl-wrap ctrl-wrap--text';

    const el = document.createElement('textarea');
    el.className = 'ctrl-input--text';
    el.rows = node._itemControl === 'text-area' ? 3 : 1;
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
      if (node._minLenInteracted) { validateMinLen(); } else { errMinLen.style.display = 'none'; }
      el.addEventListener('blur', () => { node._minLenInteracted = true; validateMinLen(); });
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
}

NODE_REGISTRY.set('text',        TextNode);
