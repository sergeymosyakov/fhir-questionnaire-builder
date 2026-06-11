// ── FHIR Version Registry — backward-compat facade ───────────────────────────
// versionRegistry delegates to formatRegistry, filtering for isBuilderVersion.
// All callers (fhir-version-select.js, questionnaire-loader.js, export.js,
// unit tests) continue to work without changes.
//
// The actual registration is done by js/fhir/formats/r4.js, r4b.js, r5.js.

import { formatRegistry } from './format-registry.js';

export const versionRegistry = {
  get: (id)           => formatRegistry.get(id),
  getAll: ()          => formatRegistry.getBuilderVersions(),
  detectVersion: (data) => formatRegistry.detectVersion(data),
};
