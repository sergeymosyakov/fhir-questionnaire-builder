import { describe, it, expect } from 'vitest';
import fhirpath from 'fhirpath';
import fhirpath_r4_model from 'fhirpath/fhir-context/r4/index.js';
import { parseExpression } from '../js/fhir/expr-builder/parse.js';
import { emit } from '../js/fhir/expr-builder/emit.js';
import { describeBlock } from '../js/fhir/expr-builder/describe.js';
import { itemRef, literal, compare, arith, exists, raw, BlockKind } from '../js/fhir/expr-builder/model.js';
import { iif, union, empty, answerScores, IIF, UNION, EMPTY, ANSWER_SCORES, ORDINAL_VALUE_URL, power, negate, keepIf, duration, today, textFn, POWER, NEGATE, registerBlock, registeredBlocks } from '../js/fhir/expr-builder/blocks/index.js';
import { aggregate } from '../js/fhir/expr-builder/model.js';
import { collectExpressions, responsesFor, evaluate as evaluateText } from './helpers/expressions.js';
import { EXPR_GALLERY, resolveGalleryPattern } from '../js/fhir/expr-builder/gallery/index.js';
import { loadFhirpath } from './helpers/fhirpath-node.js';

const fp = loadFhirpath();
const parse = (s) => parseExpression(s, fp);
const ref = (id) => `%resource.item.where(linkId='${id}').answer.valueBoolean`;
const itemBool = (id) => itemRef([id], 'valueBoolean');
const evaluate = (qr, expr) => fhirpath.evaluate(qr, expr, { resource: qr }, fhirpath_r4_model);

describe('block registry', () => {
  it('holds the library blocks, refuses a second registration of a kind and a definition without a kind', () => {
    expect(registeredBlocks().map((d) => d.kind)).toEqual(expect.arrayContaining([IIF, UNION, EMPTY]));
    expect(() => registerBlock({ kind: IIF })).toThrow(/already registered/);
    expect(() => registerBlock({})).toThrow(/needs "kind"/);
  });
});

describe('conditional value (iif)', () => {
  it('reads iif(condition, then, otherwise) into a block and writes it back', () => {
    const b = parse(`iif(${ref('a')}, 1, 0)`);
    expect(b).toEqual(iif(itemBool('a'), literal('number', 1), literal('number', 0)));
    expect(emit(b)).toBe(`iif(${ref('a')}, 1, 0)`);
  });

  it('reads the two-argument form (no otherwise)', () => {
    const b = parse('iif(%x > 1, 5)');
    expect(b.kind).toBe(IIF);
    expect(b.otherwise).toBeNull();
    expect(emit(b)).toBe('iif(%x > 1, 5)');
  });

  it('nests: a conditional inside a conditional and inside arithmetic', () => {
    const text = "iif(%a > 1, iif(%b > 2, 'x', 'y'), 'z')";
    expect(emit(parse(text))).toBe(text);
    expect(emit(parse('iif(%a, 1, 0) + iif(%b, 1, 0)'))).toBe('iif(%a, 1, 0) + iif(%b, 1, 0)');
  });

  it('keeps an unreadable branch as text instead of failing the whole expression', () => {
    expect(parse('iif(%a, now(), 0)').kind).toBe(BlockKind.RAW);
  });

  it('rejects a call with the wrong number of arguments', () => {
    expect(parse('iif(%a)').kind).toBe(BlockKind.RAW);
    expect(parse('iif(%a, 1, 2, 3)').kind).toBe(BlockKind.RAW);
  });

  it('is described in plain words', () => {
    expect(describeBlock(parse(`iif(${ref('a')}, 1, 0)`))).toBe('if the answer to «a», then 1, otherwise 0');
    expect(describeBlock(iif(raw('x'), literal('number', 1)))).toBeNull();
  });
});

