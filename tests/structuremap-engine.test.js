import { describe, it, expect } from 'vitest';
import fhirpath from 'fhirpath';
import { StructureMapEngine, parseFMLToDocument } from '../lib/fhir-structuremap-js.esm.js';
import { createStructureMapEngine } from '../js/fhir/structuremap-engine.js';

// Proves the wrapper wires a working StructureMapEngine — the library's own
// suite covers its FML/engine semantics, this only covers our integration point.
describe('structuremap-engine wrapper', () => {
  it('builds a StructureMapEngine instance with default (window.fhirpath-based) wiring', () => {
    expect(createStructureMapEngine()).toBeInstanceOf(StructureMapEngine);
  });

  it('executes a trivial FML map end-to-end via an injected evaluator override', () => {
    const doc = parseFMLToDocument(`
      map "http://example.org/StructureMap/Test" = Test
      group main(source src : Patient, target tgt : Person) {
        src.name as n -> tgt.name = n;
      }
    `);
    const engine = createStructureMapEngine({
      evaluator: { evaluate: (resource, expr, env) => fhirpath.evaluate(resource, expr, env) },
    });
    const result = engine.run(doc, { src: { name: [{ given: ['Ann'] }] }, tgt: {} });
    expect(result.tgt.name).toEqual({ given: ['Ann'] });
  });
});
