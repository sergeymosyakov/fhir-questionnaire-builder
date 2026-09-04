// ── Unit tests: describeBlock() — plain-English gloss of expr-builder blocks ──
import { describe, it, expect } from 'vitest';
import {
  itemRef, variable, literal, compare, logic, arith, exists, aggregate, raw,
  setLiteral, pipeline, mathFn, descendants,
} from '../js/fhir/expr-builder/model.js';
import { describeBlock } from '../js/fhir/expr-builder/describe.js';

const linkIdMap = { weight: 'Weight', height: 'Height', smoker: 'Smoker?' };

describe('describeBlock — leaves', () => {
  it('describes an item reference using the linkId map', () => {
    expect(describeBlock(itemRef(['weight'], 'valueDecimal'), linkIdMap)).toBe('the answer to \u00ABWeight\u00BB');
  });

  it('falls back to the raw linkId when it is not in the map', () => {
    expect(describeBlock(itemRef(['ghost'], ''), linkIdMap)).toBe('the answer to \u00ABghost\u00BB');
  });

  it('joins a nested item path with an arrow', () => {
    expect(describeBlock(itemRef(['weight', 'height'], ''), linkIdMap)).toBe('the answer to \u00ABWeight\u00BB \u2192 \u00ABHeight\u00BB');
  });

  it('describes a variable', () => {
    expect(describeBlock(variable('age'))).toBe('the variable %age');
  });

  it('describes literals', () => {
    expect(describeBlock(literal('integer', 5))).toBe('5');
    expect(describeBlock(literal('string', 'yes'))).toBe('"yes"');
    expect(describeBlock(literal('boolean', true))).toBe('Yes');
    expect(describeBlock(literal('boolean', false))).toBe('No');
  });

  it('describes descendants and a set literal', () => {
    expect(describeBlock(descendants())).toBe('all items in the questionnaire');
    expect(describeBlock(setLiteral(['a', 'b']))).toBe('one of: "a", "b"');
  });

  it('returns null for a raw block, a null block, or a non-object', () => {
    expect(describeBlock(raw('some().weird().fhirpath()'))).toBeNull();
    expect(describeBlock(null)).toBeNull();
    expect(describeBlock(undefined)).toBeNull();
  });
});

describe('describeBlock — compare / arith / logic / exists', () => {
  it('describes a comparison in words', () => {
    expect(describeBlock(compare('=', itemRef(['smoker'], 'valueBoolean'), literal('boolean', true)), linkIdMap))
      .toBe('the answer to \u00ABSmoker?\u00BB equals Yes');
    expect(describeBlock(compare('>=', literal('integer', 5), literal('integer', 2)))).toBe('5 is at least 2');
  });

  it('describes arithmetic with spelled-out operators', () => {
    const bmi = arith('/', itemRef(['weight'], 'valueDecimal'), itemRef(['height'], 'valueDecimal'));
    expect(describeBlock(bmi, linkIdMap)).toBe('the answer to \u00ABWeight\u00BB divided by the answer to \u00ABHeight\u00BB');
  });

  it('joins logic operands with AND/OR', () => {
    const a = compare('=', literal('integer', 1), literal('integer', 1));
    const b = compare('=', literal('integer', 2), literal('integer', 2));
    expect(describeBlock(logic('and', [a, b]))).toBe('1 equals 1 AND 2 equals 2');
    expect(describeBlock(logic('or', [a, b]))).toBe('1 equals 1 OR 2 equals 2');
  });

  it('describes exists / negated exists', () => {
    const target = itemRef(['smoker'], '');
    expect(describeBlock(exists(target), linkIdMap)).toBe('the answer to \u00ABSmoker?\u00BB has an answer');
    expect(describeBlock(exists(target, true), linkIdMap)).toBe('the answer to \u00ABSmoker?\u00BB has no answer');
  });

  it('propagates null (unmodeled sub-part) up through compare/arith/logic/exists', () => {
    const withRaw = arith('+', raw('weird()'), literal('integer', 1));
    expect(describeBlock(withRaw)).toBeNull();
    expect(describeBlock(logic('and', [withRaw, literal('boolean', true)]))).toBeNull();
  });
});

describe('describeBlock — aggregate / mathFn', () => {
  it('describes an aggregate over an item reference', () => {
    const agg = aggregate('sum', itemRef(['weight'], 'valueDecimal'));
    expect(describeBlock(agg, linkIdMap)).toBe('the sum of the answer to \u00ABWeight\u00BB');
  });

  it('describes an aggregate over descendants with a filter', () => {
    const agg = aggregate('count', descendants(), compare('=', literal('string', 'x'), literal('string', 'x')));
    expect(describeBlock(agg)).toBe('the count of all items in the questionnaire where "x" equals "x"');
  });

  it('describes math wrapper functions', () => {
    const target = itemRef(['weight'], 'valueDecimal');
    expect(describeBlock(mathFn('round', 1, target), linkIdMap)).toBe('the answer to \u00ABWeight\u00BB rounded to 1 decimal place');
    expect(describeBlock(mathFn('round', null, target), linkIdMap)).toBe('the answer to \u00ABWeight\u00BB rounded');
    expect(describeBlock(mathFn('abs', null, target), linkIdMap)).toBe('the absolute value of the answer to \u00ABWeight\u00BB');
  });
});

describe('describeBlock — pipeline', () => {
  it('describes a plain reduce-less pipeline as the answers to the source item', () => {
    expect(describeBlock(pipeline({ linkId: 'weight' }), linkIdMap)).toBe('the answers to \u00ABWeight\u00BB');
  });

  it('describes filters and a join reduce', () => {
    const p = pipeline({ linkId: 'weight' }, [{ op: 'distinct' }], { fn: 'join', sep: ', ' });
    expect(describeBlock(p, linkIdMap)).toBe('the ", "-joined list of the answers to \u00ABWeight\u00BB, made unique');
  });

  it('describes count/exists/first/last reduces', () => {
    const src = { linkId: 'weight' };
    expect(describeBlock(pipeline(src, [], { fn: 'count' }), linkIdMap)).toBe('the count of the answers to \u00ABWeight\u00BB');
    expect(describeBlock(pipeline(src, [], { fn: 'exists' }), linkIdMap)).toBe('whether the answers to \u00ABWeight\u00BB has any answers');
    expect(describeBlock(pipeline(src, [], { fn: 'first' }), linkIdMap)).toBe('the first of the answers to \u00ABWeight\u00BB');
    expect(describeBlock(pipeline(src, [], { fn: 'last' }), linkIdMap)).toBe('the last of the answers to \u00ABWeight\u00BB');
  });

  it('describes a compare filter', () => {
    const p = pipeline({ linkId: 'weight' }, [{ op: 'compare', cmp: '>', value: 10, dataType: 'number' }]);
    expect(describeBlock(p, linkIdMap)).toBe('the answers to \u00ABWeight\u00BB, kept only where the value is greater than 10');
  });
});