describe('union and presence of a value', () => {
  it('reads a | b | c into one N-ary union and writes it back', () => {
    const text = `(${ref('a')} | ${ref('b')} | ${ref('c')})`;
    const b = parse(text);
    expect(b).toEqual(union([itemBool('a'), itemBool('b'), itemBool('c')]));
    expect(emit(b)).toBe(text);
  });

  it('reads (a | b).exists() and .empty()', () => {
    const b = parse(`(${ref('a')} | ${ref('b')}).exists()`);
    expect(b).toEqual(exists(union([itemBool('a'), itemBool('b')]), false));
    expect(emit(b)).toBe(`(${ref('a')} | ${ref('b')}).exists()`);
    expect(parse(`(${ref('a')} | ${ref('b')}).empty()`)).toEqual(exists(union([itemBool('a'), itemBool('b')]), true));
  });

  it('reads the presence of a sum', () => {
    const b = parse('(%a + %b).exists()');
    expect(b.kind).toBe(BlockKind.EXISTS);
    expect(b.target.kind).toBe(BlockKind.ARITH);
    expect(emit(b)).toBe('(%a + %b).exists()');
  });

  it('parenthesizes a compound target of exists so the meaning survives', () => {
    expect(emit(exists(arith('+', literal('number', 1), literal('number', 2))))).toBe('(1 + 2).exists()');
    expect(emit(exists(compare('>', literal('number', 1), literal('number', 2))))).toBe('(1 > 2).exists()');
  });

  it('is described as "at least one of … has an answer"', () => {
    const text = `(${ref('a')} | ${ref('b')} | ${ref('c')}).exists()`;
    expect(describeBlock(parse(text), { a: 'Alpha', b: 'Beta', c: 'Gamma' })).toBe('at least one of «Alpha», «Beta» or «Gamma» has an answer');
    expect(describeBlock(parse(text.replace('exists', 'empty')), { a: 'Alpha', b: 'Beta', c: 'Gamma' })).toBe('none of «Alpha», «Beta» or «Gamma» has an answer');
  });
});

describe('union operands that bind looser than |', () => {
  const qr = (a, b, c) => ({
    resourceType: 'QuestionnaireResponse',
    item: [['a', a], ['b', b], ['c', c]].filter(([, v]) => v != null).map(([id, v]) => ({ linkId: id, answer: [{ valueBoolean: v }] })),
  });
  const answers = [qr(), qr(true), qr(false, true), qr(true, false, true), qr(false, false, false), qr(true, true, true)];

  it('keeps a comparison operand in its own brackets, so the result does not change', () => {
    const text = `((${ref('a')} = true) | ${ref('b')}).exists()`;
    const rewritten = emit(parse(text));
    expect(rewritten).toBe(`((${ref('a')} = true) | ${ref('b')}).exists()`);
    for (const a of answers) expect(evaluate(a, rewritten)).toEqual(evaluate(a, text));
  });

  it('keeps an and/or operand in its own brackets, so the result does not change', () => {
    const text = `((${ref('a')} and ${ref('b')}) | ${ref('c')}).exists()`;
    const rewritten = emit(parse(text));
    expect(rewritten).toContain(`(${ref('a')} and ${ref('b')}) | ${ref('c')}`);
    for (const a of answers) expect(evaluate(a, rewritten)).toEqual(evaluate(a, text));
  });
});

describe('plain-words descriptions stay truthful', () => {
  it('does not say "has an answer" about a comparison, an and/or or a sum', () => {
    expect(describeBlock(parse(`(${ref('a')} = true).exists()`))).toBeNull();
    expect(describeBlock(parse(`(${ref('a')} and ${ref('b')}).exists()`))).toBeNull();
    expect(describeBlock(parse('(%a + %b).exists()'))).toBeNull();
    expect(describeBlock(parse(`${ref('a')}.exists()`))).toBe('the answer to «a» has an answer');
  });

  it('brackets a compound operand of a union', () => {
    expect(describeBlock(parse('((%a + %b) | %c).exists()'))).toBe('at least one of (the variable %a plus the variable %b) or the variable %c has an answer');
  });

  it('brackets a conditional used inside arithmetic or inside another conditional', () => {
    expect(describeBlock(parse(`iif(${ref('a')}, 1, 2) * 3`))).toBe('(if the answer to «a», then 1, otherwise 2) multiplied by 3');
    expect(describeBlock(parse(`iif(${ref('a')}, iif(${ref('b')}, 1, 2), 3)`)))
      .toBe('if the answer to «a», then (if the answer to «b», then 1, otherwise 2), otherwise 3');
  });
});

