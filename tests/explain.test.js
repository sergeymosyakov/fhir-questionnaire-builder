// ── Unit tests: js/fhir/explain.js ───────────────────────────────────────────
// Tests parseExprTree (parser) and evaluateExprTree (evaluator).
// All logic is pure — no DOM, no state, no mocks required for parseExprTree.

import { describe, it, expect, vi } from 'vitest';
import { parseExprTree, evaluateExprTree } from '../js/fhir/explain.js';

// ── parseExprTree ─────────────────────────────────────────────────────────────

describe('parseExprTree — LEAF', () => {
  it('simple expression becomes a LEAF', () => {
    expect(parseExprTree('age > 18')).toEqual({ type: 'LEAF', expr: 'age > 18' });
  });

  it('trims surrounding whitespace', () => {
    expect(parseExprTree('  x = 1  ')).toEqual({ type: 'LEAF', expr: 'x = 1' });
  });

  it('function call without and/or is a LEAF', () => {
    const t = parseExprTree('fn(a and b)');
    expect(t.type).toBe('LEAF');
    expect(t.expr).toBe('fn(a and b)');
  });

  it('does not split on "and" inside a string literal', () => {
    const t = parseExprTree("name = 'bread and butter'");
    expect(t.type).toBe('LEAF');
  });

  it('does not split on "or" inside a string literal', () => {
    const t = parseExprTree("code = 'one or two'");
    expect(t.type).toBe('LEAF');
  });
});

describe('parseExprTree — AND', () => {
  it('splits two-term AND', () => {
    const t = parseExprTree('a > 0 and b = true');
    expect(t.type).toBe('AND');
    expect(t.children).toHaveLength(2);
    expect(t.children[0]).toEqual({ type: 'LEAF', expr: 'a > 0' });
    expect(t.children[1]).toEqual({ type: 'LEAF', expr: 'b = true' });
  });

  it('splits three-term AND', () => {
    const t = parseExprTree('a and b and c');
    expect(t.type).toBe('AND');
    expect(t.children).toHaveLength(3);
    expect(t.children.map(c => c.expr)).toEqual(['a', 'b', 'c']);
  });

  it('is case-insensitive (AND)', () => {
    expect(parseExprTree('a AND b').type).toBe('AND');
  });
});

describe('parseExprTree — OR', () => {
  it('splits two-term OR', () => {
    const t = parseExprTree('a = 1 or b = 2');
    expect(t.type).toBe('OR');
    expect(t.children).toHaveLength(2);
    expect(t.children[0]).toEqual({ type: 'LEAF', expr: 'a = 1' });
    expect(t.children[1]).toEqual({ type: 'LEAF', expr: 'b = 2' });
  });

  it('is case-insensitive (OR)', () => {
    expect(parseExprTree('a OR b').type).toBe('OR');
  });
});

describe('parseExprTree — operator precedence', () => {
  it('"a and b or c" → OR at top level (OR has lower precedence)', () => {
    const t = parseExprTree('a and b or c');
    expect(t.type).toBe('OR');
    expect(t.children[0].type).toBe('AND');
    expect(t.children[1]).toEqual({ type: 'LEAF', expr: 'c' });
  });

  it('"a or b and c" → OR at top; right child is AND', () => {
    const t = parseExprTree('a or b and c');
    expect(t.type).toBe('OR');
    expect(t.children[0]).toEqual({ type: 'LEAF', expr: 'a' });
    expect(t.children[1].type).toBe('AND');
  });
});

describe('parseExprTree — NOT', () => {
  it('parses not(...)', () => {
    const t = parseExprTree('not(a > 0)');
    expect(t.type).toBe('NOT');
    expect(t.child).toEqual({ type: 'LEAF', expr: 'a > 0' });
  });

  it('is case-insensitive (NOT)', () => {
    expect(parseExprTree('NOT(x = 1)').type).toBe('NOT');
  });

  it('NOT wrapping an AND', () => {
    const t = parseExprTree('not(a and b)');
    expect(t.type).toBe('NOT');
    expect(t.child.type).toBe('AND');
  });
});

describe('parseExprTree — parentheses', () => {
  it('unwraps fully-wrapping outer parens', () => {
    expect(parseExprTree('(a > 0 and b = 1)').type).toBe('AND');
  });

  it('does not unwrap partial parens like "(a) or (b)"', () => {
    const t = parseExprTree('(a) or (b)');
    expect(t.type).toBe('OR');
  });

  it('returns expression unchanged when opening paren has no matching close', () => {
    const t = parseExprTree('(unmatched');
    expect(t.type).toBe('LEAF');
    expect(t.expr).toBe('(unmatched');
  });

  it('handles nested parens inside AND', () => {
    const t = parseExprTree('x > 0 and (y = 1 or z = 2)');
    expect(t.type).toBe('AND');
    expect(t.children[0]).toEqual({ type: 'LEAF', expr: 'x > 0' });
    expect(t.children[1].type).toBe('OR');
  });
});

// ── evaluateExprTree ──────────────────────────────────────────────────────────

/** Build a mock fp that maps expr strings → boolean | number | throw */
function makeFp(map) {
  return {
    evaluate: vi.fn((resource, expr) => {
      if (!(expr in map)) return [];
      const v = map[expr];
      if (v === 'throw') throw new Error('eval error: ' + expr);
      return [v];
    }),
  };
}

