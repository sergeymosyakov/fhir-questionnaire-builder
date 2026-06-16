// ── QuestDocument — single loaded FHIR Questionnaire document ────────────────
// Encapsulates tree nodes, raw FHIR JSON, questionnaire-level metadata,
// contained resources, and SDC variables into one coherent object.
//
// The singleton `questDoc` is the single source of truth for the current
// document. Import it wherever document state is needed.
import { destroyTree } from '../utils.js';

export class QuestDocument {
  /** @type {import('../nodes/base-node.js').BaseNode[]} Root-level tree nodes. */
  tree      = [];
  /** @type {object|null} Raw imported FHIR Questionnaire JSON; null if not loaded. */
  rawFhir   = null;
  /** @type {object[]} Questionnaire.contained[] — preserved for round-trip. */
  contained = [];
  /** @type {{name:string, expression:string}[]} SDC questionnaire-level variables. */
  variables = [];

  /**
   * Questionnaire-level metadata — populated on import, edited via Properties modal.
   * Mirrors all fields from the old questMeta object in state.js.
   */
  meta = {
    // Core (always visible in Properties modal)
    id:            '',
    url:           '',
    version:       '',
    title:         '',
    status:        'draft',
    publisher:     '',
    description:   '',
    name:          '',
    // Advanced (collapsible section in Properties modal)
    date:          '',
    subjectType:   [],
    purpose:       '',
    copyright:     '',
    approvalDate:  '',
    lastReviewDate: '',
    effectivePeriodStart: '',
    effectivePeriodEnd:   '',
    experimental:    null,
    language:        '',
    derivedFrom:     [],
    replaces:        [],
    // Business identifiers
    _rawIdentifier:   [],
    // FHIR root fields — pass-through or limited edit
    _rawText:         null,
    _rawContact:      null,
    _rawUseContext:   null,
    _rawJurisdiction: null,
    _rawCode:         null,
    // meta.*
    _metaVersionId:   '',
    _metaSource:      '',
    _metaLastUpdated: '',
    _rawMetaProfile:  [],
    _rawMetaTag:      [],
    _rawMetaSecurity: [],
    // Extensions
    _rawQuestExtensions: [],
    preferredTermServer: '',
    _signatureRequired:  [],
    _implicitRules:      '',
    // Target FHIR version — drives UI gates and export meta.fhirVersion
    fhirTarget: 'R4',
  };

  /** Convenience getter — same as meta.fhirTarget. */
  get fhirTarget() { return this.meta.fhirTarget; }

  /** Returns contained[] entries that are ValueSet resources. */
  get containedValueSets() {
    return this.contained.filter(r => r.resourceType === 'ValueSet');
  }

  /**
   * Reset to empty state — in-place mutation so all external array references
   * (tree, contained, variables) remain valid.
   * Replaces the old resetQuestMeta() + destroyTree(tree) + array splices pattern.
   */
  reset() {
    destroyTree(this.tree);
    this.rawFhir = null;
    this.contained.splice(0);
    this.variables.splice(0);
    Object.assign(this.meta, {
      id: '', url: '', version: '', title: '', status: 'draft',
      publisher: '', description: '', name: '',
      date: '', subjectType: [],
      purpose: '', copyright: '', approvalDate: '', lastReviewDate: '',
      effectivePeriodStart: '', effectivePeriodEnd: '',
      experimental: null, language: '', derivedFrom: [], replaces: [],
      _rawIdentifier: [], _rawText: null, _rawContact: null,
      _rawUseContext: null, _rawJurisdiction: null, _rawCode: null,
      _metaVersionId: '', _metaSource: '', _metaLastUpdated: '',
      _rawMetaProfile: [], _rawMetaTag: [], _rawMetaSecurity: [],
      _rawQuestExtensions: [],
      preferredTermServer: '', _signatureRequired: [], _implicitRules: '',
      fhirTarget: 'R4',
    });
  }
}

/** Singleton — the currently loaded (or empty) questionnaire document. */
export const questDoc = new QuestDocument();
