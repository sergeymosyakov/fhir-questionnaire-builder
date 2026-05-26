// ── States modal (Required / Read-only / Hidden / Collapsible) ───────────────
import { MODAL_REGISTRY } from './modal-registry.js';
import { triggerCalcRecalc } from '../../builder/_shared.js';
import { initModal, setModalTitle, openModal, closeModal } from './modal-base.js';
import { STATES_SECTIONS, renderStatesSections } from './states-sections/index.js';

let _pending = null;

const _el = {
  modal:     document.getElementById('statesModal'),
  title:     document.getElementById('statesModalTitle'),
  body:      document.getElementById('statesModalBody'),
  closeBtn:  document.getElementById('statesModalClose'),
  cancelBtn: document.getElementById('statesModalCancel'),
  applyBtn:  document.getElementById('statesModalApply'),
};
initModal(_el, { onApply: _apply, onCancel: _cancel });

export function open(node, statesLink, setActive) {
  _pending = { node, statesLink, setActive,
    ...Object.assign({}, ...STATES_SECTIONS.map(s => s.initPending(node))) };
  setModalTitle(_el.title, 'States', node.title || node.id || 'Item');
  renderStatesSections(_el.body, _pending);
  openModal(_el.modal);
}

function _apply() {
  if (!_pending) return;
  const { node, statesLink, setActive } = _pending;
  STATES_SECTIONS.forEach(s => s.commit(_pending, node));
  const anyActive = node.mandatory === true || !!node._readOnly || !!node._hidden || !!node._collapsible;
  setActive(statesLink, anyActive);
  triggerCalcRecalc();
  _close();
}

function _cancel() { _close(); }

function _close() {
  _pending = null;
  closeModal(_el.modal);
}

MODAL_REGISTRY.set('states', { open });
