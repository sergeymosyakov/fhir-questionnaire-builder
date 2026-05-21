// ── QR Export modal ────────────────────────────────────────────────────────────
// Shown before downloading a QuestionnaireResponse.
// Pre-populated from qrMeta (preserved when a QR was loaded); editable.
//
// init(elements)             — wire DOM once at startup
// open(suggestedName, meta)  — show modal; meta = { status, subject, author }

import { exportQR } from '../fhir/qr-export.js';
import { initModal, openModal, closeModal } from './modal-base.js';

const QR_STATUSES = ['in-progress', 'completed', 'amended', 'entered-in-error', 'stopped'];

let _el    = null;
let _state = null; // { fileName, status, subject, author }

// ── module API ────────────────────────────────────────────────────────────────

export function init(elements) {
  _el = elements;
  initModal(elements, { onApply: _export, onCancel: _cancel });
}

export function open(suggestedName, meta) {
  _state = {
    fileName: suggestedName || 'questionnaire-response.json',
    status:   (meta && meta.status)  || 'in-progress',
    subject:  (meta && meta.subject) || '',
    author:   (meta && meta.author)  || '',
  };
  _renderBody();
  openModal(_el.modal);
}

// ── private ───────────────────────────────────────────────────────────────────

function _row(label, forId) {
  const lbl = document.createElement('label');
  lbl.className = 'modal-field-label';
  lbl.textContent = label;
  lbl.htmlFor = forId;
  return lbl;
}

function _renderBody() {
  _el.body.innerHTML = '';

  // File name
  _el.body.appendChild(_row('File name', 'qrExportFileName'));
  const nameInp = document.createElement('input');
  nameInp.type = 'text';
  nameInp.id = 'qrExportFileName';
  nameInp.className = 'modal-text-input';
  nameInp.value = _state.fileName;
  nameInp.dataset.testid = 'qr-export-filename';
  nameInp.oninput = () => { _state.fileName = nameInp.value; };
  _el.body.appendChild(nameInp);

  // Status
  _el.body.appendChild(_row('Status', 'qrExportStatus'));
  const statusSel = document.createElement('select');
  statusSel.id = 'qrExportStatus';
  statusSel.className = 'modal-select';
  statusSel.dataset.testid = 'qr-export-status';
  for (const v of QR_STATUSES) {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    if (v === _state.status) opt.selected = true;
    statusSel.appendChild(opt);
  }
  statusSel.onchange = () => { _state.status = statusSel.value; };
  _el.body.appendChild(statusSel);

  // Subject reference
  _el.body.appendChild(_row('Subject reference', 'qrExportSubject'));
  const subjectInp = document.createElement('input');
  subjectInp.type = 'text';
  subjectInp.id = 'qrExportSubject';
  subjectInp.className = 'modal-text-input';
  subjectInp.placeholder = 'Patient/123';
  subjectInp.value = _state.subject;
  subjectInp.dataset.testid = 'qr-export-subject';
  subjectInp.oninput = () => { _state.subject = subjectInp.value; };
  _el.body.appendChild(subjectInp);

  // Author reference
  _el.body.appendChild(_row('Author reference', 'qrExportAuthor'));
  const authorInp = document.createElement('input');
  authorInp.type = 'text';
  authorInp.id = 'qrExportAuthor';
  authorInp.className = 'modal-text-input';
  authorInp.placeholder = 'Practitioner/456';
  authorInp.value = _state.author;
  authorInp.dataset.testid = 'qr-export-author';
  authorInp.oninput = () => { _state.author = authorInp.value; };
  _el.body.appendChild(authorInp);
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
