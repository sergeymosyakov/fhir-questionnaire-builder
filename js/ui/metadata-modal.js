// ── Questionnaire Properties (metadata) modal ─────────────────────────────────
// Edits questionnaire-level fields.
// Core fields (always visible): id, url, version, title, status, language,
//   publisher, description, name.
// Advanced (collapsible, collapsed by default): experimental, date, subjectType,
//   effectivePeriodStart, effectivePeriodEnd, approvalDate, lastReviewDate,
//   purpose, copyright.
// Pass-through fields (contact, useContext, jurisdiction) have no
//   editing UI — they are preserved automatically on import/export.
// Derived From (collapsible): Questionnaire.derivedFrom[] — canonical URL list.
// Codes (collapsible): Questionnaire.code[] — editable via shared renderCodesEditor.
//
// init(elements)  — wire DOM once at startup
// open()          — populate body + show

import { questMeta } from '../state.js';
import { initModal, setModalTitle, openModal, closeModal } from './modal-base.js';
import { renderCodesEditor } from './codes-modal.js';

const STATUSES = ['draft', 'active', 'retired', 'unknown'];

const LANGUAGES = [
  { value: '',      label: '(not set)' },
  { value: 'en',    label: 'en \u2014 English' },
  { value: 'en-US', label: 'en-US \u2014 English (US)' },
  { value: 'en-GB', label: 'en-GB \u2014 English (UK)' },
  { value: 'de',    label: 'de \u2014 German' },
  { value: 'de-DE', label: 'de-DE \u2014 German (Germany)' },
  { value: 'de-AT', label: 'de-AT \u2014 German (Austria)' },
  { value: 'de-CH', label: 'de-CH \u2014 German (Switzerland)' },
  { value: 'fr',    label: 'fr \u2014 French' },
  { value: 'fr-FR', label: 'fr-FR \u2014 French (France)' },
  { value: 'fr-BE', label: 'fr-BE \u2014 French (Belgium)' },
  { value: 'fr-CH', label: 'fr-CH \u2014 French (Switzerland)' },
  { value: 'nl',    label: 'nl \u2014 Dutch' },
  { value: 'nl-NL', label: 'nl-NL \u2014 Dutch (Netherlands)' },
  { value: 'nl-BE', label: 'nl-BE \u2014 Dutch (Belgium)' },
  { value: 'es',    label: 'es \u2014 Spanish' },
  { value: 'es-ES', label: 'es-ES \u2014 Spanish (Spain)' },
  { value: 'pt',    label: 'pt \u2014 Portuguese' },
  { value: 'pt-BR', label: 'pt-BR \u2014 Portuguese (Brazil)' },
  { value: 'it',    label: 'it \u2014 Italian' },
  { value: 'pl',    label: 'pl \u2014 Polish' },
  { value: 'sv',    label: 'sv \u2014 Swedish' },
  { value: 'da',    label: 'da \u2014 Danish' },
  { value: 'nb',    label: 'nb \u2014 Norwegian Bokm\u00e5l' },
  { value: 'fi',    label: 'fi \u2014 Finnish' },
  { value: 'ja',    label: 'ja \u2014 Japanese' },
  { value: 'zh',    label: 'zh \u2014 Chinese' },
  { value: 'ar',    label: 'ar \u2014 Arabic' },
  { value: 'ru',    label: 'ru \u2014 Russian' },
  { value: 'uk',    label: 'uk \u2014 Ukrainian' },
];

const EXPERIMENTALS = [
  { value: '',      label: '(not set)' },
  { value: 'true',  label: 'Yes \u2014 experimental / for testing only' },
  { value: 'false', label: 'No \u2014 production ready' },
];

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
    experimental: questMeta.experimental === null ? '' : String(questMeta.experimental),
    language:     questMeta.language || '',
    derivedFrom:  [...(questMeta.derivedFrom || [])],
    codes: JSON.parse(JSON.stringify(questMeta._rawCode || [])),
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
  questMeta.experimental = _pending.experimental === '' ? null : _pending.experimental === 'true';
  questMeta.language     = _pending.language;
  questMeta.derivedFrom  = _pending.derivedFrom.filter(u => u.trim());
  const filteredCodes = _pending.codes.filter(c => c.code.trim());
  questMeta._rawCode = filteredCodes.length ? filteredCodes : null;
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

