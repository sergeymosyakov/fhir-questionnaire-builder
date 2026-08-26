// ── Unit tests: js/fhir/sdc-structuremap-populate.js ──────────────────────────
// structureMapPopulate() resolves a contained StructureMap and runs it through
// fhir-structuremap-js — real evaluator, no fakes (matches the library's own
// testing philosophy).
import { describe, it, expect } from 'vitest';
import fhirpath from 'fhirpath';
import { parseFMLToJSON } from '../lib/fhir-structuremap-js.esm.js';
import { structureMapPopulate } from '../js/fhir/sdc-structuremap-populate.js';
import { createStructureMapEngine } from '../js/fhir/structuremap-engine.js';
import { FHIR } from '../js/fhir/urls/fhir.js';

const realEngine = createStructureMapEngine({
  evaluator: { evaluate: (resource, expr, env) => fhirpath.evaluate(resource, expr, env) },
});

const SM_JSON = parseFMLToJSON(`
  map "http://example.org/StructureMap/PatientToQR" = PatientToQR
  group main(source patient : Patient, target qr : QuestionnaireResponse) {
    patient -> qr.resourceType = 'QuestionnaireResponse';
    patient.name as n -> qr.status = 'in-progress' then {
      n.family as f -> qr.patientFamilyName = f;
    };
  }
`);
SM_JSON.id = 'patient-to-qr';

function makeQ(extra = {}) {
  return {
    resourceType: 'Questionnaire',
    contained: [SM_JSON],
    extension: [{ url: FHIR.sourceStructureMap, valueCanonical: '#patient-to-qr' }],
    ...extra,
  };
}

const patient = { resourceType: 'Patient', name: [{ family: 'Doe' }] };

describe('structureMapPopulate — guard paths', () => {
  it('warns when the source resource is missing', () => {
    const { qr, warnings } = structureMapPopulate(makeQ(), null, { engine: realEngine });
    expect(qr).toBeNull();
    expect(warnings[0]).toContain('No source resource');
  });

  it('warns when no sourceStructureMap extension is present', () => {
    const q = { resourceType: 'Questionnaire' };
    const { qr, warnings } = structureMapPopulate(q, patient, { engine: realEngine });
    expect(qr).toBeNull();
    expect(warnings[0]).toContain('sourceStructureMap');
  });

  it('warns when the referenced StructureMap is not found in contained[]', () => {
    const q = { resourceType: 'Questionnaire', contained: [], extension: [{ url: FHIR.sourceStructureMap, valueCanonical: '#missing' }] };
    const { qr, warnings } = structureMapPopulate(q, patient, { engine: realEngine });
    expect(qr).toBeNull();
    expect(warnings[0]).toContain('not found in contained');
  });

  it('warns when the sourceStructureMap value is an external URL (no server to resolve it)', () => {
    const q = { resourceType: 'Questionnaire', contained: [SM_JSON], extension: [{ url: FHIR.sourceStructureMap, valueCanonical: 'https://example.org/StructureMap/PatientToQR' }] };
    const { qr, warnings } = structureMapPopulate(q, patient, { engine: realEngine });
    expect(qr).toBeNull();
    expect(warnings[0]).toContain('not found in contained');
  });
});

describe('structureMapPopulate — happy path', () => {
  it('runs the map and returns a QuestionnaireResponse with the mapped field', () => {
    const { qr, warnings } = structureMapPopulate(makeQ(), patient, { engine: realEngine });
    expect(warnings).toHaveLength(0);
    expect(qr.resourceType).toBe('QuestionnaireResponse');
    expect(qr.patientFamilyName).toBe('Doe');
  });
});

