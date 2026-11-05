import { describe, it, expect } from 'vitest';
import { templateGroupFrom } from '../js/fhir/templates.js';

describe('templateGroupFrom', () => {
  it('returns the single root group', () => {
    const group = { linkId: 'g', type: 'group', item: [] };
    expect(templateGroupFrom({ resourceType: 'Questionnaire', item: [group] })).toBe(group);
  });

  it.each([
    ['no items', { item: [] }],
    ['missing item', {}],
    ['two root items', { item: [{ type: 'group' }, { type: 'group' }] }],
    ['root is not a group', { item: [{ type: 'string' }] }],
  ])('rejects %s', (_label, q) => {
    expect(() => templateGroupFrom(q)).toThrow('exactly one root group');
  });
});
