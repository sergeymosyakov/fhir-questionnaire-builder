import { createCustomSelect } from '../../custom-select.js';
import { applyTip } from '../section.js';
export { applyTip, makeCollapsible } from '../section.js';

// ── makeRow: label + text/date/textarea input ─────────────────────────────────
export function makeRow(pending, key, label, type, placeholder, testid, tip = null) {
  const row = document.createElement('div');
  row.className = 'meta-modal-row';
  const lbl = document.createElement('label');
  lbl.className   = 'meta-modal-lbl';
  lbl.textContent = label + ':';
  applyTip(lbl, tip);
  let inp;
  if (type === 'textarea') {
    inp = document.createElement('textarea');
    inp.className = 'meta-modal-textarea';
    inp.rows = 3;
  } else {
    inp = document.createElement('input');
    inp.type      = type;
    inp.className = type === 'date' ? 'meta-modal-inp meta-modal-inp--date' : 'meta-modal-inp';
  }
  inp.value          = pending[key] || '';
  inp.placeholder    = placeholder;
  inp.dataset.testid = testid;
  inp.oninput = () => { pending[key] = inp.value; };
  row.append(lbl, inp);
  return row;
}

// ── makeSelectRow: label + custom dropdown ────────────────────────────────────
// options: Array<{ value, label }>
export function makeSelectRow(pending, key, label, options, testid, tip = null) {
  const row = document.createElement('div');
  row.className = 'meta-modal-row';
  const lbl = document.createElement('label');
  lbl.className   = 'meta-modal-lbl';
  lbl.textContent = label + ':';
  applyTip(lbl, tip);
  const currentVal = String(pending[key] ?? '');
  let items = options.map(o => ({ value: o.value, label: o.label }));
  if (currentVal && !options.find(o => o.value === currentVal)) {
    items = [{ value: currentVal, label: currentVal + ' (imported)' }, ...items];
  }
  const sel = createCustomSelect({
    items,
    value:    currentVal || (items[0]?.value ?? ''),
    testid,
    className: 'sc-trigger--sm',
    onChange:  v => { pending[key] = v; },
  });
  row.append(lbl, sel.el);
  return row;
}


