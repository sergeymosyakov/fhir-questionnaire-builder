import { createCustomSelect } from '../custom-select.js';

// ── Shared tip applicator ─────────────────────────────────────────────────────
export function applyTip(el, tip) {
  if (!tip) return;
  el.dataset.tipTitle = tip.title;
  if (tip.body) el.dataset.tipBody = tip.body;
  if (tip.fhir) el.dataset.tipFhir = tip.fhir;
  if (tip.spec) el.dataset.tipSpec  = tip.spec;
}

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

// ── makeCollapsible: reusable collapsible section shell ───────────────────────
// @param {string}   opts.testid        data-testid on the toggle button
// @param {object}   [opts.tip]         { title, body, fhir, spec }
// @param {string}   opts.label         visible text (e.g. 'Derived From')
// @param {Function} [opts.countFn]     () => number for badge; omit for no badge
// @param {boolean}  [opts.initialOpen]
// @param {Function}  opts.buildBody    ({ el, setLabel, expand }) => void
// @param {boolean}  [opts.liveUpdate]  add input/click listeners to auto-refresh badge
// @returns {HTMLElement}
export function makeCollapsible({
  testid, tip, label, countFn, initialOpen = false, buildBody, liveUpdate = false,
}) {
  const section = document.createElement('div');
  section.className = 'meta-modal-advanced';

  const toggle = document.createElement('button');
  toggle.type      = 'button';
  toggle.className = 'meta-modal-adv-toggle';
  toggle.dataset.testid = testid;
  applyTip(toggle, tip);

  let open = initialOpen;

  const body = document.createElement('div');
  body.className    = 'meta-modal-adv-body';
  body.style.display = open ? '' : 'none';

  const setLabel = () => {
    const count = countFn ? countFn() : 0;
    const badge = count ? ` (${count})` : '';
    toggle.textContent = (open ? '\u25BC' : '\u25BA') + ' ' + label + badge;
  };

  const expand = () => { open = true; body.style.display = ''; };

  buildBody({ el: body, setLabel, expand });
  setLabel();

  toggle.addEventListener('click', () => {
    open = !open;
    body.style.display = open ? '' : 'none';
    setLabel();
  });

  if (liveUpdate) {
    body.addEventListener('input',  () => setLabel());
    body.addEventListener('click',  () => setTimeout(setLabel, 0));
  }

  section.append(toggle, body);
  return section;
}
