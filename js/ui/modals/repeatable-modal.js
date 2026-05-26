// ── Repeatable (item.repeats + cardinality) edit modal ────────────────────────
import { MODAL_REGISTRY } from './modal-registry.js';
import { Modal } from './modal-base.js';
import { triggerCalcRecalc } from '../../builder/_shared.js';
import { REPEATABLE_SECTIONS, renderRepeatableSections } from './repeatable-sections/index.js';

class RepeatableModal extends Modal {
  constructor() {
    super();
    this._pending = null;
    MODAL_REGISTRY.set('repeatable', this);
  }

  open(node, repeatLink, setActive) {
    this._pending = { node, repeatLink, setActive,
      ...Object.assign({}, ...REPEATABLE_SECTIONS.map(s => s.initPending(node))) };
    this.setTitle('Repeatable', node.title || node.id || 'Item');
    renderRepeatableSections(this.body, this._pending);
    super.open();
  }

  _apply() {
    if (!this._pending) return;
    const { node, repeatLink, setActive } = this._pending;
    REPEATABLE_SECTIONS.forEach(s => s.commit(this._pending, node));
    setActive(repeatLink, !!node.repeats);
    triggerCalcRecalc();
    this._cancel();
  }

  _cancel() {
    this._pending = null;
    this.close();
  }
}
new RepeatableModal();
