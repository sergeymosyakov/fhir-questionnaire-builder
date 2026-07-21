// ── SNOMED CT (snomed.info) ───────────────────────────────────────────────────
// SNOMED CT code-system URI. Spec-defined `http://` identifier, never fetched.
const SNOMED = 'http:' + '//snomed.info/sct'; // NOSONAR — SNOMED CT system URI, not a network endpoint

export const SNOMED_URL = {
  system:     SNOMED,
  implicitVs: SNOMED + '?fhir_vs',
};
