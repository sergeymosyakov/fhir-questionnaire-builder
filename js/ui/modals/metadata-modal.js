// ── Questionnaire Properties (metadata) modal ─────────────────────────────────
// Edits questionnaire-level fields.
// Core fields (always visible): id, url, version, title, status, language,
//   publisher, description, name.
// Advanced (collapsible, collapsed by default): experimental, date, subjectType,
//   effectivePeriodStart, effectivePeriodEnd, approvalDate, lastReviewDate,
//   purpose, copyright.
// Contact (collapsible): Questionnaire.contact[] — editable name + telecom rows.
// Jurisdiction (collapsible): Questionnaire.jurisdiction[] — editable system/code/display codings.
// Pass-through (useContext): preserved automatically on import/export, no UI.
// Derived From (collapsible): Questionnaire.derivedFrom[] — canonical URL list.
// Codes (collapsible): Questionnaire.code[] — editable via shared renderCodesEditor.
//
// init(elements)  — wire DOM once at startup
// open()          — populate body + show


import { questMeta } from '../state.js';
import { initModal, setModalTitle, openModal, closeModal } from './modal-base.js';
import { renderMetaSections } from './metadata-sections/index.js';

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
    replaces:     [...(questMeta.replaces     || [])],
    codes: JSON.parse(JSON.stringify(questMeta._rawCode || [])),
    metaVersionId:  questMeta._metaVersionId  || '',
    metaSource:     questMeta._metaSource      || '',
    metaProfile:    [...(questMeta._rawMetaProfile  || [])],

    metaTag:        JSON.parse(JSON.stringify(questMeta._rawMetaTag      || [])),
    metaSecurity:   JSON.parse(JSON.stringify(questMeta._rawMetaSecurity || [])),
    identifiers:    JSON.parse(JSON.stringify(questMeta._rawIdentifier   || [])),
    contacts:       JSON.parse(JSON.stringify(questMeta._rawContact      || [])),
    jurisdictions:  JSON.parse(JSON.stringify(questMeta._rawJurisdiction || [])),
  };

  setModalTitle(_el.title, 'Questionnaire Properties', '');
  _el.body.innerHTML = '';
  renderMetaSections(_el.body, _pending);
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
  questMeta.replaces     = _pending.replaces.filter(u => u.trim());
  const filteredCodes = _pending.codes.filter(c => c.code.trim());
  questMeta._rawCode = filteredCodes.length ? filteredCodes : null;
  questMeta._metaVersionId   = _pending.metaVersionId.trim();
  questMeta._metaSource      = _pending.metaSource.trim();
  questMeta._rawMetaProfile  = _pending.metaProfile.filter(u => u.trim());
  questMeta._rawMetaTag      = _pending.metaTag.filter(c => c.code?.trim());
  questMeta._rawMetaSecurity = _pending.metaSecurity.filter(c => c.code?.trim());
  questMeta._rawIdentifier   = _pending.identifiers.filter(i => i.system?.trim() || i.value?.trim());
  const filteredContacts = _pending.contacts.filter(c => c.name?.trim() || c.telecom?.some(t => t.value?.trim()));
  questMeta._rawContact = filteredContacts.length ? filteredContacts : null;
  const filteredJur = _pending.jurisdictions.filter(jur => jur.coding?.[0]?.code?.trim());
  questMeta._rawJurisdiction = filteredJur.length ? filteredJur : null;
  _close();
}

function _cancel() { _close(); }

function _close() {
  _pending = null;
  closeModal(_el.modal);
}
