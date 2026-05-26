// ── Design Note modal ─────────────────────────────────────────────────────────
// Centered modal for editing node._designNote (FHIR designNote extension).
import { MODAL_REGISTRY } from './modal-registry.js';
import { Modal } from './modal-base.js';

class NoteModal extends Modal {
  getName() { return 'designNoteModal'; }
  constructor() {
    super();
    this._pending = null;
    MODAL_REGISTRY.set('note', this);
  }

  open(node, noteLink, setActive) {
    this._pending = { node, noteLink, setActive, draftNote: node._designNote || '' };
    this.setTitle('Design Note', node.title || node.id || 'Item');
    this.body.innerHTML = '';
    this._renderBody();
    super.open();
    this.body.querySelector('textarea')?.focus();
  }

  _apply() {
    if (!this._pending) return;
    const { node, noteLink, setActive } = this._pending;
    const v = this._pending.draftNote.trim();
    if (v) node._designNote = v;
    else   delete node._designNote;
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
