// ── Clear Questionnaire confirm dialog ────────────────────────────────────────
// 3-button confirm: Export first | Clear anyway | Cancel
// open() returns Promise<'export'|'clear'|'cancel'>
import { ChoiceModal } from './choice-modal.js';
import { AppEvents } from '../../events.js';

class ClearConfirmModal extends ChoiceModal {
  getName() { return 'clearConfirmModal'; }

  constructor() {
    super();
    this.backdrop.classList.add('clear-confirm-backdrop');
    this.title.textContent = 'Clear questionnaire?';

    const msg = document.createElement('p');
    msg.className = 'modal-confirm-msg';
    msg.textContent = 'You have unsaved changes. Do you want to export before clearing?';
    this.body.appendChild(msg);

    this.addChoice('⬇ Export first', 'modal-btn modal-btn--apply',  'clear-confirm-export-btn', 'export');
    this.addChoice('Clear anyway',   'modal-btn',                   'clear-confirm-clear-btn',  'clear');
    this.addChoice('Cancel',         'modal-btn modal-btn--cancel', 'clear-confirm-cancel-btn', 'cancel');
  }
}

export const clearConfirmModal = new ClearConfirmModal();

// Self-wire: open when QuestionnaireLoader requests confirmation
if (typeof document !== 'undefined') {
  document.addEventListener(AppEvents.CLEAR_CONFIRM_REQUESTED, async e => {
    const choice = await clearConfirmModal.open();
    e.detail?.resolve(choice);
  });
}
