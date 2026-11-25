// ── Generic 2-button confirm dialog ──────────────────────────────────────────
// open(config) returns Promise<'ok'|'cancel'>
import { ChoiceModal } from './choice-modal.js';

class ConfirmModal extends ChoiceModal {
  getName() { return 'confirmModal'; }

  constructor() {
    super({ applyLabel: 'OK', cancelLabel: 'Cancel' });
  }

  /**
   * @param {object} config
   * @param {string} config.title
   * @param {string} [config.msg]
   * @param {string} [config.okLabel]
   * @param {string} [config.cancelLabel]
   * @returns {Promise<'ok'|'cancel'>}
   */
  open({ title = '', msg = '', okLabel = 'OK', cancelLabel = 'Cancel' } = {}) {
    this.title.textContent = title;
    this.body.textContent  = msg;
    if (this.applyBtn)  this.applyBtn.textContent  = okLabel;
    if (this.cancelBtn) this.cancelBtn.textContent = cancelLabel;

    return super.open();
  }

  _apply()  { this._done('ok');     }
}

export const confirmModal = new ConfirmModal();
