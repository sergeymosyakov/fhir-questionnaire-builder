// Pure helpers for repeating-select dedup (IH-5563).
import { describe, it, expect } from 'vitest';
import { siblingSelectedCodes, filterSiblingSelected, baseRowId } from '../js/nodes/choice-helpers.js';

describe('baseRowId', () => {
  it('strips the $$n row-address suffix', () => {
    expect(baseRowId('1.code')).toBe('1.code');
    expect(baseRowId('1.code$$2')).toBe('1.code');
    expect(baseRowId('1.code$$10')).toBe('1.code');
  });
});

describe('siblingSelectedCodes', () => {
  const store = { '1.c$$n': 2, '1.c': 'A', '1.c$$1': 'B', '1.c$$2': 'C' };
  const getValue = id => store[id];

  it('collects codes from the other rows, excluding own row', () => {
    expect([...siblingSelectedCodes('1.c', '1.c', getValue)].sort()).toEqual(['B', 'C']);
    expect([...siblingSelectedCodes('1.c', '1.c$$1', getValue)].sort()).toEqual(['A', 'C']);
  });

  it('ignores empty rows', () => {
    const g = id => ({ 'q$$n': 1, q: 'A', 'q$$1': '' }[id]);
    expect([...siblingSelectedCodes('q', 'q', g)]).toEqual([]);
  });

  it('returns an empty set when the item is not repeating (n=0)', () => {
    const g = id => ({ q: 'A' }[id]);
    expect(siblingSelectedCodes('q', 'q', g).size).toBe(0);
  });
});

describe('filterSiblingSelected', () => {
  const opts = [{ code: 'A', display: 'a' }, { code: 'B', display: 'b' }, { code: 'C', display: 'c' }];

  it('removes sibling-selected codes but keeps this row own value', () => {
    expect(filterSiblingSelected(opts, 'A', new Set(['B'])).map(o => o.code)).toEqual(['A', 'C']);
  });

  it('keeps own value even if it is also in the sibling set', () => {
    expect(filterSiblingSelected(opts, 'B', new Set(['B'])).map(o => o.code)).toEqual(['A', 'B', 'C']);
  });

  it('returns the same array when the sibling set is empty', () => {
    expect(filterSiblingSelected(opts, '', new Set())).toBe(opts);
  });
});