describe('string literals and numbers survive a round trip', () => {
  const text = (expr) => emit(parse(expr));

  it('keeps escapes: tab, quote, backslash and unicode read and write back with the same meaning', () => {
    for (const lit of [String.raw`'tab\there'`, String.raw`'it\'s'`, String.raw`'a\\b'`, String.raw`'x\u0041y'`, String.raw`'line\nbreak'`]) {
      const expr = `iif(${ref('a')}, ${lit}, 'y')`;
      const rewritten = text(expr);
      const qr = { resourceType: 'QuestionnaireResponse', item: [{ linkId: 'a', answer: [{ valueBoolean: true }] }] };
      expect(evaluate(qr, rewritten), lit).toEqual(evaluate(qr, expr));
    }
  });

  it('writes every number so that it reads back as exactly the same number', async () => {
    const { numberText } = await import('../js/fhir/expr-builder/emit.js');
    for (const n of [1e-7, 1.5e-7, -1e-7, 5e-21, 1e-25, 1.2345678901234568e-7, 5e-324, 1e21, 1.2e25, 2 ** 53 + 2, Number.MAX_VALUE, 0.1 + 0.2, 18.5, -0.00000025]) {
      expect(numberText(n), String(n)).not.toMatch(/e/i);
      expect(Number(numberText(n)), String(n)).toBe(n);
    }
  });

  it('writes a very small or very large number in full, never with an exponent', () => {
    expect(text('%a < 0.0000001')).toBe('%a < 0.0000001');
    expect(text('%a * 100000000000000000000000')).toBe('%a * 100000000000000000000000');
    expect(text('%a < 18.5')).toBe('%a < 18.5');
  });
});

