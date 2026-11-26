import { describe, test, expect } from 'vitest';
import { buildScenarioBundle, hasScenarios } from '../js/fhir/check/scenario-bundle.js';

const qr = (n) => ({ resourceType: 'QuestionnaireResponse', questionnaire: 'q', status: 'in-progress', item: [{ linkId: 'total', answer: [{ valueInteger: n }] }] });

describe('scenario bundle', () => {
  const report = { trials: [{ qr: qr(1) }, { qr: null }, { qr: qr(3) }] };

  test('a batch Bundle with one POST of a completed response per scenario that has one', () => {
    const b = buildScenarioBundle(report);
    expect(b).toMatchObject({ resourceType: 'Bundle', type: 'batch' });
    expect(b.entry).toHaveLength(2);
    expect(b.entry.map((e) => e.request)).toEqual(Array(2).fill({ method: 'POST', url: 'QuestionnaireResponse' }));
    expect(b.entry.map((e) => e.resource.status)).toEqual(['completed', 'completed']);
    expect(b.entry[1].resource.item[0].answer[0].valueInteger).toBe(3);
    expect(new Set(b.entry.map((e) => e.fullUrl)).size).toBe(2);
    expect(b.entry.every((e) => !Number.isNaN(Date.parse(e.resource.authored)))).toBe(true);
  });

  test('a bare id becomes a relative Questionnaire reference; a canonical url stays', () => {
    const ref = (questionnaire) => buildScenarioBundle({ trials: [{ qr: { ...qr(1), questionnaire } }] }).entry[0].resource.questionnaire;
    expect(ref('logic-builder-export')).toBe('Questionnaire/logic-builder-export');
    expect(ref('http://example.org/Questionnaire/phq9')).toBe('http://example.org/Questionnaire/phq9');
    expect(ref('Questionnaire/abc')).toBe('Questionnaire/abc');
  });

  test('does not touch the report it was built from', () => {
    buildScenarioBundle(report);
    expect(report.trials[0].qr.status).toBe('in-progress');
  });

  test('hasScenarios is false when no response was kept', () => {
    expect(hasScenarios({ trials: [{ qr: null }] })).toBe(false);
    expect(hasScenarios(report)).toBe(true);
  });
});
