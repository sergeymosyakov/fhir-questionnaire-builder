// ── Generic 2-button confirm dialog ──────────────────────────────────────────
// open(config) returns Promise<'ok'|'cancel'>
import { Modal } from './modal-base.js';

class ConfirmModal extends Modal {
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

    return new Promise(resolve => {
      this._resolve = resolve;
      super.open();
    });
  }

  _done(result) {
    const resolve = this._resolve;
    this._resolve = null;
    this.close();
    resolve?.(result);
  }

  _apply()  { this._done('ok');     }
  _cancel() { this._done('cancel'); }
}

export const confirmModal = new ConfirmModal();
