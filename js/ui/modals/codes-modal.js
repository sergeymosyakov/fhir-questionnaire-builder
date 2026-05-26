// ── Item Properties modal ─────────────────────────────────────────────────────
// Sections live in item-sections/; this file is a thin lifecycle wrapper.
import { MODAL_REGISTRY } from './modal-registry.js';
import { Modal } from './modal-base.js';
import { ITEM_SECTIONS, renderItemSections } from './item-sections/index.js';

class CodesModal extends Modal {
  getName() { return 'codesModal'; }
  constructor() {
    super();
    this._pending = null;
    MODAL_REGISTRY.set('codes', this);
  }

  open(node, link, setActive) {
    this._pending = Object.assign(
      { node, link, setActive },
      ...ITEM_SECTIONS.map(s => s.initPending(node)),
    );
    this.setTitle('Item Properties', node.title || node.id || 'Item');
    renderItemSections(this.body, this._pending);
    super.open();
  }

  _apply() {
    if (!this._pending) return;
    const { node, link, setActive } = this._pending;
    ITEM_SECTIONS.forEach(s => s.commit(this._pending, node));
    const isActive = !!(node._codes?.length) || !!node._definition ||
                     !!(node._supportLinks?.length) || !!(node._unknownExtensions?.length);
    setActive(link, isActive);
    Modal._svc.triggerCalcRecalc();
    this._cancel();
  }

  _cancel() {
    this._pending = null;
    this.close();
  }
}
new CodesModal();

// Re-export shared utility used by metadata-sections/codes.js and resource-meta.js
export { renderCodesEditor } from './item-sections/codes.js';
