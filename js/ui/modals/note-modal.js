// ── Design Note modal ─────────────────────────────────────────────────────────
// Centered modal for editing node._designNote (FHIR designNote extension).
import { MODAL_REGISTRY } from './modal-registry.js';
import { Modal } from './modal-base.js';
import { nodePickerModal } from './node-picker-modal.js';
import { AppEvents } from '../../events.js';

class NoteModal extends Modal {
  getName() { return 'designNoteModal'; }
  constructor() {
    super();
    this._pending = null;
    MODAL_REGISTRY.set('note', this);

    this._copyToBtn = document.createElement('button');
    this._copyToBtn.type = 'button';
    this._copyToBtn.className = 'modal-btn modal-btn--copy-to';
    this._copyToBtn.textContent = 'Copy to\u2026';
    this._copyToBtn.dataset.testid = 'note-copy-to-btn';
    this._copyToBtn.addEventListener('click', () => this._openCopyTo());
    this.footer.insertBefore(this._copyToBtn, this.footer.firstChild);
  }

  open(node, noteLink, setActive) {
    this._pending = { node, noteLink, setActive, draftNote: node._designNote || '' };
    this.setTitle('Design Note', node.title || node.id || 'Item');
    this.body.innerHTML = '';
    this._renderBody();
    super.open();
    this.body.querySelector('textarea')?.focus();
  }

  _buildPayload() {
    const v = this._pending.draftNote.trim();
    return { _designNote: v || null };
  }

  _openCopyTo() {
    if (!this._pending) return;
    const patch = this._buildPayload();
    const { node } = this._pending;
    // allowedType=null — design notes apply to both items and groups
    nodePickerModal.open(node.id, (ids) => {
      document.dispatchEvent(new CustomEvent(AppEvents.COPY_TO_NODES, {
        detail: { ids, patch, nodeType: null },
      }));
      document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_RERENDER));
    }, null);
  }

  _apply() {
    if (!this._pending) return;
    const { node, noteLink, setActive } = this._pending;
    const v = this._pending.draftNote.trim();
    node.applyPatch({ _designNote: v || null });
    setActive(noteLink, !!node._designNote);
    this._cancel();
  }

  _cancel() {
    this._pending = null;
    this.close();
  }

  _renderBody() {
    const hint = document.createElement('div');
    hint.className = 'panel-hint';
    hint.textContent = 'Internal note for questionnaire authors. Stored as the FHIR designNote extension — never displayed to patients.';
    this.body.appendChild(hint);

    const ta = document.createElement('textarea');
    ta.className = 'note-modal-textarea';
    ta.dataset.testid = 'design-note-input';
    ta.placeholder = 'e.g. "Discuss with clinical lead — threshold may change."';
    ta.value = this._pending.draftNote;
    ta.oninput = () => { this._pending.draftNote = ta.value; };
    this.body.appendChild(ta);
  }
}
new NoteModal();
