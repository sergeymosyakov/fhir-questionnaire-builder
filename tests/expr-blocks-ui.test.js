// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { leafKinds, leafKind, leafFromBlock, registerLeafKind, LeafKind } from '../js/ui/modals/expr-blocks/leaves/index.js';
import { operandKinds, operandKind, registerOperand, OperandKind } from '../js/ui/modals/expr-blocks/operands/index.js';
import { parseExpression } from '../js/fhir/expr-builder/parse.js';
import { emit } from '../js/fhir/expr-builder/emit.js';
import { createQuestionSelect } from '../js/ui/modals/expr-blocks/question-select.js';
import { loadFhirpath } from './helpers/fhirpath-node.js';

const fp = loadFhirpath();
const ref = (id) => `%resource.item.where(linkId='g').item.where(linkId='${id}').answer.valueBoolean`;
const item = (id, itemType = 'checkbox') => ({ id, label: id, itemType, segments: ['g', id], answerAt: [] });
const items = [item('a'), item('b'), item('c'), item('n', 'integer')];

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
