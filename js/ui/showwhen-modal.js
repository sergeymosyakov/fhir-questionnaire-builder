// ── Show When (enableWhen) edit modal ─────────────────────────────────────────
// Centered modal for editing a node's enableWhen conditions and
// enableWhenExpression. Uses a draft pattern — changes are only committed on
// Apply. Cancel discards all edits and restores the original state.
//
// init(elements)                                  — wire DOM once at startup
// open(node, visLink, setActive, ctx, buildVisFn) — populate body + show
// close()                                         — cancel (discard draft)

import { refreshExprIcons } from '../render-preview.js';
import { triggerCalcRecalc } from '../builder/_shared.js';

let _el      = null;
let _pending = null; // { node, visLink, setActive, draft }

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

export function open(node, visLink, setActive, ctx, buildVisFn) {
  // Deep-clone only the fields that buildVisPanel can mutate
  const draft = Object.assign({}, node, {
    enableWhen:            JSON.parse(JSON.stringify(node.enableWhen || [])),
    enableBehavior:        node.enableBehavior        || 'all',
    enableWhenExpression:  node.enableWhenExpression  || '',
  });

  _pending = { node, visLink, setActive, draft };

  // Build title: label + muted subject
  _el.title.innerHTML = '';
  const labelEl = document.createElement('span');
  labelEl.className   = 'modal-title-label';
  labelEl.textContent = 'Show When';
  const subjectEl = document.createElement('span');
  subjectEl.className   = 'modal-title-subject';
  subjectEl.textContent = '\u2014 ' + (node.title || node.id || 'Item');
  _el.title.appendChild(labelEl);
  _el.title.appendChild(subjectEl);
  _el.body.innerHTML = '';
  // Pass a no-op setActive — button state must only change on Apply, not during draft editing
  buildVisFn(draft, _el.body, visLink, () => {}, ctx);
  _el.modal.style.display = 'flex';
  refreshExprIcons();
}

function _apply() {
  if (!_pending) return;
  const { node, draft, visLink, setActive } = _pending;
  node.enableWhen           = draft.enableWhen;
  node.enableBehavior       = draft.enableBehavior;
  node.enableWhenExpression = draft.enableWhenExpression;
  setActive(visLink, node.enableWhen.length > 0 || !!node.enableWhenExpression);
  triggerCalcRecalc();
  _close();
}

function _cancel() {
  _close();
}

function _close() {
  if (!_el) return;
  _pending = null;
  _el.modal.style.display = 'none';
  _el.body.innerHTML = '';
}

// Public alias so external callers (e.g. Escape handler) can close the modal
export { _cancel as close };
