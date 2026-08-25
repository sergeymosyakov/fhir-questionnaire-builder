// Wires fhir-structuremap-js's injected-evaluator engine to this app's FHIRPath + R4 model.
import { StructureMapEngine } from 'fhir-structuremap-js';
import { fhirModel } from './fhir-model.js';

const fhirpath = typeof window !== 'undefined' ? window.fhirpath : null;

/** Builds a StructureMapEngine; pass `overrides.evaluator` to replace the default FHIRPath wiring (e.g. in tests). */
export function createStructureMapEngine(overrides = {}) {
  return new StructureMapEngine({
    evaluator: { evaluate: (resource, expr, env) => fhirpath.evaluate(resource, expr, env, fhirModel()) },
    ...overrides,
  });
}
