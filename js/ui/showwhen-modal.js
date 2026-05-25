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
import { initModal, setModalTitle, openModal, closeModal } from './modal-base.js';

let _el      = null;
let _pending = null; // { node, visLink, setActive, draft }

export function init(elements) {
  _el = elements;
  initModal(elements, { onApply: _apply, onCancel: _cancel });
}

export function open(node, visLink, setActive, ctx, buildVisFn) {
  // Deep-clone only the fields that buildVisPanel can mutate
  const draft = Object.assign({}, node, {
    enableWhen:            JSON.parse(JSON.stringify(node.enableWhen || [])),
    enableBehavior:        node.enableBehavior        || 'all',
    enableWhenExpression:  node.enableWhenExpression  || '',
    _disabledDisplay:      node._disabledDisplay      || 'protected',
  });

  _pending = { node, visLink, setActive, draft };

  setModalTitle(_el.title, 'Show When', node.title || node.id || 'Item');
  _el.body.innerHTML = '';
  buildVisFn(draft, _el.body, visLink, () => {}, ctx);

  // ── disabledDisplay row ──────────────────────────────────────────────────
  const ddRow = document.createElement('div');
  ddRow.className = 'sw-disabled-display-row';
  const ddLbl = document.createElement('label');
  ddLbl.textContent = 'When not visible:';
  const ddSel = document.createElement('select');
  ddSel.className = 'sw-dd-select';
  ddSel.dataset.testid = 'disabled-display-select';
  [{ value: 'protected', label: 'Show grayed (protected)' },
   { value: 'hidden',    label: 'Remove from view (hidden)' }]
    .forEach(({ value, label }) => {
      const opt = document.createElement('option');
      opt.value = value; opt.textContent = label;
      if (value === draft._disabledDisplay) opt.selected = true;
      ddSel.appendChild(opt);
    });
  ddSel.onchange = () => { draft._disabledDisplay = ddSel.value; };
  ddRow.append(ddLbl, ddSel);
  _el.body.appendChild(ddRow);

  openModal(_el.modal);
  refreshExprIcons();
}

function _apply() {
  if (!_pending) return;
  const { node, draft, visLink, setActive } = _pending;
  node.enableWhen           = draft.enableWhen;
  node.enableBehavior       = draft.enableBehavior;
  node.enableWhenExpression = draft.enableWhenExpression;
  if (draft._disabledDisplay && draft._disabledDisplay !== 'protected') {
    node._disabledDisplay = draft._disabledDisplay;
  } else {
    delete node._disabledDisplay; // 'protected' is default — don't persist
  }
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
  closeModal(_el.modal);
  _el.body.innerHTML = '';
}

// Public alias so external callers (e.g. Escape handler) can close the modal
export { _cancel as close };
