// "Check my form" core on small hand-built forms: input collection, scenario shape, band detection and its non-reports.
import { describe, it, expect } from 'vitest';
import { loadFhirpath } from './helpers/fhirpath-node.js';
import { collectInputs, buildScenarios } from '../js/fhir/check/generators.js';
import { checkForm } from '../js/fhir/check/reachability.js';

const fp = loadFhirpath();
const opts = (...codes) => codes.map((c) => ({ valueCoding: { code: c, display: c === 'a' ? 'Severe' : c } }));
const choice = (id, ...codes) => ({ id, type: 'item', itemType: 'select', _rawAnswerOptions: opts(...codes), children: [] });
const calc = (id, expr, itemType = 'text') => ({ id, type: 'item', itemType, _calculatedExpr: expr, children: [] });
const ref = (id, acc = 'valueCoding.code') => `%resource.repeat(item).where(linkId='${id}').answer.${acc}`;
const baseOf = (tree) => ({
  resourceType: 'Questionnaire',
  item: tree.map((n) => ({ linkId: n.id, type: n.itemType === 'select' ? 'choice' : n.itemType === 'text' ? 'string' : n.itemType, ...(n._rawAnswerOptions ? { answerOption: n._rawAnswerOptions } : {}) })),
});
const run = (tree, f = fp) => checkForm({ tree, base: baseOf(tree), fp: f });

describe('collectInputs', () => {
  it('takes choice, yes/no and bounded numbers; skips calculated, unbounded and repeating-group questions', () => {
    const tree = [
      choice('c', 'a', 'b'),
      { id: 'yn', type: 'item', itemType: 'checkbox', children: [] },
      { id: 'n1', type: 'item', itemType: 'integer', _minValue: 0, _maxValue: 10, children: [] },
      { id: 'n2', type: 'item', itemType: 'integer', children: [] },
      calc('k', "'x'"),
      { id: 'g', type: 'group', repeats: true, children: [choice('inner', 'a')] },
    ];
    expect(collectInputs(tree).map((i) => i.id)).toEqual(['c', 'yn', 'n1', 'n2']);
  });
});

const showWhen = (node, question, code) => ({ ...node, enableWhen: [{ question, operator: '=', answerCoding: { code } }], enableBehavior: 'all' });

describe('Show When', () => {
  const hit = (q2) => calc('c', `iif(${ref(q2)} = 'x', 'Hit', 'Miss')`);

  it('keeps a result that is reachable through a question that gets enabled', async () => {
    const tree = [choice('q1', 'a', 'b'), showWhen(choice('q2', 'x', 'y'), 'q1', 'b'), hit('q2')];
    const { calcs, unshown } = await run(tree);
    expect(calcs[0].status).toBe('ok');
    expect(unshown).toEqual([]);
  });

  it('drops the answer of a question that stays disabled, and reports the result and the question', async () => {
    const tree = [choice('q1', 'a', 'b'), showWhen(choice('q2', 'x', 'y'), 'q1', 'zz'), hit('q2')];
    const { calcs, unshown, trials } = await run(tree);
    expect(calcs[0]).toMatchObject({ status: 'unreachable', missed: ['Hit'] });
    expect(unshown).toEqual([{ id: 'q2', title: 'q2', when: 'q1 = zz' }]);
    expect(trials.every((t) => !('q2' in t.answers))).toBe(true);
  });

  it('does not judge a rule that reads a number without limits', async () => {
    const w = { id: 'w', type: 'item', itemType: 'integer', children: [] };
    const more = { ...choice('q2', 'x'), enableWhen: [{ question: 'w', operator: '>', answerInteger: 120 }], enableBehavior: 'all' };
    expect((await run([w, more])).unshown).toEqual([]);
  });

  it('does not call a question never shown when the rule reads a date the check cannot try', async () => {
    const tree = [{ id: 'd', type: 'item', itemType: 'date', children: [] }, showWhen(choice('q2', 'x'), 'd', '2020-01-01'), hit('q2')];
    expect((await run(tree)).unshown).toEqual([]);
  });
});

