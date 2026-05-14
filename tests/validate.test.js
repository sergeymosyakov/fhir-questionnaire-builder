import { describe, it, expect, vi, beforeAll } from 'vitest';

// validate.js calls window.fhirpath for FHIRPath syntax checks.
// Provide a minimal stub so the module loads in Node.
beforeAll(() => {
  globalThis.window = {
    fhirpath: {
      compile: vi.fn(expr => {
        if (expr.startsWith('INVALID')) throw new Error('parse error');
      }),
    },
  };
});

const { validateTree } = await import('../js/fhir/validate.js');

// ── helpers ───────────────────────────────────────────────────────────────────
const makeItem = (overrides = {}) => ({
  id: 'q1', type: 'item', title: 'Question 1',
  itemType: 'text', options: '', mandatory: null,
  ...overrides,
});
const makeGroup = (overrides = {}) => ({
  id: 'g1', type: 'group', title: 'Group 1', children: [],
  ...overrides,
});

const errIds = (issues) => issues.filter(i => i.severity === 'error').map(i => i.nodeId);
const warnIds = (issues) => issues.filter(i => i.severity === 'warning').map(i => i.nodeId);

// ── empty tree ────────────────────────────────────────────────────────────────
describe('validateTree — empty tree', () => {
  it('returns no issues for empty tree', () => {
    expect(validateTree([])).toEqual([]);
  });
});

// ── linkId errors ─────────────────────────────────────────────────────────────
describe('validateTree — linkId', () => {
  it('errors on empty linkId', () => {
    const issues = validateTree([makeItem({ id: '' })]);
    expect(errIds(issues)).toContain('(empty)');
  });

  it('errors on duplicate linkIds', () => {
    const tree = [makeItem({ id: 'dup' }), makeItem({ id: 'dup', title: 'Q2' })];
    const issues = validateTree(tree);
    expect(errIds(issues).filter(id => id === 'dup')).toHaveLength(2);
  });

  it('no error for unique linkIds', () => {
    const tree = [makeItem({ id: 'a' }), makeItem({ id: 'b', title: 'Q2' })];
    expect(errIds(validateTree(tree))).toHaveLength(0);
  });
});

// ── title warnings ────────────────────────────────────────────────────────────
describe('validateTree — titles', () => {
  it('warns on empty title', () => {
    const issues = validateTree([makeItem({ id: 'q1', title: '' })]);
    expect(warnIds(issues)).toContain('q1');
  });

  it('warns on whitespace-only title', () => {
    const issues = validateTree([makeItem({ id: 'q1', title: '   ' })]);
    expect(warnIds(issues)).toContain('q1');
  });

  it('no warning for normal title', () => {
    const issues = validateTree([makeItem()]);
    expect(warnIds(issues)).toHaveLength(0);
  });
});

// ── options warnings ──────────────────────────────────────────────────────────
describe('validateTree — select/radio options', () => {
  it('warns when select has no options', () => {
    const issues = validateTree([makeItem({ id: 'q1', itemType: 'select', options: '' })]);
    expect(warnIds(issues)).toContain('q1');
  });

  it('warns when radio has no options', () => {
    const issues = validateTree([makeItem({ id: 'q1', itemType: 'radio', options: '' })]);
    expect(warnIds(issues)).toContain('q1');
  });

  it('no warning when select has options', () => {
    const issues = validateTree([makeItem({ id: 'q1', itemType: 'select', options: 'a=A,b=B' })]);
    expect(issues.filter(i => i.nodeId === 'q1' && i.severity === 'warning')).toHaveLength(0);
  });
});

// ── FHIRPath expression errors ──────────────────────────────────────────────
describe('validateTree — FHIRPath expression', () => {
  it('errors on invalid FHIRPath expression', () => {
    const issues = validateTree([makeItem({ id: 'q1', _calculatedExpr: 'INVALID expr' })]);
    expect(errIds(issues)).toContain('q1');
  });

  it('no error for valid FHIRPath expression', () => {
    const issues = validateTree([makeItem({ id: 'q1', _calculatedExpr: '%bmiCalc' })]);
    expect(errIds(issues)).toHaveLength(0);
  });
});

// ── reference item ──────────────────────────────────────────────────────────
describe('validateTree — reference item', () => {
  it('warns when no referenceResource defined', () => {
    const issues = validateTree([makeItem({ id: 'q1', itemType: 'reference' })]);
    expect(warnIds(issues)).toContain('q1');
  });

  it('warns on unknown referenceResource type', () => {
    const issues = validateTree([makeItem({ id: 'q1', itemType: 'reference', referenceResource: 'NotARealType' })]);
    expect(warnIds(issues)).toContain('q1');
  });

  it('no warning for known FHIR resource type', () => {
    const issues = validateTree([makeItem({ id: 'q1', itemType: 'reference', referenceResource: 'Patient' })]);
    expect(issues.filter(i => i.nodeId === 'q1')).toHaveLength(0);
  });
});

// ── nested group ──────────────────────────────────────────────────────────────
describe('validateTree — nested groups', () => {
  it('finds errors in nested nodes', () => {
    const tree = [makeGroup({
      id: 'g1',
      children: [makeItem({ id: '' })],
    })];
    expect(errIds(validateTree(tree))).toContain('(empty)');
  });
});
