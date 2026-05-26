import { MODAL_REGISTRY } from './modal-registry.js';
// ── Show When (enableWhen) edit modal ─────────────────────────────────────────
// Centered modal for editing a node's enableWhen conditions and
// enableWhenExpression. Uses a draft pattern — changes are only committed on
// Apply. Cancel discards all edits and restores the original state.
//
// init(elements)                                  — wire DOM once at startup
// open(node, visLink, setActive, ctx, buildVisFn) — populate body + show
// close()                                         — cancel (discard draft)

import { refreshExprIcons } from '../../render-preview.js';
import { triggerCalcRecalc } from '../../builder/_shared.js';
import { initModal, setModalTitle, openModal, closeModal, createModalElements } from './modal-base.js';
import { createCustomSelect } from '../custom-select.js';

let _pending = null; // { node, visLink, setActive, draft }

const _el = createModalElements('showWhenModal');
initModal(_el, { onApply: _apply, onCancel: _cancel });

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
  ddLbl.dataset.tipTitle = 'Disabled display';
  ddLbl.dataset.tipBody  = '"Protected" keeps the item grayed-out and read-only when its condition is not met. "Hidden" removes it from the form entirely.';
  ddLbl.dataset.tipFhir  = 'item.extension[questionnaire-disabledDisplay].valueCode';
  ddLbl.dataset.tipSpec  = 'SDC';
  const ddSel = createCustomSelect({
    items: [
      { value: 'protected', label: 'Show grayed (protected)' },
      { value: 'hidden',    label: 'Remove from view (hidden)' },
    ],
    value:     draft._disabledDisplay,
    testid:    'disabled-display-select',
    className: 'sc-trigger--sm',
    onChange:  v => { draft._disabledDisplay = v; },
  });
  ddRow.append(ddLbl, ddSel.el);
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

MODAL_REGISTRY.set('showWhen', { open });
