import { describe, it, expect } from 'vitest';
import fhirpath from 'fhirpath';
import fhirpath_r4_model from 'fhirpath/fhir-context/r4/index.js';
import { parseExpression } from '../js/fhir/expr-builder/parse.js';
import { emit } from '../js/fhir/expr-builder/emit.js';
import { describeBlock } from '../js/fhir/expr-builder/describe.js';
import { itemRef, literal, compare, arith, exists, raw, BlockKind } from '../js/fhir/expr-builder/model.js';
import { iif, union, empty, IIF, UNION, EMPTY, registerBlock, registeredBlocks } from '../js/fhir/expr-builder/blocks/index.js';
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
    expect(parse('iif(%a, today(), 0)').kind).toBe(BlockKind.RAW);
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
