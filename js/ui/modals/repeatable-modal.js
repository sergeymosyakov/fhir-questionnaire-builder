// ── Repeatable (item.repeats + cardinality) edit modal ───────────────────────
import { MODAL_REGISTRY } from './modal-registry.js';
import { triggerCalcRecalc } from '../../builder/_shared.js';
import { initModal, setModalTitle, openModal, closeModal } from './modal-base.js';
import { REPEATABLE_SECTIONS, renderRepeatableSections } from './repeatable-sections/index.js';

let _pending = null;

const _el = {
  modal:     document.getElementById('repeatableModal'),
  title:     document.getElementById('repeatableModalTitle'),
  body:      document.getElementById('repeatableModalBody'),
  closeBtn:  document.getElementById('repeatableModalClose'),
  cancelBtn: document.getElementById('repeatableModalCancel'),
  applyBtn:  document.getElementById('repeatableModalApply'),
};
initModal(_el, { onApply: _apply, onCancel: _cancel });

export function open(node, repeatLink, setActive) {
  _pending = { node, repeatLink, setActive,
    ...Object.assign({}, ...REPEATABLE_SECTIONS.map(s => s.initPending(node))) };
  setModalTitle(_el.title, 'Repeatable', node.title || node.id || 'Item');
  renderRepeatableSections(_el.body, _pending);
  openModal(_el.modal);
}

function _apply() {
  if (!_pending) return;
  const { node, repeatLink, setActive } = _pending;
  REPEATABLE_SECTIONS.forEach(s => s.commit(_pending, node));
  setActive(repeatLink, !!node.repeats);
  triggerCalcRecalc();
  _close();
}

function _cancel() { _close(); }

function _close() {
  _pending = null;
  closeModal(_el.modal);
}

MODAL_REGISTRY.set('repeatable', { open });
