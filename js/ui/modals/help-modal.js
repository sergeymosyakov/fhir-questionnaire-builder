// ── Help modal — iframe wrapper for help.html ─────────────────────────────────
import { Modal } from './modal-base.js';

class HelpModal extends Modal {
  getName() { return 'helpModal'; }

  constructor() {
    super({ applyLabel: null, cancelLabel: 'Close', bodyClass: 'help-modal-body' });
    this.setTitle('FHIR Field Reference');

    const iframe = document.createElement('iframe');
    iframe.src = 'help.html';
    iframe.className = 'help-iframe';
    iframe.title = 'FHIR Field Reference — where to find each FHIR field in the builder UI';
    this.body.appendChild(iframe);
  }
}

const _modal = new HelpModal();
export function open() { _modal.open(); }

// Self-wire: click on [data-mount="help-btn"] opens the modal
if (typeof document !== 'undefined') {
  document.addEventListener('click', e => {
    if (e.target.closest('[data-mount="help-btn"]')) _modal.open();
  });
}
