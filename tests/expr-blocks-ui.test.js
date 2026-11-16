// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { leafKinds, leafKind, leafFromBlock, registerLeafKind, LeafKind } from '../js/ui/modals/expr-blocks/leaves/index.js';
import { operandKinds, operandKind, registerOperand, OperandKind } from '../js/ui/modals/expr-blocks/operands/index.js';
import { parseExpression } from '../js/fhir/expr-builder/parse.js';
import { emit } from '../js/fhir/expr-builder/emit.js';
import { createQuestionSelect } from '../js/ui/modals/expr-blocks/question-select.js';
import { createQuestionList, availableFor } from '../js/ui/modals/expr-blocks/question-list.js';
import { ChainEditor } from '../js/ui/modals/expr-value/chain-editor.js';
import { createValueEditor } from '../js/ui/modals/expr-value/value-editor.js';
import { createLeafEditor } from '../js/ui/modals/expr-tree/leaf-editor.js';
import { createExprTreeEditor } from '../js/ui/modals/expr-tree/tree-editor.js';
import { NegateOperand } from '../js/ui/modals/expr-blocks/operands/negate.js';
import { TextOperand } from '../js/ui/modals/expr-blocks/operands/text.js';
import { literal } from '../js/fhir/expr-builder/model.js';
import { loadFhirpath } from './helpers/fhirpath-node.js';

const fp = loadFhirpath();
const ref = (id) => `%resource.item.where(linkId='g').item.where(linkId='${id}').answer.valueBoolean`;
const item = (id, itemType = 'checkbox') => ({ id, label: id, itemType, segments: ['g', id], answerAt: [] });
const items = [item('a'), item('b'), item('c'), item('n', 'integer'), item('w', 'decimal'), item('h', 'decimal')];

describe('condition leaf library', () => {
  it('holds the library kinds and refuses a duplicate or an id-less definition', () => {
    expect(leafKinds().map((d) => d.id)).toEqual(expect.arrayContaining(['any-answered', 'is-yes']));
    expect(() => registerLeafKind({ id: 'any-answered' })).toThrow(/already registered/);
    expect(() => registerLeafKind({})).toThrow(/needs "id"/);
  });

  it('reads (a | b | c).exists() as "at least one of" and writes the same text back', () => {
    const text = `(${ref('a')} | ${ref('b')} | ${ref('c')}).exists()`;
    const row = leafFromBlock(parseExpression(text, fp), items);
    expect(row).toBeInstanceOf(LeafKind);
    expect(row.constructor.id).toBe('any-answered');
    expect(row.picks.map((p) => p.item.id)).toEqual(['a', 'b', 'c']);
    expect(row.negate).toBe(false);
    expect(emit(row.toBlock())).toBe(text);
  });

  it('reads .empty() as "none of"', () => {
    const row = leafFromBlock(parseExpression(`(${ref('a')} | ${ref('b')}).empty()`, fp), items);
    expect(row.negate).toBe(true);
  });

  it('does not claim a union that mentions an unknown question, or a single question', () => {
    expect(leafFromBlock(parseExpression(`(${ref('a')} | ${ref('zzz')}).exists()`, fp), items)).toBeNull();
    expect(leafFromBlock(parseExpression(`${ref('a')}.exists()`, fp), items)).toBeNull();
  });

  it('is incomplete until two questions are chosen', () => {
    const fresh = leafKind('any-answered').create(items);
    expect(fresh.toBlock()).toBeNull();
  });

  it('starts from the question already chosen in the single-question row, and can go back to it', () => {
    const from = { item: items[1] };
    const leaf = leafKind('any-answered').create(items, from);
    expect(leaf.picks.map((p) => p.item?.id ?? null)).toEqual(['b', null]);
    expect(leaf.firstItem().id).toBe('b');
    expect(leaf.backLabel).toBe('one question');
  });

  it('reads a bare yes/no answer as "is Yes (checked)" and only for a yes/no question', () => {
    const row = leafFromBlock(parseExpression(ref('a'), fp), items);
    expect(row.constructor.id).toBe('is-yes');
    expect(emit(row.toBlock())).toBe(ref('a'));
    expect(leafFromBlock(parseExpression("%resource.item.where(linkId='g').item.where(linkId='n').answer.valueInteger", fp), items)).toBeNull();
  });
});

