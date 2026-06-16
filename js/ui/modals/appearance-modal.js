// ── Appearance (rendering-style) edit modal ───────────────────────────────────
import { MODAL_REGISTRY } from './modal-registry.js';
import { Modal } from './modal-base.js';
import { APPEARANCE_SECTIONS, renderAppearanceSections } from './appearance-sections/index.js';
import { nodePickerModal } from './node-picker-modal.js';
import { AppEvents } from '../../events.js';

class AppearanceModal extends Modal {
  getName() { return 'appearanceModal'; }
  constructor() {
    super();
    this._pending = null;
    MODAL_REGISTRY.set('appearance', this);

    this._copyToBtn = document.createElement('button');
    this._copyToBtn.type = 'button';
    this._copyToBtn.className = 'modal-btn modal-btn--copy-to';
    this._copyToBtn.textContent = 'Copy to\u2026';
    this._copyToBtn.dataset.testid = 'appearance-copy-to-btn';
    this._copyToBtn.addEventListener('click', () => this._openCopyTo());
    this.footer.insertBefore(this._copyToBtn, this.footer.firstChild);
  }

  open(node, styleLink, setActive) {
    this._pending = { node, styleLink, setActive,
      ...Object.assign({}, ...APPEARANCE_SECTIONS.map(s => s.initPending(node))) };
    this.setTitle('Appearance', node.title || node.id || 'Item');
    renderAppearanceSections(this.body, this._pending);
    super.open();
  }

  _buildPayload() {
    const p = this._pending;
    return Object.assign({}, ...APPEARANCE_SECTIONS.map(s => s.buildPatch(p, p.node)));
  }

  _openCopyTo() {
    if (!this._pending) return;
    const patch = this._buildPayload();
    const { node } = this._pending;
    nodePickerModal.open(node.id, (ids) => {
      document.dispatchEvent(new CustomEvent(AppEvents.COPY_TO_NODES, { detail: { ids, patch, nodeType: node.type } }));
      document.dispatchEvent(new CustomEvent(AppEvents.CALC_RECALC_REQUESTED));
      document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_RERENDER));
    }, node.type);
  }

  _apply() {
    if (!this._pending) return;
    const { node, styleLink, setActive } = this._pending;
    node.applyPatch(this._buildPayload());
    setActive(styleLink, !!(node._renderStyle || node._renderXhtml || node._renderMarkdown));
    document.dispatchEvent(new CustomEvent(AppEvents.CALC_RECALC_REQUESTED));
    this._cancel();
  }

  _cancel() {
    this._pending = null;
    this.close();
  }
}
new AppearanceModal();
