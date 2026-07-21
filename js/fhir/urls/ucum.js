// ── UCUM (unitsofmeasure.org) ─────────────────────────────────────────────────
// UCUM code-system URI. Spec-defined `http://` identifier, never fetched.
const UCUM = 'http:' + '//unitsofmeasure.org'; // NOSONAR — UCUM system URI, not a network endpoint

export const UCUM_URL = {
  system:   UCUM,
  valueSet: UCUM + '/vs',
};
