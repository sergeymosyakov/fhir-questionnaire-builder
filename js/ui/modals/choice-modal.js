// A modal that asks one question and resolves with the id of the button pressed ('cancel' for Esc, ×, backdrop or a second request).
import { Modal } from './modal-base.js';

export class ChoiceModal extends Modal {
  constructor(options = {}) {
    super({ applyLabel: null, cancelLabel: null, ...options });
  }

  /** @param {string} text @param {string} className @param {string} testid @param {string} result id the promise resolves with */
  addChoice(text, className, testid, result) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = className;
    btn.dataset.testid = testid;
    btn.textContent = text;
    btn.addEventListener('click', () => this._done(result));
    this.footer.appendChild(btn);
    return btn;
  }

  /** Shows the modal; resolves with the chosen id. */
  open() {
    this._resolve?.('cancel'); // a second request must not leave the first waiting forever
    return new Promise(resolve => {
      this._resolve = resolve;
      super.open();
    });
  }

  _done(result) {
    const resolve = this._resolve;
    if (!resolve) return;
    this._resolve = null;
    this.close();
    resolve(result);
  }

  _apply()  { /* the buttons are the choices */ }
  _cancel() { this._done('cancel'); }
}