// ── Realistic item[]/answer[] nested output (matches the sampledata demo shape) ──
// Built as a raw StructureMap JSON model (not FML text — FML source contexts
// only support one "." level), same authoring style as the targetStructureMap
// demo in sampledata/structuremap-extract-demo.fhir.json.
function itemRule(idx, linkId, path, valueField) {
  return {
    source: [{ context: 'patient' }],
    target: [{
      context: 'qr', element: 'item', variable: `_item${idx}`, listMode: [],
      transform: 'create', parameter: [{ valueString: 'BackboneElement' }],
    }],
    rule: [
      {
        source: [{ context: 'patient' }],
        target: [{ context: `_item${idx}`, element: 'linkId', listMode: [], transform: 'copy', parameter: [{ valueString: linkId }] }],
        rule: [], dependent: [],
      },
      {
        source: [{ context: 'patient' }],
        target: [{ context: `_item${idx}`, element: 'answer', variable: `_ans${idx}`, listMode: ['first'] }],
        rule: [
          {
            source: [{ context: `_ans${idx}` }],
            target: [{
              context: `_ans${idx}`, element: valueField, listMode: [],
              transform: 'evaluate', parameter: [{ valueId: 'patient' }, { valueString: path }],
            }],
            rule: [], dependent: [],
          },
        ],
        dependent: [],
      },
    ],
    dependent: [],
  };
}

const SM_ITEM_JSON = {
  resourceType: 'StructureMap', id: 'patient-to-qr-items', url: 'http://fhir-qb.app/StructureMap/PatientToQRItems',
  name: 'PatientToQRItems', status: 'active', structure: [], import: [], const: [],
  group: [{
    name: 'main', typeMode: 'none',
    input: [
      { name: 'patient', mode: 'source', type: 'Patient' },
      { name: 'qr', mode: 'target', type: 'QuestionnaireResponse' },
    ],
    rule: [
      { source: [{ context: 'patient' }], target: [{ context: 'qr', element: 'resourceType', listMode: [], transform: 'copy', parameter: [{ valueString: 'QuestionnaireResponse' }] }], rule: [], dependent: [] },
      { source: [{ context: 'patient' }], target: [{ context: 'qr', element: 'status', listMode: [], transform: 'copy', parameter: [{ valueString: 'in-progress' }] }], rule: [], dependent: [] },
      itemRule(0, 'family-name', 'name.family', 'valueString'),
      itemRule(1, 'birth-date', 'birthDate', 'valueDate'),
    ],
  }],
};

function makeItemsQ() {
  return {
    resourceType: 'Questionnaire',
    contained: [SM_ITEM_JSON],
    extension: [{ url: FHIR.sourceStructureMap, valueCanonical: '#patient-to-qr-items' }],
  };
}

const fullPatient = { resourceType: 'Patient', name: [{ family: 'Doe' }], birthDate: '1980-01-01' };

describe('structureMapPopulate — realistic item[]/answer[] output', () => {
  it('builds a QuestionnaireResponse with linkId/answer items from a raw JSON StructureMap', () => {
    const { qr, warnings } = structureMapPopulate(makeItemsQ(), fullPatient, { engine: realEngine });
    expect(warnings).toHaveLength(0);
    expect(qr.resourceType).toBe('QuestionnaireResponse');
    expect(qr.status).toBe('in-progress');
    expect(qr.item).toHaveLength(2);
    const byLinkId = Object.fromEntries(qr.item.map(i => [i.linkId, i]));
    expect(byLinkId['family-name'].answer[0].valueString).toBe('Doe');
    expect(byLinkId['birth-date'].answer[0].valueDate).toBe('1980-01-01');
  });
});

describe('structureMapPopulate — sampledata/structuremap-populate-demo.fhir.json', () => {
  it('runs the shipped demo StructureMap against a Patient and fills all three items', async () => {
    const fs = await import('node:fs/promises');
    const questJson = JSON.parse(await fs.readFile(new URL('../sampledata/structuremap-populate-demo.fhir.json', import.meta.url)));
    const demoPatient = { resourceType: 'Patient', name: [{ family: 'Smith', given: ['Alex'] }], birthDate: '1975-06-15' };
    const { qr, warnings } = structureMapPopulate(questJson, demoPatient, { engine: realEngine });
    expect(warnings).toHaveLength(0);
    expect(qr.resourceType).toBe('QuestionnaireResponse');
    expect(qr.item).toHaveLength(3);
    const byLinkId = Object.fromEntries(qr.item.map(i => [i.linkId, i]));
    expect(byLinkId['family-name'].answer[0].valueString).toBe('Smith');
    expect(byLinkId['given-name'].answer[0].valueString).toBe('Alex');
    expect(byLinkId['birth-date'].answer[0].valueDate).toBe('1975-06-15');
  });
});
