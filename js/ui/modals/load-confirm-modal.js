// ── Load Questionnaire confirm dialog ─────────────────────────────────────────
// 2-button confirm: Load anyway | Cancel
// open() returns Promise<'proceed'|'cancel'>
import { ChoiceModal } from './choice-modal.js';

class LoadConfirmModal extends ChoiceModal {
  getName() { return 'loadConfirmModal'; }

  constructor() {
    super();
    this.title.textContent = 'Load new questionnaire?';

    const msg = document.createElement('p');
    msg.className = 'modal-confirm-msg';
    msg.textContent = 'This will replace the current questionnaire. The undo history will also be lost and cannot be recovered.';
    this.body.appendChild(msg);

    this.addChoice('Load anyway', 'modal-btn modal-btn--apply',  'load-confirm-proceed-btn', 'proceed');
    this.addChoice('Cancel',      'modal-btn modal-btn--cancel', 'load-confirm-cancel-btn',  'cancel');
  }
}

export const loadConfirmModal = new LoadConfirmModal();
