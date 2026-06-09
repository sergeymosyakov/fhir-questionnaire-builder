// ── Unit tests: REDCap Compatibility Validator ────────────────────────────────
import { describe, it, expect, beforeEach } from 'vitest';

// Guard for document — validator base uses document.addEventListener
globalThis.document = globalThis.document || { addEventListener: () => {} };

import { REDCapCompatValidator } from '../js/fhir/validators/redcap-compat.js';

function makeQ(items) {
  return { resourceType: 'Questionnaire', item: items };
}

function group(linkId, text, children, exts) {
  const g = { linkId, text, type: 'group', item: children };
  if (exts) g.extension = exts;
  return g;
}

function item(linkId, text, type, extra = {}) {
  return { linkId, text, type, ...extra };
}

const RC = 'http://fhir-qb.app/redcap/';

describe('REDCapCompatValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new REDCapCompatValidator();
  });

  it('returns no issues for a simple compatible questionnaire', async () => {
    const q = makeQ([
      group('demo', 'Demographics', [
        item('age', 'Age', 'string'),
        item('gender', 'Gender', 'choice', {
          answerOption: [{ valueCoding: { code: '1', display: 'Male' } }],
        }),
      ]),
    ]);
    const issues = await validator._run(q, [], {});
    expect(issues).toHaveLength(0);
  });

  it('warns on group nested deeper than 2 levels (no rc origin)', async () => {
    const q = makeQ([
      group('form', 'Form', [
        group('section', 'Section', [
          group('deep', 'Deep Group', [
            item('q1', 'Q1', 'string'),
          ]),
        ]),
      ]),
    ]);
    const issues = await validator._run(q, [], {});
    expect(issues.some(i => i.nodeId === 'deep' && i.severity === 'warning')).toBe(true);
  });

  it('does NOT warn on deep group with rc origin (round-trip data)', async () => {
    const q = makeQ([
      group('form', 'Form', [
        group('section', 'Section', [
          group('deep', 'Deep Group', [
            item('q1', 'Q1', 'string'),
          ], [{ url: RC + 'section-header', valueString: 'Deep Group' }]),
        ]),
      ]),
    ]);
    const issues = await validator._run(q, [], {});
    const deepIssues = issues.filter(i => i.nodeId === 'deep');
    expect(deepIssues).toHaveLength(0);
  });

  it('errors on answerValueSet by URL', async () => {
    const q = makeQ([
      group('f', 'F', [
        item('q1', 'Q1', 'choice', { answerValueSet: 'http://example.org/vs' }),
      ]),
    ]);
    const issues = await validator._run(q, [], {});
    expect(issues.some(i => i.nodeId === 'q1' && i.severity === 'error')).toBe(true);
  });

  it('warns on item.code', async () => {
    const q = makeQ([
      group('f', 'F', [
        item('q1', 'Q1', 'string', { code: [{ system: 'http://loinc.org', code: '1234-5' }] }),
      ]),
    ]);
    const issues = await validator._run(q, [], {});
    expect(issues.some(i => i.nodeId === 'q1' && i.severity === 'warning')).toBe(true);
  });

  it('warns on enableWhenExpression (FHIRPath branching)', async () => {
    const q = makeQ([
      group('f', 'F', [
        item('q2', 'Q2', 'string', {
          enableWhenExpression: { language: 'text/fhirpath', expression: "%resource.item.where(linkId='q1').answer.value = true" },
        }),
      ]),
    ]);
    const issues = await validator._run(q, [], {});
    expect(issues.some(i => i.nodeId === 'q2' && i.message.includes('FHIRPath'))).toBe(true);
  });

  it('warns on answerExpression extension', async () => {
    const q = makeQ([
      group('f', 'F', [
        item('q1', 'Q1', 'choice', {
          extension: [{
            url: 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-answerExpression',
            valueExpression: { language: 'text/fhirpath', expression: '%choices' },
          }],
        }),
      ]),
    ]);
    const issues = await validator._run(q, [], {});
    expect(issues.some(i => i.severity === 'warning' && i.message.includes('answerExpression'))).toBe(true);
  });

  it('warns on type reference', async () => {
    const q = makeQ([
      group('f', 'F', [
        item('prac', 'Practitioner', 'reference'),
      ]),
    ]);
    const issues = await validator._run(q, [], {});
    expect(issues.some(i => i.nodeId === 'prac' && i.message.includes('reference'))).toBe(true);
  });

  it('warns on type quantity', async () => {
    const q = makeQ([
      group('f', 'F', [
        item('weight', 'Weight', 'quantity'),
      ]),
    ]);
    const issues = await validator._run(q, [], {});
    expect(issues.some(i => i.nodeId === 'weight' && i.message.includes('quantity'))).toBe(true);
  });

  it('warns on calculatedExpression (non-rc-origin)', async () => {
    const q = makeQ([
      group('f', 'F', [
        item('total', 'Total', 'decimal', {
          extension: [{
            url: 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-calculatedExpression',
            valueExpression: { language: 'text/fhirpath', expression: 'answers()' },
          }],
        }),
      ]),
    ]);
    const issues = await validator._run(q, [], {});
    expect(issues.some(i => i.nodeId === 'total' && i.severity === 'warning')).toBe(true);
  });

  it('returns no issues for null questJson', async () => {
    const issues = await validator._run(null, [], {});
    expect(issues).toHaveLength(0);
  });
});
