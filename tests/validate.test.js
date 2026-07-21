import { describe, it, expect, vi, beforeAll } from 'vitest';
import { LOINC_URL } from '../js/fhir/urls/loinc.js';

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
  itemType: 'text', options: '', mandatory: false,
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

  it('no warning when select uses answerValueSet', () => {
    const issues = validateTree([makeItem({ id: 'q1', itemType: 'select', options: '', _answerValueSet: '#vs-diet' })]);
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

  it('errors on invalid answerExpression', () => {
    const issues = validateTree([makeItem({ id: 'q1', itemType: 'select', options: '', _answerExpression: 'INVALID expression' })]);
    expect(errIds(issues)).toContain('q1');
    expect(issues.find(i => i.nodeId === 'q1' && i.severity === 'error').message).toMatch(/Answer expression error/);
  });

  it('no error for valid answerExpression', () => {
    const issues = validateTree([makeItem({ id: 'q1', itemType: 'select', options: '', _answerExpression: "'a' | 'b' | 'c'" })]);
    expect(errIds(issues)).toHaveLength(0);
  });

  it('no error when answerExpression is absent', () => {
    const issues = validateTree([makeItem({ id: 'q1', itemType: 'select', options: 'a=A,b=B' })]);
    expect(errIds(issues)).toHaveLength(0);
  });

  it('errors on invalid candidateExpression', () => {
    const issues = validateTree([makeItem({ id: 'q1', itemType: 'select', options: '', _candidateExpression: 'INVALID expression' })]);
    expect(errIds(issues)).toContain('q1');
    expect(issues.find(i => i.nodeId === 'q1' && i.severity === 'error').message).toMatch(/Candidate expression error/);
  });

  it('no error for valid candidateExpression', () => {
    const issues = validateTree([makeItem({ id: 'q1', itemType: 'select', options: '', _candidateExpression: "'a' | 'b' | 'c'" })]);
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

// ── constraint key: ITLH group-or system key ──────────────────────────────────
describe('validateTree — constraint ITLH group-or key', () => {
  it('silently skips system-generated group-or constraint key', () => {
    const ITLH_KEY = 'e3a8c2f1-6b4d-4e9a-87c5:group-or';
    const item = makeItem({ id: 'q1', constraint: [{ key: ITLH_KEY, severity: 'error', human: 'msg', expression: 'true' }] });
    const issues = validateTree([item]);
    expect(issues.filter(i => i.nodeId === 'q1' && i.message.match(/key/i))).toHaveLength(0);
  });
});

// ── fhirpath not available ────────────────────────────────────────────────────
describe('validateTree — fhirpath unavailable', () => {
  it('returns null (no error) when window.fhirpath is not loaded', () => {
    const saved = globalThis.window;
    globalThis.window = {};
    const item = makeItem({ id: 'q1', constraint: [{ key: 'c1', severity: 'error', human: 'msg', expression: '%age > 0' }] });
    const issues = validateTree([item]);
    expect(issues.filter(i => i.message.match(/expression error/))).toHaveLength(0);
    globalThis.window = saved;
  });
});

// ── cross-field: required + hidden ───────────────────────────────────────────
describe('validateTree — required + hidden', () => {
  it('warns when item is both required and hidden', () => {
    const item = makeItem({ id: 'q1', mandatory: true, _hidden: true });
    const issues = validateTree([item]);
    expect(warnIds(issues)).toContain('q1');
    expect(issues.find(i => i.nodeId === 'q1' && i.message.match(/required and hidden/))).toBeTruthy();
  });

  it('no warning when required but not hidden', () => {
    const item = makeItem({ id: 'q1', mandatory: true, _hidden: false });
    expect(warnIds(validateTree([item]))).not.toContain('q1');
  });

  it('no warning when hidden but not required', () => {
    const item = makeItem({ id: 'q1', mandatory: false, _hidden: true });
    const issues = validateTree([item]);
    expect(issues.filter(i => i.nodeId === 'q1' && i.message.match(/required and hidden/))).toHaveLength(0);
  });
});

// ── cross-field: calculatedExpression + not readOnly ─────────────────────────
describe('validateTree — calculatedExpression without readOnly', () => {
  it('warns when calculatedExpression set but readOnly is not true', () => {
    const item = makeItem({ id: 'q1', _calculatedExpr: '%age * 2', _readOnly: false });
    const issues = validateTree([item]);
    expect(warnIds(issues)).toContain('q1');
    expect(issues.find(i => i.nodeId === 'q1' && i.message.match(/calculatedExpression.*not read-only/))).toBeTruthy();
  });

  it('no warning when calculatedExpression set and readOnly is true', () => {
    const item = makeItem({ id: 'q1', _calculatedExpr: '%age * 2', _readOnly: true });
    const issues = validateTree([item]);
    expect(issues.filter(i => i.nodeId === 'q1' && i.message.match(/calculatedExpression/))).toHaveLength(0);
  });

  it('no warning when calculatedExpression is absent', () => {
    const item = makeItem({ id: 'q1', _readOnly: false });
    const issues = validateTree([item]);
    expect(issues.filter(i => i.nodeId === 'q1' && i.message.match(/calculatedExpression/))).toHaveLength(0);
  });
});

// ── cross-field: answerExpression + answerOption[] ───────────────────────────
describe('validateTree — answerExpression + answerOption co-presence', () => {
  it('warns when both answerExpression and _rawAnswerOptions are set', () => {
    const item = makeItem({ id: 'q1', _answerExpression: '%meds', _rawAnswerOptions: [{ valueCoding: { code: 'a' } }] });
    const issues = validateTree([item]);
    expect(warnIds(issues)).toContain('q1');
    expect(issues.find(i => i.nodeId === 'q1' && i.message.match(/answerExpression.*answerOption/))).toBeTruthy();
  });

  it('warns when both answerExpression and options string are set', () => {
    const item = makeItem({ id: 'q1', _answerExpression: '%meds', options: 'a,b,c' });
    const issues = validateTree([item]);
    expect(issues.find(i => i.nodeId === 'q1' && i.message.match(/answerExpression.*answerOption/))).toBeTruthy();
  });

  it('no warning when only answerExpression is set', () => {
    const item = makeItem({ id: 'q1', _answerExpression: '%meds' });
    const issues = validateTree([item]);
    expect(issues.filter(i => i.nodeId === 'q1' && i.message.match(/answerExpression/))).toHaveLength(0);
  });
});

// ── cross-field: candidateExpression + answerOption[] ─────────────────────
describe('validateTree — candidateExpression + answerOption co-presence', () => {
  it('warns when both candidateExpression and options string are set', () => {
    const item = makeItem({ id: 'q1', _candidateExpression: '%meds', options: 'a,b,c' });
    const issues = validateTree([item]);
    expect(issues.find(i => i.nodeId === 'q1' && i.message.match(/candidateExpression.*answerOption/))).toBeTruthy();
  });

  it('no warning when only candidateExpression is set', () => {
    const item = makeItem({ id: 'q1', _candidateExpression: '%meds' });
    const issues = validateTree([item]);
    expect(issues.filter(i => i.nodeId === 'q1' && i.message.match(/candidateExpression/))).toHaveLength(0);
  });
});

// ── isSubject: at most one item may be the QR subject ─────────────────────────
describe('validateTree — isSubject uniqueness', () => {
  it('errors when more than one item is marked isSubject', () => {
    const a = makeItem({ id: 'q1', itemType: 'reference', _isSubject: true });
    const b = makeItem({ id: 'q2', itemType: 'reference', _isSubject: true });
    const issues = validateTree([a, b]);
    const subjectErrs = issues.filter(i => i.severity === 'error' && i.message.match(/isSubject/));
    expect(subjectErrs.length).toBeGreaterThan(0);
  });

  it('does not error when exactly one item is marked isSubject', () => {
    const a = makeItem({ id: 'q1', itemType: 'reference', _isSubject: true });
    const b = makeItem({ id: 'q2', itemType: 'reference' });
    const issues = validateTree([a, b]);
    expect(issues.filter(i => i.message.match(/isSubject/))).toHaveLength(0);
  });

  it('does not error when no item is marked isSubject', () => {
    const issues = validateTree([makeItem({ id: 'q1', itemType: 'reference' })]);
    expect(issues.filter(i => i.message.match(/isSubject/))).toHaveLength(0);
  });
});

// ── cross-field: enableWhen + enableWhenExpression ───────────────────────────
describe('validateTree — enableWhen + enableWhenExpression conflict', () => {
  it('warns when both enableWhen[] and enableWhenExpression are set', () => {
    const item = makeItem({ id: 'q2', enableWhen: [{ question: 'q1', operator: 'exists', answerBoolean: true }], enableWhenExpression: '%age > 18' });
    const q1 = makeItem({ id: 'q1' });
    const issues = validateTree([q1, item]);
    expect(warnIds(issues)).toContain('q2');
    expect(issues.find(i => i.nodeId === 'q2' && i.message.match(/enableWhen.*enableWhenExpression/))).toBeTruthy();
  });

  it('no warning when only enableWhen[] is set', () => {
    const q1 = makeItem({ id: 'q1' });
    const q2 = makeItem({ id: 'q2', enableWhen: [{ question: 'q1', operator: 'exists', answerBoolean: true }] });
    const issues = validateTree([q1, q2]);
    expect(issues.filter(i => i.nodeId === 'q2' && i.message.match(/enableWhenExpression/))).toHaveLength(0);
  });

  it('no warning when only enableWhenExpression is set', () => {
    const item = makeItem({ id: 'q1', enableWhenExpression: '%age > 18' });
    const issues = validateTree([item]);
    expect(issues.filter(i => i.nodeId === 'q1' && i.message.match(/enableWhen.*enableWhenExpression/))).toHaveLength(0);
  });
});

// ── cross-field: repeats false + multiple initial values ─────────────────────
describe('validateTree — repeats + initial values count', () => {
  it('warns when repeats is not set but _initialValues has more than 1 entry', () => {
    const item = makeItem({ id: 'q1', repeats: false, _initialValues: ['a', 'b'] });
    const issues = validateTree([item]);
    expect(warnIds(issues)).toContain('q1');
    expect(issues.find(i => i.nodeId === 'q1' && i.message.match(/initial values/))).toBeTruthy();
  });

  it('no warning when repeats is true and multiple initial values', () => {
    const item = makeItem({ id: 'q1', repeats: true, _initialValues: ['a', 'b'] });
    const issues = validateTree([item]);
    expect(issues.filter(i => i.nodeId === 'q1' && i.message.match(/initial values/))).toHaveLength(0);
  });

  it('no warning when repeats is false but only 1 initial value', () => {
    const item = makeItem({ id: 'q1', repeats: false, _initialValues: ['a'] });
    const issues = validateTree([item]);
    expect(issues.filter(i => i.nodeId === 'q1' && i.message.match(/initial values/))).toHaveLength(0);
  });
});

// ── minOccurs R4 invariant ────────────────────────────────────────────────────
describe('validateTree — minOccurs R4 invariant', () => {
  it('warns when minOccurs=0 and required is not set (R4 context invariant: must be required=true)', () => {
    const item = makeItem({ id: 'q1', repeats: true, _minOccurs: 0 });
    const issues = validateTree([item]);
    expect(issues.find(i => i.nodeId === 'q1' && i.message.match(/minOccurs/))).toBeTruthy();
  });

  it('no warning when minOccurs > 0 and required=true', () => {
    const item = makeItem({ id: 'q1', repeats: true, required: true, _minOccurs: 2 });
    const issues = validateTree([item]);
    expect(issues.filter(i => i.nodeId === 'q1' && i.message.match(/minOccurs/))).toHaveLength(0);
  });

  it('warns when minOccurs > 0 and required is not set', () => {
    const item = makeItem({ id: 'q1', repeats: true, _minOccurs: 2 });
    const issues = validateTree([item], {});
    expect(issues.find(i => i.nodeId === 'q1' && i.message.match(/minOccurs/))).toBeTruthy();
  });

  it('no warning when minOccurs is not set', () => {
    const item = makeItem({ id: 'q1', repeats: true });
    const issues = validateTree([item]);
    expect(issues.filter(i => i.nodeId === 'q1' && i.message.match(/minOccurs/))).toHaveLength(0);
  });
});

// ── que-11: initial[] must be absent when answerOption[] present ──────────────
describe('validateTree — que-11 initial + answerOption conflict', () => {
  it('warns when _initialValue is set and item has options', () => {
    const item = makeItem({ id: 'q1', itemType: 'select', _initialValue: 'opt1', options: 'opt1|opt2' });
    const issues = validateTree([item]);
    expect(issues.find(i => i.nodeId === 'q1' && i.message.match(/que-11|initial value/))).toBeTruthy();
  });

  it('warns when _initialValue is set and item has _rawAnswerOptions', () => {
    const item = makeItem({ id: 'q1', itemType: 'select', _initialValue: 'opt1', _rawAnswerOptions: [{ valueCoding: { code: 'opt1' } }] });
    const issues = validateTree([item]);
    expect(issues.find(i => i.nodeId === 'q1' && i.message.match(/que-11|initial value/))).toBeTruthy();
  });

  it('warns when _initialValue is set and item has _answerValueSet', () => {
    const item = makeItem({ id: 'q1', itemType: 'select', _initialValue: 'opt1', _answerValueSet: 'https://example.com/vs' });
    const issues = validateTree([item]);
    expect(issues.find(i => i.nodeId === 'q1' && i.message.match(/que-11|initial value/))).toBeTruthy();
  });

  it('no warning when _initialValue is set on text item (no answer options)', () => {
    const item = makeItem({ id: 'q1', itemType: 'text', _initialValue: 'hello' });
    const issues = validateTree([item]);
    expect(issues.filter(i => i.nodeId === 'q1' && i.message.match(/que-11|initial value/))).toHaveLength(0);
  });

  it('no warning when _initialValue equals _initialSelected (derived from answerOption.initialSelected — correct R4 pattern)', () => {
    const item = makeItem({ id: 'q1', itemType: 'select', _initialValue: 'opt1', _initialSelected: 'opt1', _rawAnswerOptions: [{ valueCoding: { code: 'opt1' } }] });
    const issues = validateTree([item]);
    expect(issues.filter(i => i.nodeId === 'q1' && i.message.match(/que-11|initial value/))).toHaveLength(0);
  });

  it('no warning when no _initialValue even with answerOptions', () => {
    const item = makeItem({ id: 'q1', itemType: 'select', options: 'opt1|opt2' });
    const issues = validateTree([item]);
    expect(issues.filter(i => i.nodeId === 'q1' && i.message.match(/que-11|initial value/))).toHaveLength(0);
  });
});

// ── que-3: display items cannot have code[] ───────────────────────────────────
describe('validateTree — que-3 display item with code[]', () => {
  it('warns when display item has _codes', () => {
    const item = makeItem({ id: 'q1', itemType: 'display', _codes: [{ system: LOINC_URL.system, code: '1234-5' }] });
    const issues = validateTree([item]);
    expect(warnIds(issues)).toContain('q1');
    expect(issues.find(i => i.nodeId === 'q1' && i.message.match(/que-3|code\[\]/))).toBeTruthy();
  });

  it('no warning when non-display item has _codes', () => {
    const item = makeItem({ id: 'q1', itemType: 'text', _codes: [{ system: LOINC_URL.system, code: '1234-5' }] });
    const issues = validateTree([item]);
    expect(issues.filter(i => i.nodeId === 'q1' && i.message.match(/que-3/))).toHaveLength(0);
  });
});

// ── que-4: answerOption[] and answerValueSet cannot both be present ────────────
describe('validateTree — que-4 answerOption + answerValueSet conflict', () => {
  it('no error when only options string and _answerValueSet are set (options may come from contained VS resolution)', () => {
    // node.options can be populated during import from a contained ValueSet — export already
    // suppresses answerOption[] when _answerValueSet is set, so this is not a real que-4 violation.
    const item = makeItem({ id: 'q1', itemType: 'select', options: 'a=A,b=B', _answerValueSet: 'https://example.com/vs' });
    const issues = validateTree([item]);
    expect(errIds(issues)).not.toContain('q1');
  });

  it('errors when both _rawAnswerOptions and _answerValueSet are set', () => {
    const item = makeItem({ id: 'q1', itemType: 'select', options: '', _rawAnswerOptions: [{ valueCoding: { code: 'a' } }], _answerValueSet: 'https://example.com/vs' });
    const issues = validateTree([item]);
    expect(errIds(issues)).toContain('q1');
  });

  it('no error when only _answerValueSet is set', () => {
    const item = makeItem({ id: 'q1', itemType: 'select', options: '', _answerValueSet: 'https://example.com/vs' });
    expect(errIds(validateTree([item]))).toHaveLength(0);
  });

  it('no error when only options is set', () => {
    const item = makeItem({ id: 'q1', itemType: 'select', options: 'a=A,b=B' });
    expect(errIds(validateTree([item]))).toHaveLength(0);
  });
});

// ── que-6: display items cannot have required or repeats ─────────────────────
describe('validateTree — que-6 display item required/repeats', () => {
  it('warns when display item has required=true', () => {
    const item = makeItem({ id: 'q1', itemType: 'display', mandatory: true });
    const issues = validateTree([item]);
    expect(warnIds(issues)).toContain('q1');
    expect(issues.find(i => i.nodeId === 'q1' && i.message.match(/que-6|required/))).toBeTruthy();
  });

  it('warns when display item has repeats=true', () => {
    const item = makeItem({ id: 'q1', itemType: 'display', repeats: true });
    const issues = validateTree([item]);
    expect(warnIds(issues)).toContain('q1');
    expect(issues.find(i => i.nodeId === 'q1' && i.message.match(/que-6|repeats/))).toBeTruthy();
  });

  it('no que-6 warning for text item with required=true', () => {
    const item = makeItem({ id: 'q1', itemType: 'text', mandatory: true });
    expect(validateTree([item]).filter(i => i.message.match(/que-6/))).toHaveLength(0);
  });
});

// ── que-7: enableWhen operator 'exists' must use answerBoolean ────────────────
describe('validateTree — que-7 enableWhen exists operator', () => {
  it('errors when operator=exists but answerBoolean is missing', () => {
    const item = makeItem({ id: 'q2', enableWhen: [{ question: 'q1', operator: 'exists', answerString: 'anything' }] });
    const q1 = makeItem({ id: 'q1' });
    const issues = validateTree([q1, item]);
    expect(errIds(issues)).toContain('q2');
    expect(issues.find(i => i.nodeId === 'q2' && i.message.match(/que-7|exists.*boolean/))).toBeTruthy();
  });

  it('no error when operator=exists with answerBoolean=true', () => {
    const q1 = makeItem({ id: 'q1' });
    const item = makeItem({ id: 'q2', enableWhen: [{ question: 'q1', operator: 'exists', answerBoolean: true }] });
    expect(errIds(validateTree([q1, item]))).toHaveLength(0);
  });

  it('no error when operator=exists with answerBoolean=false', () => {
    const q1 = makeItem({ id: 'q1' });
    const item = makeItem({ id: 'q2', enableWhen: [{ question: 'q1', operator: 'exists', answerBoolean: false }] });
    expect(errIds(validateTree([q1, item]))).toHaveLength(0);
  });

  it('no que-7 error when operator is = with a string answer', () => {
    const q1 = makeItem({ id: 'q1' });
    const item = makeItem({ id: 'q2', enableWhen: [{ question: 'q1', operator: '=', answerString: 'yes' }] });
    expect(validateTree([q1, item]).filter(i => i.message.match(/que-7/))).toHaveLength(0);
  });
});

// ── que-9: display items cannot have readOnly ─────────────────────────────────
describe('validateTree — que-9 display item readOnly', () => {
  it('warns when display item has readOnly=true', () => {
    const item = makeItem({ id: 'q1', itemType: 'display', _readOnly: true });
    const issues = validateTree([item]);
    expect(warnIds(issues)).toContain('q1');
    expect(issues.find(i => i.nodeId === 'q1' && i.message.match(/que-9|readOnly/))).toBeTruthy();
  });

  it('no que-9 warning for text item with readOnly=true', () => {
    const item = makeItem({ id: 'q1', itemType: 'text', _readOnly: true });
    expect(validateTree([item]).filter(i => i.message.match(/que-9/))).toHaveLength(0);
  });
});

// ── que-10: maxLength only valid for allowed types ────────────────────────────
describe('validateTree — que-10 maxLength type restriction', () => {
  it('warns when maxLength set on date item', () => {
    const item = makeItem({ id: 'q1', itemType: 'date', _maxLength: 10 });
    const issues = validateTree([item]);
    expect(warnIds(issues)).toContain('q1');
    expect(issues.find(i => i.nodeId === 'q1' && i.message.match(/que-10|maxLength/))).toBeTruthy();
  });

  it('warns when maxLength set on select item', () => {
    const item = makeItem({ id: 'q1', itemType: 'select', options: 'a,b', _maxLength: 50 });
    const issues = validateTree([item]);
    expect(issues.find(i => i.nodeId === 'q1' && i.message.match(/que-10|maxLength/))).toBeTruthy();
  });

  it('no que-10 warning for text item with maxLength', () => {
    const item = makeItem({ id: 'q1', itemType: 'text', _maxLength: 200 });
    expect(validateTree([item]).filter(i => i.message.match(/que-10/))).toHaveLength(0);
  });

  it('no que-10 warning for url item with maxLength', () => {
    const item = makeItem({ id: 'q1', itemType: 'url', _maxLength: 100 });
    expect(validateTree([item]).filter(i => i.message.match(/que-10/))).toHaveLength(0);
  });

  it('no que-10 warning for open-choice item with maxLength', () => {
    const item = makeItem({ id: 'q1', itemType: 'open-choice', options: 'a,b', _maxLength: 100 });
    expect(validateTree([item]).filter(i => i.message.match(/que-10/))).toHaveLength(0);
  });

  it('no warning when maxLength is not set on a date item', () => {
    const item = makeItem({ id: 'q1', itemType: 'date' });
    expect(validateTree([item]).filter(i => i.message.match(/que-10/))).toHaveLength(0);
  });
});

// ── que-0: Questionnaire.name format ─────────────────────────────────────────
describe('validateTree — que-0 Questionnaire.name format', () => {
  it('warns when name starts with lowercase', () => {
    const issues = validateTree([], {}, { name: 'myQuestionnaire' });
    expect(issues.find(i => i.nodeId === '(root)' && i.message.match(/que-0|naming/))).toBeTruthy();
  });

  it('warns when name contains spaces', () => {
    const issues = validateTree([], {}, { name: 'My Questionnaire' });
    expect(issues.find(i => i.nodeId === '(root)')).toBeTruthy();
  });

  it('no warning when name matches pattern', () => {
    expect(validateTree([], {}, { name: 'MyQuestionnaire' })).toHaveLength(0);
    expect(validateTree([], {}, { name: 'PHQ_9' })).toHaveLength(0);
  });

  it('no warning when questMeta is null', () => {
    expect(validateTree([], {}, null)).toHaveLength(0);
  });

  it('no warning when name is absent', () => {
    expect(validateTree([], {}, {})).toHaveLength(0);
  });
});

// ── modifierExtension warning ─────────────────────────────────────────────────
describe('validateTree — modifierExtension warning', () => {
  it('warns when questMeta._rawModifierExtension is non-empty', () => {
    const issues = validateTree([], {}, {
      _rawModifierExtension: [{ url: 'https://example.org/someModifier', valueBoolean: true }],
    });
    expect(issues.length).toBe(1);
    expect(issues[0].severity).toBe('warning');
    expect(issues[0].nodeId).toBe('(root)');
    expect(issues[0].message).toMatch(/modifierExtension/);
    expect(issues[0].message).toMatch(/https:\/\/example\.org\/someModifier/);
  });

  it('no warning when _rawModifierExtension is empty or absent', () => {
    expect(validateTree([], {}, { _rawModifierExtension: [] })).toHaveLength(0);
    expect(validateTree([], {}, {})).toHaveLength(0);
    expect(validateTree([], {}, null)).toHaveLength(0);
  });
});

// ── que-1: group must have children ──────────────────────────────────────────
// ── que-5: answerValueSet only for allowed types ──────────────────────────────
describe('validateTree — que-5 answerValueSet type restriction', () => {
  it('errors when answerValueSet set on url item', () => {
    const item = makeItem({ id: 'q1', itemType: 'url', _answerValueSet: 'https://example.com/vs' });
    const issues = validateTree([item]);
    expect(errIds(issues)).toContain('q1');
    expect(issues.find(i => i.nodeId === 'q1' && i.message.match(/que-5/))).toBeTruthy();
  });

  it('errors when answerValueSet set on attachment item', () => {
    const item = makeItem({ id: 'q1', itemType: 'attachment', _answerValueSet: 'https://example.com/vs' });
    const issues = validateTree([item]);
    expect(errIds(issues)).toContain('q1');
  });

  it('errors when answerValueSet set on checkbox (boolean) item', () => {
    const item = makeItem({ id: 'q1', itemType: 'checkbox', _answerValueSet: 'https://example.com/vs' });
    const issues = validateTree([item]);
    expect(errIds(issues)).toContain('q1');
  });

  it('no error when answerValueSet set on select item', () => {
    const item = makeItem({ id: 'q1', itemType: 'select', options: '', _answerValueSet: 'https://example.com/vs' });
    expect(errIds(validateTree([item]))).toHaveLength(0);
  });

  it('no error when answerValueSet set on text item', () => {
    const item = makeItem({ id: 'q1', itemType: 'text', _answerValueSet: 'https://example.com/vs' });
    expect(errIds(validateTree([item]))).toHaveLength(0);
  });

  it('no error when answerValueSet set on decimal item', () => {
    const item = makeItem({ id: 'q1', itemType: 'decimal', _answerValueSet: 'https://example.com/vs' });
    expect(errIds(validateTree([item]))).toHaveLength(0);
  });

  it('no error when answerValueSet set on quantity item', () => {
    const item = makeItem({ id: 'q1', itemType: 'quantity', _answerValueSet: 'https://example.com/vs' });
    expect(errIds(validateTree([item]))).toHaveLength(0);
  });
});

// ── circular dependency detection ─────────────────────────────────────────────
describe('validateTree — circular dependency detection', () => {
  it('errors on a two-node calculatedExpression cycle', () => {
    const a = makeItem({ id: 'a', itemType: 'decimal', _readOnly: true, _calculatedExpr: "item.where(linkId='b').answer.valueDecimal" });
    const b = makeItem({ id: 'b', itemType: 'decimal', _readOnly: true, _calculatedExpr: "item.where(linkId='a').answer.valueDecimal" });
    const issues = validateTree([a, b]);
    const cycleErr = issues.find(i => i.severity === 'error' && /Circular dependency/.test(i.message));
    expect(cycleErr).toBeTruthy();
  });

  it('errors on an enableWhen cycle', () => {
    const a = makeItem({ id: 'a', enableWhen: [{ question: 'b', operator: 'exists', answerBoolean: true }] });
    const b = makeItem({ id: 'b', enableWhen: [{ question: 'a', operator: 'exists', answerBoolean: true }] });
    const issues = validateTree([a, b]);
    expect(issues.find(i => /Circular dependency/.test(i.message))).toBeTruthy();
  });

  it('reports a cycle only once', () => {
    const a = makeItem({ id: 'a', itemType: 'decimal', _readOnly: true, _calculatedExpr: "item.where(linkId='b').answer.valueDecimal" });
    const b = makeItem({ id: 'b', itemType: 'decimal', _readOnly: true, _calculatedExpr: "item.where(linkId='a').answer.valueDecimal" });
    const issues = validateTree([a, b]);
    expect(issues.filter(i => /Circular dependency/.test(i.message))).toHaveLength(1);
  });

  it('no cycle error for a linear calc chain', () => {
    const a = makeItem({ id: 'a', itemType: 'decimal' });
    const b = makeItem({ id: 'b', itemType: 'decimal', _readOnly: true, _calculatedExpr: "item.where(linkId='a').answer.valueDecimal * 2" });
    const c = makeItem({ id: 'c', itemType: 'decimal', _readOnly: true, _calculatedExpr: "item.where(linkId='b').answer.valueDecimal + 1" });
    const issues = validateTree([a, b, c]);
    expect(issues.filter(i => /Circular dependency/.test(i.message))).toHaveLength(0);
  });
});
