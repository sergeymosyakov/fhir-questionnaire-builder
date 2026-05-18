// ── Required (mandatory) edit modal ──────────────────────────────────────────
// Centered modal for editing a node's mandatory flag.
// Uses a draft pattern — changes are only committed on Apply.
// Cancel discards all edits.
//
// init(elements)                       — wire DOM once at startup
// open(node, mandLink, setActive)      — populate body + show
// close()                              — cancel (discard draft)

let _el      = null;
let _pending = null; // { node, mandLink, setActive, draftValue }

// ── value helpers ─────────────────────────────────────────────────────────────

const OPTIONS = [
  ['null',  'Not set (acts as required)'],
  ['true',  'Yes \u2014 required'],
  ['false', 'No \u2014 optional'],
];

function _toKey(v) {
  if (v === true)  return 'true';
  if (v === false) return 'false';
  return 'null';
}

function _fromKey(k) {
  if (k === 'true')  return true;
  if (k === 'false') return false;
  return null;
}

// ── module API ────────────────────────────────────────────────────────────────

export function init(elements) {
  _el = elements;
  _el.closeBtn.addEventListener('click', _cancel);
  _el.cancelBtn.addEventListener('click', _cancel);
  _el.applyBtn.addEventListener('click', _apply);
  _el.modal.addEventListener('click', e => { if (e.target === _el.modal) _cancel(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && _el.modal.style.display !== 'none') _cancel();
  });
}

export function open(node, mandLink, setActive) {
  _pending = { node, mandLink, setActive, draftValue: node.mandatory };

  _el.title.innerHTML = '';
  const labelEl = document.createElement('span');
  labelEl.className   = 'modal-title-label';
  labelEl.textContent = 'Required';
  const subjectEl = document.createElement('span');
  subjectEl.className   = 'modal-title-subject';
  subjectEl.textContent = '\u2014 ' + (node.title || node.id || 'Item');
  _el.title.appendChild(labelEl);
  _el.title.appendChild(subjectEl);

  _el.body.innerHTML = '';
  _renderBody(_el.body);
  _el.modal.style.display = 'flex';
}

function _apply() {
  if (!_pending) return;
  const { node, mandLink, setActive } = _pending;
  node.mandatory = _pending.draftValue;
  setActive(mandLink, node.mandatory === true);
  _close();
}

function _cancel() { _close(); }

function _close() {
  _pending = null;
  _el.modal.style.display = 'none';
}

// ── body renderer ─────────────────────────────────────────────────────────────

function _renderBody(container) {
  const hint = document.createElement('div');
  hint.className   = 'panel-hint';
  hint.textContent = 'Whether this item must be answered. Required items show \u2714/\u2718 validation in the preview and affect the final PASS/FAIL result.';
  container.appendChild(hint);

  const row = document.createElement('div');
  row.className = 'required-modal-row';

  const lbl = document.createElement('label');
  lbl.className   = 'required-modal-label';
  lbl.textContent = 'Required:';
  lbl.htmlFor     = '_rm_sel';

  const sel = document.createElement('select');
  sel.id             = '_rm_sel';
  sel.className      = 'required-modal-sel';
  sel.dataset.testid = 'required-sel';

  for (const [val, text] of OPTIONS) {
    const o = document.createElement('option');
    o.value = val; o.textContent = text;
    if (val === _toKey(_pending.draftValue)) o.selected = true;
    sel.appendChild(o);
  }
  sel.onchange = () => { _pending.draftValue = _fromKey(sel.value); };

  row.appendChild(lbl);
  row.appendChild(sel);
  container.appendChild(row);
}
