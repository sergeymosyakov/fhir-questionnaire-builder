// ── R5 → R4/R4B field downgrade ──────────────────────────────────────────────
// Some Questionnaire.item fields are native in R5 but do not exist in the R4/R4B
// schema (`disabledDisplay` and `answerConstraint` were both added in R5).
// Exporting them as native fields makes the document invalid against R4/R4B.
// The official HL7 cross-version extension URLs are rejected by some validators
// (public HAPI cannot resolve them), so we move these fields into builder-private
// extensions instead — the document stays valid (validators emit at most an
// "unknown extension" warning) and our importer reads them back for a loss-less
// downgrade round-trip.

import {
  ITEM_ANSWER_CONSTRAINT_EXTENSION_URL,
  ITEM_DISABLED_DISPLAY_EXTENSION_URL,
} from '../format-registry.js';

/** Builder-private extension URLs for R5-only Questionnaire.item fields. */
const R5_FIELD_EXTENSIONS = {
  disabledDisplay:  ITEM_DISABLED_DISPLAY_EXTENSION_URL,
  answerConstraint: ITEM_ANSWER_CONSTRAINT_EXTENSION_URL,
};

// Official HL7 cross-version extensions for R5-only Questionnaire root fields.
// Both are valid on Questionnaire from R4 onward (FHIR Extensions Pack).
const ARTIFACT_VERSION_ALGO_URL    = 'http://hl7.org/fhir/StructureDefinition/artifact-versionAlgorithm';
const ARTIFACT_COPYRIGHT_LABEL_URL = 'http://hl7.org/fhir/StructureDefinition/artifact-copyrightLabel';

/**
 * Move R5-only native Questionnaire root fields (versionAlgorithm[x],
 * copyrightLabel) into their official cross-version extensions so the document
 * is valid against the R4/R4B schema. Mutates in place.
 * @param {object} q - FHIR Questionnaire object (already deep-cloned)
 */
export function backportR5RootFields(q) {
  if (!q) return;
  const ext = [];
  if (q.versionAlgorithmString !== undefined) {
    ext.push({ url: ARTIFACT_VERSION_ALGO_URL, valueString: q.versionAlgorithmString });
    delete q.versionAlgorithmString;
  } else if (q.versionAlgorithmCoding !== undefined) {
    ext.push({ url: ARTIFACT_VERSION_ALGO_URL, valueCoding: q.versionAlgorithmCoding });
    delete q.versionAlgorithmCoding;
  }
  if (q.copyrightLabel !== undefined) {
    ext.push({ url: ARTIFACT_COPYRIGHT_LABEL_URL, valueString: q.copyrightLabel });
    delete q.copyrightLabel;
  }
  if (ext.length) q.extension = [...(q.extension || []), ...ext];
}

/**
 * Recursively move R5-only native item fields into cross-version extensions.
 * Mutates the questionnaire in place.
 * @param {object} q - FHIR Questionnaire object (already deep-cloned)
 */
export function backportR5ItemFields(q) {
  if (q?.item) _walk(q.item);
}

function _walk(items) {
  if (!Array.isArray(items)) return;
  for (const item of items) {
    for (const [field, url] of Object.entries(R5_FIELD_EXTENSIONS)) {
      if (item[field] === undefined || item[field] === null) continue;
      item.extension = (item.extension || []).filter(e => e?.url !== url);
      item.extension.push({ url, valueCode: item[field] });
      delete item[field];
    }
    if (item.item) _walk(item.item);
  }
}
