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

// ── constraint[] ──────────────────────────────────────────────────────────────
describe('validateTree — constraint[]', () => {
  it('errors on invalid FHIRPath in constraint expression', () => {
    const item = makeItem({ id: 'q1', constraint: [{ key: 'c1', severity: 'error', human: 'msg', expression: 'INVALID_EXPR' }] });
    const issues = validateTree([item]);
    expect(errIds(issues)).toContain('q1');
    expect(issues.find(i => i.nodeId === 'q1').message).toMatch(/Constraint "c1" expression error/);
  });

  it('errors on empty constraint key', () => {
    const item = makeItem({ id: 'q1', constraint: [{ key: '', severity: 'error', human: 'msg', expression: '%age > 0' }] });
    const issues = validateTree([item]);
    expect(errIds(issues)).toContain('q1');
    expect(issues.find(i => i.severity === 'error' && i.nodeId === 'q1').message).toMatch(/empty key/);
  });

  it('warns on empty constraint human message', () => {
    const item = makeItem({ id: 'q1', constraint: [{ key: 'c1', severity: 'error', human: '', expression: '%age > 0' }] });
    const issues = validateTree([item]);
    expect(warnIds(issues)).toContain('q1');
    expect(issues.find(i => i.severity === 'warning' && i.nodeId === 'q1').message).toMatch(/human/);
  });

  it('warns on empty constraint expression', () => {
    const item = makeItem({ id: 'q1', constraint: [{ key: 'chk', severity: 'warning', human: 'msg', expression: '' }] });
    const issues = validateTree([item]);
    expect(warnIds(issues)).toContain('q1');
    expect(issues.find(i => i.nodeId === 'q1' && i.message.includes('empty expression'))).toBeTruthy();
  });

  it('no issues for valid constraint', () => {
    const item = makeItem({ id: 'q1', constraint: [{ key: 'c1', severity: 'error', human: 'Must be > 18', expression: '%age > 18' }] });
    const issues = validateTree([item]);
    expect(issues.filter(i => i.nodeId === 'q1')).toHaveLength(0);
  });

  it('no issues when constraint[] is absent', () => {
    const item = makeItem({ id: 'q1' });
    expect(validateTree([item])).toHaveLength(0);
  });
});

// ── enableWhenExpression ───────────────────────────────────────────────────────
describe('validateTree — enableWhenExpression', () => {
  it('errors on invalid FHIRPath in enableWhenExpression', () => {
    const item = makeItem({ id: 'q1', enableWhenExpression: 'INVALID_EXPR' });
    const issues = validateTree([item]);
    expect(errIds(issues)).toContain('q1');
    expect(issues.find(i => i.nodeId === 'q1').message).toMatch(/enableWhenExpression error/);
  });

  it('no error for valid enableWhenExpression', () => {
    const item = makeItem({ id: 'q1', enableWhenExpression: '%age > 18' });
    expect(errIds(validateTree([item]))).toHaveLength(0);
  });
});

// ── enableWhen[].question linkId references ────────────────────────────────────
describe('validateTree — enableWhen linkId references', () => {
  it('errors when enableWhen.question references unknown linkId', () => {
    const item = makeItem({ id: 'q2', enableWhen: [{ question: 'ghost', operator: 'exists', answerBoolean: true }] });
    const issues = validateTree([item]);
    expect(errIds(issues)).toContain('q2');
    expect(issues.find(i => i.nodeId === 'q2').message).toMatch(/unknown linkId "ghost"/);
  });

  it('no error when enableWhen.question references a valid sibling', () => {
    const q1 = makeItem({ id: 'q1' });
    const q2 = makeItem({ id: 'q2', enableWhen: [{ question: 'q1', operator: 'exists', answerBoolean: true }] });
    expect(errIds(validateTree([q1, q2]))).toHaveLength(0);
  });

  it('no error when enableWhen[] is absent', () => {
    expect(errIds(validateTree([makeItem({ id: 'q1' })]))).toHaveLength(0);
  });
});
