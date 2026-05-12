import { createWrap } from './_base.js';

export function build(node, ctx) {
  const { values, autoFilledIds, onChange, _reCalc, _formTick } = ctx;
  const wrap = createWrap();

  const el = document.createElement('input');
  el.type    = 'checkbox';
  el.checked = !!values[node.id];

  let badge = null;
  if (autoFilledIds.has(node.id)) {
    badge = document.createElement('span');
    badge.className = 'auto-badge';
    badge.title = 'Pre-filled from patient data. You can override.';
    badge.textContent = '\uD83E\uDD16';
  }

  el.onchange = () => {
    values[node.id] = el.checked;
    autoFilledIds.delete(node.id);
    if (badge) { badge.style.opacity = '0.35'; badge.title = 'Was pre-filled, now manually set.'; }
    _reCalc();
    onChange();
    _formTick.value++;
  };

  wrap.appendChild(el);
  if (badge) wrap.appendChild(badge);
  return wrap;
}