describe('the scores of the chosen answers of several questions', () => {
  const scores = (fn = '') => `%resource.repeat(item).where(linkId in ('q1' | 'q2' | 'q3')).answer.valueCoding.extension('${ORDINAL_VALUE_URL}').valueDecimal${fn}`;

  it('is a registered block, read from and written back to the exact text', () => {
    expect(registeredBlocks().map((d) => d.kind)).toContain(ANSWER_SCORES);
    for (const text of [scores(), scores('.sum()'), scores('.count()'), scores('.avg()')]) {
      expect(emit(parse(text)), text).toBe(text);
    }
    expect(parse(scores())).toEqual(answerScores(['q1', 'q2', 'q3']));
    expect(parse(scores('.sum()'))).toEqual(aggregate('sum', answerScores(['q1', 'q2', 'q3'])));
  });

  it('keeps another ordinal-score URL and the order of the questions', () => {
    const text = "%resource.repeat(item).where(linkId in ('z' | 'a')).answer.valueCoding.extension('http://example.org/score').valueDecimal.sum()";
    expect(parse(text)).toEqual(aggregate('sum', answerScores(['z', 'a'], 'http://example.org/score')));
    expect(emit(parse(text))).toBe(text);
  });

  it('reads a scale total: if every answer is given, the sum, otherwise nothing', () => {
    const total = `iif(${scores('.count()')} = 3, ${scores('.sum()')}, {})`;
    const b = parse(total);
    expect(b.kind).toBe(IIF);
    expect(b.condition.left).toEqual(aggregate('count', answerScores(['q1', 'q2', 'q3'])));
    expect(b.then).toEqual(aggregate('sum', answerScores(['q1', 'q2', 'q3'])));
    expect(emit(b)).toBe(total);
  });

  it('leaves a look-alike as text: no extension step, one question only, another member, an extra step', () => {
    for (const text of [
      "%resource.repeat(item).where(linkId in ('q1' | 'q2')).answer.valueCoding.code",
      `%resource.repeat(item).where(linkId = 'q1').answer.valueCoding.extension('${ORDINAL_VALUE_URL}').valueDecimal`,
      `%resource.repeat(item).where(linkId in ('q1' | 'q2')).answer.valueCoding.extension('${ORDINAL_VALUE_URL}').valueInteger`,
      `%resource.repeat(item).where(linkId in ('q1' | 'q2')).answer.valueCoding.extension('${ORDINAL_VALUE_URL}').valueDecimal.distinct().sum()`,
      `%resource.item.where(linkId in ('q1' | 'q2')).answer.valueCoding.extension('${ORDINAL_VALUE_URL}').valueDecimal`,
    ]) expect(parse(text).kind, text).toBe(BlockKind.RAW);
  });

  it('does not read a set that is more than strings, nor a repeat over anything but item', () => {
    const tail = `.answer.valueCoding.extension('${ORDINAL_VALUE_URL}').valueDecimal.sum()`;
    for (const text of [
      `%resource.repeat(item).where(linkId in ('a' | 'b'.upper()))${tail}`,
      `%resource.repeat(item).where(linkId in ('a' | iif(%x, 'b', 'c')))${tail}`,
      `%resource.repeat(item).where(linkId in ('a' | %resource.item.where(linkId='z').answer.valueString))${tail}`,
      `%resource.repeat(item).where(linkId in ('a') = false)${tail}`,
      `%resource.repeat(item.item).where(linkId in ('a' | 'b'))${tail}`,
    ]) {
      expect(parse(text).kind, text).toBe(BlockKind.RAW);
      expect(emit(parse(text)), text).toBe(text); // text stays exactly as it was
    }
  });

  it('reads brackets and unions of strings in any shape, and keeps the meaning', () => {
    const text = `%resource.repeat(item).where(linkId in (('a' | 'b') | 'c'))${`.answer.valueCoding.extension('${ORDINAL_VALUE_URL}').valueDecimal`}.sum()`;
    expect(parse(text)).toEqual(aggregate('sum', answerScores(['a', 'b', 'c'])));
  });

  it('applies the same strictness to a pipeline over a question\'s answers', () => {
    for (const text of [
      "%resource.repeat(item).where(linkId='x').answer.valueCoding.code.intersect(('a' | 'b'.upper())).join(',')",
      "%resource.repeat(item.item).where(linkId='x').answer.valueCoding.code.distinct().count()",
    ]) {
      expect(parse(text).kind, text).toBe(BlockKind.RAW);
    }
    expect(parse("%resource.repeat(item).where(linkId='x').answer.valueCoding.code.intersect(('a' | 'b')).join(',')").kind).toBe(BlockKind.PIPELINE);
  });

  it('is described in plain words', () => {
    expect(describeBlock(parse(scores('.sum()')), { q1: 'Interest', q2: 'Mood', q3: 'Sleep' })).toBe('the sum of the scores of the answers to «Interest», «Mood» and «Sleep»');
  });
});

describe('every shipped calculation gives the same results written back from its blocks', () => {
  const all = collectExpressions();
  // Many generated responses per expression, some through slow date functions: more than the default 5 s on a busy machine.
  it.each(all.map((e) => [e.id, e]))('%s', (_id, e) => {
    const block = parse(e.text);
    const written = emit(block);
    for (const qr of responsesFor(e.text, block)) expect(evaluateText(qr, written)).toBe(evaluateText(qr, e.text));
  }, 60_000);
});

describe('the generated responses really exercise a scale total', () => {
  it('give a number once every answer is there and nothing otherwise', () => {
    const e = collectExpressions().find((x) => x.id.startsWith('template:phq-9') && /\.sum\(\)/.test(x.text));
    expect(e).toBeTruthy();
    const results = responsesFor(e.text, parse(e.text)).map((qr) => evaluateText(qr, e.text));
    expect(results.some((r) => /^\[\d+(\.\d+)?\]$/.test(r))).toBe(true); // a total
    expect(results.some((r) => r === '[]')).toBe(true); // an answer missing → no total
    expect(new Set(results).size).toBeGreaterThan(2); // and the totals differ between scenarios
  });
});

