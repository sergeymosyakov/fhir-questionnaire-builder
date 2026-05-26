// ── Appearance (rendering-style) edit modal ───────────────────────────────────
import { MODAL_REGISTRY } from './modal-registry.js';
import { triggerCalcRecalc } from '../../builder/_shared.js';
import { initModal, setModalTitle, openModal, closeModal, createModalElements } from './modal-base.js';
import { APPEARANCE_SECTIONS, renderAppearanceSections } from './appearance-sections/index.js';

let _pending = null;

const _el = createModalElements('appearanceModal');
initModal(_el, { onApply: _apply, onCancel: _cancel });

export function open(node, styleLink, setActive) {
  _pending = { node, styleLink, setActive,
    ...Object.assign({}, ...APPEARANCE_SECTIONS.map(s => s.initPending(node))) };
  setModalTitle(_el.title, 'Appearance', node.title || node.id || 'Item');
  renderAppearanceSections(_el.body, _pending);
  openModal(_el.modal);
}

function _apply() {
  if (!_pending) return;
  const { node, styleLink, setActive } = _pending;
  APPEARANCE_SECTIONS.forEach(s => s.commit(_pending, node));
  setActive(styleLink, !!(node._renderStyle || node._renderXhtml));
  triggerCalcRecalc();
  _close();
}

function _cancel() { _close(); }

function _close() {
  _pending = null;
  closeModal(_el.modal);
}

MODAL_REGISTRY.set('appearance', { open });
