// ── Unit tests: js/fhir/sdc-structuremap-extract.js ──────────────────────────
// structureMapExtract() resolves a contained StructureMap and runs it through
// fhir-structuremap-js — real evaluator, no fakes (matches the library's own
// testing philosophy).
import { describe, it, expect } from 'vitest';
import fhirpath from 'fhirpath';
import { parseFMLToJSON } from '../lib/fhir-structuremap-js.esm.js';
import { structureMapExtract } from '../js/fhir/sdc-structuremap-extract.js';
import { createStructureMapEngine } from '../js/fhir/structuremap-engine.js';
import { FHIR } from '../js/fhir/urls/fhir.js';

const realEngine = createStructureMapEngine({
  evaluator: { evaluate: (resource, expr, env) => fhirpath.evaluate(resource, expr, env) },
});

const SM_JSON = parseFMLToJSON(`
  map "http://example.org/StructureMap/QRToPatient" = QRToPatient
  group main(source qr : QuestionnaireResponse, target patient : Patient) {
    qr -> patient.resourceType = 'Patient';
    qr.patientFamilyName as n -> patient.name.family = n;
  }
`);
SM_JSON.id = 'qr-to-patient';

function makeQ(extra = {}) {
  return {
    resourceType: 'Questionnaire',
    contained: [SM_JSON],
    extension: [{ url: FHIR.targetStructureMap, valueCanonical: '#qr-to-patient' }],
    ...extra,
  };
}

const qr = { resourceType: 'QuestionnaireResponse', status: 'completed', patientFamilyName: 'Doe' };

describe('structureMapExtract — guard paths', () => {
  it('warns when QR is missing', () => {
    const { bundle, count, warnings } = structureMapExtract(makeQ(), null, { engine: realEngine });
    expect(bundle).toBeNull();
    expect(count).toBe(0);
    expect(warnings[0]).toContain('No QuestionnaireResponse');
  });

  it('warns when no targetStructureMap extension is present', () => {
    const q = { resourceType: 'Questionnaire' };
    const { bundle, warnings } = structureMapExtract(q, qr, { engine: realEngine });
    expect(bundle).toBeNull();
    expect(warnings[0]).toContain('targetStructureMap');
  });

  it('warns when the referenced StructureMap is not found in contained[]', () => {
    const q = { resourceType: 'Questionnaire', contained: [], extension: [{ url: FHIR.targetStructureMap, valueCanonical: '#missing' }] };
    const { bundle, warnings } = structureMapExtract(q, qr, { engine: realEngine });
    expect(bundle).toBeNull();
    expect(warnings[0]).toContain('not found in contained');
  });

  it('warns when the targetStructureMap value is an external URL (no server to resolve it)', () => {
    const q = { resourceType: 'Questionnaire', contained: [SM_JSON], extension: [{ url: FHIR.targetStructureMap, valueCanonical: 'https://example.org/StructureMap/QRToPatient' }] };
    const { bundle, warnings } = structureMapExtract(q, qr, { engine: realEngine });
    expect(bundle).toBeNull();
    expect(warnings[0]).toContain('not found in contained');
  });
});

describe('structureMapExtract — happy path', () => {
  it('returns a transaction Bundle with one Patient', () => {
    const { bundle, count, warnings } = structureMapExtract(makeQ(), qr, { engine: realEngine });
    expect(warnings).toHaveLength(0);
    expect(count).toBe(1);
    expect(bundle.resourceType).toBe('Bundle');
    expect(bundle.type).toBe('transaction');
    expect(bundle.entry).toHaveLength(1);
  });

  it('runs the map and sets the mapped field', () => {
    const { bundle } = structureMapExtract(makeQ(), qr, { engine: realEngine });
    const r = bundle.entry[0].resource;
    expect(r.resourceType).toBe('Patient');
    expect(r.name.family).toBe('Doe');
  });

  it('entry request.url uses the produced resourceType', () => {
    const { bundle } = structureMapExtract(makeQ(), qr, { engine: realEngine });
    expect(bundle.entry[0].request).toEqual({ method: 'POST', url: 'Patient' });
  });
});
