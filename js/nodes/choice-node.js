// ── ChoiceNode / RadioNode / OpenChoiceNode ───────────────────────────────────
// Closed/open answer-list questions.
// Optional FHIR-imported: _optionOrdinals, _optionPrefixes, _choiceOrientation,
//   _answerValueSet, _openLabel, _initialSelected
import { ItemNode } from './item-node.js';
import { NODE_REGISTRY } from './registry.js';
import { createWrap } from './base-node.js';
import { parseOptions } from '../utils.js';

// Evaluate answerExpression (SDC) against the current FHIRPath context.
// Returns [{code, display}] from the expression result, or falls back to
// parseOptions(node.options) if the expression is absent, empty, or errors.
// For external answerValueSet items, reads node._vsCache populated by
// terminologyService.expandAll() — returns [] if expansion not yet done.
function _evalAnswerOpts(node, fpCtx) {
  if (!node._answerExpression) {
    if (node._answerValueSet && !node._answerValueSet.startsWith('#')) {
      return node._vsCache ?? [];
    }
    return parseOptions(node.options);
  }
  if (!fpCtx || !fpCtx.fp || !fpCtx.qr) return parseOptions(node.options);
  try {
    const raw = fpCtx.fp.evaluate(fpCtx.qr, node._answerExpression, fpCtx.env || {});
    if (!raw || !raw.length) return parseOptions(node.options);
    return raw.map(v => {
      if (v === null || v === undefined) return null;
      if (typeof v === 'string')  return { code: v, display: v };
      if (typeof v === 'number')  return { code: String(v), display: String(v) };
      if (typeof v === 'boolean') return { code: String(v), display: v ? 'Yes' : 'No' };
      if (typeof v === 'object') {
        if (v.code  !== undefined) return { code: String(v.code),  display: v.display || String(v.code) };
        if (v.value !== undefined) return { code: String(v.value), display: v.display || String(v.value) };
      }
      return { code: String(v), display: String(v) };
    }).filter(Boolean);
  } catch {
    return parseOptions(node.options);
  }
}

export class ChoiceNode extends ItemNode {
  constructor(data = {}) {
    super(data);
    this.itemType = 'select';
  }

  buildControl(ctx) {
    const node = this;
    const { getValue, setValue, onChange, _reCalc, _formTick } = ctx;
    const wrap = createWrap();

    const opts   = _evalAnswerOpts(node, ctx._fpCtx);
    let selected = getValue(node.id) || '';

    const trigger = document.createElement('div');
    trigger.className = 'sc-trigger';
    trigger.tabIndex  = 0;

    const textSpan = document.createElement('span');
    textSpan.className = 'sc-trigger-text';
    trigger.appendChild(textSpan);

    const setLabel = () => {
      const found = opts.find(o => o.code === selected);
      if (found) {
        let label = found.display || found.code;
        if (node._optionPrefixes && node._optionPrefixes[found.code] !== undefined)
          label = node._optionPrefixes[found.code] + '\u00A0' + label;
        if (node._optionOrdinals && node._optionOrdinals[found.code] !== undefined)
          label += '\u00A0(' + node._optionOrdinals[found.code] + ')';
        textSpan.textContent = label;
      } else {
        textSpan.textContent = '\u2014 select \u2014';
      }
      trigger.classList.toggle('sc-trigger--empty', !found);
    };
    setLabel();

    let dropEl = null;
    let _open  = false;

    const close = () => {
      if (dropEl) { dropEl.remove(); dropEl = null; }
      _open = false;
      document.removeEventListener('mousedown', _onOutside, true);
    };

    const _onOutside = e => {
      if (!wrap.contains(e.target) && !dropEl?.contains(e.target)) close();
    };

    const _pick = code => {
      selected = code;
      setValue(node.id, code);
      setLabel();
      _reCalc(); onChange(); _formTick.value++;
      close();
      trigger.focus();
    };

    const openDrop = () => {
      if (dropEl) { close(); return; }
      dropEl = document.createElement('div');
      dropEl.className = 'oc-drop';
      for (const { code, display } of opts) {
        const label = display || code;
        const opt   = document.createElement('div');
        opt.className = 'oc-opt';
        if (node._optionPrefixes && node._optionPrefixes[code] !== undefined) {
          const pfx = document.createElement('span');
          pfx.className = 'option-prefix';
          pfx.textContent = node._optionPrefixes[code] + '\u00A0';
          opt.appendChild(pfx);
        }
        if (node._optionOrdinals && node._optionOrdinals[code] !== undefined) {
          opt.appendChild(document.createTextNode(label));
          const ord = document.createElement('span');
          ord.className = 'option-ordinal';
          ord.textContent = '\u00A0(' + node._optionOrdinals[code] + ')';
          opt.appendChild(ord);
        } else {
          opt.appendChild(document.createTextNode(label));
        }
        if (code === selected) opt.classList.add('oc-opt--sel');
        opt.addEventListener('mousedown', e => { e.preventDefault(); _pick(code); });
        dropEl.appendChild(opt);
      }
      document.body.appendChild(dropEl);
      _open = true;
      const rect = trigger.getBoundingClientRect();
      dropEl.style.left     = rect.left + 'px';
      dropEl.style.minWidth = rect.width + 'px';
      const dropH = dropEl.offsetHeight;
      if (rect.bottom + dropH + 4 <= window.innerHeight) {
        dropEl.style.top = (rect.bottom + 2) + 'px';
      } else {
        dropEl.style.top = Math.max(4, rect.top - dropH - 2) + 'px';
      }
      document.addEventListener('mousedown', _onOutside, true);
    };

    trigger.addEventListener('click', openDrop);
    trigger.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDrop(); }
      if (e.key === 'Escape') close();
    });

    wrap.appendChild(trigger);
    return wrap;
  }
}

