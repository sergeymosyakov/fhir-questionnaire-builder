// ── Questionnaire Properties (metadata) modal ─────────────────────────────────
// Edits questionnaire-level fields.
// Core fields (always visible): id, url, version, title, status, publisher,
//   description, name.
// Advanced (collapsible, collapsed by default): date, subjectType,
//   effectivePeriodStart, effectivePeriodEnd, approvalDate, lastReviewDate,
//   purpose, copyright.
// Pass-through fields (contact, useContext, jurisdiction, code[]) have no
//   editing UI — they are preserved automatically on import/export.
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
    id:            questMeta.id,
    url:           questMeta.url,
    version:       questMeta.version,
    title:         questMeta.title,
    status:        questMeta.status || 'draft',
    publisher:     questMeta.publisher,
    description:   questMeta.description,
    name:          questMeta.name,
    date:          questMeta.date,
    subjectType:   questMeta.subjectType,
    purpose:       questMeta.purpose,
    copyright:     questMeta.copyright,
    approvalDate:  questMeta.approvalDate,
    lastReviewDate: questMeta.lastReviewDate,
    effectivePeriodStart: questMeta.effectivePeriodStart,
    effectivePeriodEnd:   questMeta.effectivePeriodEnd,
  };

  setModalTitle(_el.title, 'Questionnaire Properties', '');
  _el.body.innerHTML = '';
  _renderBody(_el.body);
  openModal(_el.modal);
}

// ── internals ─────────────────────────────────────────────────────────────────

function _apply() {
  if (!_pending) return;
  questMeta.id            = _pending.id.trim();
  questMeta.url           = _pending.url.trim();
  questMeta.version       = _pending.version.trim();
  questMeta.title         = _pending.title.trim();
  questMeta.status        = _pending.status;
  questMeta.publisher     = _pending.publisher.trim();
  questMeta.description   = _pending.description.trim();
  questMeta.name          = _pending.name.trim();
  questMeta.date          = _pending.date.trim();
  questMeta.subjectType   = _pending.subjectType.trim();
  questMeta.purpose       = _pending.purpose.trim();
  questMeta.copyright     = _pending.copyright.trim();
  questMeta.approvalDate  = _pending.approvalDate.trim();
  questMeta.lastReviewDate = _pending.lastReviewDate.trim();
  questMeta.effectivePeriodStart = _pending.effectivePeriodStart.trim();
  questMeta.effectivePeriodEnd   = _pending.effectivePeriodEnd.trim();
  _close();
}

function _cancel() { _close(); }

function _close() {
  _pending = null;
  closeModal(_el.modal);
}

// ── body renderer ─────────────────────────────────────────────────────────────

function _makeRow(key, label, type, placeholder, testid) {
  const row = document.createElement('div');
  row.className = 'meta-modal-row';
  const lbl = document.createElement('label');
  lbl.className   = 'meta-modal-lbl';
  lbl.textContent = label + ':';
  let inp;
  if (type === 'textarea') {
    inp = document.createElement('textarea');
    inp.className = 'meta-modal-textarea';
    inp.rows = 3;
  } else {
    inp = document.createElement('input');
    inp.type      = type;
    inp.className = type === 'date' ? 'meta-modal-inp meta-modal-inp--date' : 'meta-modal-inp';
  }
  inp.value          = _pending[key] || '';
  inp.placeholder    = placeholder;
  inp.dataset.testid = testid;
  inp.oninput = () => { _pending[key] = inp.value; };
  row.append(lbl, inp);
  return row;
}

