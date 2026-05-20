// Tests for evalConstraints in js/state.js.
// evalConstraints is pure — fp, qr, varEnv all injected.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Vue reactivity CDN (state.js imports it at module level)
vi.mock('https://unpkg.com/@vue/reactivity@3/dist/reactivity.esm-browser.js', () => ({
  ref: v => ({ value: v }),
  reactive: v => v,
  effect: fn => fn(),
}));

// Mock fhirpath evaluate — routes by expression string
function makeFp(routes) {
  return { evaluate: vi.fn((qr, expr, env) => routes[expr] ?? []) };
}

const { evalConstraints, getValue, setValue, getAllValues, deleteValue, clearAllValues } = await import('../js/state.js');

// ── getAllValues ───────────────────────────────────────────────────────────────
describe('getAllValues', () => {
  beforeEach(() => clearAllValues());

  it('returns empty array when no value set', () => {
    expect(getAllValues('q1')).toEqual([]);
  });

  it('returns [primary] when only primary value set', () => {
    setValue('q1', 'hello');
    expect(getAllValues('q1')).toEqual(['hello']);
  });

  it('returns primary + repeat rows in order', () => {
    setValue('q1', 'first');
    setValue('q1$$n', 2);
    setValue('q1$$1', 'second');
    setValue('q1$$2', 'third');
    expect(getAllValues('q1')).toEqual(['first', 'second', 'third']);
  });

  it('skips undefined repeat slots', () => {
    setValue('q1', 'first');
    setValue('q1$$n', 2);
    setValue('q1$$1', 'second');
    // $$2 deliberately not set
    expect(getAllValues('q1')).toEqual(['first', 'second']);
  });

  it('returns only repeat rows when primary not set', () => {
    setValue('q1$$n', 1);
    setValue('q1$$1', 'only-repeat');
    expect(getAllValues('q1')).toEqual(['only-repeat']);
  });
});


// ── baseline ──────────────────────────────────────────────────────────────────
describe('evalConstraints — baseline', () => {
  it('returns true when node has no constraints', () => {
    expect(evalConstraints({ constraint: [] }, null, null, {})).toBe(true);
  });

  it('returns true when node.constraint is undefined', () => {
    expect(evalConstraints({}, null, null, {})).toBe(true);
  });

  it('returns true when fp is null', () => {
    const node = { constraint: [{ key: 'k', severity: 'error', expression: 'true' }] };
    expect(evalConstraints(node, null, {}, {})).toBe(true);
  });

  it('returns true when qr is null', () => {
    const node = { constraint: [{ key: 'k', severity: 'error', expression: 'true' }] };
    const fp = makeFp({ 'true': [true] });
    expect(evalConstraints(node, fp, null, {})).toBe(true);
  });
});

// ── severity filtering ────────────────────────────────────────────────────────
describe('evalConstraints — severity', () => {
  it('ignores warning-severity constraints (never blocks)', () => {
    const node = { constraint: [{ key: 'w', severity: 'warning', expression: 'false' }] };
    const fp = makeFp({ 'false': [false] });
    expect(evalConstraints(node, fp, {}, {})).toBe(true);
  });

  it('evaluates error-severity constraint', () => {
    const node = { constraint: [{ key: 'e', severity: 'error', expression: 'true' }] };
    const fp = makeFp({ 'true': [true] });
    expect(evalConstraints(node, fp, {}, {})).toBe(true);
  });

  it('fails on error-severity constraint returning false', () => {
    const node = { constraint: [{ key: 'e', severity: 'error', expression: 'false' }] };
    const fp = makeFp({ 'false': [false] });
    expect(evalConstraints(node, fp, {}, {})).toBe(false);
  });
});

// ── expression results ────────────────────────────────────────────────────────
describe('evalConstraints — expression results', () => {
  it('returns false when expression yields empty array', () => {
    const node = { constraint: [{ key: 'e', severity: 'error', expression: 'missing' }] };
    const fp = makeFp({ 'missing': [] });
    expect(evalConstraints(node, fp, {}, {})).toBe(false);
  });

  it('returns false when expression yields [false]', () => {
    const node = { constraint: [{ key: 'e', severity: 'error', expression: 'expr' }] };
    const fp = makeFp({ 'expr': [false] });
    expect(evalConstraints(node, fp, {}, {})).toBe(false);
  });

  it('returns true when expression yields [true]', () => {
    const node = { constraint: [{ key: 'e', severity: 'error', expression: 'expr' }] };
    const fp = makeFp({ 'expr': [true] });
    expect(evalConstraints(node, fp, {}, {})).toBe(true);
  });

  it('returns false on expression throw', () => {
    const node = { constraint: [{ key: 'e', severity: 'error', expression: 'bad' }] };
    const fp = { evaluate: () => { throw new Error('parse error'); } };
    expect(evalConstraints(node, fp, {}, {})).toBe(false);
  });

  it('skips constraint with empty expression', () => {
    const node = { constraint: [{ key: 'e', severity: 'error', expression: '' }] };
    const fp = makeFp({});
    expect(evalConstraints(node, fp, {}, {})).toBe(true);
  });
});

// ── multiple constraints ──────────────────────────────────────────────────────
describe('evalConstraints — multiple constraints', () => {
  it('ALL error constraints must pass', () => {
    const node = {
      constraint: [
        { key: 'a', severity: 'error', expression: 'pass' },
        { key: 'b', severity: 'error', expression: 'fail' },
      ],
    };
    const fp = makeFp({ 'pass': [true], 'fail': [false] });
    expect(evalConstraints(node, fp, {}, {})).toBe(false);
  });

  it('returns true when all error constraints pass', () => {
    const node = {
      constraint: [
        { key: 'a', severity: 'error', expression: 'pass' },
        { key: 'b', severity: 'error', expression: 'pass' },
      ],
    };
    const fp = makeFp({ 'pass': [true] });
    expect(evalConstraints(node, fp, {}, {})).toBe(true);
  });

  it('warning does not block when error passes', () => {
    const node = {
      constraint: [
        { key: 'a', severity: 'error',   expression: 'pass' },
        { key: 'b', severity: 'warning', expression: 'fail' },
      ],
    };
    const fp = makeFp({ 'pass': [true], 'fail': [false] });
    expect(evalConstraints(node, fp, {}, {})).toBe(true);
  });
});

// ── varEnv / %resource ────────────────────────────────────────────────────────
describe('evalConstraints — environment', () => {
  it('passes resource and varEnv to fp.evaluate', () => {
    const node = { constraint: [{ key: 'e', severity: 'error', expression: 'expr' }] };
    const qr = { resourceType: 'QuestionnaireResponse', item: [] };
    const varEnv = { someVar: 42 };
    const fp = { evaluate: vi.fn(() => [true]) };
    evalConstraints(node, fp, qr, varEnv);
    expect(fp.evaluate).toHaveBeenCalledWith(
      qr, 'expr', { resource: qr, someVar: 42 }
    );
  });
});
