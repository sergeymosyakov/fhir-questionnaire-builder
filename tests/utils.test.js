import { describe, it, expect } from 'vitest';
import {
  escAttr,
  findAndRemove,
  isDescendant,
  findAncestorGroupIds,
  parseOption,
  parseOptions,
  rawOptsToPairs,
  highlightJson,
  highlightJsonWithSearch,
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

// ── highlightJson ─────────────────────────────────────────────────────────────
describe('highlightJson', () => {
  it('wraps object keys in jv-k span', () => {
    const out = highlightJson('{"foo": 1}');
    expect(out).toContain('<span class="jv-k">"foo":</span>');
  });

  it('wraps string values in jv-s span', () => {
    const out = highlightJson('{"x": "hello"}');
    expect(out).toContain('<span class="jv-s">"hello"</span>');
  });

  it('wraps numbers in jv-n span', () => {
    const out = highlightJson('{"n": 42}');
    expect(out).toContain('<span class="jv-n">42</span>');
  });

  it('wraps true/false in jv-b span', () => {
    const out = highlightJson('{"a": true, "b": false}');
    expect(out).toContain('<span class="jv-b">true</span>');
    expect(out).toContain('<span class="jv-b">false</span>');
  });

  it('wraps null in jv-null span', () => {
    const out = highlightJson('{"x": null}');
    expect(out).toContain('<span class="jv-null">null</span>');
  });

  it('escapes HTML special chars in values', () => {
    const out = highlightJson('{"x": "<b>bold</b>"}');
    expect(out).toContain('&lt;b&gt;');
    expect(out).not.toContain('<b>');
  });

  it('escapes ampersand in values', () => {
    const out = highlightJson('{"x": "a&b"}');
    expect(out).toContain('&amp;');
  });
});

// ── highlightJsonWithSearch ───────────────────────────────────────────────────
describe('highlightJsonWithSearch', () => {
  it('returns count 0 and base html when query is empty', () => {
    const base = highlightJson('{"a": 1}');
    const { html, count } = highlightJsonWithSearch('{"a": 1}', '');
    expect(count).toBe(0);
    expect(html).toBe(base);
  });

  it('returns count 0 when no match found', () => {
    const { count } = highlightJsonWithSearch('{"a": 1}', 'zzz');
    expect(count).toBe(0);
  });

  it('wraps a match inside a string value in <mark>', () => {
    const { html, count } = highlightJsonWithSearch('{"x": "hello"}', 'hello');
    expect(count).toBe(1);
    expect(html).toContain('<mark class="search-match">hello</mark>');
  });

  it('wraps a match inside an object key in <mark>', () => {
    const { html, count } = highlightJsonWithSearch('{"linkId": "q1"}', 'linkId');
    expect(count).toBe(1);
    expect(html).toContain('<mark class="search-match">linkId</mark>');
  });

  it('is case-insensitive', () => {
    const { count } = highlightJsonWithSearch('{"x": "Hello"}', 'hello');
    expect(count).toBe(1);
  });

  it('counts multiple occurrences', () => {
    const { count } = highlightJsonWithSearch('{"a": "foo", "b": "foo"}', 'foo');
    expect(count).toBe(2);
  });

  it('does not produce overlapping marks', () => {
    const { html } = highlightJsonWithSearch('"aaa"', 'a');
    // each 'a' should be wrapped separately
    expect(html.match(/<mark/g)).toHaveLength(3);
  });

  it('preserves syntax highlighting spans alongside marks', () => {
    const { html } = highlightJsonWithSearch('{"x": "val"}', 'val');
    expect(html).toContain('jv-s');
    expect(html).toContain('search-match');
  });

  it('HTML-escapes special chars even when marked', () => {
    const { html } = highlightJsonWithSearch('{"x": "<em>"}', '<em>');
    expect(html).not.toContain('<em>');
    expect(html).toContain('&lt;em&gt;');
  });
});

// ── rawOptsToPairs ────────────────────────────────────────────────────────────
describe('rawOptsToPairs', () => {
  it('converts valueCoding to {code, display}', () => {
    expect(rawOptsToPairs([{ valueCoding: { code: 'a', display: 'Alpha' } }]))
      .toEqual([{ code: 'a', display: 'Alpha' }]);
  });

  it('uses display as code when code absent', () => {
    expect(rawOptsToPairs([{ valueCoding: { display: 'Only display' } }]))
      .toEqual([{ code: 'Only display', display: 'Only display' }]);
  });

  it('converts valueString', () => {
    expect(rawOptsToPairs([{ valueString: 'Email' }]))
      .toEqual([{ code: 'Email', display: 'Email' }]);
  });

  it('converts valueInteger', () => {
    expect(rawOptsToPairs([{ valueInteger: 3 }]))
      .toEqual([{ code: '3', display: '3' }]);
  });

  it('converts valueDate', () => {
    expect(rawOptsToPairs([{ valueDate: '2026-06-01' }]))
      .toEqual([{ code: '2026-06-01', display: '2026-06-01' }]);
  });

  it('converts valueTime', () => {
    expect(rawOptsToPairs([{ valueTime: '09:00:00' }]))
      .toEqual([{ code: '09:00:00', display: '09:00:00' }]);
  });

  it('converts valueReference object with display', () => {
    expect(rawOptsToPairs([{ valueReference: { reference: 'Practitioner/p1', display: 'Dr. A' } }]))
      .toEqual([{ code: 'Practitioner/p1', display: 'Dr. A' }]);
  });

  it('converts valueReference object without display', () => {
    expect(rawOptsToPairs([{ valueReference: { reference: 'Practitioner/p1' } }]))
      .toEqual([{ code: 'Practitioner/p1', display: 'Practitioner/p1' }]);
  });

  it('filters out unknown option shapes', () => {
    expect(rawOptsToPairs([{}])).toEqual([]);
  });

  it('handles null/undefined input', () => {
    expect(rawOptsToPairs(null)).toEqual([]);
    expect(rawOptsToPairs(undefined)).toEqual([]);
  });

  it('handles mixed types in one array', () => {
    const result = rawOptsToPairs([
      { valueCoding: { code: 'c1', display: 'Coding' } },
      { valueString: 'str' },
      { valueInteger: 5 },
    ]);
    expect(result).toEqual([
      { code: 'c1', display: 'Coding' },
      { code: 'str', display: 'str' },
      { code: '5', display: '5' },
    ]);
  });
});
