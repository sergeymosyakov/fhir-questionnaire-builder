// Tests for the checklist code codec and its QR round trip.
import { describe, it, expect } from 'vitest';
import { joinCodes, splitCodes } from '../js/fhir/checklist-codec.js';
import { importQRAnswers } from '../js/fhir/qr-import.js';
import { buildQR } from '../js/fhir/qr-builder.js';
import { FHIR } from '../js/fhir/urls/fhir.js';

const control = code => ({ url: FHIR.itemControl, valueCodeableConcept: { coding: [{ code }] } });
const checklist = { linkId: 'c', type: 'choice', repeats: true, extension: [control('check-box')] };
const codesOf = qr => qr.item[0].answer.map(a => a.valueCoding.code);

describe('checklist codec', () => {
  it('round-trips codes containing commas, percent signs and backslashes', () => {
    for (const set of [['a', 'b,c'], ['d\\e', ',', '%2C', '%'], ['x']]) {
      expect(splitCodes(joinCodes(set))).toEqual(set);
    }
  });

  it('plain codes keep the legacy comma-separated form', () => {
    expect(joinCodes(['a', 'b', 'c'])).toBe('a,b,c');
    expect(splitCodes('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('empty string and trailing comma behave like a plain split', () => {
    expect(splitCodes('')).toEqual(['']);
    expect(splitCodes('a,')).toEqual(['a', '']);
  });
});

describe('checklist codec through the QR', () => {
  it('one answer per selected code, even when a code has a comma', () => {
    expect(codesOf(buildQR({ item: [checklist] }, { c: [joinCodes(['a,b', 'z'])] }))).toEqual(['a,b', 'z']);
  });

  it.each([['a,b'], ['d\\e'], ['50%'], ['%2C']])('a lone code %s is exported unchanged', code => {
    expect(codesOf(buildQR({ item: [checklist] }, { c: [joinCodes([code])] }))).toEqual([code]);
  });

  it('an atable checklist is split the same way', () => {
    const atable = { ...checklist, extension: [control('atable')] };
    expect(codesOf(buildQR({ item: [atable] }, { c: [joinCodes(['a,b', 'z'])] }))).toEqual(['a,b', 'z']);
  });

  it('a repeating non-checklist choice keeps a raw comma code intact', () => {
    const select = { linkId: 'c', type: 'choice', repeats: true };
    expect(codesOf(buildQR({ item: [select] }, { c: ['cough,dry'] }))).toEqual(['cough,dry']);
  });

  it('QR import keeps a comma-containing code as one selection', () => {
    const values = {};
    const qr = { resourceType: 'QuestionnaireResponse', item: [{ linkId: 'c', answer: [{ valueCoding: { code: 'a,b' } }, { valueCoding: { code: 'z' } }] }] };
    importQRAnswers(qr, values, [{ id: 'c', itemType: 'checklist', children: [] }]);
    expect(splitCodes(values.c[0])).toEqual(['a,b', 'z']);
  });

  it('merges and encodes a checklist inside each repeating-group instance', () => {
    const tree = [{ id: 'g', type: 'group', repeats: true, children: [{ id: 'c', itemType: 'checklist', children: [] }] }];
    const values = {};
    const qr = { resourceType: 'QuestionnaireResponse', item: [
      { linkId: 'g', item: [{ linkId: 'c', answer: [{ valueCoding: { code: 'a,b' } }] }] },
      { linkId: 'g', item: [{ linkId: 'c', answer: [{ valueCoding: { code: 'x' } }, { valueCoding: { code: 'y' } }] }] },
    ] };
    importQRAnswers(qr, values, tree);
    expect(values.g.map(m => splitCodes(m.c[0]))).toEqual([['a,b'], ['x', 'y']]);
  });

  it('merges a checklist that is a child of a repeating non-group question', () => {
    const tree = [{ id: 'q', type: 'item', repeats: true, children: [{ id: 'c', itemType: 'checklist', children: [] }] }];
    const values = {};
    const qr = { resourceType: 'QuestionnaireResponse', item: [
      { linkId: 'q', answer: [{ valueString: 'x', item: [{ linkId: 'c', answer: [{ valueCoding: { code: 'a' } }, { valueCoding: { code: 'b' } }] }] }] },
    ] };
    importQRAnswers(qr, values, tree);
    expect(splitCodes(values.c[0])).toEqual(['a', 'b']);
  });
});
