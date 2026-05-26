// ── Appearance (rendering-style) edit modal ───────────────────────────────────
import { MODAL_REGISTRY } from './modal-registry.js';
import { Modal } from './modal-base.js';
import { APPEARANCE_SECTIONS, renderAppearanceSections } from './appearance-sections/index.js';

class AppearanceModal extends Modal {
  getName() { return 'appearanceModal'; }
  constructor() {
    super();
    this._pending = null;
    MODAL_REGISTRY.set('appearance', this);
  }

  open(node, styleLink, setActive) {
    this._pending = { node, styleLink, setActive,
      ...Object.assign({}, ...APPEARANCE_SECTIONS.map(s => s.initPending(node))) };
    this.setTitle('Appearance', node.title || node.id || 'Item');
    renderAppearanceSections(this.body, this._pending);
    super.open();
  }

  _apply() {
    if (!this._pending) return;
    const { node, styleLink, setActive } = this._pending;
    APPEARANCE_SECTIONS.forEach(s => s.commit(this._pending, node));
    setActive(styleLink, !!(node._renderStyle || node._renderXhtml));
    Modal._svc.triggerCalcRecalc();
    this._cancel();
  }

  _cancel() {
    this._pending = null;
    this.close();
  }
}
new AppearanceModal();