describe('no value ({})', () => {
  it('reads {} and writes it back, alone and as a branch', () => {
    expect(parse('{}')).toEqual(empty());
    expect(emit(empty())).toBe('{}');
    expect(emit(parse('iif(%a, 1, {})'))).toBe('iif(%a, 1, {})');
    expect(describeBlock(empty())).toBe('no value');
  });
});

describe('the qSOFA calculation', () => {
  const total = `iif((${ref('r')} | ${ref('m')} | ${ref('s')}).exists(), (iif((${ref('r')}), 1, 0) + iif((${ref('m')}), 1, 0) + iif((${ref('s')}), 1, 0)), {})`;

  it('opens as blocks: presence of any criterion → sum of the criteria, otherwise no value', () => {
    const b = parse(total);
    expect(b.kind).toBe(IIF);
    expect(b.condition).toEqual(exists(union([itemBool('r'), itemBool('m'), itemBool('s')]), false));
    expect(b.then.kind).toBe(BlockKind.ARITH);
    expect(b.otherwise).toEqual(empty());
  });

  it('gives the same result written back from its blocks', () => {
    const rewritten = emit(parse(total));
    const answers = (r, m, s) => ({
      resourceType: 'QuestionnaireResponse',
      item: [['r', r], ['m', m], ['s', s]].filter(([, v]) => v != null).map(([id, v]) => ({ linkId: id, answer: [{ valueBoolean: v }] })),
    });
    for (const qr of [answers(), answers(false), answers(true, true), answers(true, false, true), answers(true, true, true)]) {
      expect(evaluate(qr, rewritten)).toEqual(evaluate(qr, total));
    }
    expect(evaluate(answers(true, true), rewritten)).toEqual([2]);
    expect(evaluate(answers(), rewritten)).toEqual([]);
  });

  it('reads as one sentence', () => {
    expect(describeBlock(parse(total), { r: 'Respiratory rate', m: 'Mentation', s: 'Systolic BP' }))
      .toBe('if at least one of «Respiratory rate», «Mentation» or «Systolic BP» has an answer, then (if the answer to «Respiratory rate», then 1, otherwise 0) plus (if the answer to «Mentation», then 1, otherwise 0) plus (if the answer to «Systolic BP», then 1, otherwise 0), otherwise no value');
  });
});