describe('Show When edge cases', () => {
  it('tries the number a rule compares with, not only the bounds and the middle', async () => {
    const age = { id: 'age', type: 'item', itemType: 'integer', _minValue: 0, _maxValue: 120, children: [] };
    const adult = { ...choice('q2', 'x'), enableWhen: [{ question: 'age', operator: '=', answerInteger: 18 }], enableBehavior: 'all' };
    expect((await run([age, adult])).unshown).toEqual([]);
  });

  it('tries the neighbour of a number a strict rule compares with', async () => {
    const age = { id: 'age', type: 'item', itemType: 'integer', _minValue: 0, _maxValue: 120, children: [] };
    const ew = (operator, answerInteger) => ({ question: 'age', operator, answerInteger });
    const window = { ...choice('q2', 'x'), enableWhen: [ew('>', 10), ew('<', 12)], enableBehavior: 'all' };
    expect((await run([age, window])).unshown).toEqual([]);
  });

  it('does not judge a question inside a repeating group', async () => {
    const group = { id: 'g', type: 'group', repeats: true, children: [showWhen(choice('x', 'p'), 'q1', 'a')] };
    expect((await run([choice('q1', 'a', 'b'), group])).unshown).toEqual([]);
  });
});

describe('buildScenarios', () => {
  it('covers the last questions of a large form, not only the first', () => {
    const many = Array.from({ length: 60 }, (_, i) => collectInputs([choice(`q${i}`, 'x', 'y')])[0]);
    const s = buildScenarios(many);
    expect(s.truncated).toBe(false); // the cap grows with the form
    expect(s.some((v) => Object.keys(v).length === 59 && !('q59' in v))).toBe(true); // the last question left unanswered
  });

  const inputs = [choice('a', 'x', 'y'), choice('b', 'x', 'y')].map((n) => collectInputs([n])[0]);
  it('starts with unanswered, all lowest, all highest, without repeats', () => {
    const s = buildScenarios(inputs);
    expect(s.slice(0, 3)).toEqual([{}, { a: 'x', b: 'x' }, { a: 'y', b: 'y' }]);
    expect(new Set(s.map((v) => JSON.stringify(v))).size).toBe(s.length);
  });
  it('says when the cap cut combinations off', () => {
    expect(buildScenarios(inputs, 3).truncated).toBe(true);
    expect(buildScenarios(inputs).truncated).toBe(false);
  });
});

