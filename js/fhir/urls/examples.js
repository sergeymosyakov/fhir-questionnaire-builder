// ── Example / placeholder URLs ────────────────────────────────────────────────
// Sample URLs shown only as input placeholders or in tooltip help text. They are
// illustrative, never used as real identifiers or fetched. Centralised behind a
// single NOSONAR base so SonarQube's S5332 (clear-text protocol) does not flag
// the many placeholder strings across the modal UI.
const P = 'http:' + '//'; // NOSONAR — example/placeholder scheme, not a network endpoint

export const EXAMPLE_URL = {
  fhirBase:        P + 'hl7.org/fhir/...',
  structureDef:    P + 'hl7.org/fhir/StructureDefinition/\u2026',
  extension:       P + 'example.com/fhir/StructureDefinition/ext-name',
  valueSet:        P + 'terminology.hl7.org/ValueSet/...',
  unitValueSet:    P + 'unitsofmeasure.org/vs/\u2026',
  questionnaireUrl: P + 'example.org/fhir/\u2026',
  identifierSystem: P + 'example.org/ids',
  canonicalBase:   P + 'example.org/fhir/Questionnaire/base|1.0',
  canonicalPrior:  P + 'example.org/fhir/Questionnaire/prior|1.0',
  scheme:          P + '\u2026',
};
