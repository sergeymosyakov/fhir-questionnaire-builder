// ── QR Export modal ───────────────────────────────────────────────────────────
// Shown before downloading a QuestionnaireResponse.
import { Modal } from './modal-base.js';
import { exportQR } from '../../fhir/qr-export.js';
import { createCustomSelect } from '../custom-select.js';

import { AppEvents } from '../../events.js';

const QR_STATUSES = ['in-progress', 'completed', 'amended', 'entered-in-error', 'stopped'];

// QR pre-fill state — owned here, not in state.js.
const _qrMeta = { status: 'in-progress', subject: '', author: '' };
document.addEventListener(AppEvents.QUESTIONNAIRE_LOADED, () => {
  _qrMeta.status  = 'in-progress';
  _qrMeta.subject = '';
  _qrMeta.author  = '';
});
document.addEventListener(AppEvents.QR_LOADED, e => {
  _qrMeta.status  = e.detail.status  || 'in-progress';
  _qrMeta.subject = e.detail.subject || '';
  _qrMeta.author  = e.detail.author  || '';
});

class QrExportModal extends Modal {
  getName() { return 'qrExportModal'; }
  constructor() {
    super();
    this._state = null;
  }

  open(suggestedName) {
    this._state = {
      fileName: suggestedName || 'questionnaire-response.json',
      status:   _qrMeta.status,
      subject:  _qrMeta.subject,
      author:   _qrMeta.author,
    };
    this._renderBody();
    super.open();
  }

  _apply() {
    const base = (this._state.fileName || 'questionnaire-response').replace(/\.json$/i, '');
    exportQR(base + '.json', {
      status:  this._state.status  || 'in-progress',
      subject: this._state.subject,
      author:  this._state.author,
    });
    this.close();
  }

  _cancel() {
    this.close();
  }

  _renderBody() {
    this.body.innerHTML = '';
    const s = this._state;

    const nameInp = document.createElement('input');
    nameInp.type  = 'text';
    nameInp.id    = 'qrExportFileName';
    nameInp.className   = 'meta-modal-inp';
    nameInp.value       = s.fileName;
    nameInp.dataset.testid = 'qr-export-filename';
    nameInp.oninput = () => { s.fileName = nameInp.value; };
    this.body.appendChild(_fieldRow('File name:', nameInp));

    const statusSel = createCustomSelect({
      items:     QR_STATUSES.map(v => ({ value: v, label: v })),
      value:     s.status,
      testid:    'qr-export-status',
      className: 'sc-trigger--sm',
      onChange:  v => { s.status = v; },
    });
    this.body.appendChild(_fieldRow('Status:', statusSel.el));

    const subjectInp = document.createElement('input');
    subjectInp.type  = 'text';
    subjectInp.id    = 'qrExportSubject';
    subjectInp.className   = 'meta-modal-inp';
    subjectInp.placeholder = 'Patient/123';
    subjectInp.value       = s.subject;
    subjectInp.dataset.testid = 'qr-export-subject';
    subjectInp.oninput = () => { s.subject = subjectInp.value; };
    this.body.appendChild(_fieldRow('Subject:', subjectInp));

    const authorInp = document.createElement('input');
    authorInp.type  = 'text';
    authorInp.id    = 'qrExportAuthor';
    authorInp.className   = 'meta-modal-inp';
    authorInp.placeholder = 'Practitioner/456';
    authorInp.value       = s.author;
    authorInp.dataset.testid = 'qr-export-author';
    authorInp.oninput = () => { s.author = authorInp.value; };
    this.body.appendChild(_fieldRow('Author:', authorInp));
  }
}

function _fieldRow(labelText, inputEl) {
  const row = document.createElement('div');
  row.className = 'meta-modal-row';
  const lbl = document.createElement('label');
  lbl.className   = 'meta-modal-lbl';
  lbl.textContent = labelText;
  lbl.htmlFor     = inputEl.id || '';
  row.append(lbl, inputEl);
  return row;
}

const _modal = new QrExportModal();
export const open = (suggestedName) => _modal.open(suggestedName);
