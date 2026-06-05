// ── States modal (Required / Read-only / Hidden / Collapsible) ───────────────
import { MODAL_REGISTRY } from './modal-registry.js';
import { Modal } from './modal-base.js';
import { STATES_SECTIONS, renderStatesSections } from './states-sections/index.js';

class StatesModal extends Modal {
  getName() { return 'statesModal'; }
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

  _buildPayload() {
    const p = this._pending;
    return Object.assign({}, ...STATES_SECTIONS.map(s => s.buildPatch(p, p.node)));
  }

  _apply() {
    if (!this._pending) return;
    const { node, statesLink, setActive } = this._pending;
    node.applyPatch(this._buildPayload());
    const anyActive = node.mandatory === true || !!node._readOnly || !!node._hidden || !!node._collapsible || !!node._usageMode || !!node._signatureRequired?.length;
    setActive(statesLink, anyActive);
    Modal._svc.triggerCalcRecalc();
    this._cancel();
  }

  _cancel() {
    this._pending = null;
    this.close();
  }
}
new StatesModal();