function _makeSelectRow(key, label, options, testid) {
  const row = document.createElement('div');
  row.className = 'meta-modal-row';
  const lbl = document.createElement('label');
  lbl.className   = 'meta-modal-lbl';
  lbl.textContent = label + ':';
  const sel = document.createElement('select');
  sel.className      = 'meta-modal-sel';
  sel.dataset.testid = testid;
  const currentVal   = String(_pending[key] ?? '');
  // If imported value isn't in the predefined list, add it as a custom option at top
  if (currentVal && !options.find(o => o.value === currentVal)) {
    const opt = document.createElement('option');
    opt.value = currentVal; opt.textContent = currentVal + ' (imported)';
    opt.selected = true;
    sel.appendChild(opt);
  }
  for (const o of options) {
    const opt = document.createElement('option');
    opt.value = o.value; opt.textContent = o.label;
    if (o.value === currentVal) opt.selected = true;
    sel.appendChild(opt);
  }
  sel.onchange = () => { _pending[key] = sel.value; };
  row.append(lbl, sel);
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

  // Language dropdown (after Status)
  container.insertBefore(
    _makeSelectRow('language', 'Language', LANGUAGES, 'meta-language'),
    container.children[7]
  );

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
  body.appendChild(_makeSelectRow('experimental', 'Experimental', EXPERIMENTALS, 'meta-experimental'));
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

  // ── Derived From (collapsible) ────────────────────────────────────────────
  const derivedSection = document.createElement('div');
  derivedSection.className = 'meta-modal-advanced';

  const derivedToggle = document.createElement('button');
  derivedToggle.type      = 'button';
  derivedToggle.className = 'meta-modal-adv-toggle';
  derivedToggle.dataset.testid = 'meta-derived-toggle';
  let derivedOpen = _pending.derivedFrom.length > 0;

  const derivedBody = document.createElement('div');
  derivedBody.className = 'meta-modal-adv-body';
  derivedBody.style.display = derivedOpen ? '' : 'none';

  const _setDerivedLabel = () => {
    const count = _pending.derivedFrom.filter(u => u.trim()).length;
    const badge = count ? ` (${count})` : '';
    derivedToggle.textContent = (derivedOpen ? '\u25BC' : '\u25BA') + ' Derived From' + badge;
  };

  const _renderDerived = () => {
    derivedBody.innerHTML = '';
    if (_pending.derivedFrom.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'codes-empty-msg';
      empty.textContent = 'No derived-from URLs. Click \u2018+ Add URL\u2019 to add one.';
      derivedBody.appendChild(empty);
    }
    _pending.derivedFrom.forEach((url, idx) => {
      const row = document.createElement('div');
      row.className = 'codes-row';
      const inp = document.createElement('input');
      inp.type = 'url';
      inp.className = 'codes-inp';
      inp.value = url;
      inp.placeholder = 'http://example.org/fhir/Questionnaire/base|1.0';
      inp.dataset.testid = `meta-derived-url-${idx}`;
      inp.oninput = () => { _pending.derivedFrom[idx] = inp.value; _setDerivedLabel(); };
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'codes-remove-btn';
      removeBtn.textContent = '\u00D7';
      removeBtn.dataset.testid = `meta-derived-remove-${idx}`;
      removeBtn.onclick = () => { _pending.derivedFrom.splice(idx, 1); _renderDerived(); _setDerivedLabel(); };
      row.append(inp, removeBtn);
      derivedBody.appendChild(row);
    });
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'codes-add-btn';
    addBtn.textContent = '+ Add URL';
    addBtn.dataset.testid = 'meta-derived-add-btn';
    addBtn.onclick = () => {
      _pending.derivedFrom.push('');
      derivedOpen = true;
      derivedBody.style.display = '';
      _renderDerived();
      _setDerivedLabel();
    };
    derivedBody.appendChild(addBtn);
  };
  _renderDerived();
  _setDerivedLabel();

  derivedToggle.addEventListener('click', () => {
    derivedOpen = !derivedOpen;
    derivedBody.style.display = derivedOpen ? '' : 'none';
    _setDerivedLabel();
  });

  derivedSection.append(derivedToggle, derivedBody);
  container.appendChild(derivedSection);

  // ── Codes (collapsible) ──────────────────────────────────────────────────
  const codesSection = document.createElement('div');
  codesSection.className = 'meta-modal-advanced';

  const codesToggle = document.createElement('button');
  codesToggle.type      = 'button';
  codesToggle.className = 'meta-modal-adv-toggle';
  codesToggle.dataset.testid = 'meta-codes-toggle';
  let codesOpen = false;

  const codesBody = document.createElement('div');
  codesBody.className = 'meta-modal-adv-body';
  codesBody.style.display = 'none';
  renderCodesEditor(_pending.codes, codesBody, 'meta-code');

  const _setCodesLabel = () => {
    const count = _pending.codes.filter(c => c.code.trim()).length;
    const badge = count ? ` (${count})` : '';
    codesToggle.textContent = (codesOpen ? '\u25BC' : '\u25BA') + ' Codes' + badge;
  };
  _setCodesLabel();
  codesToggle.addEventListener('click', () => {
    codesOpen = !codesOpen;
    codesBody.style.display = codesOpen ? '' : 'none';
    _setCodesLabel();
  });

  // Refresh badge after any add/remove inside the editor
  const _refreshBadge = () => _setCodesLabel();
  codesBody.addEventListener('input', _refreshBadge);
  codesBody.addEventListener('click', () => setTimeout(_refreshBadge, 0));

  codesSection.append(codesToggle, codesBody);
  container.appendChild(codesSection);
}