describe('operand library', () => {
  it('holds the conditional and "no value" operands and refuses a duplicate or an id-less definition', () => {
    expect(operandKinds().map((d) => d.id)).toEqual(expect.arrayContaining(['iif', 'empty']));
    expect(() => registerOperand({ id: 'iif' })).toThrow(/already registered/);
    expect(() => registerOperand({})).toThrow(/needs "id"/);
  });

  it('offers "no value" only inside a branch and only as its single value, and the conditional everywhere', () => {
    expect(operandKind('empty').available({ branch: false })).toBe(false);
    expect(operandKind('empty').available({ branch: true, alone: true })).toBe(true);
    expect(operandKind('empty').available({ branch: true })).toBe(true); // while a branch is being read
    expect(operandKind('empty').available({ branch: true, alone: false })).toBe(false);
    expect(operandKind('iif').available({ branch: false })).toBe(true);
  });

  it('refuses a kind that reuses the id of a built-in operand', () => {
    class Clash extends OperandKind { static id = 'num'; static label = 'x'; }
    expect(() => registerOperand(Clash)).toThrow(/built-in/);
  });

  it('are subclasses of the shared base, which gives every kind its defaults', () => {
    for (const Kind of operandKinds()) {
      expect(Object.getPrototypeOf(Kind)).toBe(OperandKind);
      expect(Kind.id && Kind.label).toBeTruthy();
    }
    for (const Kind of leafKinds()) expect(Object.getPrototypeOf(Kind)).toBe(LeafKind);
  });
});

describe('question select', () => {
  const qs = (value) => createQuestionSelect({ items, value, onChange: () => {}, testid: 'q' });

  it('starts on the placeholder when no question is chosen, and shows the chosen one otherwise', () => {
    expect(qs().getValue()).toBe('');
    expect(qs('b').getValue()).toBe('b');
  });

  it('names itself for screen readers', () => {
    const el = qs().el;
    expect(el.getAttribute('aria-label') ?? el.querySelector('[aria-label]')?.getAttribute('aria-label')).toBe('Question');
  });
});

describe('calculated-value condition leaves', () => {
  const dec = (id) => `%resource.item.where(linkId='g').item.where(linkId='${id}').answer.valueDecimal`;
  const ctx = { createChain: (opts = {}) => new ChainEditor({ items, allItems: items, variables: [], fp, onChange: () => {}, nested: true, ...opts }) };
  const read = (text) => leafFromBlock(parseExpression(text, fp), items, ctx);

  it('read "<calculation> < number" and write the same text back', () => {
    const text = `(${dec('w')} / (${dec('h')} * ${dec('h')})) < 18.5`;
    const leaf = read(text);
    expect(leaf.constructor.id).toBe('value-compare');
    expect(leaf.op).toBe('<');
    expect(leaf.value).toBe('18.5');
    expect(leaf.open).toBe(false);
    expect(emit(leaf.toBlock())).toBe(emit(parseExpression(text, fp)));
  });

  it('read "<calculation> can be calculated" and "cannot be calculated"', () => {
    const can = read(`(${dec('w')} / ${dec('h')}).exists()`);
    expect(can.constructor.id).toBe('value-exists');
    expect(can.negate).toBe(false);
    expect(read(`(${dec('w')} / ${dec('h')}).empty()`).negate).toBe(true);
    expect(emit(can.toBlock())).toBe(`(${dec('w')} / ${dec('h')}).exists()`);
  });

  it('leave the ordinary rows alone: a plain question, a text comparison, or no way to nest a calculation', () => {
    expect(read(`${dec('w')} < 18.5`)?.constructor.id).not.toBe('value-compare');
    expect(read(`(${dec('w')} / ${dec('h')}) = 'x'`)).toBeNull();
    expect(read(`${dec('w')}.exists()`)?.constructor.id).not.toBe('value-exists');
    expect(leafFromBlock(parseExpression(`(${dec('w')} / ${dec('h')}) < 18.5`, fp), items, {})).toBeNull();
  });

  it('are incomplete until the calculation and the number are given', () => {
    const fresh = leafKind('value-compare').create(items, null, ctx);
    expect(fresh.open).toBe(true);
    expect(fresh.toBlock()).toBeNull();
  });
});

