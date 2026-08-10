import { describe, it, expect } from 'vitest';
import { parseExpression } from '../js/fhir/expr-builder/parse.js';
import { emit } from '../js/fhir/expr-builder/emit.js';
import { setLiteral, pipeline } from '../js/fhir/expr-builder/model.js';
import { loadFhirpath } from './helpers/fhirpath-node.js';

const fp = loadFhirpath();
const parse = (s) => parseExpression(s, fp);

describe('setLiteral / pipeline — emit', () => {
  it('emits a code set as a parenthesized union', () => {
    expect(emit(setLiteral(['43633', '43644']))).toBe("('43633'|'43644')");
  });

  it('emits source + intersect + join', () => {
    const b = pipeline(
      { linkId: '1.SelectedProcedureCodes', accessor: 'valueCoding.code' },
      [{ op: 'intersect', set: setLiteral(['43633', '43644', '43770', '43775']) }],
      { fn: 'join', sep: ', ' },
    );
    expect(emit(b)).toBe(
      "%resource.repeat(item).where(linkId='1.SelectedProcedureCodes').answer.valueCoding.code.intersect(('43633'|'43644'|'43770'|'43775')).join(', ')",
    );
  });

  it('emits distinct and exclude filters', () => {
    const b = pipeline(
      { linkId: 'x', accessor: 'valueCoding.code' },
      [{ op: 'exclude', set: setLiteral(['a']) }, { op: 'distinct' }],
      { fn: 'count' },
    );
    expect(emit(b)).toBe(
      "%resource.repeat(item).where(linkId='x').answer.valueCoding.code.exclude(('a')).distinct().count()",
    );
  });

  it('emits a bare answer accessor and no reduce', () => {
    const b = pipeline({ linkId: 'x', accessor: '' }, [], null);
    expect(emit(b)).toBe("%resource.repeat(item).where(linkId='x').answer");
  });
});

describe('pipeline — parse', () => {
  it('reads the selected-procedure-codes example', () => {
    expect(parse(
      "%resource.repeat(item).where(linkId='1.SelectedProcedureCodes').answer.valueCoding.code.intersect(('43633'|'43644'|'43770'|'43775')).join(', ')",
    )).toEqual(pipeline(
      { linkId: '1.SelectedProcedureCodes', accessor: 'valueCoding.code' },
      [{ op: 'intersect', set: setLiteral(['43633', '43644', '43770', '43775']) }],
      { fn: 'join', sep: ', ' },
    ));
  });

  it('reads exclude + distinct + count', () => {
    expect(parse(
      "%resource.repeat(item).where(linkId='x').answer.valueCoding.code.exclude(('a'|'b')).distinct().count()",
    )).toEqual(pipeline(
      { linkId: 'x', accessor: 'valueCoding.code' },
      [{ op: 'exclude', set: setLiteral(['a', 'b']) }, { op: 'distinct' }],
      { fn: 'count' },
    ));
  });

  it('reads a reducer without filters', () => {
    expect(parse(
      "%resource.repeat(item).where(linkId='x').answer.valueString.first()",
    )).toEqual(pipeline({ linkId: 'x', accessor: 'valueString' }, [], { fn: 'first' }));
  });

  it('reads exists as a boolean reducer', () => {
    expect(parse(
      "%resource.repeat(item).where(linkId='x').answer.valueCoding.code.intersect(('a')).exists()",
    )).toEqual(pipeline(
      { linkId: 'x', accessor: 'valueCoding.code' },
      [{ op: 'intersect', set: setLiteral(['a']) }],
      { fn: 'exists' },
    ));
  });
});

describe('pipeline — round-trip parse(emit(b)) === b', () => {
  const cases = [
    pipeline(
      { linkId: '1.SelectedProcedureCodes', accessor: 'valueCoding.code' },
      [{ op: 'intersect', set: setLiteral(['43633', '43644', '43770', '43775']) }],
      { fn: 'join', sep: ', ' },
    ),
    pipeline({ linkId: 'x', accessor: 'valueString' }, [], { fn: 'last' }),
    pipeline(
      { linkId: 'y', accessor: 'valueCoding.code' },
      [{ op: 'exclude', set: setLiteral(['a', 'b']) }, { op: 'distinct' }],
      { fn: 'count' },
    ),
    pipeline({ linkId: 'z', accessor: 'valueCoding.code' }, [{ op: 'intersect', set: setLiteral(['1']) }], { fn: 'exists' }),
  ];
  cases.forEach((b, idx) => {
    it(`round-trips case ${idx}`, () => {
      expect(parse(emit(b))).toEqual(b);
    });
  });
});

