// ── States modal (Required / Read-only / Hidden / Collapsible) ───────────────
import { MODAL_REGISTRY } from './modal-registry.js';
import { Modal } from './modal-base.js';
import { STATES_SECTIONS, renderStatesSections } from './states-sections/index.js';
import { nodePickerModal } from './node-picker-modal.js';
import { AppEvents, EventState } from '../../events.js';

class StatesModal extends Modal {
  getName() { return 'statesModal'; }
  constructor() {
    super({ maxWidth: '380px' });
    this._pending = null;
    MODAL_REGISTRY.set('states', this);

    this._copyToBtn = document.createElement('button');
    this._copyToBtn.type = 'button';
    this._copyToBtn.className = 'modal-btn modal-btn--copy-to';
    this._copyToBtn.textContent = 'Copy to\u2026';
    this._copyToBtn.dataset.testid = 'states-copy-to-btn';
    this._copyToBtn.addEventListener('click', () => this._openCopyTo());
    this.footer.insertBefore(this._copyToBtn, this.footer.firstChild);
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

  _openCopyTo() {
    if (!this._pending) return;
    const patch = this._buildPayload();
    const { node } = this._pending;
    nodePickerModal.open(node.id, (ids) => {
      document.dispatchEvent(new CustomEvent(AppEvents.COPY_TO_NODES, {
        detail: { ids, patch, nodeType: node.type },
      }));
      document.dispatchEvent(new CustomEvent(AppEvents.CALC_RECALC_REQUESTED));
      document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_RERENDER));
    }, node.type, EventState.get(AppEvents.APP_CONTEXT_READY)?.questDoc?.tree ?? []);
  }

  _apply() {
    if (!this._pending) return;
    const { node, statesLink, setActive } = this._pending;
    node.applyPatch(this._buildPayload());
    const anyActive = node.mandatory === true || !!node._readOnly || !!node._hidden || node._observationExtract != null || !!node._collapsible || !!node._usageMode || !!node._signatureRequired?.length || !!node._isSubject;
    setActive(statesLink, anyActive);
    document.dispatchEvent(new CustomEvent(AppEvents.CALC_RECALC_REQUESTED));
    this._cancel();
  }

  _cancel() {
    this._pending = null;
    this.close();
  }
}
export const statesModal = typeof document !== 'undefined' ? new StatesModal() : null;
