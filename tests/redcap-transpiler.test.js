// ── Tests: REDCap calc → FHIRPath transpiler ──────────────────────────────────
import { describe, test, expect } from 'vitest';
import { transpileCalc, canTranspile } from '../js/fhir/converters/redcap/calc-transpiler.js';

const V = name =>
  `%resource.repeat(item).where(linkId='${name}').answer.first().valueDecimal`;

describe('transpileCalc — basic', () => {
  test('null returns null', () => expect(transpileCalc(null)).toBeNull());
  test('empty string returns null', () => expect(transpileCalc('')).toBeNull());
  test('whitespace-only returns null', () => expect(transpileCalc('   ')).toBeNull());

  test('[var] reference', () => {
    expect(transpileCalc('[weight_kg]')).toBe(V('weight_kg'));
  });

  test('multiple [var] references', () => {
    expect(transpileCalc('[a] + [b]')).toBe(`${V('a')} + ${V('b')}`);
  });

  test('arithmetic operators pass through', () => {
    expect(transpileCalc('[a] - [b]')).toBe(`${V('a')} - ${V('b')}`);
    expect(transpileCalc('[a] * [b]')).toBe(`${V('a')} * ${V('b')}`);
    expect(transpileCalc('[a] / [b]')).toBe(`${V('a')} / ${V('b')}`);
  });

  test('<> becomes !=', () => {
    expect(transpileCalc('[a] <> 0')).toBe(`${V('a')} != 0`);
  });

  test('numeric literal passthrough', () => {
    expect(transpileCalc('42')).toBe('42');
    expect(transpileCalc('3.14')).toBe('3.14');
  });
});

describe('transpileCalc — power operator', () => {
  test('x^2 → .power(2)', () => {
    const r = transpileCalc('[x]^2');
    expect(r).toBe(`${V('x')}.power(2)`);
  });

  test('(expr)^2 preserves parens', () => {
    const r = transpileCalc('([height_cm] / 100)^2');
    expect(r).toContain('.power(2)');
    expect(r).toContain(V('height_cm'));
  });

  test('numeric base: 2^8', () => {
    expect(transpileCalc('2^8')).toBe('2.power(8)');
  });
});

describe('transpileCalc — math functions', () => {
  test('round(x, n)', () => {
    expect(transpileCalc('round([x], 2)')).toBe(`(${V('x')}).round(2)`);
  });

  test('round(x) with no n defaults to 0', () => {
    expect(transpileCalc('round([x])')).toBe(`(${V('x')}).round(0)`);
  });

  test('sqrt(x)', () => {
    expect(transpileCalc('sqrt([x])')).toBe(`(${V('x')}).sqrt()`);
  });

  test('abs(x)', () => {
    expect(transpileCalc('abs([x])')).toBe(`(${V('x')}).abs()`);
  });

  test('floor(x)', () => {
    expect(transpileCalc('floor([x])')).toBe(`(${V('x')}).floor()`);
  });

  test('ceiling(x)', () => {
    expect(transpileCalc('ceiling([x])')).toBe(`(${V('x')}).ceiling()`);
  });

  test('ceil(x) alias', () => {
    expect(transpileCalc('ceil([x])')).toBe(`(${V('x')}).ceiling()`);
  });

  test('log(x) → ln', () => {
    expect(transpileCalc('log([x])')).toBe(`(${V('x')}).ln()`);
  });

  test('log10(x)', () => {
    expect(transpileCalc('log10([x])')).toBe(`(${V('x')}).log(10)`);
  });

  test('exp(x)', () => {
    expect(transpileCalc('exp([x])')).toBe(`(${V('x')}).exp()`);
  });
});

describe('transpileCalc — logic / conditional functions', () => {
  test('if(cond, a, b) → iif', () => {
    expect(transpileCalc('if([a] > 0, 1, 0)')).toBe(`iif(${V('a')} > 0, 1, 0)`);
  });

  test('min(a, b)', () => {
    const r = transpileCalc('min([a], [b])');
    expect(r).toContain('iif(');
    expect(r).toContain(' < ');
    expect(r).toContain(V('a'));
    expect(r).toContain(V('b'));
  });

  test('max(a, b)', () => {
    const r = transpileCalc('max([a], [b])');
    expect(r).toContain('iif(');
    expect(r).toContain(' > ');
  });

  test('mean(a, b, c)', () => {
    const r = transpileCalc('mean([a], [b], [c])');
    expect(r).toContain(' / 3');
    expect(r).toContain(V('a'));
    expect(r).toContain(V('b'));
    expect(r).toContain(V('c'));
  });

  test('sum(a, b)', () => {
    const r = transpileCalc('sum([a], [b])');
    expect(r).toContain(V('a'));
    expect(r).toContain(V('b'));
    expect(r).toContain('+');
  });

  test('today()', () => {
    expect(transpileCalc('today()')).toBe('today()');
  });
});

describe('transpileCalc — complex / nested', () => {
  test('BMI: round([weight_kg] / ([height_cm] / 100)^2, 1)', () => {
    const r = transpileCalc('round([weight_kg] / ([height_cm] / 100)^2, 1)');
    expect(r).toContain(V('weight_kg'));
    expect(r).toContain(V('height_cm'));
    expect(r).toContain('.power(2)');
    expect(r).toContain('.round(1)');
  });

  test('nested functions: round(sqrt([x]), 2)', () => {
    const r = transpileCalc('round(sqrt([x]), 2)');
    expect(r).toContain('.sqrt()');
    expect(r).toContain('.round(2)');
  });

  test('roundup uses ceiling', () => {
    expect(transpileCalc('roundup([x], 0)')).toBe(`(${V('x')}).ceiling()`);
  });

  test('rounddown uses floor', () => {
    expect(transpileCalc('rounddown([x], 0)')).toBe(`(${V('x')}).floor()`);
  });
});

describe('canTranspile', () => {
  test('simple arithmetic → true', () => {
    expect(canTranspile('[a] + [b]')).toBe(true);
  });

  test('round formula → true', () => {
    expect(canTranspile('round([x], 2)')).toBe(true);
  });

  test('datediff → false', () => {
    expect(canTranspile('datediff([d1], [d2], "d")')).toBe(false);
  });

  test('age() → false', () => {
    expect(canTranspile('age()')).toBe(false);
  });

  test('age-years() → false', () => {
    expect(canTranspile('age-years()')).toBe(false);
  });

  test('stdev → false', () => {
    expect(canTranspile('stdev([a], [b], [c])')).toBe(false);
  });

  test('null → false', () => {
    expect(canTranspile(null)).toBe(false);
  });

  test('empty → false', () => {
    expect(canTranspile('')).toBe(false);
  });
});