describe('pipeline — falls back to raw when not a modeled shape', () => {
  it('non-repeat item path is not a pipeline (stays itemRef/raw)', () => {
    const b = parse("%resource.item.where(linkId='x').answer.valueCoding.code");
    expect(b.kind).not.toBe('pipeline');
  });

  it('unknown trailing function collapses to raw', () => {
    const src = "%resource.repeat(item).where(linkId='x').answer.valueCoding.code.frobnicate()";
    expect(parse(src)).toEqual({ kind: 'raw', text: src });
  });
});

describe('pipeline — additional shapes', () => {
  it('emits and parses an empty join separator', () => {
    const b = pipeline({ linkId: 'x', accessor: 'valueCoding.code' }, [], { fn: 'join', sep: '' });
    expect(emit(b)).toBe("%resource.repeat(item).where(linkId='x').answer.valueCoding.code.join('')");
    expect(parse(emit(b))).toEqual(b);
  });

  it('round-trips a string (valueString) source with first', () => {
    const b = pipeline({ linkId: 'notes', accessor: 'valueString' }, [], { fn: 'first' });
    expect(emit(b)).toBe("%resource.repeat(item).where(linkId='notes').answer.valueString.first()");
    expect(parse(emit(b))).toEqual(b);
  });

  it('round-trips intersect + exclude + distinct chained', () => {
    const b = pipeline(
      { linkId: 'x', accessor: 'valueCoding.code' },
      [
        { op: 'intersect', set: setLiteral(['a', 'b']) },
        { op: 'exclude', set: setLiteral(['b']) },
        { op: 'distinct' },
      ],
      { fn: 'join', sep: ' / ' },
    );
    expect(emit(b)).toBe(
      "%resource.repeat(item).where(linkId='x').answer.valueCoding.code.intersect(('a'|'b')).exclude(('b')).distinct().join(' / ')",
    );
    expect(parse(emit(b))).toEqual(b);
  });

  it('parses a bare source with no filters and no reduce back to a list', () => {
    expect(parse("%resource.repeat(item).where(linkId='x').answer.valueCoding.code"))
      .toEqual(pipeline({ linkId: 'x', accessor: 'valueCoding.code' }, [], null));
  });
});

describe('pipeline — value comparison filter', () => {
  it('emits a numeric where($this > n)', () => {
    const b = pipeline({ linkId: 'x', accessor: 'valueInteger' }, [{ op: 'compare', cmp: '>', value: 5, dataType: 'number' }], { fn: 'count' });
    expect(emit(b)).toBe("%resource.repeat(item).where(linkId='x').answer.valueInteger.where($this > 5).count()");
  });

  it('emits a string where($this = \u2018A\u2019)', () => {
    const b = pipeline({ linkId: 'x', accessor: 'valueString' }, [{ op: 'compare', cmp: '=', value: 'A', dataType: 'string' }], null);
    expect(emit(b)).toBe("%resource.repeat(item).where(linkId='x').answer.valueString.where($this = 'A')");
  });

  it('round-trips numeric comparisons for every operator', () => {
    for (const cmp of ['=', '!=', '>', '<', '>=', '<=']) {
      const b = pipeline({ linkId: 'x', accessor: 'valueDecimal' }, [{ op: 'compare', cmp, value: 2.5, dataType: 'number' }], { fn: 'count' });
      expect(parse(emit(b))).toEqual(b);
    }
  });

  it('round-trips a string comparison', () => {
    const b = pipeline({ linkId: 'x', accessor: 'valueString' }, [{ op: 'compare', cmp: '!=', value: 'draft', dataType: 'string' }], { fn: 'first' });
    expect(parse(emit(b))).toEqual(b);
  });

  it('round-trips a compare mixed with distinct', () => {
    const b = pipeline(
      { linkId: 'x', accessor: 'valueInteger' },
      [{ op: 'compare', cmp: '>=', value: 18, dataType: 'number' }, { op: 'distinct' }],
      { fn: 'join', sep: ', ' },
    );
    expect(parse(emit(b))).toEqual(b);
  });

  it('a where() that is not a $this comparison collapses to raw', () => {
    const src = "%resource.repeat(item).where(linkId='x').answer.valueInteger.where(value > 5)";
    expect(parse(src).kind).toBe('raw');
  });
});