export class RadioNode extends ItemNode {
  constructor(data = {}) {
    super(data);
    this.itemType = 'radio';
  }

  buildControl(ctx) {
    const node = this;
    const { getValue, setValue, onChange, _reCalc, _formTick } = ctx;
    const wrap = createWrap();

    const opts = _evalAnswerOpts(node, ctx._fpCtx);
    if (!opts.length) {
      const msg = document.createElement('span');
      msg.className = 'radio-no-opts';
      msg.textContent = '(no options)';
      wrap.appendChild(msg);
      return wrap;
    }

    if (node._choiceOrientation === 'vertical') wrap.classList.add('ctrl-wrap--vertical');
    else if (node._choiceOrientation === 'horizontal') wrap.classList.add('ctrl-wrap--horizontal');

    const rbName = 'radio_' + node.id;

    for (const { code, display } of opts) {
      const lbl = document.createElement('label');
      lbl.className = 'radio-label';
      const rb = document.createElement('input');
      rb.type = 'radio'; rb.name = rbName; rb.value = code;
      rb.checked = getValue(node.id) === code;
      rb.onchange = () => { if (rb.checked) { setValue(node.id, code); _reCalc(); onChange(); _formTick.value++; } };
      lbl.appendChild(rb);
      if (node._optionPrefixes && node._optionPrefixes[code] !== undefined) {
        const pfx = document.createElement('span');
        pfx.className = 'option-prefix';
        pfx.textContent = node._optionPrefixes[code] + '\u00A0';
        lbl.appendChild(pfx);
      }
      lbl.appendChild(document.createTextNode(display));
      if (node._optionOrdinals && node._optionOrdinals[code] !== undefined) {
        const ord = document.createElement('span');
        ord.className = 'option-ordinal';
        ord.textContent = '\u00A0(' + node._optionOrdinals[code] + ')';
        lbl.appendChild(ord);
      }
      wrap.appendChild(lbl);
    }
    return wrap;
  }
}

export class OpenChoiceNode extends ItemNode {
  constructor(data = {}) {
    super(data);
    this.itemType = 'open-choice';
  }

  buildControl(ctx) {
    const node = this;
    const { getValue, setValue, onChange, _reCalc, _formTick } = ctx;
    const wrap = createWrap();

    const parsed = _evalAnswerOpts(node, ctx._fpCtx);

    const box = document.createElement('div');
    box.className = 'oc-wrap';

    const el = document.createElement('input');
    el.type        = 'text';
    el.className   = 'oc-input';
    el.placeholder = node._openLabel || 'Choose or type\u2026';
    el.value       = getValue(node.id) !== undefined ? getValue(node.id) : '';
    el.autocomplete = 'off';

    const btn = document.createElement('button');
    btn.type      = 'button';
    btn.className = 'oc-btn';
    btn.innerHTML = '&#x25BE;';
    btn.dataset.tipTitle = 'Show options';

    box.appendChild(el);
    box.appendChild(btn);

    let dropEl = null;
    let _open  = false;

    const close = () => {
      if (dropEl) { dropEl.remove(); dropEl = null; }
      _open = false;
      document.removeEventListener('mousedown', _onOutside, true);
    };

    const _onOutside = e => {
      if (!box.contains(e.target) && !dropEl?.contains(e.target)) close();
    };

    const _pick = display => {
      el.value = display;
      setValue(node.id, display);
      _reCalc(); onChange(); _formTick.value++;
      close();
      el.focus();
    };

    const openDrop = (filter = '') => {
      if (dropEl) dropEl.remove();
      const q = filter.toLowerCase();
      const matches = q
        ? parsed.filter(({ display, code }) => (display || code).toLowerCase().includes(q))
        : parsed;
      if (!matches.length) { _open = false; return; }

      dropEl = document.createElement('div');
      dropEl.className = 'oc-drop';
      for (const { display, code } of matches) {
        const label = display || code;
        const opt = document.createElement('div');
        opt.className = 'oc-opt';
        opt.textContent = label;
        if (label === el.value) opt.classList.add('oc-opt--sel');
        opt.addEventListener('mousedown', e => { e.preventDefault(); _pick(label); });
        dropEl.appendChild(opt);
      }
      document.body.appendChild(dropEl);
      _open = true;
      const rect = el.getBoundingClientRect();
      dropEl.style.left     = rect.left + 'px';
      dropEl.style.minWidth = rect.width + 'px';
      const dropH = dropEl.offsetHeight;
      if (rect.bottom + dropH + 4 <= window.innerHeight) {
        dropEl.style.top = (rect.bottom + 2) + 'px';
      } else {
        dropEl.style.top = Math.max(4, rect.top - dropH - 2) + 'px';
      }
      document.addEventListener('mousedown', _onOutside, true);
    };

    el.addEventListener('input', () => { setValue(node.id, el.value); _reCalc(); onChange(); openDrop(el.value); });
    el.addEventListener('change', () => { _formTick.value++; });
    el.addEventListener('focus', () => { if (parsed.length) openDrop(el.value); });
    el.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    btn.addEventListener('click', e => { e.stopPropagation(); if (_open) { close(); } else { el.focus(); openDrop(el.value); } });

    wrap.appendChild(box);
    return wrap;
  }
}

NODE_REGISTRY.set('select',      ChoiceNode);
NODE_REGISTRY.set('radio',       RadioNode);
NODE_REGISTRY.set('open-choice', OpenChoiceNode);
