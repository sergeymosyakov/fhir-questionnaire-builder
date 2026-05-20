// ── Questionnaire Properties (metadata) modal ─────────────────────────────────
// Edits questionnaire-level fields: id, url, version, title, status, publisher,
// description. Changes committed on Apply; Cancel discards. Uses draft pattern.
//
// init(elements)  — wire DOM once at startup
// open()          — populate body + show

import { questMeta } from '../state.js';
import { initModal, setModalTitle, openModal, closeModal } from './modal-base.js';

const STATUSES = ['draft', 'active', 'retired', 'unknown'];

let _el      = null;
let _pending = null;

// ── module API ────────────────────────────────────────────────────────────────

export function init(elements) {
  _el = elements;
  initModal(elements, { onApply: _apply, onCancel: _cancel });
}

export function open() {
  _pending = {
    id:          questMeta.id,
    url:         questMeta.url,
    version:     questMeta.version,
    title:       questMeta.title,
    status:      questMeta.status || 'draft',
    publisher:   questMeta.publisher,
    description: questMeta.description,
  };

  setModalTitle(_el.title, 'Questionnaire Properties', '');
  _el.body.innerHTML = '';
  _renderBody(_el.body);
  openModal(_el.modal);
}

// ── internals ─────────────────────────────────────────────────────────────────

function _apply() {
  if (!_pending) return;
  questMeta.id          = _pending.id.trim();
  questMeta.url         = _pending.url.trim();
  questMeta.version     = _pending.version.trim();
  questMeta.title       = _pending.title.trim();
  questMeta.status      = _pending.status;
  questMeta.publisher   = _pending.publisher.trim();
  questMeta.description = _pending.description.trim();
  _close();
}

function _cancel() { _close(); }

function _close() {
  _pending = null;
  closeModal(_el.modal);
}

// ── body renderer ─────────────────────────────────────────────────────────────

function _renderBody(container) {
  const hint = document.createElement('div');
  hint.className   = 'panel-hint';
  hint.textContent = 'Questionnaire-level metadata. These fields are preserved on import and written back on export.';
  container.appendChild(hint);

  const fields = [
    { key: 'id',          label: 'ID',          type: 'text',     placeholder: 'e.g. my-questionnaire',     testid: 'meta-id'          },
    { key: 'url',         label: 'URL',          type: 'text',     placeholder: 'http://example.org/fhir/…', testid: 'meta-url'         },
    { key: 'version',     label: 'Version',      type: 'text',     placeholder: 'e.g. 1.0.0',                testid: 'meta-version'     },
    { key: 'title',       label: 'Title',        type: 'text',     placeholder: 'e.g. PHQ-9 Depression…',    testid: 'meta-title'       },
    { key: 'publisher',   label: 'Publisher',    type: 'text',     placeholder: 'e.g. HL7 International',    testid: 'meta-publisher'   },
    { key: 'description', label: 'Description',  type: 'textarea', placeholder: 'Optional description…',     testid: 'meta-description' },
  ];

  for (const f of fields) {
    const row = document.createElement('div');
    row.className = 'meta-modal-row';

    const lbl = document.createElement('label');
    lbl.className   = 'meta-modal-lbl';
    lbl.textContent = f.label + ':';

    let inp;
    if (f.type === 'textarea') {
      inp = document.createElement('textarea');
      inp.className = 'meta-modal-textarea';
      inp.rows = 3;
    } else {
      inp = document.createElement('input');
      inp.type      = 'text';
      inp.className = 'meta-modal-inp';
    }
    inp.value            = _pending[f.key] || '';
    inp.placeholder      = f.placeholder;
    inp.dataset.testid   = f.testid;
    inp.oninput = () => { _pending[f.key] = inp.value; };

    row.append(lbl, inp);
    container.appendChild(row);
  }

  // Status dropdown
  const statusRow = document.createElement('div');
  statusRow.className = 'meta-modal-row';
  const statusLbl = document.createElement('label');
  statusLbl.className   = 'meta-modal-lbl';
  statusLbl.textContent = 'Status:';

  const statusSel = document.createElement('select');
  statusSel.className       = 'meta-modal-sel';
  statusSel.dataset.testid  = 'meta-status';
  for (const s of STATUSES) {
    const opt = document.createElement('option');
    opt.value = s; opt.textContent = s;
    if (s === _pending.status) opt.selected = true;
    statusSel.appendChild(opt);
  }
  statusSel.onchange = () => { _pending.status = statusSel.value; };

  statusRow.append(statusLbl, statusSel);
  // Insert status row after title (index 3 → after id, url, version, title = 4 rows + hint = 5 nodes)
  container.insertBefore(statusRow, container.children[5]);
}
