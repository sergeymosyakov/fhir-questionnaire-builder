// ── Delete node confirm dialog ────────────────────────────────────────────────
// ask(label) returns Promise<'delete'|'cancel'>
import { ChoiceModal } from './choice-modal.js';

class DeleteConfirmModal extends ChoiceModal {
  getName() { return 'deleteConfirmModal'; }

  constructor() {
    super();
    this.title.textContent = 'Delete node?';
    this._msg = document.createElement('p');
    this._msg.className = 'modal-confirm-msg';
    this.body.appendChild(this._msg);
    this.addChoice('Delete', 'modal-btn btn-danger',        'delete-confirm-del-btn',    'delete');
    this.addChoice('Cancel', 'modal-btn modal-btn--cancel', 'delete-confirm-cancel-btn', 'cancel');
  }

  /** @param {string} label node title or linkId shown in the message */
  ask(label) {
    const strong = document.createElement('strong');
    strong.textContent = label;
    this._msg.replaceChildren(strong, ' and all its children will be permanently removed.');
    return this.open();
  }
}

export const deleteConfirmModal = typeof document !== 'undefined' ? new DeleteConfirmModal() : null;
