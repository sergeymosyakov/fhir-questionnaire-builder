// ── Clear Questionnaire confirm dialog ────────────────────────────────────────
// 3-button confirm: Export first | Clear anyway | Cancel
// open() returns Promise<'export'|'clear'|'cancel'>
import { Modal } from './modal-base.js';

class ClearConfirmModal extends Modal {
  getName() { return 'clearConfirmModal'; }

  constructor() {
    super({ applyLabel: null, cancelLabel: null });
    this.backdrop.classList.add('clear-confirm-backdrop');

    this.title.textContent = 'Clear questionnaire?';

    const msg = document.createElement('p');
    msg.className = 'modal-confirm-msg';
    msg.textContent = 'You have unsaved changes. Do you want to export before clearing?';
    this.body.appendChild(msg);

    const exportBtn = this._makeBtn('⬇ Export first', 'modal-btn modal-btn--apply', 'clear-confirm-export-btn');
    const clearBtn  = this._makeBtn('Clear anyway',    'modal-btn',                  'clear-confirm-clear-btn');
    const cancelBtn = this._makeBtn('Cancel',          'modal-btn modal-btn--cancel', 'clear-confirm-cancel-btn');
    this.footer.append(exportBtn, clearBtn, cancelBtn);

    exportBtn.addEventListener('click', () => this._done('export'));
    clearBtn.addEventListener ('click', () => this._done('clear'));
    cancelBtn.addEventListener('click', () => this._done('cancel'));
  }

  _makeBtn(text, className, testid) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = className;
    btn.dataset.testid = testid;
    btn.textContent = text;
    return btn;
  }

  /** @returns {Promise<'export'|'clear'|'cancel'>} */
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

  _apply()  { /* unused — no standard apply button */ }
  _cancel() { this._done('cancel'); }
}

export const clearConfirmModal = new ClearConfirmModal();
