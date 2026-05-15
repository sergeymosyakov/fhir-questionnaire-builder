import { createWrap } from './_base.js';
import { parseOptions } from '../utils.js';

export function build(node, ctx) {
  const { values, onChange, _reCalc, _formTick } = ctx;
  const wrap = createWrap();

  const opts   = parseOptions(node.options);
  let selected = values[node.id] || '';

  // ── Trigger button ────────────────────────────────────────────────────────
  const trigger = document.createElement('div');
  trigger.className = 'sc-trigger';
  trigger.tabIndex  = 0;

  const textSpan = document.createElement('span');
  textSpan.className = 'sc-trigger-text';
  trigger.appendChild(textSpan);

  const setLabel = () => {
    const found = opts.find(o => o.code === selected);
    textSpan.textContent = found ? (found.display || found.code) : '\u2014 select \u2014';
    trigger.classList.toggle('sc-trigger--empty', !found);
  };
  setLabel();

  // ── Portal dropdown ───────────────────────────────────────────────────────
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
    values[node.id] = code;
    setLabel();
    _reCalc();
    onChange();
    _formTick.value++;
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
      opt.className   = 'oc-opt';
      opt.textContent = label;
      if (code === selected) opt.classList.add('oc-opt--sel');
      opt.addEventListener('mousedown', e => { e.preventDefault(); _pick(code); });
      dropEl.appendChild(opt);
    }

    document.body.appendChild(dropEl);
    _open = true;

    const rect  = trigger.getBoundingClientRect();
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
