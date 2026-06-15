// ── Unit tests: js/fhir/extract.js ───────────────────────────────────────────
// Pure SDC Observation-based extraction — no DOM, no state.

import { describe, it, expect } from 'vitest';
import { extractObservations } from '../js/fhir/extract.js';

const OBS_EXT = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-observationExtract';
const UNIT    = 'http://hl7.org/fhir/StructureDefinition/questionnaire-unit';

function flag(value = true) {
  return { url: OBS_EXT, valueBoolean: value };
}

describe('extractObservations — basics', () => {
  it('returns an empty transaction Bundle when nothing is flagged', () => {
    const q = { resourceType: 'Questionnaire', item: [
      { linkId: 'a', type: 'integer', code: [{ system: 's', code: 'c' }] },
    ] };
    const qr = { resourceType: 'QuestionnaireResponse', item: [
      { linkId: 'a', answer: [{ valueInteger: 5 }] },
    ] };
    const bundle = extractObservations(qr, q);
    expect(bundle.resourceType).toBe('Bundle');
    expect(bundle.type).toBe('transaction');
    expect(bundle.entry).toHaveLength(0);
  });

  it('extracts a flagged coded leaf as a final Observation', () => {
    const q = { resourceType: 'Questionnaire', item: [
      { linkId: 'a', type: 'integer', code: [{ system: 'http://loinc.org', code: '1234-5', display: 'X' }], extension: [flag()] },
    ] };
    const qr = { resourceType: 'QuestionnaireResponse', id: 'qr1', authored: '2026-06-15T10:00:00Z',
      subject: { reference: 'Patient/p1' }, item: [
        { linkId: 'a', answer: [{ valueInteger: 5 }] },
      ] };
    const bundle = extractObservations(qr, q);
    expect(bundle.entry).toHaveLength(1);
    const obs = bundle.entry[0].resource;
    expect(obs.resourceType).toBe('Observation');
    expect(obs.status).toBe('final');
    expect(obs.code.coding).toEqual([{ system: 'http://loinc.org', code: '1234-5', display: 'X' }]);
    expect(obs.valueInteger).toBe(5);
    expect(obs.subject).toEqual({ reference: 'Patient/p1' });
    expect(obs.effectiveDateTime).toBe('2026-06-15T10:00:00Z');
    expect(obs.issued).toBe('2026-06-15T10:00:00Z');
    expect(obs.derivedFrom).toEqual([{ reference: 'QuestionnaireResponse/qr1' }]);
    expect(bundle.entry[0].request).toEqual({ method: 'POST', url: 'Observation' });
    expect(bundle.entry[0].fullUrl).toMatch(/^urn:uuid:/);
  });

  it('skips items without a code', () => {
    const q = { resourceType: 'Questionnaire', item: [
      { linkId: 'a', type: 'integer', extension: [flag()] },
    ] };
    const qr = { item: [{ linkId: 'a', answer: [{ valueInteger: 5 }] }] };
    expect(extractObservations(qr, q).entry).toHaveLength(0);
  });

  it('skips unanswered items', () => {
    const q = { resourceType: 'Questionnaire', item: [
      { linkId: 'a', type: 'integer', code: [{ code: 'c' }], extension: [flag()] },
    ] };
    const qr = { item: [{ linkId: 'a' }] };
    expect(extractObservations(qr, q).entry).toHaveLength(0);
  });
});

describe('extractObservations — inheritance', () => {
  it('inherits a group flag down to coded leaves', () => {
    const q = { resourceType: 'Questionnaire', item: [
      { linkId: 'g', type: 'group', extension: [flag()], item: [
        { linkId: 'a', type: 'integer', code: [{ code: 'c1' }] },
        { linkId: 'b', type: 'integer', code: [{ code: 'c2' }] },
      ] },
    ] };
    const qr = { item: [
      { linkId: 'g', item: [
        { linkId: 'a', answer: [{ valueInteger: 1 }] },
        { linkId: 'b', answer: [{ valueInteger: 2 }] },
      ] },
    ] };
    const bundle = extractObservations(qr, q);
    expect(bundle.entry).toHaveLength(2);
  });

  it('an explicit false on a descendant suppresses an inherited true', () => {
    const q = { resourceType: 'Questionnaire', item: [
      { linkId: 'g', type: 'group', extension: [flag(true)], item: [
        { linkId: 'a', type: 'integer', code: [{ code: 'c1' }] },
        { linkId: 'b', type: 'integer', code: [{ code: 'c2' }], extension: [flag(false)] },
      ] },
    ] };
    const qr = { item: [
      { linkId: 'g', item: [
        { linkId: 'a', answer: [{ valueInteger: 1 }] },
        { linkId: 'b', answer: [{ valueInteger: 2 }] },
      ] },
    ] };
    const bundle = extractObservations(qr, q);
    expect(bundle.entry).toHaveLength(1);
    expect(bundle.entry[0].resource.code.coding[0].code).toBe('c1');
  });

  it('does not emit a value-less Observation for a flagged group', () => {
    const q = { resourceType: 'Questionnaire', item: [
      { linkId: 'g', type: 'group', code: [{ code: 'panel' }], extension: [flag()], item: [
        { linkId: 'a', type: 'integer', code: [{ code: 'c1' }] },
      ] },
    ] };
    const qr = { item: [{ linkId: 'g', item: [{ linkId: 'a', answer: [{ valueInteger: 1 }] }] }] };
    const bundle = extractObservations(qr, q);
    expect(bundle.entry).toHaveLength(1);
    expect(bundle.entry[0].resource.code.coding[0].code).toBe('c1');
  });

  it('honours a root-level Questionnaire flag', () => {
    const q = { resourceType: 'Questionnaire', extension: [flag()], item: [
      { linkId: 'a', type: 'integer', code: [{ code: 'c1' }] },
    ] };
    const qr = { item: [{ linkId: 'a', answer: [{ valueInteger: 9 }] }] };
    expect(extractObservations(qr, q).entry).toHaveLength(1);
  });
});

