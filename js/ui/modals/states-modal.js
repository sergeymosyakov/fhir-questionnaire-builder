// ── States modal (Required / Read-only / Hidden / Collapsible) ───────────────
import { MODAL_REGISTRY } from './modal-registry.js';
import { Modal } from './modal-base.js';
import { triggerCalcRecalc } from '../../builder/_shared.js';
import { STATES_SECTIONS, renderStatesSections } from './states-sections/index.js';

class StatesModal extends Modal {
  constructor() {
    super({ maxWidth: '380px' });
    this._pending = null;
    MODAL_REGISTRY.set('states', this);
  }

  open(node, statesLink, setActive) {
    this._pending = { node, statesLink, setActive,
      ...Object.assign({}, ...STATES_SECTIONS.map(s => s.initPending(node))) };
    this.setTitle('States', node.title || node.id || 'Item');
    renderStatesSections(this.body, this._pending);
    super.open();
  }

  _apply() {
    if (!this._pending) return;
    const { node, statesLink, setActive } = this._pending;
    STATES_SECTIONS.forEach(s => s.commit(this._pending, node));
    const anyActive = node.mandatory === true || !!node._readOnly || !!node._hidden || !!node._collapsible;
    setActive(statesLink, anyActive);
    triggerCalcRecalc();
    this._cancel();
  }

  _cancel() {
    this._pending = null;
    this.close();
  }
}
new StatesModal();
