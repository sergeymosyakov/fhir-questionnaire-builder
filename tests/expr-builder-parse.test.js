import { describe, it, expect } from 'vitest';
import { parseExpression, astToBlocks, expandAggregateOverSet } from '../js/fhir/expr-builder/parse.js';
import { emit } from '../js/fhir/expr-builder/emit.js';
import {
  itemRef, variable, literal, compare, logic, arith, exists, aggregate, mathFn,
} from '../js/fhir/expr-builder/model.js';
import { loadFhirpath } from './helpers/fhirpath-node.js';

const fp = loadFhirpath();
const parse = (s) => parseExpression(s, fp);

describe('parseExpression — recognised shapes', () => {
  it('reads an item reference into segments + value', () => {
    expect(parse("%resource.item.where(linkId='weight').answer.valueDecimal"))
      .toEqual(itemRef(['weight'], 'valueDecimal'));
  });

  it('reads a nested item path', () => {
    expect(parse("%resource.item.where(linkId='vitals').item.where(linkId='weight').answer.valueDecimal"))
      .toEqual(itemRef(['vitals', 'weight'], 'valueDecimal'));
  });

  it('reads a coded leaf accessor', () => {
    expect(parse("%resource.item.where(linkId='cat').answer.valueCoding.code"))
      .toEqual(itemRef(['cat'], 'valueCoding.code'));
  });

  it('reads a bare variable', () => {
    expect(parse('%totalRisk')).toEqual(variable('totalRisk'));
  });

  it('reads a comparison of item reference and number', () => {
    expect(parse("%resource.item.where(linkId='w').answer.valueDecimal >= 30"))
      .toEqual(compare('>=', itemRef(['w'], 'valueDecimal'), literal('number', 30)));
  });

  it('reads and/or logic', () => {
    const block = parse("%age > 18 and %resource.item.where(linkId='s').answer.valueBoolean");
    expect(block).toEqual(logic('and', [
      compare('>', variable('age'), literal('number', 18)),
      itemRef(['s'], 'valueBoolean'),
    ]));
  });

  it('flattens an N-ary or chain into one logic block', () => {
    const block = parse('%a > 1 or %b > 2 or %c > 3');
    expect(block).toEqual(logic('or', [
      compare('>', variable('a'), literal('number', 1)),
      compare('>', variable('b'), literal('number', 2)),
      compare('>', variable('c'), literal('number', 3)),
    ]));
  });

  it('reads mixed and/or with correct precedence (or of and-groups)', () => {
    // FHIRPath: `and` binds tighter than `or`
    const block = parse('%a and %b or %c');
    expect(block).toEqual(logic('or', [
      logic('and', [variable('a'), variable('b')]),
      variable('c'),
    ]));
  });

  it('reads arithmetic', () => {
    expect(parse('%a + %b')).toEqual(arith('+', variable('a'), variable('b')));
  });

  it('reads parenthesized nested arithmetic (BMI)', () => {
    const bmi = parse("%resource.item.where(linkId='weight').answer.valueDecimal / (%resource.item.where(linkId='height').answer.valueDecimal * %resource.item.where(linkId='height').answer.valueDecimal)");
    expect(bmi).toEqual(arith(
      '/',
      itemRef(['weight'], 'valueDecimal'),
      arith('*', itemRef(['height'], 'valueDecimal'), itemRef(['height'], 'valueDecimal')),
    ));
  });

  it('reads the BMI expression with a trailing .round(n) wrapper', () => {
    const src = "(%resource.item.where(linkId='vitals').item.where(linkId='weight').answer.valueDecimal * 10000 / (%resource.item.where(linkId='vitals').item.where(linkId='height').answer.valueDecimal * %resource.item.where(linkId='vitals').item.where(linkId='height').answer.valueDecimal)).round(1)";
    expect(parse(src)).toEqual(mathFn('round', 1, arith(
      '/',
      arith('*', itemRef(['vitals', 'weight'], 'valueDecimal'), literal('number', 10000)),
      arith('*', itemRef(['vitals', 'height'], 'valueDecimal'), itemRef(['vitals', 'height'], 'valueDecimal')),
    )));
  });

  it('reads round() with no precision arg on a plain path', () => {
    expect(parse("%resource.item.where(linkId='age').answer.valueDecimal.round()"))
      .toEqual(mathFn('round', null, itemRef(['age'], 'valueDecimal')));
  });

  it('reads abs/ceiling/floor/truncate wrapping a plain path', () => {
    expect(parse("%resource.item.where(linkId='delta').answer.valueDecimal.abs()"))
      .toEqual(mathFn('abs', null, itemRef(['delta'], 'valueDecimal')));
    expect(parse("%resource.item.where(linkId='delta').answer.valueDecimal.ceiling()"))
      .toEqual(mathFn('ceiling', null, itemRef(['delta'], 'valueDecimal')));
    expect(parse("%resource.item.where(linkId='delta').answer.valueDecimal.floor()"))
      .toEqual(mathFn('floor', null, itemRef(['delta'], 'valueDecimal')));
    expect(parse("%resource.item.where(linkId='delta').answer.valueDecimal.truncate()"))
      .toEqual(mathFn('truncate', null, itemRef(['delta'], 'valueDecimal')));
  });

  it('reads .round(n) wrapping a simple arithmetic sum', () => {
    expect(parse('(%a + %b).round(2)')).toEqual(mathFn('round', 2, arith('+', variable('a'), variable('b'))));
  });

  it('reads exists / empty', () => {
    expect(parse("%resource.item.where(linkId='q').answer.exists()"))
      .toEqual(exists(itemRef(['q'], ''), false));
    expect(parse("%resource.item.where(linkId='q').answer.empty()"))
      .toEqual(exists(itemRef(['q'], ''), true));
  });

  it('reads a string equality', () => {
    expect(parse("%resource.item.where(linkId='cat').answer.valueCoding.code = 'fever'"))
      .toEqual(compare('=', itemRef(['cat'], 'valueCoding.code'), literal('string', 'fever')));
  });

  it('reads aggregates over a repeating item', () => {
    expect(parse("%resource.item.where(linkId='pain').answer.count()"))
      .toEqual(aggregate('count', itemRef(['pain'], '')));
    expect(parse("%resource.item.where(linkId='pain').answer.valueDecimal.sum()"))
      .toEqual(aggregate('sum', itemRef(['pain'], 'valueDecimal')));
  });

  it('reads answer-nested item paths (.answer.item.where)', () => {
    const src = "%resource.item.where(linkId='g').item.where(linkId='q').answer.item.where(linkId='sub').answer.valueBoolean.exists()";
    expect(parse(src)).toEqual(exists(itemRef(['g', 'q', 'sub'], 'valueBoolean', [false, false, true]), false));
  });
});

