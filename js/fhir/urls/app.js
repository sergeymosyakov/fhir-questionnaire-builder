// ── Private extension namespace (fhir-qb.app) ─────────────────────────────────
// Our own canonical URIs for builder-specific data that has no standard FHIR
// extension. Spec-style `http://` identifiers, never fetched — see fhir.js for
// why the single base literal carries NOSONAR.

const APP = 'http:' + '//fhir-qb.app'; // NOSONAR — private extension namespace URI, not a network endpoint

export const APP_URL = {
  redcapNs:             APP + '/redcap/',
  uiTranslations:       APP + '/StructureDefinition/ui-translations',
  xhtmlTranslations:    APP + '/StructureDefinition/xhtml-translations',
  markdownTranslations: APP + '/StructureDefinition/markdown-translations',
};
