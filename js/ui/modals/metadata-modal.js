// ── Questionnaire Properties (metadata) modal ────────────────────────────────
import { Modal } from './modal-base.js';
import { renderMetaSections } from './metadata-sections/index.js';import { AppEvents } from '../../events.js';
class MetadataModal extends Modal {
  getName() { return 'metadataModal'; }
  constructor() {
    super();
    this._pending = null;
  }

  open() {
    const questMeta = Modal._svc.questMeta;
    this._pending = {
      id:            questMeta.id,
      url:           questMeta.url,
      version:       questMeta.version,
      title:         questMeta.title,
      status:        questMeta.status || 'draft',
      publisher:     questMeta.publisher,
      description:   questMeta.description,
      name:          questMeta.name,
      date:          questMeta.date,
      subjectType:   [...(questMeta.subjectType || [])],
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
      implicitRules:  questMeta._implicitRules   || '',
      metaProfile:    [...(questMeta._rawMetaProfile  || [])],
      metaTag:        JSON.parse(JSON.stringify(questMeta._rawMetaTag      || [])),
      metaSecurity:   JSON.parse(JSON.stringify(questMeta._rawMetaSecurity || [])),
      identifiers:    JSON.parse(JSON.stringify(questMeta._rawIdentifier   || [])),
      contacts:       JSON.parse(JSON.stringify(questMeta._rawContact      || [])),
      jurisdictions:  JSON.parse(JSON.stringify(questMeta._rawJurisdiction || [])),
      preferredTermServer: questMeta.preferredTermServer || '',
    };
    this.setTitle('Questionnaire Properties', '');
    this.body.innerHTML = '';
    renderMetaSections(this.body, this._pending);
    super.open();
  }

  _apply() {
    if (!this._pending) return;
    const p = this._pending;
    const questMeta = Modal._svc.questMeta;
    questMeta.id            = p.id.trim();
    questMeta.url           = p.url.trim();
    questMeta.version       = p.version.trim();
    questMeta.title         = p.title.trim();
    questMeta.status        = p.status;
    questMeta.publisher     = p.publisher.trim();
    questMeta.description   = p.description.trim();
    questMeta.name          = p.name.trim();
    questMeta.date          = p.date.trim();
    questMeta.subjectType   = p.subjectType.filter(t => t.trim());
    questMeta.purpose       = p.purpose.trim();
    questMeta.copyright     = p.copyright.trim();
    questMeta.approvalDate  = p.approvalDate.trim();
    questMeta.lastReviewDate = p.lastReviewDate.trim();
    questMeta.effectivePeriodStart = p.effectivePeriodStart.trim();
    questMeta.effectivePeriodEnd   = p.effectivePeriodEnd.trim();
    questMeta.experimental = p.experimental === '' ? null : p.experimental === 'true';
    questMeta.language     = p.language;
    questMeta.derivedFrom  = p.derivedFrom.filter(u => u.trim());
    questMeta.replaces     = p.replaces.filter(u => u.trim());
    const filteredCodes = p.codes.filter(c => c.code.trim());
    questMeta._rawCode = filteredCodes.length ? filteredCodes : null;
    questMeta._metaVersionId   = p.metaVersionId.trim();
    questMeta._metaSource      = p.metaSource.trim();
    questMeta._implicitRules   = p.implicitRules.trim();
    questMeta._rawMetaProfile  = p.metaProfile.filter(u => u.trim());
    questMeta._rawMetaTag      = p.metaTag.filter(c => c.code?.trim());
    questMeta._rawMetaSecurity = p.metaSecurity.filter(c => c.code?.trim());
    questMeta._rawIdentifier   = p.identifiers.filter(i => i.system?.trim() || i.value?.trim());
    const filteredContacts = p.contacts.filter(c => c.name?.trim() || c.telecom?.some(t => t.value?.trim()));
    questMeta._rawContact = filteredContacts.length ? filteredContacts : null;
    const filteredJur = p.jurisdictions.filter(jur => jur.coding?.[0]?.code?.trim());
    questMeta._rawJurisdiction = filteredJur.length ? filteredJur : null;
    questMeta.preferredTermServer = p.preferredTermServer.trim();
    this._cancel();
    document.dispatchEvent(new CustomEvent(AppEvents.QUESTIONNAIRE_META_CHANGED));
  }

  _cancel() {
    this._pending = null;
    this.close();
  }
}

const _modal = new MetadataModal();
export const open = () => _modal.open();