describe('expandAggregateOverSet', () => {
  const base = "%resource.item.where(linkId='1').item.where(linkId='1.3').answer.item.where(linkId='1.3.1' or '1.3.2' or '1.3.3')";

  it('expands allTrue over a set into an AND of per-item = true', () => {
    const ex = expandAggregateOverSet(base + '.answer.valueBoolean.allTrue()', fp);
    expect(ex.op).toBe('and');
    expect(ex.leaves).toEqual([
      "%resource.item.where(linkId='1').item.where(linkId='1.3').answer.item.where(linkId='1.3.1').answer.valueBoolean = true",
      "%resource.item.where(linkId='1').item.where(linkId='1.3').answer.item.where(linkId='1.3.2').answer.valueBoolean = true",
      "%resource.item.where(linkId='1').item.where(linkId='1.3').answer.item.where(linkId='1.3.3').answer.valueBoolean = true",
    ]);
  });

  it('expands anyTrue → OR and anyFalse → = false', () => {
    expect(expandAggregateOverSet(base + '.answer.valueBoolean.anyTrue()', fp).op).toBe('or');
    const f = expandAggregateOverSet(base + '.answer.valueBoolean.anyFalse()', fp);
    expect(f.op).toBe('or');
    expect(f.leaves[0]).toContain('= false');
  });

  it('expands the count() >= 1 spelling of "any true" (real-world SDC generator output)', () => {
    const ex = expandAggregateOverSet(base + '.answer.valueBoolean.where($this = true).count() >= 1', fp);
    expect(ex.op).toBe('or');
    expect(ex.leaves).toEqual([
      "%resource.item.where(linkId='1').item.where(linkId='1.3').answer.item.where(linkId='1.3.1').answer.valueBoolean = true",
      "%resource.item.where(linkId='1').item.where(linkId='1.3').answer.item.where(linkId='1.3.2').answer.valueBoolean = true",
      "%resource.item.where(linkId='1').item.where(linkId='1.3').answer.item.where(linkId='1.3.3').answer.valueBoolean = true",
    ]);
  });

  it('expands count() >= 1 with $this = false the same as anyFalse', () => {
    const ex = expandAggregateOverSet(base + '.answer.valueBoolean.where($this = false).count() >= 1', fp);
    expect(ex.op).toBe('or');
    expect(ex.leaves[0]).toContain('= false');
  });

  it('expands the equivalent count() > 0 spelling the same as >= 1', () => {
    const ex = expandAggregateOverSet(base + '.answer.valueBoolean.where($this = true).count() > 0', fp);
    expect(ex.op).toBe('or');
    expect(ex.leaves).toHaveLength(3);
  });

  it('does not recognize count() >= N for N other than 1, or count() > N for N other than 0 (not yet supported)', () => {
    expect(expandAggregateOverSet(base + '.answer.valueBoolean.where($this = true).count() >= 2', fp)).toBeNull();
    expect(expandAggregateOverSet(base + '.answer.valueBoolean.where($this = true).count() > 1', fp)).toBeNull();
  });

  it('expands exists over a set → OR of per-item exists()', () => {
    const ex = expandAggregateOverSet(base + '.answer.exists()', fp);
    expect(ex.op).toBe('or');
    expect(ex.leaves).toHaveLength(3);
    expect(ex.leaves[0]).toBe("%resource.item.where(linkId='1').item.where(linkId='1.3').answer.item.where(linkId='1.3.1').answer.exists()");
  });

  it('expands empty over a set → AND of per-item empty()', () => {
    const ex = expandAggregateOverSet(base + '.answer.empty()', fp);
    expect(ex.op).toBe('and');
    expect(ex.leaves[0]).toContain('.answer.empty()');
  });

  it('expands allFalse over a set → AND of per-item = false', () => {
    const ex = expandAggregateOverSet(base + '.answer.valueBoolean.allFalse()', fp);
    expect(ex.op).toBe('and');
    expect(ex.leaves).toHaveLength(3);
    expect(ex.leaves[0]).toContain('= false');
  });

  it('returns null for a single-item where or a non-aggregate', () => {
    expect(expandAggregateOverSet("%resource.item.where(linkId='a').answer.valueBoolean.allTrue()", fp)).toBeNull();
    expect(expandAggregateOverSet("%resource.item.where(linkId='a').answer.exists()", fp)).toBeNull();
  });
});

