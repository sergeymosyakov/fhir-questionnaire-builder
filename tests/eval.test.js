// Tests for evalRule (inline) and evaluateNode.
// evalRule lives in state.js which imports @vue/reactivity (CDN only).
// We test the same logic inline to keep tests dependency-free,
// then test evaluateNode via vi.mock of state.js.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── evalRule — tested inline (same logic as state.js) ────────────────────────
// This ensures we catch regressions in the rule-evaluation algorithm itself.

const evalRule = (rule, ctx, values = {}) => {
  if (!rule || !rule.trim()) return true;
  try {
    return !!new Function(
      'age', 'gender', 'bmi', 'pregnant', 'smoker', 'proc', 'comorb', 'values',
      'return (' + rule + ');'
    )(ctx.age, ctx.gender, ctx.bmi, ctx.pregnant, ctx.smoker, ctx.proc, ctx.comorb, values);
  } catch (_) { return false; }
};

const CTX = { age: 45, gender: 'male', bmi: 32, pregnant: false, smoker: true, proc: '', comorb: '' };

describe('evalRule', () => {
  it('returns true for empty/null rule', () => {
    expect(evalRule('', CTX)).toBe(true);
    expect(evalRule(null, CTX)).toBe(true);
    expect(evalRule('  ', CTX)).toBe(true);
  });

  it('evaluates a simple age comparison', () => {
    expect(evalRule('age >= 40', CTX)).toBe(true);
    expect(evalRule('age < 40', CTX)).toBe(false);
  });

  it('evaluates gender check', () => {
    expect(evalRule("gender === 'male'", CTX)).toBe(true);
    expect(evalRule("gender === 'female'", CTX)).toBe(false);
  });

  it('evaluates bmi threshold', () => {
    expect(evalRule('bmi > 30', CTX)).toBe(true);
    expect(evalRule('bmi > 40', CTX)).toBe(false);
  });

  it('evaluates values lookup', () => {
    const values = { q1: 'yes' };
    expect(evalRule("values['q1'] === 'yes'", CTX, values)).toBe(true);
    expect(evalRule("values['q1'] === 'no'", CTX, values)).toBe(false);
  });

  it('returns false for syntax errors', () => {
    expect(evalRule('age ===', CTX)).toBe(false);
    expect(evalRule('{{invalid}}', CTX)).toBe(false);
  });

  it('evaluates compound conditions', () => {
    expect(evalRule('age > 40 && smoker === true', CTX)).toBe(true);
    expect(evalRule('age > 40 && smoker === false', CTX)).toBe(false);
  });
});

// ── evaluateNode — via vi.mock of state.js ────────────────────────────────────
vi.mock('../js/state.js', () => ({
  evalRule: (rule, ctx) => evalRule(rule, ctx),
}));

const { evaluateNode, markAllDisabled } = await import('../js/eval.js');

const BASE_CTX = { age: 30, gender: 'female', bmi: 22, pregnant: false, smoker: false, proc: '', comorb: '' };

describe('markAllDisabled', () => {
  it('marks all nodes in subtree as disabled', () => {
    const nodes = [
      { id: 'a', type: 'item' },
      { id: 'b', type: 'group', children: [{ id: 'c', type: 'item' }] },
    ];
    const results = [];
    markAllDisabled(nodes, results);
    expect(results).toHaveLength(3);
    expect(results.every(r => r.disabled && r.visible && r.ok)).toBe(true);
  });
});

describe('evaluateNode — item', () => {
  it('visible item with no rules → ok', () => {
    const node = { id: 'q1', type: 'item', mandatory: true };
    const results = [];
    const r = evaluateNode(node, BASE_CTX, results);
    expect(r.visible).toBe(true);
    // ok depends on conditionRule (undefined → evalRule → true)
    expect(r.ok).toBe(true);
  });

  it('hidden by visibilityRule → not visible', () => {
    const node = { id: 'q1', type: 'item', visibilityRule: 'age > 50' };
    const results = [];
    const r = evaluateNode(node, BASE_CTX, results);
    expect(r.visible).toBe(false);
  });

  it('mandatory false → ok even without conditionRule', () => {
    const node = { id: 'q1', type: 'item', mandatory: false };
    const results = [];
    const r = evaluateNode(node, BASE_CTX, results);
    expect(r.ok).toBe(true);
  });

  it('showDimmed set when _enableWhenText present', () => {
    const node = { id: 'q1', type: 'item', visibilityRule: 'age > 50', _enableWhenText: 'Age > 50' };
    const results = [];
    const r = evaluateNode(node, BASE_CTX, results);
    expect(r.visible).toBe(false);
    expect(r.showDimmed).toBe(true);
  });
});

describe('evaluateNode — group', () => {
  it('group with all visible children → visible', () => {
    const node = {
      id: 'g1', type: 'group', children: [
        { id: 'c1', type: 'item', mandatory: false },
        { id: 'c2', type: 'item', mandatory: false },
      ],
    };
    const results = [];
    const r = evaluateNode(node, BASE_CTX, results);
    expect(r.visible).toBe(true);
    expect(results.length).toBe(3); // group + 2 children
  });

  it('group disabled by conditionRule → subtree disabled', () => {
    const node = {
      id: 'g1', type: 'group',
      conditionRule: 'age > 50',
      children: [{ id: 'c1', type: 'item' }],
    };
    const results = [];
    const r = evaluateNode(node, BASE_CTX, results);
    expect(r.disabled).toBe(true);
  });

  it('AND group ok only if all children ok', () => {
    const node = {
      id: 'g1', type: 'group', logicWithParent: 'AND',
      children: [
        { id: 'c1', type: 'item', mandatory: true, conditionRule: 'true' },
        { id: 'c2', type: 'item', mandatory: true, conditionRule: 'false' },
      ],
    };
    const results = [];
    const r = evaluateNode(node, BASE_CTX, results);
    expect(r.ok).toBe(false);
  });

  it('OR group ok if any child ok', () => {
    const node = {
      id: 'g1', type: 'group', logicWithParent: 'OR',
      children: [
        { id: 'c1', type: 'item', mandatory: true, conditionRule: 'false' },
        { id: 'c2', type: 'item', mandatory: true, conditionRule: 'true' },
      ],
    };
    const results = [];
    const r = evaluateNode(node, BASE_CTX, results);
    expect(r.ok).toBe(true);
  });
});