describe('evaluateExprTree — LEAF', () => {
  it('result=true when fp returns [true]', () => {
    const fp = makeFp({ 'x': true });
    const n = evaluateExprTree(parseExprTree('x'), fp, {}, {});
    expect(n.result).toBe(true);
  });

  it('result=false when fp returns [false]', () => {
    const fp = makeFp({ 'x': false });
    const n = evaluateExprTree(parseExprTree('x'), fp, {}, {});
    expect(n.result).toBe(false);
  });

  it('result=false when fp returns [] (empty)', () => {
    const fp = { evaluate: vi.fn(() => []) };
    const n = evaluateExprTree(parseExprTree('x'), fp, {}, {});
    expect(n.result).toBe(false);
  });

  it('result=true for non-zero number', () => {
    const fp = makeFp({ 'score': 5 });
    const n = evaluateExprTree(parseExprTree('score'), fp, {}, {});
    expect(n.result).toBe(true);
  });

  it('result=false for zero', () => {
    const fp = makeFp({ 'score': 0 });
    const n = evaluateExprTree(parseExprTree('score'), fp, {}, {});
    expect(n.result).toBe(false);
  });

  it('result=true for string "true"', () => {
    const fp = makeFp({ 'x': 'true' });
    const n = evaluateExprTree(parseExprTree('x'), fp, {}, {});
    expect(n.result).toBe(true);
  });

  it('result=false for string "false"', () => {
    const fp = makeFp({ 'x': 'false' });
    const n = evaluateExprTree(parseExprTree('x'), fp, {}, {});
    expect(n.result).toBe(false);
  });

  it('result=null and error set when fp throws', () => {
    const fp = makeFp({ 'bad': 'throw' });
    const n = evaluateExprTree(parseExprTree('bad'), fp, {}, {});
    expect(n.result).toBe(null);
    expect(n.error).toBe('eval error: bad');
  });

  it('returns the node (for chaining)', () => {
    const fp = makeFp({ 'x': true });
    const node = parseExprTree('x');
    expect(evaluateExprTree(node, fp, {}, {})).toBe(node);
  });
});

describe('evaluateExprTree — NOT', () => {
  it('inverts true → false', () => {
    const fp = makeFp({ 'a > 0': true });
    const n = evaluateExprTree(parseExprTree('not(a > 0)'), fp, {}, {});
    expect(n.result).toBe(false);
  });

  it('inverts false → true', () => {
    const fp = makeFp({ 'a > 0': false });
    const n = evaluateExprTree(parseExprTree('not(a > 0)'), fp, {}, {});
    expect(n.result).toBe(true);
  });

  it('propagates null when child errors', () => {
    const fp = makeFp({ 'bad': 'throw' });
    const n = evaluateExprTree(parseExprTree('not(bad)'), fp, {}, {});
    expect(n.result).toBe(null);
  });
});

describe('evaluateExprTree — AND', () => {
  it('true when all children true', () => {
    const fp = makeFp({ 'a': true, 'b': true });
    expect(evaluateExprTree(parseExprTree('a and b'), fp, {}, {}).result).toBe(true);
  });

  it('false when any child false', () => {
    const fp = makeFp({ 'a': true, 'b': false });
    expect(evaluateExprTree(parseExprTree('a and b'), fp, {}, {}).result).toBe(false);
  });

  it('false when all children false', () => {
    const fp = makeFp({ 'a': false, 'b': false });
    expect(evaluateExprTree(parseExprTree('a and b'), fp, {}, {}).result).toBe(false);
  });
});

describe('evaluateExprTree — OR', () => {
  it('true when any child true', () => {
    const fp = makeFp({ 'a': false, 'b': true });
    expect(evaluateExprTree(parseExprTree('a or b'), fp, {}, {}).result).toBe(true);
  });

  it('false when all children false', () => {
    const fp = makeFp({ 'a': false, 'b': false });
    expect(evaluateExprTree(parseExprTree('a or b'), fp, {}, {}).result).toBe(false);
  });

  it('true when all children true', () => {
    const fp = makeFp({ 'a': true, 'b': true });
    expect(evaluateExprTree(parseExprTree('a or b'), fp, {}, {}).result).toBe(true);
  });
});

describe('evaluateExprTree — nested', () => {
  it('AND(true,true) OR false → true', () => {
    const fp = makeFp({ 'a > 0': true, 'b = true': true, 'c = 1': false });
    const n = evaluateExprTree(parseExprTree('a > 0 and b = true or c = 1'), fp, {}, {});
    expect(n.result).toBe(true);
  });

  it('AND(true,false) OR true → true', () => {
    const fp = makeFp({ 'a': true, 'b': false, 'c': true });
    const n = evaluateExprTree(parseExprTree('a and b or c'), fp, {}, {});
    expect(n.result).toBe(true);
  });

  it('AND(false,false) OR false → false', () => {
    const fp = makeFp({ 'a': false, 'b': false, 'c': false });
    const n = evaluateExprTree(parseExprTree('a and b or c'), fp, {}, {});
    expect(n.result).toBe(false);
  });
});
