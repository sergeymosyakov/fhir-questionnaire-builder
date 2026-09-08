// ── Unit tests: StructureDefinition → draft Questionnaire generator ──────────
import { describe, it, expect } from 'vitest';
import { generateQuestionnaireFromSD } from '../js/fhir/sd-to-questionnaire.js';

function el(id, extra = {}) {
  return { id, path: id, min: 0, max: '1', ...extra };
}

function makeSD(elements, opts = {}) {
  return {
    resourceType: 'StructureDefinition',
    url: 'http://example.org/StructureDefinition/DemoPatient',
    type: 'Patient',
    title: opts.title,
    name: opts.name,
    snapshot: { element: [el('Patient'), ...elements] },
  };
}

describe('generateQuestionnaireFromSD', () => {
  it('throws on a non-StructureDefinition resource', () => {
    expect(() => generateQuestionnaireFromSD({ resourceType: 'Patient' })).toThrow();
  });

  it('throws when snapshot.element is missing', () => {
    expect(() => generateQuestionnaireFromSD({ resourceType: 'StructureDefinition' })).toThrow();
  });

  it('produces a valid draft Questionnaire resource', () => {
    const sd = makeSD([el('Patient.active', { short: 'Active', type: [{ code: 'boolean' }] })]);
    const { questionnaire } = generateQuestionnaireFromSD(sd);
    expect(questionnaire.resourceType).toBe('Questionnaire');
    expect(questionnaire.status).toBe('draft');
    expect(Array.isArray(questionnaire.item)).toBe(true);
  });

  it('titles from sd.title, falling back to sd.name then sd.type', () => {
    const withTitle = makeSD([el('Patient.active', { type: [{ code: 'boolean' }] })], { title: 'Demo Patient Profile' });
    expect(generateQuestionnaireFromSD(withTitle).questionnaire.title).toBe('Demo Patient Profile');

    const withName = makeSD([el('Patient.active', { type: [{ code: 'boolean' }] })], { name: 'DemoPatient' });
    expect(generateQuestionnaireFromSD(withName).questionnaire.title).toBe('DemoPatient');

    const bare = makeSD([el('Patient.active', { type: [{ code: 'boolean' }] })]);
    expect(generateQuestionnaireFromSD(bare).questionnaire.title).toBe('Patient');
  });

  it('maps a leaf element to a top-level item with a valid FHIR item.type, text, definition', () => {
    const sd = makeSD([el('Patient.active', { short: 'Active flag', type: [{ code: 'boolean' }] })]);
    const { questionnaire } = generateQuestionnaireFromSD(sd);
    const item = questionnaire.item[0];
    expect(item.linkId).toBe('Patient.active');
    expect(item.type).toBe('boolean');
    expect(item.text).toBe('Active flag');
    expect(item.definition).toBe('http://example.org/StructureDefinition/DemoPatient#Patient.active');
  });

  it('maps a coded element to FHIR item.type "choice", not the internal alias', () => {
    const sd = makeSD([el('Patient.gender', { short: 'Gender', type: [{ code: 'code' }] })]);
    const { questionnaire } = generateQuestionnaireFromSD(sd);
    expect(questionnaire.item[0].type).toBe('choice');
  });

  it('turns a BackboneElement with children into a nested group item', () => {
    const sd = makeSD([
      el('Patient.name', { short: 'Name', type: [{ code: 'HumanName' }] }),
      el('Patient.name.family', { short: 'Family name', type: [{ code: 'string' }] }),
      el('Patient.name.given', { short: 'Given name', type: [{ code: 'string' }], max: '*' }),
    ]);
    const { questionnaire } = generateQuestionnaireFromSD(sd);
    const group = questionnaire.item[0];
    expect(group.type).toBe('group');
    expect(group.linkId).toBe('Patient.name');
    expect(group.item).toHaveLength(2);
    expect(group.item[0].linkId).toBe('Patient.name.family');
    expect(group.item[1].repeats).toBe(true);
  });

  it('marks required from min >= 1', () => {
    const sd = makeSD([el('Patient.active', { min: 1, type: [{ code: 'boolean' }] })]);
    expect(generateQuestionnaireFromSD(sd).questionnaire.item[0].required).toBe(true);
  });

  it('skips profile-excluded (max:"0") elements', () => {
    const sd = makeSD([
      el('Patient.active', { type: [{ code: 'boolean' }] }),
      el('Patient.deceased[x]', { max: '0', type: [{ code: 'boolean' }] }),
    ]);
    const { questionnaire } = generateQuestionnaireFromSD(sd);
    expect(questionnaire.item).toHaveLength(1);
    expect(questionnaire.item[0].linkId).toBe('Patient.active');
  });

  it('generates a separate item for each slice, alongside the base element', () => {
    const sd = makeSD([
      el('Patient.identifier', { type: [{ code: 'Identifier' }] }),
      el('Patient.identifier:mrn', { short: 'MRN', type: [{ code: 'Identifier' }] }),
    ]);
    const { questionnaire, warnings } = generateQuestionnaireFromSD(sd);
    expect(questionnaire.item).toHaveLength(2);
    expect(questionnaire.item[0].linkId).toBe('Patient.identifier');
    expect(questionnaire.item[1].linkId).toBe('Patient.identifier:mrn');
    expect(questionnaire.item[1].text).toBe('MRN');
    expect(warnings).toHaveLength(0);
  });

  it('explodes a multi-type element into one item per type, FHIR-named', () => {
    const sd = makeSD([
      el('Patient.multipleBirth[x]', { short: 'Multiple birth', type: [{ code: 'boolean' }, { code: 'integer' }] }),
    ]);
    const { questionnaire, warnings } = generateQuestionnaireFromSD(sd);
    expect(questionnaire.item).toHaveLength(2);
    expect(questionnaire.item[0]).toMatchObject({ linkId: 'Patient.multipleBirthBoolean', type: 'boolean', text: 'Multiple birth (boolean)' });
    expect(questionnaire.item[1]).toMatchObject({ linkId: 'Patient.multipleBirthInteger', type: 'integer', text: 'Multiple birth (integer)' });
    expect(questionnaire.item[0].required).toBeUndefined();
    expect(warnings.some(w => w.includes('Patient.multipleBirth[x]'))).toBe(true);
  });
});
