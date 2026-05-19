// ── Constraint edit modal ─────────────────────────────────────────────────────
// Centered modal for editing a node's questionnaire-constraint[] array.
// Uses a draft pattern — changes are only committed on Apply.
// Cancel discards all edits.
//
// init(elements)                          — wire DOM once at startup
// open(node, constraintLink, setActive)   — populate body + show
// close()                                 — cancel (discard draft)

import { triggerCalcRecalc } from '../builder/_shared.js';
import * as explainModal from './explain-modal.js';
import { getLastCtx } from '../render-preview.js';
import { createCustomSelect } from './custom-select.js';

let _el      = null;
let _pending = null; // { node, constraintLink, setActive, draft }

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

export function open(node, constraintLink, setActive) {
  if (!Array.isArray(node.constraint)) node.constraint = [];
  const draft = JSON.parse(JSON.stringify(node.constraint));

  _pending = { node, constraintLink, setActive, draft };

  // Title: label + muted subject
  _el.title.innerHTML = '';
  const labelEl = document.createElement('span');
  labelEl.className   = 'modal-title-label';
  labelEl.textContent = 'Constraints';
  const subjectEl = document.createElement('span');
  subjectEl.className   = 'modal-title-subject';
  subjectEl.textContent = '\u2014 ' + (node.title || node.id || 'Item');
  _el.title.appendChild(labelEl);
  _el.title.appendChild(subjectEl);

  _el.body.innerHTML = '';
  _renderBody(draft, _el.body);
  _el.modal.style.display = 'flex';
}

function _apply() {
  if (!_pending) return;
  const { node, draft, constraintLink, setActive } = _pending;
  node.constraint = draft;
  setActive(constraintLink, draft.length > 0);
  triggerCalcRecalc();
  _close();
}

function _cancel() {
  _close();
}

function _close() {
  if (_el) _el.modal.style.display = 'none';
  _pending = null;
}

// ── Body renderer ─────────────────────────────────────────────────────────────

function _renderBody(draft, container) {
  container.innerHTML = '';

  if (draft.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'constraint-empty-msg';
    empty.textContent = 'No constraints. Add one below.';
    container.appendChild(empty);
  }

  draft.forEach((c, idx) => {
    const card = document.createElement('div');
    card.className = 'constraint-card';

    // Card header: key badge + severity selector + remove button
    const hdr = document.createElement('div');
    hdr.className = 'constraint-card-hdr';

    const keyLbl = document.createElement('span');
    keyLbl.className   = 'constraint-key';
    keyLbl.textContent = c.key || '(no key)';
    hdr.appendChild(keyLbl);

    const sevSel = createCustomSelect({
      items: [{ value: 'error', label: 'error \u274C' }, { value: 'warning', label: 'warning \u26A0\uFE0F' }],
      value: c.severity || 'error',
      className: 'constraint-sev-sel sc-trigger--sm',
      onChange: v => { c.severity = v; },
    });
    hdr.appendChild(sevSel.el);

    const rmBtn = document.createElement('button');
    rmBtn.type = 'button'; rmBtn.className = 'vis-cond-rm'; rmBtn.textContent = '\u2715';
    rmBtn.onclick = () => { draft.splice(idx, 1); _renderBody(draft, container); };
    hdr.appendChild(rmBtn);
    card.appendChild(hdr);

    // Key input
    const keyInp = document.createElement('input');
    keyInp.type = 'text'; keyInp.className = 'panel-inp-sm constraint-inp';
    keyInp.placeholder = 'key (e.g. consent-required)';
    keyInp.value = c.key || '';
    keyInp.oninput = () => { c.key = keyInp.value; keyLbl.textContent = keyInp.value || '(no key)'; };
    card.appendChild(_lbl('Key:', keyInp));

    // Human message
    const humanInp = document.createElement('input');
    humanInp.type = 'text'; humanInp.className = 'panel-inp-sm constraint-inp';
    humanInp.placeholder = 'Human-readable message';
    humanInp.value = c.human || '';
    humanInp.oninput = () => { c.human = humanInp.value; };
    card.appendChild(_lbl('Message:', humanInp));

    // FHIRPath expression + Explain button row
    const exprInp = document.createElement('textarea');
    exprInp.rows = 2;
    exprInp.className = 'expr-textarea';
    exprInp.placeholder = 'FHIRPath expression (must return true to pass)';
    exprInp.value = c.expression || '';
    const _resize = () => { exprInp.style.height = 'auto'; exprInp.style.height = exprInp.scrollHeight + 'px'; };
    exprInp.addEventListener('input', _resize);
    setTimeout(_resize, 0);
    exprInp.oninput = () => { c.expression = exprInp.value; };

    const explainBtn = document.createElement('button');
    explainBtn.type = 'button';
    explainBtn.className = 'expr-explain-btn';
    explainBtn.textContent = 'Explain';
    explainBtn.title = 'Evaluate expression and show result tree';
    explainBtn.onclick = () => {
      const fp = window.fhirpath;
      const { qr, env } = getLastCtx();
      if (fp && exprInp.value.trim()) explainModal.show(exprInp.value.trim(), fp, qr, env);
    };

    const exprWrap = document.createElement('div');
    exprWrap.className = 'constraint-expr-wrap';
    exprWrap.appendChild(exprInp);
    exprWrap.appendChild(explainBtn);
    card.appendChild(_lbl('Expression:', exprWrap));

    container.appendChild(card);
  });

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'vis-add-btn vis-add-btn--mt';
  addBtn.textContent = '+ Add constraint';
  addBtn.onclick = () => {
    draft.push({ key: '', severity: 'error', human: '', expression: '' });
    _renderBody(draft, container);
  };
  container.appendChild(addBtn);
}

function _lbl(text, input) {
  const row = document.createElement('div');
  row.className = 'constraint-field-row';
  const lbl = document.createElement('label');
  lbl.className   = 'constraint-field-lbl';
  lbl.textContent = text;
  row.appendChild(lbl);
  row.appendChild(input);
  return row;
}
