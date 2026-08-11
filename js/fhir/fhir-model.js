// FHIR R4 model for fhirpath.js — enables polymorphic value[x] (`.value`),
// `.ofType()`, and resource-aware navigation. Loaded globally by index.html
// (lib/fhirpath.r4.min.js → window.fhirpath_r4_model). Returns undefined in Node
// tests (which use explicit `.valueX` accessors), where fhirpath runs model-less.
export const fhirModel = () => (typeof window !== 'undefined' ? window.fhirpath_r4_model : undefined);
