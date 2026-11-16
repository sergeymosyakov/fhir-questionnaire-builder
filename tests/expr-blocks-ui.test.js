// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { leafKinds, leafKind, leafFromBlock, registerLeafKind, LeafKind } from '../js/ui/modals/expr-blocks/leaves/index.js';
import { operandKinds, operandKind, registerOperand, OperandKind } from '../js/ui/modals/expr-blocks/operands/index.js';
import { parseExpression } from '../js/fhir/expr-builder/parse.js';
import { emit } from '../js/fhir/expr-builder/emit.js';
import { createQuestionSelect } from '../js/ui/modals/expr-blocks/question-select.js';
import { ChainEditor } from '../js/ui/modals/expr-value/chain-editor.js';
import { createValueEditor } from '../js/ui/modals/expr-value/value-editor.js';
import { createLeafEditor } from '../js/ui/modals/expr-tree/leaf-editor.js';
import { createExprTreeEditor } from '../js/ui/modals/expr-tree/tree-editor.js';
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
