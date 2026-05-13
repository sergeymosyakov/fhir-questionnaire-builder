import { describe, it, expect } from 'vitest';
import {
  escAttr,
  findAndRemove,
  isDescendant,
  findAncestorGroupIds,
  parseOption,
  parseOptions,
} from '../js/utils.js';

// ── escAttr ───────────────────────────────────────────────────────────────────
describe('escAttr', () => {
  it('escapes ampersands', () => expect(escAttr('a&b')).toBe('a&amp;b'));
  it('escapes quotes', () => expect(escAttr('say "hi"')).toBe('say &quot;hi&quot;'));
  it('handles null/undefined', () => {
    expect(escAttr(null)).toBe('');
    expect(escAttr(undefined)).toBe('');
  });
  it('leaves plain text unchanged', () => expect(escAttr('hello')).toBe('hello'));
});

// ── findAndRemove ─────────────────────────────────────────────────────────────
describe('findAndRemove', () => {
  it('removes a top-level node by id', () => {
    const tree = [{ id: 'a' }, { id: 'b' }];
    findAndRemove('a', tree);
    expect(tree).toEqual([{ id: 'b' }]);
  });

  it('removes a nested node inside a group', () => {
    const tree = [{ id: 'g', type: 'group', children: [{ id: 'child' }] }];
    findAndRemove('child', tree);
    expect(tree[0].children).toEqual([]);
  });

  it('does nothing if id not found', () => {
    const tree = [{ id: 'x' }];
    findAndRemove('missing', tree);
    expect(tree).toEqual([{ id: 'x' }]);
  });
});

// ── isDescendant ──────────────────────────────────────────────────────────────
describe('isDescendant', () => {
  const group = {
    id: 'g',
    type: 'group',
    children: [
      { id: 'child1', type: 'item', children: [] },
      { id: 'sub', type: 'group', children: [{ id: 'grandchild', type: 'item', children: [] }] },
    ],
  };

  it('returns true for direct child', () => expect(isDescendant('child1', group)).toBe(true));
  it('returns true for grandchild', () => expect(isDescendant('grandchild', group)).toBe(true));
  it('returns false for unknown id', () => expect(isDescendant('other', group)).toBe(false));
  it('returns false for the group itself', () => expect(isDescendant('g', group)).toBe(false));
});

// ── findAncestorGroupIds ──────────────────────────────────────────────────────
describe('findAncestorGroupIds', () => {
  const tree = [
    {
      id: 'g1', type: 'group',
      children: [
        { id: 'item1', type: 'item' },
        {
          id: 'g2', type: 'group',
          children: [{ id: 'item2', type: 'item' }],
        },
      ],
    },
  ];

  it('returns empty array for top-level item', () =>
    expect(findAncestorGroupIds('item1', tree)).toEqual(['g1']));

  it('returns full ancestor chain for nested item', () =>
    expect(findAncestorGroupIds('item2', tree)).toEqual(['g1', 'g2']));

  it('returns empty array for root group', () =>
    expect(findAncestorGroupIds('g1', tree)).toEqual([]));

  it('returns null for unknown id', () =>
    expect(findAncestorGroupIds('nope', tree)).toBeNull());
});

// ── parseOption ───────────────────────────────────────────────────────────────
describe('parseOption', () => {
  it('parses code=display format', () =>
    expect(parseOption('la1=Not at all')).toEqual({ code: 'la1', display: 'Not at all' }));

  it('falls back to code=display when no equals sign', () =>
    expect(parseOption('simple')).toEqual({ code: 'simple', display: 'simple' }));

  it('trims whitespace around equals', () =>
    expect(parseOption(' a = b ')).toEqual({ code: 'a', display: 'b' }));
});

// ── parseOptions ──────────────────────────────────────────────────────────────
describe('parseOptions', () => {
  it('parses comma-separated options', () =>
    expect(parseOptions('a=Alpha,b=Beta')).toEqual([
      { code: 'a', display: 'Alpha' },
      { code: 'b', display: 'Beta' },
    ]));

  it('returns empty array for empty string', () =>
    expect(parseOptions('')).toEqual([]));

  it('returns empty array for null/undefined', () => {
    expect(parseOptions(null)).toEqual([]);
    expect(parseOptions(undefined)).toEqual([]);
  });

  it('filters blank tokens', () =>
    expect(parseOptions('a=A,,b=B')).toHaveLength(2));
});
