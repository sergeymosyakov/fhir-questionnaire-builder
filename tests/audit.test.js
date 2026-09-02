// ── Unit tests: auditTree() quality-audit report ──────────────────────────────
import { describe, it, expect } from 'vitest';

const { auditTree } = await import('../js/fhir/audit.js');

// ── helpers ───────────────────────────────────────────────────────────────────
const makeItem = (overrides = {}) => ({
  id: 'q1', type: 'item', title: 'Question 1',
  itemType: 'text', options: '', mandatory: false,
  ...overrides,
});

const warnIds = (issues) => issues.map(i => i.nodeId);

describe('auditTree — empty tree', () => {
  it('returns no issues', () => {
    expect(auditTree([])).toEqual([]);
  });
});

describe('auditTree — broken linkId references', () => {
  it('flags an enableWhenExpression referencing an unknown linkId', () => {
    const issues = auditTree([makeItem({ enableWhenExpression: "item.where(linkId='ghost').answer.exists()" })]);
    expect(warnIds(issues)).toContain('q1');
    expect(issues[0].message).toContain('"ghost"');
    expect(issues[0].severity).toBe('warning');
  });

  it('flags enableWhen[].question referencing an unknown linkId', () => {
    const issues = auditTree([makeItem({ enableWhen: [{ question: 'ghost', operator: '=', answerBoolean: true }] })]);
    expect(warnIds(issues)).toContain('q1');
  });

  it('does not flag a reference to a real linkId', () => {
    const issues = auditTree([
      makeItem({ id: 'q1', enableWhen: [{ question: 'q2', operator: '=', answerBoolean: true }] }),
      makeItem({ id: 'q2' }),
    ]);
    expect(issues).toEqual([]);
  });
});

describe('auditTree — answerValueSet fallback', () => {
  it('flags an external answerValueSet with no local fallback', () => {
    const issues = auditTree([makeItem({ _answerValueSet: 'https://tx.fhir.org/r4/ValueSet/x' })]);
    expect(issues.some(i => i.nodeId === 'q1' && i.message.includes('external terminology server'))).toBe(true);
  });

  it('does not flag a local #contained answerValueSet', () => {
    const issues = auditTree([makeItem({ _answerValueSet: '#vs-local' })]);
    expect(issues).toEqual([]);
  });
});

describe('auditTree — unreachable items (contradiction heuristic)', () => {
  const src = makeItem({ id: 'src', itemType: 'text' });

  it('flags = X and = Y (different literals) on a non-repeating question', () => {
    const item = makeItem({
      id: 'q1',
      enableWhen: [
        { question: 'src', operator: '=', answerString: 'A' },
        { question: 'src', operator: '=', answerString: 'B' },
      ],
    });
    const issues = auditTree([src, item]);
    expect(issues.some(i => i.nodeId === 'q1' && i.message.startsWith('Unreachable'))).toBe(true);
  });

  it('flags = X and != X (same literal) as contradictory', () => {
    const item = makeItem({
      id: 'q1',
      enableWhen: [
        { question: 'src', operator: '=',  answerString: 'A' },
        { question: 'src', operator: '!=', answerString: 'A' },
      ],
    });
    const issues = auditTree([src, item]);
    expect(issues.some(i => i.nodeId === 'q1')).toBe(true);
  });

  it('does not flag two identical = X conditions (redundant, not contradictory)', () => {
    const item = makeItem({
      id: 'q1',
      enableWhen: [
        { question: 'src', operator: '=', answerString: 'A' },
        { question: 'src', operator: '=', answerString: 'A' },
      ],
    });
    expect(auditTree([src, item])).toEqual([]);
  });

  it('does not flag contradictory conditions under enableBehavior: any', () => {
    const item = makeItem({
      id: 'q1',
      enableBehavior: 'any',
      enableWhen: [
        { question: 'src', operator: '=', answerString: 'A' },
        { question: 'src', operator: '=', answerString: 'B' },
      ],
    });
    expect(auditTree([src, item])).toEqual([]);
  });

  it('does not flag contradictory conditions when the source question repeats', () => {
    const repeatingSrc = makeItem({ id: 'src', repeats: true });
    const item = makeItem({
      id: 'q1',
      enableWhen: [
        { question: 'src', operator: '=', answerString: 'A' },
        { question: 'src', operator: '=', answerString: 'B' },
      ],
    });
    expect(auditTree([repeatingSrc, item])).toEqual([]);
  });

  it('flags an impossible numeric range (> 10 and < 5)', () => {
    const item = makeItem({
      id: 'q1',
      enableWhen: [
        { question: 'src', operator: '>', answerInteger: 10 },
        { question: 'src', operator: '<', answerInteger: 5 },
      ],
    });
    const issues = auditTree([src, item]);
    expect(issues.some(i => i.nodeId === 'q1')).toBe(true);
  });

  it('does not flag a satisfiable numeric range (> 5 and < 10)', () => {
    const item = makeItem({
      id: 'q1',
      enableWhen: [
        { question: 'src', operator: '>', answerInteger: 5 },
        { question: 'src', operator: '<', answerInteger: 10 },
      ],
    });
    expect(auditTree([src, item])).toEqual([]);
  });

  it('does not flag >= 5 and <= 5 (exactly 5 satisfies both)', () => {
    const item = makeItem({
      id: 'q1',
      enableWhen: [
        { question: 'src', operator: '>=', answerInteger: 5 },
        { question: 'src', operator: '<=', answerInteger: 5 },
      ],
    });
    expect(auditTree([src, item])).toEqual([]);
  });

  it('flags > 5 and <= 5 (nothing strictly greater than 5 is also <= 5)', () => {
    const item = makeItem({
      id: 'q1',
      enableWhen: [
        { question: 'src', operator: '>',  answerInteger: 5 },
        { question: 'src', operator: '<=', answerInteger: 5 },
      ],
    });
    const issues = auditTree([src, item]);
    expect(issues.some(i => i.nodeId === 'q1')).toBe(true);
  });
});

describe('auditTree — nested children', () => {
  it('walks group children', () => {
    const group = {
      id: 'g1', type: 'group', title: 'Group', children: [
        makeItem({ id: 'q1', enableWhen: [{ question: 'ghost', operator: '=', answerBoolean: true }] }),
      ],
    };
    const issues = auditTree([group]);
    expect(warnIds(issues)).toContain('q1');
  });
});
