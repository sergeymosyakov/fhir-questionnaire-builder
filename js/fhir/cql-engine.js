// Wires the vendored cql-execution (ELM interpreter) + cql-exec-fhir (FHIR PatientSource)
// into a runnable CQL engine. Vendored locally (lib/cql-execution.esm.js,
// lib/cql-exec-fhir.esm.js, via `npm run vendor:cql` / `vendor:cql-fhir`) — CSP's
// script-src allowlist blocks arbitrary CDNs, so it can't be loaded from one at runtime.
//
// Lazy-loaded via dynamic import() (unlike structuremap-engine.js's eager import) —
// cql-exec-fhir bundles all 4 FHIR model-info versions (~3MB) and should only be
// fetched by the rare questionnaire that actually references a cqf-library.
let _modulesPromise = null;
function loadModules() {
  if (!_modulesPromise) {
    _modulesPromise = Promise.all([
      import('../../lib/cql-execution.esm.js'),
      import('../../lib/cql-exec-fhir.esm.js'),
    ]).then(([cqlMod, cqlFhirMod]) => ({ cql: cqlMod.default, cqlfhir: cqlFhirMod.default }));
  }
  return _modulesPromise;
}

/**
 * Run a CQL ELM library against a single FHIR patient, returning every `define`'s result.
 * @param {object} elmJson    ELM JSON (the `{ library: {...} }` wrapper produced by cql-to-elm)
 * @param {object} patient    FHIR Patient resource (plus any other resources the library needs)
 * @param {object[]} [otherResources] Additional FHIR resources for the same patient (e.g. Observation)
 * @returns {Promise<Object.<string, unknown>>} define name -> evaluated result
 */
export async function runCqlLibrary(elmJson, patient, otherResources = []) {
  const { cql, cqlfhir } = await loadModules();
  const library = new cql.Library(elmJson);
  const executor = new cql.Executor(library);
  const patientSource = cqlfhir.PatientSource.FHIRv401();
  const bundle = {
    resourceType: 'Bundle',
    type: 'collection',
    entry: [patient, ...otherResources].map(resource => ({ resource })),
  };
  patientSource.loadBundles([bundle]);
  const results = await executor.exec(patientSource);
  return results.patientResults[patient.id] || {};
}
