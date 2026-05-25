// ── QR Export modal ────────────────────────────────────────────────────────────
// Shown before downloading a QuestionnaireResponse.
// Pre-populated from qrMeta (preserved when a QR was loaded); editable.
//
// init(elements)             — wire DOM once at startup
// open(suggestedName, meta)  — show modal; meta = { status, subject, author }

import { exportQR } from '../fhir/qr-export.js';
import { initModal, openModal, closeModal } from './modal-base.js';
import { createCustomSelect } from './custom-select.js';

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