describe('editing the calculation inside a condition leaf', () => {
  const dec = (id) => `%resource.item.where(linkId='g').item.where(linkId='${id}').answer.valueDecimal`;

  it('reaches the leaf, so the condition text and the result follow (it used to stay stale)', () => {
    const exprIn = `iif((${dec('w')} / ${dec('h')}) < 18.5, 1, 2)`;
    const ve = createValueEditor({ items, allItems: items, variables: [], fp, initialExpr: exprIn });
    expect(ve.seeded).toBe(true);
    expect(ve.getExpr()).toBe(exprIn);
    // open the calculation and add an operand inside it: the written expression must change at once
    ve.el.querySelector('[data-testid="eb-calc-edit"]').click();
    ve.el.querySelector('[data-testid="eb-leaf-chain"] [data-testid="eb-branch-add"]').click();
    // the new operand is still blank, so the expression is incomplete — it is no longer the stale original
    expect(ve.getExpr()).toBe('');
  });

  it('tells the leaf\'s host about every edit of the calculation', () => {
    const ctx = { createChain: (opts = {}) => new ChainEditor({ items, allItems: items, variables: [], fp, onChange: () => {}, nested: true, ...opts }) };
    const leaf = leafFromBlock(parseExpression(`(${dec('w')} / ${dec('h')}) < 18.5`, fp), items, ctx);
    let notified = 0;
    leaf.render(document.createElement('span'), { notify: () => { notified += 1; }, rerender: () => {} });
    leaf.chain.addOperand();
    expect(notified).toBe(1);
  });
});

describe('text operand', () => {
  it('does not claim an empty string, which it cannot hold', () => {
    expect(TextOperand.fromBlock(literal('string', ''), {})).toBeNull();
    expect(TextOperand.fromBlock(literal('string', 'x'), {})).toBeInstanceOf(TextOperand);
    const ve = createValueEditor({ items, allItems: items, variables: [], fp, initialExpr: `iif(${ref('a')}, '', 'y')` });
    expect(ve.seeded).toBe(false); // stays as text instead of opening blocks it cannot write back
  });
});

describe('condition rows keep the expression exactly as it was', () => {
  const codeItem = { id: 'sex', label: 'Sex', itemType: 'radio', segments: ['g', 'sex'], answerAt: [] };
  const num = { id: 'w', label: 'W', itemType: 'decimal', segments: ['g', 'w'], answerAt: [] };
  const apply = (text, its) => createLeafEditor({ expr: text, items: its, fp, onChange: () => {} }).getExpr();
  const at = (id, acc) => `%resource.item.where(linkId='g').item.where(linkId='${id}').answer.${acc}`;

  it('keeps which part of the answer is looked at (a code is not the same as any answer)', () => {
    expect(apply(`${at('sex', 'valueCoding.code')}.exists()`, [codeItem])).toBe(`${at('sex', 'valueCoding.code')}.exists()`);
    expect(apply(`${at('sex', 'valueCoding.code')}.empty()`, [codeItem])).toBe(`${at('sex', 'valueCoding.code')}.empty()`);
    expect(apply(`${at('sex', 'valueCoding.code')} = 'LA3-6'`, [codeItem])).toBe(`${at('sex', 'valueCoding.code')} = 'LA3-6'`);
    expect(apply(`${at('w', 'valueDecimal')}.exists()`, [num])).toBe(`${at('w', 'valueDecimal')}.exists()`);
  });

  it('keeps a comparison of the answer itself (no accessor) exactly as written', () => {
    const textItem = { id: 's', label: 'S', itemType: 'text', segments: ['g', 's'], answerAt: [] };
    const expr = "%resource.item.where(linkId='g').item.where(linkId='s').answer = 'x'";
    expect(apply(expr, [textItem])).toBe(expr);
  });

  it('leaves a word compared with a number box as text instead of writing NaN', () => {
    expect(apply(`${at('w', 'valueDecimal')} = 'female'`, [num])).toBe(`${at('w', 'valueDecimal')} = 'female'`);
  });
});

