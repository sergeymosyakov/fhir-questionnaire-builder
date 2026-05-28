// ── Load Questionnaire confirm dialog ─────────────────────────────────────────
// 2-button confirm: Load anyway | Cancel
// open() returns Promise<'proceed'|'cancel'>
import { Modal } from './modal-base.js';

class LoadConfirmModal extends Modal {
  getName() { return 'loadConfirmModal'; }

  constructor() {
    super({ applyLabel: null, cancelLabel: null });

    this.title.textContent = 'Load new questionnaire?';

    const msg = document.createElement('p');
    msg.className = 'modal-confirm-msg';
    msg.textContent = 'This will replace the current questionnaire. The undo history will also be lost and cannot be recovered.';
    this.body.appendChild(msg);

    const proceedBtn = this._makeBtn('Load anyway', 'modal-btn modal-btn--apply', 'load-confirm-proceed-btn');
    const cancelBtn  = this._makeBtn('Cancel',      'modal-btn modal-btn--cancel', 'load-confirm-cancel-btn');
    this.footer.append(proceedBtn, cancelBtn);

    proceedBtn.addEventListener('click', () => this._done('proceed'));
    cancelBtn.addEventListener ('click', () => this._done('cancel'));
  }

  _makeBtn(text, className, testid) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = className;
    btn.dataset.testid = testid;
    btn.textContent = text;
    return btn;
  }

  /** @returns {Promise<'proceed'|'cancel'>} */
  open() {
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

  _apply()  { /* unused */ }
  _cancel() { this._done('cancel'); }
}

export const loadConfirmModal = new LoadConfirmModal();
