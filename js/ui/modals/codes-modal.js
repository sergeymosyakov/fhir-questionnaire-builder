// ── Item Properties modal ─────────────────────────────────────────────────────
// Sections live in item-sections/; this file is a thin lifecycle wrapper.
//
// init(elements)               — wire DOM once at startup (called from app.js)
// open(node, link, setActive)  — populate body + show modal

import { MODAL_REGISTRY } from './modal-registry.js';
import { initModal, setModalTitle, openModal, closeModal } from './modal-base.js';
import { triggerCalcRecalc } from '../../builder/_shared.js';
import { ITEM_SECTIONS, renderItemSections } from './item-sections/index.js';

let _el      = null;
let _pending = null;

export function init(elements) {
  _el = elements;
  initModal(elements, { onApply: _apply, onCancel: _cancel });
}

export function open(node, link, setActive) {
  _pending = Object.assign(
    { node, link, setActive },
    ...ITEM_SECTIONS.map(s => s.initPending(node)),
  );
  setModalTitle(_el.title, 'Item Properties', node.title || node.id || 'Item');
  renderItemSections(_el.body, _pending);
  openModal(_el.modal);
}

function _apply() {
  if (!_pending) return;
  const { node, link, setActive } = _pending;
  ITEM_SECTIONS.forEach(s => s.commit(_pending, node));
  const isActive = !!(node._codes?.length) || !!node._definition ||
                   !!(node._supportLinks?.length) || !!(node._unknownExtensions?.length);
  setActive(link, isActive);
  triggerCalcRecalc();
  _close();
}

function _cancel() { _close(); }

function _close() {
  if (_el) closeModal(_el.modal);
  _pending = null;
}

// Re-export shared utility used by metadata-sections/codes.js and resource-meta.js
export { renderCodesEditor } from './item-sections/codes.js';

MODAL_REGISTRY.set('codes', { open });
