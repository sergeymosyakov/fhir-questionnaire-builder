import { describe, it, expect } from 'vitest';
import {
  itemRef, variable, literal, compare, logic, arith, exists, aggregate, raw,
} from '../js/fhir/expr-builder/model.js';
import { emit } from '../js/fhir/expr-builder/emit.js';
import { valueAccessor, hasAnswer } from '../js/fhir/expr-builder/value-paths.js';

describe('value-paths', () => {
  it('maps scalar types to their value field', () => {
    expect(valueAccessor('decimal')).toBe('valueDecimal');
    expect(valueAccessor('integer')).toBe('valueInteger');
    expect(valueAccessor('text')).toBe('valueString');
    expect(valueAccessor('boolean')).toBe('valueBoolean');
    expect(valueAccessor('checkbox')).toBe('valueBoolean');
    expect(valueAccessor('date')).toBe('valueDate');
  });

  it('drills coded/quantity/reference to a comparable leaf', () => {
    expect(valueAccessor('select')).toBe('valueCoding.code');
    expect(valueAccessor('radio')).toBe('valueCoding.code');
    expect(valueAccessor('quantity')).toBe('valueQuantity.value');
    expect(valueAccessor('reference')).toBe('valueReference.reference');
  });

  it('can stop before the leaf', () => {
    expect(valueAccessor('select', { leaf: false })).toBe('valueCoding');
    expect(valueAccessor('quantity', { leaf: false })).toBe('valueQuantity');
  });

  it('reports display as answerless', () => {
    expect(hasAnswer('display')).toBe(false);
    expect(valueAccessor('display')).toBeNull();
    expect(hasAnswer('decimal')).toBe(true);
  });
});

describe('emit', () => {
  it('emits an item reference with the exact nested path', () => {
    expect(emit(itemRef(['weight'], 'valueDecimal')))
      .toBe("%resource.item.where(linkId='weight').answer.valueDecimal");
    expect(emit(itemRef(['vitals', 'weight'], 'valueDecimal')))
      .toBe("%resource.item.where(linkId='vitals').item.where(linkId='weight').answer.valueDecimal");
  });

  it('emits a coded leaf accessor', () => {
    expect(emit(itemRef(['cat'], 'valueCoding.code')))
      .toBe("%resource.item.where(linkId='cat').answer.valueCoding.code");
  });

  it('emits variables and literals', () => {
    expect(emit(variable('age'))).toBe('%age');
    expect(emit(literal('number', 30))).toBe('30');
    expect(emit(literal('boolean', true))).toBe('true');
    expect(emit(literal('string', 'fever'))).toBe("'fever'");
  });

  it('emits comparisons and arithmetic', () => {
    expect(emit(compare('>=', itemRef(['w'], 'valueDecimal'), literal('number', 30))))
      .toBe("%resource.item.where(linkId='w').answer.valueDecimal >= 30");
    expect(emit(arith('+', variable('a'), variable('b')))).toBe('%a + %b');
  });

  it('parenthesizes nested arithmetic to preserve grouping', () => {
    // weight / (height * height)
    const bmi = arith('/', itemRef(['weight'], 'valueDecimal'), arith('*', itemRef(['height'], 'valueDecimal'), itemRef(['height'], 'valueDecimal')));
    expect(emit(bmi))
      .toBe("%resource.item.where(linkId='weight').answer.valueDecimal / (%resource.item.where(linkId='height').answer.valueDecimal * %resource.item.where(linkId='height').answer.valueDecimal)");
    // left-associative chain keeps its own grouping explicit
    expect(emit(arith('*', arith('/', variable('a'), variable('b')), variable('c')))).toBe('(%a / %b) * %c');
  });

  it('joins logic operands and parenthesizes nested logic', () => {
    const c1 = compare('>', variable('age'), literal('number', 18));
    const flag = itemRef(['smoker'], 'valueBoolean');
    expect(emit(logic('and', [c1, flag])))
      .toBe("%age > 18 and %resource.item.where(linkId='smoker').answer.valueBoolean");
    const nested = logic('or', [logic('and', [c1, flag]), variable('x')]);
    expect(emit(nested))
      .toBe("(%age > 18 and %resource.item.where(linkId='smoker').answer.valueBoolean) or %x");
  });

  it('emits exists / empty', () => {
    expect(emit(exists(itemRef(['q'], '')))).toBe("%resource.item.where(linkId='q').answer.exists()");
    expect(emit(exists(itemRef(['q'], ''), true))).toBe("%resource.item.where(linkId='q').answer.empty()");
  });

  it('emits aggregates over a repeating item', () => {
    expect(emit(aggregate('count', itemRef(['pain'], ''))))
      .toBe("%resource.item.where(linkId='pain').answer.count()");
    expect(emit(aggregate('sum', itemRef(['pain'], 'valueDecimal'))))
      .toBe("%resource.item.where(linkId='pain').answer.valueDecimal.sum()");
  });

  it('passes raw text through unchanged', () => {
    expect(emit(raw('%weird.stuff().foo'))).toBe('%weird.stuff().foo');
  });
});