describe('gallery calculations', () => {
  const sampleRef = (key) => `%resource.item.where(linkId='${key}').answer.valueDecimal`;
  const patternExpr = (p) => {
    const sel = {};
    for (const s of p.slots) {
      const row = (k) => ({ ref: sampleRef(k), transformId: s.transforms?.[0]?.id });
      sel[s.key] = s.repeatable ? { rows: [row(s.key + '1'), row(s.key + '2')] } : row(s.key);
    }
    try { return resolveGalleryPattern(p, sel); } catch { return null; }
  };
  const qrWith = (value, ids) => ({
    resourceType: 'QuestionnaireResponse',
    item: ids.map((id, i) => ({ linkId: id, answer: [{ valueDecimal: value + i }] })),
  });
  const linkIds = (expr) => [...new Set([...expr.matchAll(/linkId='([^']+)'/g)].map((m) => m[1]))];
  const modelled = EXPR_GALLERY.map((p) => ({ p, expr: patternExpr(p) })).filter((x) => x.expr).map((x) => ({ ...x, block: parse(x.expr) })).filter((x) => x.block.kind !== BlockKind.RAW);

  it('reads the scales, scores and categories of the gallery as blocks', () => {
    const ids = modelled.map((x) => x.p.id);
    for (const id of ['qsofa', 'phq2-screen', 'phq9-severity', 'gad7-severity', 'glasgow-coma-scale', 'apgar-score', 'bmi-category', 'ldl-friedewald']) expect(ids, id).toContain(id);
  });

  it.each(modelled.map((x) => [x.p.id, x]))('%s gives the same results when written back from its blocks', (_id, { expr, block }) => {
    const rewritten = emit(block);
    expect(emit(parse(rewritten))).toBe(rewritten);
    const ids = linkIds(expr);
    for (const qr of [qrWith(1, ids), qrWith(70, ids), qrWith(1, ids.slice(0, 1)), qrWith(1, [])]) {
      expect(evaluate(qr, rewritten)).toEqual(evaluate(qr, expr));
    }
  });
});

describe('square root, power and minus', () => {
  const env = { a: 4, b: 9, age: 30 };
  const value = (text) => fhirpath.evaluate({}, text, env);

  it('reads a square root as a function block and writes it back', () => {
    const b = parse('(%a * %b / 3600).sqrt().round(2)');
    expect(b).toMatchObject({ kind: BlockKind.MATH_FN, fn: 'round', target: { kind: BlockKind.MATH_FN, fn: 'sqrt' } });
    expect(value(emit(b))).toEqual(value('(%a * %b / 3600).sqrt().round(2)'));
  });

  it('reads a power with its exponent, also a literal base and a negative exponent', () => {
    for (const text of ['%a.power(-1.2)', '0.9938.power(%age)', '(60 / %a).power(1 / 3)', '(%a / (60 / %b).power(1 / 3)).round(0)']) {
      const b = parse(text);
      expect(b.kind === POWER || b.kind === BlockKind.MATH_FN).toBe(true);
      expect(value(emit(b))).toEqual(value(text));
    }
    expect(parse('%a.power(2)')).toEqual(power({ kind: BlockKind.VARIABLE, name: 'a' }, literal('number', 2)));
  });

  it('reads a bare negative number as a number and any other minus as a negation', () => {
    expect(parse('-1.5')).toEqual(literal('number', -1.5));
    expect(parse('-%a')).toEqual(negate({ kind: BlockKind.VARIABLE, name: 'a' }));
    expect(parse('%a * -0.5')).toMatchObject({ kind: BlockKind.ARITH, right: literal('number', -0.5) });
  });

  it('keeps the meaning where a minus meets a function call (-2.abs() is minus of 2.abs())', () => {
    for (const text of ['-2.power(2)', '(-2).power(3)', '(-%a).abs()', '-(%a + 1)', '-(-2)', '%a - -2', '-%a.abs()']) {
      const b = parse(text);
      expect(b.kind).not.toBe(BlockKind.RAW);
      expect(value(emit(b))).toEqual(value(text));
    }
    expect(emit(power(literal('number', -2), literal('number', 3)))).toBe('(-2).power(3)');
    expect(emit(negate(negate(literal('number', 2))))).toBe('-(-2)');
  });

  it('leaves the shapes it does not model as text', () => {
    expect(parse('%a.power(1, 2)').kind).toBe(BlockKind.RAW);
    expect(parse('+%a').kind).toBe(BlockKind.RAW);
  });

  it('is described in words', () => {
    expect(describeBlock(parse('%a.sqrt()'))).toBe('the square root of the variable %a');
    expect(describeBlock(parse('(%a + 1).power(2)'))).toBe('(the variable %a plus 1) to the power of 2');
    expect(describeBlock(parse('-%a'))).toBe('minus the variable %a');
    expect(NEGATE).toBe('negate');
  });
});

describe('keep the result only if (where($this …))', () => {
  const value = (text) => fhirpath.evaluate({}, text, { a: -4, b: 9 });

  it('reads a test on the result, also on a conditional, and writes it back with the same meaning', () => {
    for (const text of ['(%a).where($this >= 0)', 'iif(%b > 1, %b * 2, {}).where($this > -1.5)', '(%b / 3).where($this != 3)', '(%a).where($this < 0).round(1)']) {
      const b = parse(text);
      expect(b.kind, text).not.toBe(BlockKind.RAW);
      expect(value(emit(b)), text).toEqual(value(text));
    }
    expect(parse('(%a).where($this >= 0)')).toEqual(keepIf({ kind: BlockKind.VARIABLE, name: 'a' }, '>=', 0));
  });

  it('leaves any other filter as text', () => {
    for (const text of ['(%a).where($this >= %b)', '(%a).where(true)', '(%a).where($this >= 0 and $this < 5)', '(%a).where(1 >= $this)', '(%a).where(-$this >= 0)', '(%a).where(-($this) > 3)']) {
      expect(parse(text).kind, text).toBe(BlockKind.RAW);
    }
  });

  it('is described in words', () => {
    expect(describeBlock(parse('(%a).where($this >= 0)'))).toBe('the variable %a, kept only if it is at least 0');
  });
});

describe('calendar durations (280 days, 1 week)', () => {
  it('reads a duration as its own block and writes it back as written', () => {
    for (const text of ['%d + 280 days', '%d + 1 week', '%d - 2 months', '%d + 1.5 years']) {
      const b = parse(text);
      expect(b.kind, text).toBe(BlockKind.ARITH);
      expect(b.right.kind, text).toBe('duration');
      expect(emit(b), text).toBe(text);
    }
    expect(parse('1 week')).toEqual(duration(1, 'week'));
  });

  it('adds to a date question and gives the same date', () => {
    for (const text of ['@2024-01-01 + 280 days', '@2024-01-01 + 1 week', '@2024-03-31 - 2 months']) expect(fhirpath.evaluate({}, emit(parse(text)))).toEqual(fhirpath.evaluate({}, text));
  });

  it('leaves other quantities as text', () => {
    for (const text of ["%d + 5 'mg'", "%d + 1 'wk'", '%d + 3 milliseconds', '%d + 1.50 days', '%d + 01 days']) expect(parse(text).kind, text).toBe(BlockKind.RAW);
  });

  it('is described in words', () => {
    expect(describeBlock(parse('%d + 280 days'))).toBe('the variable %d plus 280 days');
  });
});

describe('today(), text conversions and div / mod', () => {
  const year = "@2024-03-09.toString().substring(0, 4).toInteger()";

  it('reads today() and the text functions with their numbers and writes them back', () => {
    for (const text of ['today()', 'today().toString().substring(0, 4).toInteger()', '%d.toString().substring(5)', '%d.toString()']) {
      expect(emit(parse(text)), text).toBe(text);
    }
    expect(parse('today()')).toEqual(today());
    expect(parse('%d.toString().substring(5, 2)')).toEqual(textFn('substring', textFn('toString', { kind: BlockKind.VARIABLE, name: 'd' }), [5, 2]));
  });

  it('gives the same value after writing back', () => {
    for (const text of [year, '@2024-03-09.toString().substring(5, 2).toInteger() mod 2', '(@2024-03-09.toString().substring(8, 2).toInteger() + 9) div 4']) {
      expect(fhirpath.evaluate({}, emit(parse(text)))).toEqual(fhirpath.evaluate({}, text));
    }
  });

  it('keeps div and mod as arithmetic and reads them in words', () => {
    expect(parse('%a div 4')).toMatchObject({ kind: BlockKind.ARITH, op: 'div' });
    expect(parse('%a mod 4')).toMatchObject({ kind: BlockKind.ARITH, op: 'mod' });
    expect(describeBlock(parse('%a mod 4'))).toBe('the variable %a modulo 4');
  });

  it('leaves other arguments and functions as text', () => {
    for (const text of ['%d.substring(%a)', '%d.substring(-1)', '%d.substring(1.5)', '%d.toInteger(1)', '%d.substring()', '%d.toDecimal()', 'today(1)', 'now()', '01.toString()', '(1.50).toString()', "'abc'.substring(1.0)", "'abc'.substring(2, 01)"]) {
      expect(parse(text).kind, text).toBe(BlockKind.RAW);
    }
  });

  it('is described in words', () => {
    expect(describeBlock(parse('today().toString().substring(0, 4).toInteger()'))).toBe("the whole number of part of the text of the text of today's date (from character 0, 4 characters)");
  });
});
