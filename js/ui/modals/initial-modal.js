// ── Default Value (initial[]) edit modal ──────────────────────────────────────
import { MODAL_REGISTRY } from './modal-registry.js';
import { Modal } from './modal-base.js';
import { triggerCalcRecalc } from '../../builder/_shared.js';
import { INITIAL_SECTIONS, renderInitialSections } from './initial-sections/index.js';

class InitialModal extends Modal {
  constructor() {
    super();
    this._pending = null;
    MODAL_REGISTRY.set('initial', this);
  }

  open(node, initLink, setActive) {
    this._pending = { node, initLink, setActive,
      ...Object.assign({}, ...INITIAL_SECTIONS.map(s => s.initPending(node))) };
    this.setTitle('Default Value', node.title || node.id || 'Item');
    renderInitialSections(this.body, this._pending);
    super.open();
  }

  _apply() {
    if (!this._pending) return;
    const { node, initLink, setActive } = this._pending;
    INITIAL_SECTIONS.forEach(s => s.commit(this._pending, node));
    setActive(initLink, node._initialValue !== undefined && node._initialValue !== '');
    triggerCalcRecalc();
    this._cancel();
  }

  _cancel() {
    this._pending = null;
    this.close();
  }
}
new InitialModal();
