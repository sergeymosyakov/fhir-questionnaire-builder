// ── Repeatable (item.repeats + cardinality) edit modal ────────────────────────
import { MODAL_REGISTRY } from './modal-registry.js';
import { Modal } from './modal-base.js';
import { REPEATABLE_SECTIONS, renderRepeatableSections } from './repeatable-sections/index.js';
import { nodePickerModal } from './node-picker-modal.js';
import { AppEvents } from '../../events.js';

class RepeatableModal extends Modal {
  getName() { return 'repeatableModal'; }
  constructor() {
    super();
    this._pending = null;
    MODAL_REGISTRY.set('repeatable', this);

    this._copyToBtn = document.createElement('button');
    this._copyToBtn.type = 'button';
    this._copyToBtn.className = 'modal-btn modal-btn--copy-to';
    this._copyToBtn.textContent = 'Copy to\u2026';
    this._copyToBtn.dataset.testid = 'repeatable-copy-to-btn';
    this._copyToBtn.addEventListener('click', () => this._openCopyTo());
    this.footer.insertBefore(this._copyToBtn, this.footer.firstChild);
  }

  open(node, repeatLink, setActive) {
    this._pending = { node, repeatLink, setActive,
      ...Object.assign({}, ...REPEATABLE_SECTIONS.map(s => s.initPending(node))) };
    this.setTitle('Repeatable', node.title || node.id || 'Item');
    renderRepeatableSections(this.body, this._pending);
    super.open();
  }

  _buildPayload() {
    const p = this._pending;
    const min = p.draftRepeats && p.draftMin !== '' ? parseInt(p.draftMin, 10) : null;
    const max = p.draftRepeats && p.draftMax !== '' ? parseInt(p.draftMax, 10) : null;
    return {
      repeats:    p.draftRepeats || null,
      _minOccurs: (min !== null && !isNaN(min)) ? min : null,
      _maxOccurs: (max !== null && !isNaN(max)) ? max : null,
    };
  }

  _openCopyTo() {
    if (!this._pending) return;
    const patch = this._buildPayload();
    const { node } = this._pending;
    nodePickerModal.open(node.id, (ids) => {
      document.dispatchEvent(new CustomEvent(AppEvents.COPY_TO_NODES, {
        detail: { ids, patch, nodeType: 'item' },
      }));
      document.dispatchEvent(new CustomEvent(AppEvents.CALC_RECALC_REQUESTED));
      document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_RERENDER));
    }, 'item');
  }

  _apply() {
    if (!this._pending) return;
    const { node, repeatLink, setActive } = this._pending;
    REPEATABLE_SECTIONS.forEach(s => s.commit(this._pending, node));
    setActive(repeatLink, !!node.repeats);
    document.dispatchEvent(new CustomEvent(AppEvents.CALC_RECALC_REQUESTED));
    this._cancel();
  }

  _cancel() {
    this._pending = null;
    this.close();
  }
}
new RepeatableModal();