describe('checkForm', () => {
  it('does not report a compared label, only the branch results', async () => {
    const tree = [choice('q', 'a', 'b'), calc('c', `iif(${ref('q', 'valueCoding.display')} = 'Severe', 'High', 'Low')`)];
    const { calcs } = await run(tree);
    expect(calcs[0].status).toBe('ok');
  });

  it('reads only iif branches as results, not arguments of other functions', async () => {
    const tree = [choice('q', 'a', 'b'), calc('c', `iif(${ref('q')} = 'a', 'High', 'Low').replace('abc', 'def')`)];
    expect((await run(tree)).calcs[0].status).toBe('ok');
  });

  it('names a multiple-choice list as the reason it cannot check a calculation', async () => {
    const tree = [{ id: 'm', type: 'item', itemType: 'checklist', title: 'Symptoms', _rawAnswerOptions: opts('a', 'b'), children: [] }, calc('c', `iif(${ref('m')}.exists(), 'Yes', 'No')`)];
    expect((await run(tree)).calcs[0].reason).toContain('Symptoms (a multiple-choice list)');
  });

  it('compares an escaped quote in a result as the text the engine returns', async () => {
    const tree = [choice('q', 'a', 'b'), calc('c', `iif(${ref('q')} = 'a', 'Doesn\\'t qualify', 'Qualifies')`)];
    expect((await run(tree)).calcs[0].status).toBe('ok');
  });

  it('reports a branch no answer reaches', async () => {
    const tree = [choice('q', 'a', 'b'), calc('c', `iif(${ref('q')} = 'a', 'High', iif(${ref('q')} = 'zz', 'Middle', 'Low'))`)];
    const { calcs } = await run(tree);
    expect(calcs[0]).toMatchObject({ status: 'unreachable', missed: ['Middle'] });
    expect(calcs[0].details[0].when).toBe("q = 'zz'"); // the question reference reads as its title
  });

  it('reports a calculation that never gives a value, and keeps a result of false', async () => {
    const tree = [choice('q', 'a', 'b'), calc('never', `${ref('nothing')}.first()`), calc('flag', `${ref('q')} = 'zz'`, 'boolean')];
    const { calcs } = await run(tree);
    expect(calcs.find((c) => c.id === 'never').status).toBe('no-result');
    expect(calcs.find((c) => c.id === 'flag')).toMatchObject({ status: 'ok', reached: ['false'] });
  });

  it('tries numbers 1-100 for a number without limits, and says so when a result is missed', async () => {
    const n = { id: 'n', type: 'item', itemType: 'integer', title: 'Count', children: [] };
    const { calcs } = await run([n, calc('c', `iif(${ref('n', 'valueInteger')} > 500, 'Huge', 'Low')`)]);
    expect(calcs[0]).toMatchObject({ status: 'unreachable', missed: ['Huge'], sampled: ['Count (1–100)'] });
  });

  it('gives the same trials on every run and tries decimals as fractions', async () => {
    const d = { id: 'd', type: 'item', itemType: 'decimal', children: [] };
    const tree = [d, calc('c', `iif(${ref('d', 'valueDecimal')} > 50, 'Over', 'Under')`)];
    const a = await run(tree);
    expect((await run(tree)).trials).toEqual(a.trials);
    expect(a.trials.some((t) => t.answers.d % 1 !== 0)).toBe(true);
  });

  it('keeps a whole number inside a fractional limit', () => {
    expect(collectInputs([{ id: 'n', type: 'item', itemType: 'integer', _maxValue: 0.5, children: [] }])).toEqual([]);
    const [i] = collectInputs([{ id: 'n', type: 'item', itemType: 'integer', _minValue: 0.5, _maxValue: 3.5, children: [] }]);
    expect([i.lo, i.hi]).toEqual([1, 3]);
  });

  it('leaves a bounded number untouched', async () => {
    const n = { id: 'n', type: 'item', itemType: 'integer', _minValue: 0, _maxValue: 10, children: [] };
    expect((await run([n, calc('c', `iif(${ref('n', 'valueInteger')} > 5, 'High', 'Low')`)])).calcs[0].sampled).toEqual([]);
  });

  it('reaches a band that needs a matching pair of unbounded numbers', async () => {
    const num = (id) => ({ id, type: 'item', itemType: 'integer', children: [] });
    const expr = `iif(${ref('w', 'valueInteger')} > ${ref('h', 'valueInteger')} * 3, 'Heavy', 'Light')`;
    expect((await run([num('w'), num('h'), calc('c', expr)])).calcs[0].status).toBe('ok');
  });

  it('reports progress from 0 up to the number of answer sets tried', async () => {
    const tree = [choice('q', 'a', 'b'), calc('c', `iif(${ref('q')} = 'a', 'High', 'Low')`)];
    const seen = [];
    const result = await checkForm({ tree, base: baseOf(tree), fp, onProgress: (done, total) => seen.push([done, total]) });
    expect(seen[0]).toEqual([0, result.scenarios]);
    expect(seen.every(([done, total]) => done <= total && total === result.scenarios)).toBe(true);
  });

  it('fails loudly instead of calling every calculation empty when the engine is missing', async () => {
    await expect(run([calc('c', "'x'")], null)).rejects.toThrow(/FHIRPath/);
  });
});
