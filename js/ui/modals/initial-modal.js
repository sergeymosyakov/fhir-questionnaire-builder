// ── Default Value (initial[]) edit modal ──────────────────────────────────────
import { MODAL_REGISTRY } from './modal-registry.js';
import { Modal } from './modal-base.js';
import { INITIAL_SECTIONS, renderInitialSections } from './initial-sections/index.js';
import { nodePickerModal } from './node-picker-modal.js';
import { AppEvents } from '../../events.js';

class InitialModal extends Modal {
  getName() { return 'initialModal'; }
  constructor() {
    super();
    this._pending = null;
    MODAL_REGISTRY.set('initial', this);

    this._copyToBtn = document.createElement('button');
    this._copyToBtn.type = 'button';
    this._copyToBtn.className = 'modal-btn modal-btn--copy-to';
    this._copyToBtn.textContent = 'Copy to\u2026';
    this._copyToBtn.dataset.testid = 'initial-copy-to-btn';
    this._copyToBtn.addEventListener('click', () => this._openCopyTo());
    this.footer.insertBefore(this._copyToBtn, this.footer.firstChild);
  }

  open(node, initLink, setActive) {
    this._pending = { node, initLink, setActive,
      ...Object.assign({}, ...INITIAL_SECTIONS.map(s => s.initPending(node))) };
    this.setTitle('Default Value', node.title || node.id || 'Item');
    renderInitialSections(this.body, this._pending);
    super.open();
  }

  _buildPayload() {
    const v = this._pending.draftValue;
    return { _initialValue: (v !== undefined && v !== '') ? v : null };
  }

  _openCopyTo() {
    if (!this._pending) return;
    const patch = this._buildPayload();
    const { node } = this._pending;
    nodePickerModal.open(node.id, (ids) => {
      document.dispatchEvent(new CustomEvent(AppEvents.COPY_TO_NODES, {
        detail: { ids, patch, nodeType: node.type },
      }));
      Modal._svc.triggerCalcRecalc();
      document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_RERENDER));
    }, node.type);
  }

  _apply() {
    if (!this._pending) return;
    const { node, initLink, setActive } = this._pending;
    INITIAL_SECTIONS.forEach(s => s.commit(this._pending, node));
    setActive(initLink, node._initialValue !== undefined && node._initialValue !== '');
    Modal._svc.triggerCalcRecalc();
    this._cancel();
  }

  _cancel() {
    this._pending = null;
    this.close();
  }
}
new InitialModal();
