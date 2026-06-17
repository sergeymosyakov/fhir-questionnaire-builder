// ── FHIR R4 Questionnaire import ──────────────────────────────────────────────
import { showError } from '../ui/toast.js';
import { AppEvents } from '../events.js';
import { normaliseSTU3 } from './stu3-shim.js';
import { destroyTree } from '../utils.js';
import { resetSeq } from '../id.js';

let _svc = {};
/** @param {{ questDoc?: import('./quest-document.js').QuestDocument }} svc */
export function configure(svc) { _svc = { ..._svc, ...svc }; }
if (typeof document !== 'undefined') {
  document.addEventListener(AppEvents.APP_CONTEXT_READY,
    e => { if (e.detail?.questDoc) configure({ questDoc: e.detail.questDoc }); });
}
import {
  buildLinkIdMap,
  fhirTypeToItemType,
  fhirOptsToStr,
  hasNonCodingOpts,
  humanEnableWhen,
  applyVisibility,
  resolveContainedValueSet,
} from './import-helpers.js';
import { fhirItemToNode } from './import-item.js';
import { BUILDER_VERSION_EXTENSION_URL } from './format-registry.js';

// Re-export helpers — consumed by answer-type-modal.js and unit tests.
export {
  fhirTypeToItemType,
  fhirOptsToStr,
  hasNonCodingOpts,
  humanEnableWhen,
  applyVisibility,
  resolveContainedValueSet,
};

// Walk the tree and pre-populate answers from node._initialValue / _initialValues
function applyInitialValues(nodes) {
  for (const node of nodes) {
    if (node.repeats && node._initialValues && node._initialValues.length > 1) {
      document.dispatchEvent(new CustomEvent(AppEvents.ANSWER_SET, { detail: { id: node.id, value: node._initialValues[0] } }));
      for (let i = 1; i < node._initialValues.length; i++) {
        document.dispatchEvent(new CustomEvent(AppEvents.ANSWER_SET, { detail: { id: node.id + '$$' + i, value: node._initialValues[i] } }));
      }
      document.dispatchEvent(new CustomEvent(AppEvents.ANSWER_SET, { detail: { id: node.id + '$$n', value: node._initialValues.length - 1 } }));
    } else if (node._initialValue !== undefined) {
      document.dispatchEvent(new CustomEvent(AppEvents.ANSWER_SET, { detail: { id: node.id, value: node._initialValue } }));
    }
    if (node.type === 'group') applyInitialValues(node.children);
  }
}

