// @vitest-environment jsdom
// Repeat over answers: a condition leaf and a value operand that read and write repeat(item) expressions unchanged.
import { describe, it, expect } from 'vitest';
import { emit } from '../js/fhir/expr-builder/emit.js';
import { parseExpression } from '../js/fhir/expr-builder/parse.js';
import { leafFromBlock, leafKind } from '../js/ui/modals/expr-blocks/leaves/index.js';
import { createLeafEditor } from '../js/ui/modals/expr-tree/leaf-editor.js';
import { createExprTreeEditor } from '../js/ui/modals/expr-tree/tree-editor.js';
import { createValueEditor } from '../js/ui/modals/expr-value/value-editor.js';
import { loadFhirpath } from './helpers/fhirpath-node.js';

const fp = loadFhirpath();
const choice = (id) => ({ id, label: id, itemType: 'select', segments: [id], answerAt: [] });
const items = [choice('q1'), choice('q2'), { id: 'n', label: 'n', itemType: 'integer', segments: ['n'], answerAt: [] }];
const rep = (id, acc = 'valueCoding.code') => `%resource.repeat(item).where(linkId='${id}').answer.${acc}`;

describe('repeat leaf', () => {
  const leaf = (expr) => createLeafEditor({ expr, items, fp, onChange: () => {} });

  it('reads "has an answer" and "= value" written with repeat(item) as controls, not text', () => {
    for (const expr of [`${rep('q1')}.exists()`, `${rep('q1')} = 'LA33-6'`, `${rep('q2')} != 'x'`]) {
      const block = parseExpression(expr, fp);
      expect(leafFromBlock(block, items, {})?.constructor.id, expr).toBe('repeat');
      expect(leaf(expr).el.querySelector('[data-testid="eb-leaf-text"]'), expr).toBeNull();
    }
  });

  it('writes the same text back, keeping repeat(item)', () => {
    for (const expr of [`${rep('q1')}.exists()`, `${rep('q1')} = 'LA33-6'`, `${rep('q1')}.count()`, `${rep('q1')}.first()`]) {
      expect(leaf(expr).getExpr(), expr).toBe(expr);
    }
  });

  it('writes filters, a custom join separator, != and a boolean back unchanged', () => {
    for (const expr of [
      `${rep('q1')}.intersect(('a'|'b')).exists()`,
      `${rep('q1')}.join(' / ')`,
      `${rep('q1')} != 'x'`,
      `${rep('n', 'valueInteger')}.where($this > 5).count() >= 2`,
      `${rep('q1', 'valueBoolean')} = true`,
    ]) expect(leaf(expr).getExpr(), expr).toBe(expr);
  });

  it('keeps a pipeline over an unknown question as text', () => {
    expect(leafFromBlock(parseExpression(`${rep('gone')}.exists()`, fp), items, {})).toBeNull();
    expect(leaf(`${rep('gone')}.exists()`).el.querySelector('[data-testid="eb-leaf-text"]')).not.toBeNull();
  });

  it('carries the question of the row it replaces and offers the way back to it', () => {
    const leaf = leafKind('repeat').create(items, { item: items[1] });
    expect(leaf.toBlock().source.linkId).toBe('q2');
    expect(leaf.backLabel).toBe('one question');
    expect(leaf.firstItem()).toBe(items[1]);
  });

  it('types a new comparison by what the pipeline yields, and follows the reduce when it changes', () => {
    const leaf = leafKind('repeat').create(items);
    leaf.cmp = { op: '=', value: 'true', dataType: null };
    expect(emit(leaf.toBlock())).toMatch(/\.exists\(\) = true$/);
    leaf.editor._reduce.fn = 'count';
    leaf.cmp = { op: '>', value: '1', dataType: null };
    expect(emit(leaf.toBlock())).toMatch(/\.count\(\) > 1$/);
    leaf.editor._reduce.fn = 'join';
    expect(emit(leaf.toBlock())).toMatch(/\.join\(', '\) > '1'$/);
  });

  it('a compared literal read from an expression keeps its type until the reduce changes', () => {
    const leaf = leafFromBlock(parseExpression(`${rep('n', 'valueInteger')}.count() > 2`, fp), items, {});
    expect(emit(leaf.toBlock())).toBe(`${rep('n', 'valueInteger')}.count() > 2`);
    leaf.editor._reduce.fn = 'join';
    expect(emit(leaf.toBlock())).toMatch(/\.join\(', '\) > '2'$/);
  });

  it('types first / last by the answer type of a numeric question', () => {
    const leaf = leafKind('repeat').create(items, { item: items[2] });
    leaf.editor._reduce.fn = 'first';
    leaf.cmp = { op: '>', value: '5', dataType: null };
    expect(emit(leaf.toBlock())).toMatch(/\.first\(\) > 5$/);
  });

  it('claims a bare pipeline only as a yes/no; a count or a joined text stays as text', () => {
    expect(leafFromBlock(parseExpression(`${rep('q1')}.exists()`, fp), items, {})).not.toBeNull();
    for (const expr of [`${rep('q1')}.count()`, `${rep('q1')}.join(',')`, `${rep('q1')}.first()`]) {
      expect(leafFromBlock(parseExpression(expr, fp), items, {}), expr).toBeNull();
    }
  });

  it('is incomplete without a comparison unless it is a yes/no', () => {
    const leaf = leafKind('repeat').create(items);
    expect(leaf.toBlock().reduce).toEqual({ fn: 'exists' });
    leaf.editor._reduce.fn = 'count';
    expect(leaf.toBlock()).toBeNull();
  });

  it('starts a new leaf as a yes/no question', () => {
    expect(leafKind('repeat').create(items).toBlock().reduce).toEqual({ fn: 'exists' });
  });

  it('leaves a number compared with a repeat result to the repeat leaf, a plain question to its own row', () => {
    // with a value chain available, value-compare is a candidate too: the repeat leaf must still win
    const withChain = { createChain: () => ({ el: document.createElement('span'), setBlock: () => true, getBlock: () => null }) };
    expect(leafKind('value-compare').available(withChain)).toBe(true);
    expect(leafFromBlock(parseExpression(`${rep('n', 'valueInteger')}.count() > 2`, fp), items, withChain).constructor.id).toBe('repeat');
    expect(leafFromBlock(parseExpression(`%resource.item.where(linkId='q1').answer.valueCoding.code.exists()`, fp), items, {})).toBeNull();
  });

  it('keeps working inside an If condition tree with several repeat leaves', () => {
    const expr = `${rep('q1')}.exists() and ${rep('q2')}.exists()`;
    const tree = createExprTreeEditor({ initialExpr: expr, items, fp, onChange: () => {}, createChain: () => null });
    expect(tree.getExpr()).toBe(expr);
    expect(tree.el.querySelectorAll('[data-testid="eb-leaf-text"]').length).toBe(0);
  });
});

describe('repeat operand', () => {
  const make = (expr) => createValueEditor({ items, allItems: items, variables: [], fp, initialExpr: expr });

  it('does not claim a pipeline over an unknown question (the modal then keeps the text)', () => {
    expect(make(`${rep('gone')}.count() + 1`).seeded).toBe(false);
  });

  it('opens a repeat expression in the value editor and writes it back unchanged', () => {
    for (const expr of [`${rep('q1')}.count()`, `${rep('q1')}.join(', ')`]) {
      const ve = make(expr);
      expect(ve.seeded, expr).toBe(true);
      expect(ve.getExpr(), expr).toBe(expr);
    }
  });
});
