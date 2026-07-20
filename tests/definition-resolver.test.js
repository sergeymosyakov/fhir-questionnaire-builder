// ── definition-resolver tests ─────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import {
  parseDefinitionUrl,
  fhirDatatypeToItemType,
  findElement,
  resolveDefinition,
  typeFromProfileUrl,
} from '../js/fhir/definition-resolver.js';

const SD = {
  resourceType: 'StructureDefinition',
  url: 'http://example.org/StructureDefinition/DemoPatient',
  type: 'Patient',
  snapshot: {
    element: [
      { id: 'Patient.name.family', path: 'Patient.name.family',
        short: 'Family name', min: 1, max: '1', maxLength: 60,
        type: [{ code: 'string' }] },
      { id: 'Patient.birthDate', path: 'Patient.birthDate',
        short: 'Date of birth', min: 0, max: '1',
        type: [{ code: 'date' }] },
      { id: 'Patient.active', path: 'Patient.active',
        label: 'Active flag', min: 0, max: '1',
        type: [{ code: 'boolean' }] },
      { id: 'Patient.maritalStatus', path: 'Patient.maritalStatus',
        short: 'Marital status', min: 0, max: '1',
        type: [{ code: 'CodeableConcept' }],
        binding: { strength: 'required', valueSet: 'http://hl7.org/fhir/ValueSet/marital-status' } },
      { id: 'Patient.telecom', path: 'Patient.telecom',
        short: 'Contact points', min: 0, max: '*',
        type: [{ code: 'ContactPoint' }] },
      { id: 'Patient.managingOrganization', path: 'Patient.managingOrganization',
        short: 'Organization that is the custodian of the patient record', min: 0, max: '1',
        type: [{ code: 'Reference', targetProfile: ['http://hl7.org/fhir/StructureDefinition/Organization'] }] },
      { id: 'Patient.generalPractitioner', path: 'Patient.generalPractitioner',
        short: 'Patient GP', min: 0, max: '*',
        type: [{ code: 'Reference', targetProfile: ['http://example.org/StructureDefinition/custom-gp'] }] },
    ],
  },
};

describe('parseDefinitionUrl', () => {
  it('splits canonical and element id', () => {
    expect(parseDefinitionUrl('http://x/StructureDefinition/P#Patient.name.family'))
      .toEqual({ canonical: 'http://x/StructureDefinition/P', elementId: 'Patient.name.family' });
  });
  it('returns empty elementId when no fragment', () => {
    expect(parseDefinitionUrl('http://x/P')).toEqual({ canonical: 'http://x/P', elementId: '' });
  });
  it('returns null for empty input', () => {
    expect(parseDefinitionUrl('')).toBeNull();
    expect(parseDefinitionUrl(null)).toBeNull();
  });
});

describe('fhirDatatypeToItemType', () => {
  it('maps primitives and complex types', () => {
    expect(fhirDatatypeToItemType('string')).toBe('text');
    expect(fhirDatatypeToItemType('boolean')).toBe('checkbox');
    expect(fhirDatatypeToItemType('date')).toBe('date');
    expect(fhirDatatypeToItemType('CodeableConcept')).toBe('select');
    expect(fhirDatatypeToItemType('Reference')).toBe('reference');
    expect(fhirDatatypeToItemType('Quantity')).toBe('quantity');
    expect(fhirDatatypeToItemType('unknownType')).toBe('text');
  });
});

describe('findElement', () => {
  it('finds by id', () => {
    expect(findElement(SD, 'Patient.birthDate')?.short).toBe('Date of birth');
  });
  it('returns null for missing element', () => {
    expect(findElement(SD, 'Patient.nope')).toBeNull();
  });
});

describe('resolveDefinition', () => {
  it('resolves a required string element with maxLength', () => {
    const r = resolveDefinition(SD, 'http://x#Patient.name.family');
    expect(r).toMatchObject({
      itemType: 'text', fhirType: 'string', text: 'Family name',
      mandatory: true, repeats: false, maxLength: 60,
    });
  });
  it('resolves a boolean element from label', () => {
    const r = resolveDefinition(SD, 'http://x#Patient.active');
    expect(r).toMatchObject({ itemType: 'checkbox', text: 'Active flag', mandatory: false });
  });
  it('resolves a bound CodeableConcept to a choice with a value set', () => {
    const r = resolveDefinition(SD, 'http://x#Patient.maritalStatus');
    expect(r.itemType).toBe('select');
    expect(r.answerValueSet).toBe('http://hl7.org/fhir/ValueSet/marital-status');
  });
  it('marks max=* as repeats', () => {
    const r = resolveDefinition(SD, 'http://x#Patient.telecom');
    expect(r.repeats).toBe(true);
  });
  it('returns null when the element is missing or url has no fragment', () => {
    expect(resolveDefinition(SD, 'http://x#Patient.nope')).toBeNull();
    expect(resolveDefinition(SD, 'http://x')).toBeNull();
  });
  it('resolves a Reference with a base FHIR targetProfile to referenceType', () => {
    const r = resolveDefinition(SD, 'http://x#Patient.managingOrganization');
    expect(r.itemType).toBe('reference');
    expect(r.referenceProfiles).toEqual(['http://hl7.org/fhir/StructureDefinition/Organization']);
    expect(r.referenceType).toBe('Organization');
  });
  it('keeps custom targetProfile but leaves referenceType undefined', () => {
    const r = resolveDefinition(SD, 'http://x#Patient.generalPractitioner');
    expect(r.referenceProfiles).toEqual(['http://example.org/StructureDefinition/custom-gp']);
    expect(r.referenceType).toBeUndefined();
  });
});

describe('typeFromProfileUrl', () => {
  it('derives a type only from base FHIR profile URLs', () => {
    expect(typeFromProfileUrl('http://hl7.org/fhir/StructureDefinition/Organization')).toBe('Organization');
    expect(typeFromProfileUrl('http://example.org/StructureDefinition/us-core-patient')).toBeUndefined();
    expect(typeFromProfileUrl(null)).toBeUndefined();
  });
});
