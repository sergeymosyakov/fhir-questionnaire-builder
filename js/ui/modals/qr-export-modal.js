// ── QR Export modal ────────────────────────────────────────────────────────────
// Shown before downloading a QuestionnaireResponse.
// Pre-populated via 'qr-loaded' event (preserved when a QR was loaded); editable.
// Resets via 'questionnaire-loaded' event (new questionnaire clears QR context).
//
// init(elements)      — wire DOM once at startup
// open(suggestedName) — show modal pre-filled with last loaded QR meta

import { exportQR } from '../../fhir/qr-export.js';
import { initModal, openModal, closeModal } from './modal-base.js';
import { createCustomSelect } from '../custom-select.js';

const QR_STATUSES = ['in-progress', 'completed', 'amended', 'entered-in-error', 'stopped'];

// QR pre-fill state — owned here, not in state.js.
const _qrMeta = { status: 'in-progress', subject: '', author: '' };
document.addEventListener('questionnaire-loaded', () => {
  _qrMeta.status  = 'in-progress';
  _qrMeta.subject = '';
  _qrMeta.author  = '';
});
document.addEventListener('qr-loaded', e => {
  _qrMeta.status  = e.detail.status  || 'in-progress';
  _qrMeta.subject = e.detail.subject || '';
  _qrMeta.author  = e.detail.author  || '';
});

let _state = null; // { fileName, status, subject, author }

const _el = {
  modal:     document.getElementById('qrExportModal'),
  title:     document.getElementById('qrExportModalTitle'),
  body:      document.getElementById('qrExportModalBody'),
  closeBtn:  document.getElementById('qrExportModalClose'),
  cancelBtn: document.getElementById('qrExportModalCancel'),
  applyBtn:  document.getElementById('qrExportModalApply'),
};
initModal(_el, { onApply: _export, onCancel: _cancel });

// ── module API ─────────────────────────────────────────────────────────────

export function open(suggestedName) {
  _state = {
    fileName: suggestedName || 'questionnaire-response.json',
    status:   _qrMeta.status,
    subject:  _qrMeta.subject,
    author:   _qrMeta.author,
  };
  _renderBody();
  openModal(_el.modal);
}

// ── private ───────────────────────────────────────────────────────────────────

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

function _renderBody() {
  _el.body.innerHTML = '';

  // File name
  const nameInp = document.createElement('input');
  nameInp.type  = 'text';
  nameInp.id    = 'qrExportFileName';
  nameInp.className   = 'meta-modal-inp';
  nameInp.value       = _state.fileName;
  nameInp.dataset.testid = 'qr-export-filename';
  nameInp.oninput = () => { _state.fileName = nameInp.value; };
  _el.body.appendChild(_fieldRow('File name:', nameInp));

  // Status
  const statusSel = createCustomSelect({
    items:     QR_STATUSES.map(v => ({ value: v, label: v })),
    value:     _state.status,
    testid:    'qr-export-status',
    className: 'sc-trigger--sm',
    onChange:  v => { _state.status = v; },
  });
  _el.body.appendChild(_fieldRow('Status:', statusSel.el));

  // Subject reference
  const subjectInp = document.createElement('input');
  subjectInp.type  = 'text';
  subjectInp.id    = 'qrExportSubject';
  subjectInp.className   = 'meta-modal-inp';
  subjectInp.placeholder = 'Patient/123';
  subjectInp.value       = _state.subject;
  subjectInp.dataset.testid = 'qr-export-subject';
  subjectInp.oninput = () => { _state.subject = subjectInp.value; };
  _el.body.appendChild(_fieldRow('Subject:', subjectInp));

  // Author reference
  const authorInp = document.createElement('input');
  authorInp.type  = 'text';
  authorInp.id    = 'qrExportAuthor';
  authorInp.className   = 'meta-modal-inp';
  authorInp.placeholder = 'Practitioner/456';
  authorInp.value       = _state.author;
  authorInp.dataset.testid = 'qr-export-author';
  authorInp.oninput = () => { _state.author = authorInp.value; };
  _el.body.appendChild(_fieldRow('Author:', authorInp));
}

function _export() {
  const base = (_state.fileName || 'questionnaire-response').replace(/\.json$/i, '');
  exportQR(base + '.json', {
    status:  _state.status  || 'in-progress',
    subject: _state.subject,
    author:  _state.author,
  });
  closeModal(_el.modal);
}

function _cancel() {
  closeModal(_el.modal);
}