describe('a half-built condition survives the tree being redrawn', () => {
  it('keeps a calculation leaf that has no text yet when another condition is added', () => {
    const dec = [item('w', 'decimal'), item('h', 'decimal')];
    const ctx = { createChain: (opts = {}) => new ChainEditor({ items: dec, allItems: dec, variables: [], fp, onChange: () => {}, nested: true, ...opts }) };
    const tree = createExprTreeEditor({ initialExpr: '', items: dec, fp, onChange: () => {}, createChain: ctx.createChain });
    tree.el.querySelector('[data-testid="eb-leaf-kind-value-compare"]').click();
    expect(tree.el.querySelectorAll('[data-testid="eb-leaf-chain"]').length).toBe(1);
    tree.el.querySelector('[data-testid="eb-add-condition"]').click(); // redraws the whole tree
    expect(tree.el.querySelectorAll('[data-testid="eb-leaf-chain"]').length).toBe(1); // still there, not blank
    expect(tree.el.querySelectorAll('[data-testid="eb-leaf"]').length).toBe(2);
  });
});

describe('question list', () => {
  const entries = () => [{ item: items[0] }, { item: items[1] }, { item: null }];
  const list = (e, opts = {}) => createQuestionList({ entries: e, items, blank: () => ({ item: null }), onPick: (en, it) => { en.item = it; }, notify: () => {}, testids: { item: 'i', add: 'a', remove: 'r' }, ...opts });

  it('offers a question to one entry only: the others cannot pick it again', () => {
    const e = entries();
    expect(availableFor(e, e[2], items).map((it) => it.id)).not.toContain('a');
    expect(availableFor(e, e[2], items).map((it) => it.id)).not.toContain('b');
    expect(availableFor(e, e[0], items).map((it) => it.id)).toContain('a'); // its own choice stays
    expect(availableFor(e, e[2], items).map((it) => it.id)).toContain('c');
  });

  it('is a labelled group, and its remove buttons say which question they remove', () => {
    const box = list(entries(), { labels: { group: 'Questions of the scale' } });
    expect(box.getAttribute('role')).toBe('group');
    expect(box.getAttribute('aria-label')).toBe('Questions of the scale');
    expect([...box.querySelectorAll('[data-testid="r"]')].map((b) => b.getAttribute('aria-label'))).toEqual(['Remove question 1', 'Remove question 2', 'Remove question 3']);
  });

  it('adds and removes entries in place, never going below the minimum', () => {
    const e = [{ item: items[0] }, { item: items[1] }];
    const box = list(e, { min: 2 });
    expect(box.querySelectorAll('[data-testid="r"]').length).toBe(0); // at the minimum: nothing to remove
    document.body.appendChild(box);
    box.querySelector('[data-testid="a"]').click();
    expect(e.length).toBe(3);
    expect(box.querySelectorAll('[data-testid="r"]').length).toBe(3);
    box.querySelector('[data-testid="r"]').click();
    expect(e.length).toBe(2);
    expect(document.activeElement).toBe(box.querySelector('[data-testid="a"]')); // focus goes to "+", not lost
    box.remove();
  });
});