// Main import entry point
export function importFHIR(fhirJson) {
  const { questDoc } = _svc;
  const { tree, meta: questMeta, variables: questVariables, contained: questContained } = questDoc;
  let q = fhirJson;
  if (typeof q === 'string') {
    try { q = JSON.parse(q); } catch (e) { showError('Invalid JSON:\n' + e.message); return; }
  }
  if (!q || q.resourceType !== 'Questionnaire') {
    showError('Not a FHIR Questionnaire resource (resourceType must be "Questionnaire").');
    return;
  }
  q = normaliseSTU3(q); // no-op for R4; converts STU3 fields to R4 equivalents
  destroyTree(tree);
  document.dispatchEvent(new CustomEvent(AppEvents.ANSWERS_CLEAR));
  questDoc.rawFhir = q;
  resetSeq();

  // Populate questionnaire-level metadata
  questMeta.id          = q.id          || '';
  questMeta.url         = q.url         || '';
  questMeta.version     = q.version     || '';
  questMeta.title       = q.title       || '';
  questMeta.status      = q.status      || 'draft';
  questMeta.publisher   = q.publisher   || '';
  questMeta.description = q.description || '';
  questMeta.name        = q.name        || '';
  questMeta.date        = q.date        || '';
  questMeta.subjectType = Array.isArray(q.subjectType) && q.subjectType.length
    ? [...q.subjectType]
    : [];
  questMeta.purpose        = q.purpose        || '';
  questMeta.copyright      = q.copyright      || '';
  questMeta.approvalDate   = q.approvalDate   || '';
  questMeta.lastReviewDate = q.lastReviewDate || '';
  questMeta.effectivePeriodStart = q.effectivePeriod?.start || '';
  questMeta.effectivePeriodEnd   = q.effectivePeriod?.end   || '';
  questMeta.experimental      = q.experimental !== undefined ? q.experimental : null;
  questMeta.language          = q.language || '';
  questMeta._rawIdentifier   = Array.isArray(q.identifier)   ? JSON.parse(JSON.stringify(q.identifier)) : [];
  questMeta._rawText         = q.text && q.text.status && q.text.div ? { status: q.text.status, div: q.text.div } : null;
  questMeta._rawContact      = Array.isArray(q.contact)      ? q.contact      : null;
  questMeta._rawUseContext   = Array.isArray(q.useContext)   ? q.useContext   : null;
  questMeta._rawJurisdiction = Array.isArray(q.jurisdiction) ? q.jurisdiction : null;
  questMeta._rawCode         = Array.isArray(q.code)         ? q.code         : null;
  questMeta.derivedFrom      = Array.isArray(q.derivedFrom)  ? [...q.derivedFrom] : [];
  questMeta._metaVersionId   = q.meta?.versionId  || '';
  questMeta._metaSource      = q.meta?.source      || '';
  questMeta._metaLastUpdated = q.meta?.lastUpdated || '';
  questMeta._rawMetaProfile  = Array.isArray(q.meta?.profile)  ? [...q.meta.profile]  : [];
  questMeta._implicitRules   = q.implicitRules || '';
  questMeta._rawMetaTag      = Array.isArray(q.meta?.tag)      ? JSON.parse(JSON.stringify(q.meta.tag))      : [];
  questMeta._rawMetaSecurity = Array.isArray(q.meta?.security) ? JSON.parse(JSON.stringify(q.meta.security)) : [];

  const SDC_VAR_URL  = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-variable';
  const REPLACES_URL = 'http://hl7.org/fhir/StructureDefinition/replaces';
  questVariables.splice(0);

  questContained.splice(0);
  if (Array.isArray(q.contained)) {
    for (const r of q.contained) questContained.push(r);
  }
  questMeta.replaces = (q.extension || [])
    .filter(e => e.url === REPLACES_URL && e.valueCanonical)
    .map(e => e.valueCanonical);
  for (const ext of q.extension || []) {
    if (ext.url === SDC_VAR_URL && ext.valueExpression) {
      questVariables.push({
        name:       ext.valueExpression.name       || '',
        expression: ext.valueExpression.expression || ''
      });
    }
  }
  const PREF_TERM_URL = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-preferredTerminologyServer';
  const prefTermQuestExt = (q.extension || []).find(e => e.url === PREF_TERM_URL);
  questMeta.preferredTermServer = prefTermQuestExt?.valueUrl || '';
  const SIG_REQ_URL = 'http://hl7.org/fhir/StructureDefinition/questionnaire-signatureRequired';
  const sigReqExts = (q.extension || []).filter(e => e.url === SIG_REQ_URL);
  questMeta._signatureRequired = sigReqExts.length
    ? sigReqExts.filter(e => e.valueCodeableConcept?.coding?.[0]).map(e => {
        const c = e.valueCodeableConcept.coding[0];
        return { system: c.system || '', code: c.code || '', display: c.display || '' };
      })
    : [];
  const nonVarExts = (q.extension || []).filter(e => e.url !== SDC_VAR_URL && e.url !== REPLACES_URL && e.url !== PREF_TERM_URL && e.url !== SIG_REQ_URL && e.url !== BUILDER_VERSION_EXTENSION_URL);
  questMeta._rawQuestExtensions = nonVarExts.length ? JSON.parse(JSON.stringify(nonVarExts)) : [];

  try {
    const linkIdMap = buildLinkIdMap(q.item);
    for (const item of q.item || []) {
      const n = fhirItemToNode(item, linkIdMap, q.contained);
      if (n) tree.push(n);
    }
    applyInitialValues(tree);
  } finally {
    // tree is fully built — notify preview to reinitialise
    document.dispatchEvent(new CustomEvent(AppEvents.REINIT_FORM));
  }
  document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_RERENDER));
}
