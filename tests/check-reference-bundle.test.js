import { describe, test, expect } from 'vitest';
import { buildReferenceBundle, hasReference, REFERENCE_TAG } from '../js/fhir/check/reference-bundle.js';

const questionnaire = { resourceType: 'Questionnaire', id: 'phq9', status: 'active', item: [] };
const qr = (n) => ({ resourceType: 'QuestionnaireResponse', questionnaire: 'phq9', status: 'in-progress', item: [{ linkId: 'total', answer: [{ valueInteger: n }] }] });

describe('reference bundle', () => {
  const report = { questionnaire, trials: [{ qr: qr(1) }, { qr: null }, { qr: qr(3) }] };

  test('a collection: the Questionnaire first, then one completed response per scenario that has one', () => {
    const b = buildReferenceBundle(report);
    expect(b).toMatchObject({ resourceType: 'Bundle', type: 'collection' });
    expect(b.entry).toHaveLength(3);
    expect(b.entry[0].resource).toEqual(questionnaire);
    expect(b.entry.slice(1).map((e) => e.resource.status)).toEqual(['completed', 'completed']);
    expect(b.entry[2].resource.item[0].answer[0].valueInteger).toBe(3);
    expect(new Set(b.entry.map((e) => e.fullUrl)).size).toBe(3);
  });

  test('nothing in it asks a server to do anything', () => {
    expect(buildReferenceBundle(report).entry.some((e) => 'request' in e)).toBe(false);
  });

  test('says what it is, and when it was made', () => {
    const b = buildReferenceBundle(report);
    expect(b.meta.tag).toEqual([REFERENCE_TAG]);
    expect(b.identifier.value).toBeTruthy();
    expect(Number.isNaN(Date.parse(b.timestamp))).toBe(false);
    expect(b.entry.slice(1).every((e) => e.resource.authored === b.timestamp)).toBe(true);
  });

  test('a bare id becomes a relative Questionnaire reference; a canonical url stays', () => {
    const ref = (q) => buildReferenceBundle({ questionnaire, trials: [{ qr: { ...qr(1), questionnaire: q } }] }).entry[1].resource.questionnaire;
    expect(ref('logic-builder-export')).toBe('Questionnaire/logic-builder-export');
    expect(ref('http://example.org/Questionnaire/phq9')).toBe('http://example.org/Questionnaire/phq9');
    expect(ref('Questionnaire/abc')).toBe('Questionnaire/abc');
  });

  test('does not touch the report it was built from', () => {
    buildReferenceBundle(report);
    expect(report.trials[0].qr.status).toBe('in-progress');
  });

  test('hasReference needs the Questionnaire and at least one response', () => {
    expect(hasReference(report)).toBe(true);
    expect(hasReference({ questionnaire: null, trials: report.trials })).toBe(false);
    expect(hasReference({ questionnaire, trials: [{ qr: null }] })).toBe(false);
  });
});