describe('square root, power and minus in the value editor', () => {
  const dec = (id) => `%resource.item.where(linkId='g').item.where(linkId='${id}').answer.valueDecimal`;
  const writes = (expr) => {
    const ve = createValueEditor({ items, allItems: items, variables: [], fp, initialExpr: expr });
    return { seeded: ve.seeded, out: ve.getExpr(), ve };
  };

  it('opens each as blocks and writes the same text back', () => {
    for (const expr of [
      `((${dec('w')} * ${dec('h')}) / 3600).sqrt().round(2)`,
      `(${dec('w')} / (60 / ${dec('h')}).power(1 / 3)).round(0)`,
      `0.9938.power(${dec('w')})`,
      `${dec('w')}.power(-1.2)`,
      `-(${dec('w')} + 1)`,
      `${dec('w')} * -0.5`,
    ]) {
      const { seeded, out } = writes(expr);
      expect(seeded, expr).toBe(true);
      expect(out, expr).toBe(expr);
    }
  });

  it('shows the power as a block with its two chains, and an edit of the exponent is written', () => {
    const { ve } = writes(`${dec('w')}.power(1 / 3)`);
    expect(ve.el.querySelector('[data-testid="eb-power"]')).not.toBeNull();
    const nums = ve.el.querySelectorAll('[data-testid="eb-power-exp-chain"] [data-testid="eb-operand-num"]');
    nums[1].value = '2';
    nums[1].dispatchEvent(new Event('input', { bubbles: true }));
    expect(ve.getExpr()).toBe(`${dec('w')}.power(1 / 2)`);
  });

  it('leaves -<answer> as text (fhirpath.js cannot evaluate it) and builds Minus of an answer as 0 - answer', () => {
    expect(writes(`-${dec('w')}`).seeded).toBe(false);
    const ve = createValueEditor({ items, allItems: items, variables: [], fp, initialExpr: `-(${dec('w')} + 1)` });
    expect(ve.seeded).toBe(true);
    const chain = ve.el.querySelector('[data-testid="eb-negate-chain"]');
    expect(chain).not.toBeNull();
    const answer = parseExpression(dec('w'), fp);
    const built = new NegateOperand({}, { getBlock: () => answer }).toBlock();
    expect(emit(built)).toBe(`0 - ${dec('w')}`);
  });

  it('keeps a top-level square root as an operand, not under "Round the result"', () => {
    const { ve } = writes(`${dec('w')}.sqrt()`);
    expect(ve.el.querySelector('[data-testid="eb-wrap-fn"]').dataset.value).toBe('');
    expect(ve.el.querySelector('[data-testid="eb-math-fn"]').dataset.value).toBe('sqrt');
  });
});

describe('keep the result only if, in the value editor', () => {
  const dec = (id) => `%resource.item.where(linkId='g').item.where(linkId='${id}').answer.valueDecimal`;
  const make = (expr) => createValueEditor({ items, allItems: items, variables: [], fp, initialExpr: expr });

  it('opens a test on the result as its own row and writes the same text back', () => {
    for (const expr of [`(${dec('w')} / ${dec('h')}).where($this >= 0)`, `(${dec('w')} * 2).round(1).where($this > 10)`]) {
      const ve = make(expr);
      expect(ve.seeded, expr).toBe(true);
      expect(ve.getExpr(), expr).toBe(expr);
    }
    const ve = make(`(${dec('w')} / 2).where($this >= 0)`);
    expect(ve.el.querySelector('[data-testid="eb-keep-op"]').dataset.value).toBe('>=');
    expect(ve.el.querySelector('[data-testid="eb-keep-value"]').value).toBe('0');
  });

  it('writes the edited number, and nothing while the number is missing', () => {
    const ve = make(`(${dec('w')} / 2).where($this >= 0)`);
    const inp = ve.el.querySelector('[data-testid="eb-keep-value"]');
    inp.value = '5';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    expect(ve.getExpr()).toBe(`(${dec('w')} / 2).where($this >= 5)`);
    inp.value = '';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    expect(ve.getExpr()).toBe('');
  });

  it('has no test by default', () => {
    expect(make(`${dec('w')} / 2`).el.querySelector('[data-testid="eb-keep-op"]').dataset.value).toBe('');
  });
});
