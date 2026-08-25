// Wires fhir-structuremap-js's injected-evaluator engine to this app's FHIRPath + R4 model.
// Vendored locally (lib/fhir-structuremap-js.esm.js, via `npm run vendor:structuremap`) —
// CSP's script-src allowlist blocks arbitrary CDNs, so it can't be loaded from one at runtime.
import { StructureMapEngine } from '../../lib/fhir-structuremap-js.esm.js';
import { fhirModel } from './fhir-model.js';

const fhirpath = typeof window !== 'undefined' ? window.fhirpath : null;

/** Builds a StructureMapEngine; pass `overrides.evaluator` to replace the default FHIRPath wiring (e.g. in tests). */
export function createStructureMapEngine(overrides = {}) {
  return new StructureMapEngine({
    evaluator: { evaluate: (resource, expr, env) => fhirpath.evaluate(resource, expr, env, fhirModel()) },
    ...overrides,
  });
}