describe('parseExpression — raw fallback', () => {
  it('falls back to raw for unmodeled functions', () => {
    const b = parse("%resource.descendants().where(linkId='x').answer.count()");
    expect(b.kind).toBe('raw');
    expect(b.text).toBe("%resource.descendants().where(linkId='x').answer.count()");
  });

  it('falls back to raw for an unmodeled term', () => {
    const b = parse('Patient.name.given.first()');
    expect(b.kind).toBe('raw');
  });

  it('returns null for empty input', () => {
    expect(parse('')).toBeNull();
    expect(parse('   ')).toBeNull();
  });
});

describe('round-trip: parse(emit(block)) === block', () => {
  const blocks = [
    itemRef(['weight'], 'valueDecimal'),
    itemRef(['vitals', 'weight'], 'valueDecimal'),
    itemRef(['cat'], 'valueCoding.code'),
    variable('totalRisk'),
    compare('>=', itemRef(['w'], 'valueDecimal'), literal('number', 30)),
    compare('=', itemRef(['cat'], 'valueCoding.code'), literal('string', 'fever')),
    arith('+', variable('a'), variable('b')),
    arith('/', itemRef(['weight'], 'valueDecimal'), arith('*', itemRef(['height'], 'valueDecimal'), itemRef(['height'], 'valueDecimal'))),
    arith('*', arith('/', variable('a'), variable('b')), variable('c')),
    logic('and', [
      compare('>', variable('age'), literal('number', 18)),
      itemRef(['s'], 'valueBoolean'),
    ]),
    exists(itemRef(['q'], ''), false),
    exists(itemRef(['q'], ''), true),
    aggregate('count', itemRef(['pain'], '')),
    aggregate('sum', itemRef(['pain'], 'valueDecimal')),
    exists(itemRef(['g', 'q', 'sub'], 'valueBoolean', [false, false, true]), false),
    mathFn('round', 1, arith('/', itemRef(['weight'], 'valueDecimal'), arith('*', itemRef(['height'], 'valueDecimal'), itemRef(['height'], 'valueDecimal')))),
    mathFn('round', null, itemRef(['age'], 'valueDecimal')),
    mathFn('abs', null, itemRef(['delta'], 'valueDecimal')),
  ];

  it.each(blocks.map((b) => [emit(b), b]))('%s', (str, block) => {
    expect(parse(str)).toEqual(block);
  });
});

describe('astToBlocks is pure over a CST', () => {
  it('maps a pre-parsed CST without the fp wrapper', () => {
    expect(astToBlocks(fp.parse('%x'))).toEqual(variable('x'));
  });
});
