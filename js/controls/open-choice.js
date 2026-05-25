import { createWrap } from './_base.js';
import { parseOptions } from '../utils.js';

export function build(node, ctx) {
  const { getValue, setValue, onChange, _reCalc, _formTick } = ctx;
  const wrap = createWrap();

  const parsed = parseOptions(node.options);

  // ── Wrapper ───────────────────────────────────────────────────────────────
  const box = document.createElement('div');
  box.className = 'oc-wrap';

  const el = document.createElement('input');
  el.type        = 'text';
  el.className   = 'oc-input';
  el.placeholder = 'Choose or type\u2026';
  el.value       = getValue(node.id) !== undefined ? getValue(node.id) : '';
  el.autocomplete = 'off';

  const btn = document.createElement('button');
  btn.type      = 'button';
  btn.className = 'oc-btn';
  btn.innerHTML = '&#x25BE;'; // ▾
  btn.title     = 'Show options';

  box.appendChild(el);
  box.appendChild(btn);

  // ── Portal dropdown ───────────────────────────────────────────────────────
  let dropEl   = null;
  let _open    = false;

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
    _reCalc();
    onChange();
    _formTick.value++;
    close();
    el.focus();
  };

  const openDrop = (filter = '') => {
    if (dropEl) dropEl.remove();

    const q = filter.toLowerCase();
    const matches = q
      ? parsed.filter(({ display, code }) =>
          (display || code).toLowerCase().includes(q))
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
      opt.addEventListener('mousedown', e => {
        e.preventDefault(); // prevent input blur before pick
        _pick(label);
      });
      dropEl.appendChild(opt);
    }

    document.body.appendChild(dropEl);
    _open = true;

    // Position below input
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

  el.addEventListener('input', () => {
    setValue(node.id, el.value);
    _reCalc();
    onChange();
    openDrop(el.value);
  });
  el.addEventListener('change', () => { _formTick.value++; });
  el.addEventListener('focus', () => { if (parsed.length) openDrop(el.value); });
  el.addEventListener('keydown', e => {
    if (e.key === 'Escape') close();
  });

  btn.addEventListener('click', e => {
    e.stopPropagation();
    if (_open) { close(); } else { el.focus(); openDrop(el.value); }
  });

  wrap.appendChild(box);
  return wrap;
}
