// Contained ValueSets: expansion, nested sets and exclusions are used; system/filter/external includes are reported.
import { describe, it, expect } from 'vitest';
import { analyseContainedValueSet } from '../js/fhir/import-helpers.js';
import { flattenExpansion } from '../js/fhir/expansion.js';

const SYS = 'http://example.org/s';
const vs = (id, body) => ({ resourceType: 'ValueSet', id, status: 'active', ...body });
const codes = r => r.options.map(o => o.valueCoding.code);

describe('analyseContainedValueSet', () => {
  it('lists concepts and drops excluded ones', () => {
    const r = analyseContainedValueSet([vs('a', { compose: {
      include: [{ system: SYS, concept: [{ code: 'x' }, { code: 'y' }, { code: 'z' }] }],
      exclude: [{ system: SYS, concept: [{ code: 'y' }] }] } })], '#a');
    expect(codes(r)).toEqual(['x', 'z']);
    expect(r.unsupported).toEqual([]);
  });
  it('follows a nested contained value set', () => {
    const r = analyseContainedValueSet([
      vs('a', { compose: { include: [{ valueSet: ['#b'] }, { system: SYS, concept: [{ code: 'own' }] }] } }),
      vs('b', { compose: { include: [{ system: SYS, concept: [{ code: 'inner' }] }] } }),
    ], '#a');
    expect(codes(r)).toEqual(['inner', 'own']);
  });
  it('does not loop on a value set that includes itself', () => {
    const r = analyseContainedValueSet([vs('a', { compose: { include: [{ valueSet: ['#a'] }] } })], '#a');
    expect(r.options).toEqual([]);
  });
  it('uses an existing expansion, including nested entries', () => {
    const r = analyseContainedValueSet([vs('a', { expansion: { contains: [{ system: SYS, code: 'p', contains: [{ system: SYS, code: 'c' }] }] } })], '#a');
    expect(codes(r)).toEqual(['p', 'c']);
  });
  it.each([
    [{ include: [{ system: SYS }] }, /every concept of/],
    [{ include: [{ system: SYS, filter: [{ property: 'p', op: '=', value: 'v' }] }] }, /filters the concepts/],
    [{ include: [{ valueSet: ['http://example.org/vs/ext'] }] }, /external value set/],
  ])('reports %j as unsupported', (compose, message) => {
    const r = analyseContainedValueSet([vs('a', { compose })], '#a');
    expect(r.options).toEqual([]);
    expect(r.unsupported.join(' ')).toMatch(message);
  });
});

describe('flattenExpansion', () => {
  it('flattens, skips abstract and code-less entries, and reports truncation', () => {
    const r = flattenExpansion({ total: 10, contains: [
      { code: 'a', display: 'A' },
      { display: 'heading', contains: [{ code: 'b' }] },
      { code: 'c', abstract: true },
    ] });
    expect(r.options.map(o => o.code)).toEqual(['a', 'b']);
    expect(r.truncated).toBe(true);
  });
  it('is not truncated when the total matches', () => {
    expect(flattenExpansion({ total: 1, contains: [{ code: 'a' }] }).truncated).toBe(false);
  });
});

describe('analyseContainedValueSet — edge cases', () => {
  it('reports exclusions it cannot apply', () => {
    const r = analyseContainedValueSet([vs('a', { compose: { include: [{ system: SYS, concept: [{ code: 'x' }] }], exclude: [{ valueSet: ['http://example.org/vs/ext'] }] } })], '#a');
    expect(r.unsupported.join(' ')).toMatch(/excludes concepts/);
  });
  it('reports an include that combines a system with a value set', () => {
    const r = analyseContainedValueSet([vs('a', { compose: { include: [{ system: SYS, valueSet: ['#b'] }] } }), vs('b', { compose: { include: [{ system: SYS, concept: [{ code: 'x' }] }] } })], '#a');
    expect(r.unsupported.join(' ')).toMatch(/combines/);
  });
  it('keeps a code that two branches share (diamond) and lists it once', () => {
    const r = analyseContainedValueSet([
      vs('a', { compose: { include: [{ valueSet: ['#b'] }, { valueSet: ['#c'] }] } }),
      vs('b', { compose: { include: [{ valueSet: ['#d'] }] } }),
      vs('c', { compose: { include: [{ valueSet: ['#d'] }] } }),
      vs('d', { compose: { include: [{ system: SYS, concept: [{ code: 'x' }] }] } }),
    ], '#a');
    expect(codes(r)).toEqual(['x']);
  });
  it('reports a contained expansion that was cut off', () => {
    const r = analyseContainedValueSet([vs('a', { expansion: { total: 50, contains: [{ system: SYS, code: 'p' }] } })], '#a');
    expect(r.unsupported.join(' ')).toMatch(/cut off at 1 of 50/);
  });
  it('lists duplicate codes once', () => {
    const r = analyseContainedValueSet([vs('a', { compose: { include: [{ system: SYS, concept: [{ code: 'x' }] }, { system: SYS, concept: [{ code: 'x' }] }] } })], '#a');
    expect(codes(r)).toEqual(['x']);
  });
});

describe('validateTree — stale flags', () => {
  it('does not warn about a contained value set once the item no longer uses one', async () => {
    globalThis.window = { fhirpath: { compile: () => {} } };
    const { validateTree } = await import('../js/fhir/validate.js');
    const node = { id: 'q', type: 'item', title: 'Q', itemType: 'select', _rawAnswerOptions: [{ valueCoding: { code: 'a', display: 'A' } }], _containedVsUnsupported: ['filters the concepts of x'] };
    expect(validateTree([node]).some(i => /cannot expand itself/.test(i.message))).toBe(false);
  });
});

describe('analyseContainedValueSet — reported gaps', () => {
  it('reports a reference to a value set that is not contained, and a self-include', () => {
    expect(analyseContainedValueSet([vs('a', { compose: { include: [{ valueSet: ['#missing'] }] } })], '#a').unsupported.join(' ')).toMatch(/not contained/);
    expect(analyseContainedValueSet([vs('a', { compose: { include: [{ valueSet: ['#a'] }] } })], '#a').unsupported.join(' ')).toMatch(/includes itself/);
  });
  it('reports an include of several value sets as an intersection', () => {
    const r = analyseContainedValueSet([vs('a', { compose: { include: [{ valueSet: ['#b', '#c'] }] } }), vs('b', {}), vs('c', {})], '#a');
    expect(r.unsupported.join(' ')).toMatch(/intersects/);
  });
  it('does not drop listed concepts of an exclude that also names a value set', () => {
    const r = analyseContainedValueSet([vs('a', { compose: { include: [{ system: SYS, concept: [{ code: 'x' }] }], exclude: [{ system: SYS, concept: [{ code: 'x' }], valueSet: ['http://example.org/vs/ext'] }] } })], '#a');
    expect(codes(r)).toEqual(['x']);
  });
  it('keeps an expansion entry without a display unchanged', () => {
    const r = analyseContainedValueSet([vs('a', { expansion: { contains: [{ system: SYS, code: 'p' }] } })], '#a');
    expect(r.options[0].valueCoding).toEqual({ system: SYS, code: 'p' });
  });
});