describe('extractObservations — value mapping', () => {
  it('maps an integer with questionnaire-unit to a Quantity', () => {
    const q = { resourceType: 'Questionnaire', item: [
      { linkId: 'w', type: 'decimal', code: [{ code: '29463-7' }], extension: [
        flag(),
        { url: UNIT, valueCoding: { system: 'http://unitsofmeasure.org', code: 'kg', display: 'kg' } },
      ] },
    ] };
    const qr = { item: [{ linkId: 'w', answer: [{ valueDecimal: 72.5 }] }] };
    const obs = extractObservations(qr, q).entry[0].resource;
    expect(obs.valueQuantity).toEqual({ value: 72.5, unit: 'kg', system: 'http://unitsofmeasure.org', code: 'kg' });
    expect(obs.valueDecimal).toBeUndefined();
  });

  it('maps a coding answer to a CodeableConcept', () => {
    const q = { resourceType: 'Questionnaire', item: [
      { linkId: 's', type: 'choice', code: [{ code: '72166-2' }], extension: [flag()] },
    ] };
    const qr = { item: [{ linkId: 's', answer: [{ valueCoding: { system: 'http://snomed.info/sct', code: '8517006', display: 'Ex-smoker' } }] }] };
    const obs = extractObservations(qr, q).entry[0].resource;
    expect(obs.valueCodeableConcept).toEqual({ coding: [{ system: 'http://snomed.info/sct', code: '8517006', display: 'Ex-smoker' }] });
  });

  it('maps string, boolean and date answers', () => {
    const q = { resourceType: 'Questionnaire', extension: [flag()], item: [
      { linkId: 'str', type: 'string', code: [{ code: 'c-str' }] },
      { linkId: 'bool', type: 'boolean', code: [{ code: 'c-bool' }] },
      { linkId: 'dt', type: 'date', code: [{ code: 'c-dt' }] },
    ] };
    const qr = { item: [
      { linkId: 'str', answer: [{ valueString: 'hi' }] },
      { linkId: 'bool', answer: [{ valueBoolean: true }] },
      { linkId: 'dt', answer: [{ valueDate: '2020-01-01' }] },
    ] };
    const obs = extractObservations(qr, q).entry.map(e => e.resource);
    expect(obs.find(o => o.code.coding[0].code === 'c-str').valueString).toBe('hi');
    expect(obs.find(o => o.code.coding[0].code === 'c-bool').valueBoolean).toBe(true);
    expect(obs.find(o => o.code.coding[0].code === 'c-dt').valueDateTime).toBe('2020-01-01');
  });

  it('emits one Observation per answer for multi-answer items', () => {
    const q = { resourceType: 'Questionnaire', item: [
      { linkId: 'm', type: 'integer', repeats: true, code: [{ code: 'c' }], extension: [flag()] },
    ] };
    const qr = { item: [{ linkId: 'm', answer: [{ valueInteger: 1 }, { valueInteger: 2 }, { valueInteger: 3 }] }] };
    expect(extractObservations(qr, q).entry).toHaveLength(3);
  });

  it('uses a display-only derivedFrom reference when the QR has no id', () => {
    const q = { resourceType: 'Questionnaire', item: [
      { linkId: 'a', type: 'integer', code: [{ code: 'c' }], extension: [flag()] },
    ] };
    const qr = { item: [{ linkId: 'a', answer: [{ valueInteger: 1 }] }] };
    const obs = extractObservations(qr, q).entry[0].resource;
    expect(obs.derivedFrom).toEqual([{ display: 'Source QuestionnaireResponse' }]);
  });
});
