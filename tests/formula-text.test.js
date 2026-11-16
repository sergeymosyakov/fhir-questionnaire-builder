import { describe, it, expect } from 'vitest';
import { formulaText } from '../js/fhir/expr-builder/formula-text.js';
import { parseExpression } from '../js/fhir/expr-builder/parse.js';
import { loadFhirpath } from './helpers/fhirpath-node.js';

const fp = loadFhirpath();
const ref = (id) => `%resource.item.where(linkId='g').item.where(linkId='${id}').answer.valueDecimal`;
const labels = { w: 'Weight (kg)', h: 'Height (cm)' };
const text = (expr) => formulaText(parseExpression(expr, fp), (id) => labels[id] ?? id);

describe('formulaText', () => {
  it('writes questions by their title and keeps the grouping that changes the meaning', () => {
    expect(text(`${ref('w')} / ((${ref('h')} / 100) * (${ref('h')} / 100))`)).toBe('Weight (kg) \u00f7 ((Height (cm) \u00f7 100) \u00d7 (Height (cm) \u00f7 100))');
    expect(text(`(${ref('w')} + ${ref('h')}) * 2`)).toBe('(Weight (kg) + Height (cm)) \u00d7 2');
  });

  it('shows rounding, variables and aggregates', () => {
    expect(text(`(${ref('w')} / 2).round(1)`)).toBe('round(Weight (kg) \u00f7 2, 1)');
    expect(text('%age * 2')).toBe('%age \u00d7 2');
  });

  it('falls back to the expression itself for anything it does not describe, never to a guess', () => {
    expect(text(`iif(${ref('w')} > 1, 1, 2)`)).toContain('iif(');
  });
});