function _renderBody(container) {
  const hint = document.createElement('div');
  hint.className   = 'panel-hint';
  hint.textContent = 'Questionnaire-level metadata. Preserved on import and written back on export.';
  container.appendChild(hint);

  // ── Core fields ──────────────────────────────────────────────────────────
  const coreFields = [
    { key: 'id',          label: 'ID',          type: 'text',     placeholder: 'e.g. my-questionnaire',     testid: 'meta-id'          },
    { key: 'url',         label: 'URL',          type: 'text',     placeholder: 'http://example.org/fhir/…', testid: 'meta-url'         },
    { key: 'version',     label: 'Version',      type: 'text',     placeholder: 'e.g. 1.0.0',                testid: 'meta-version'     },
    { key: 'name',        label: 'Name',         type: 'text',     placeholder: 'e.g. MyQuestionnaire',      testid: 'meta-name'        },
    { key: 'title',       label: 'Title',        type: 'text',     placeholder: 'e.g. PHQ-9 Depression…',    testid: 'meta-title'       },
    { key: 'publisher',   label: 'Publisher',    type: 'text',     placeholder: 'e.g. HL7 International',    testid: 'meta-publisher'   },
    { key: 'description', label: 'Description',  type: 'textarea', placeholder: 'Optional description…',     testid: 'meta-description' },
  ];

  for (const f of coreFields) container.appendChild(_makeRow(f.key, f.label, f.type, f.placeholder, f.testid));

  // Status dropdown (after title)
  const statusRow = document.createElement('div');
  statusRow.className = 'meta-modal-row';
  const statusLbl = document.createElement('label');
  statusLbl.className   = 'meta-modal-lbl';
  statusLbl.textContent = 'Status:';
  const statusSel = document.createElement('select');
  statusSel.className      = 'meta-modal-sel';
  statusSel.dataset.testid = 'meta-status';
  for (const s of STATUSES) {
    const opt = document.createElement('option');
    opt.value = s; opt.textContent = s;
    if (s === _pending.status) opt.selected = true;
    statusSel.appendChild(opt);
  }
  statusSel.onchange = () => { _pending.status = statusSel.value; };
  statusRow.append(statusLbl, statusSel);
  // Insert after title (index 4 in fields array = 5th row node after hint)
  container.insertBefore(statusRow, container.children[6]);

  // ── Advanced (collapsible) ───────────────────────────────────────────────
  const adv = document.createElement('div');
  adv.className = 'meta-modal-advanced';

  const toggle = document.createElement('button');
  toggle.type      = 'button';
  toggle.className = 'meta-modal-adv-toggle';
  toggle.dataset.testid = 'meta-advanced-toggle';
  let open = false;

  const body = document.createElement('div');
  body.className = 'meta-modal-adv-body';
  body.style.display = 'none';

  const advFields = [
    { key: 'date',                label: 'Date',           type: 'date',     placeholder: '',                           testid: 'meta-date'                },
    { key: 'subjectType',         label: 'Subject Type',   type: 'text',     placeholder: 'e.g. Patient, Practitioner',  testid: 'meta-subject-type'        },
    { key: 'effectivePeriodStart',label: 'Effective From', type: 'date',     placeholder: '',                           testid: 'meta-effective-start'     },
    { key: 'effectivePeriodEnd',  label: 'Effective To',   type: 'date',     placeholder: '',                           testid: 'meta-effective-end'       },
    { key: 'approvalDate',        label: 'Approved',       type: 'date',     placeholder: '',                           testid: 'meta-approval-date'       },
    { key: 'lastReviewDate',      label: 'Last Review',    type: 'date',     placeholder: '',                           testid: 'meta-last-review'         },
    { key: 'purpose',             label: 'Purpose',        type: 'textarea', placeholder: 'Intended use…',              testid: 'meta-purpose'             },
    { key: 'copyright',           label: 'Copyright',      type: 'textarea', placeholder: 'Copyright statement…',       testid: 'meta-copyright'           },
  ];
  for (const f of advFields) body.appendChild(_makeRow(f.key, f.label, f.type, f.placeholder, f.testid));

  const _setToggleLabel = () => {
    toggle.textContent = (open ? '\u25BC' : '\u25BA') + ' Advanced';
  };
  _setToggleLabel();
  toggle.addEventListener('click', () => {
    open = !open;
    body.style.display = open ? '' : 'none';
    _setToggleLabel();
  });

  adv.append(toggle, body);
  container.appendChild(adv);
}
