// Tests for pure helper functions exported from js/fhir/import.js.
// import.js depends on state.js (CDN) — mocked below.

import { describe, it, expect, vi } from 'vitest';

vi.mock('../js/state.js', () => ({
  tree:           [],
  values:         {},
  rawFhir:        { value: null },
  questVariables: [],
  _bulkUpdate:    { value: false },
  resetSeq:       vi.fn(),
  makeGroup:      vi.fn(title => ({ type: 'group', id: 'g', title, children: [], enableWhen: [], enableBehavior: 'all', enableWhenExpression: '', mandatory: null, logicWithParent: 'AND' })),
  makeItem:       vi.fn(title => ({ type: 'item',  id: 'i', title, itemType: 'text', options: '', mandatory: null, enableWhen: [], enableBehavior: 'all', enableWhenExpression: '', constraint: [] })),
}));

vi.mock('../js/render-builder.js', () => ({ renderTree: vi.fn() }));

const { fhirTypeToItemType, fhirOptsToStr, humanEnableWhen, applyVisibility } = await import('../js/fhir/import.js');

// ── fhirTypeToItemType ────────────────────────────────────────────────────────────
describe('fhirTypeToItemType', () => {
  const cases = [
    ['boolean',     'checkbox'],
    ['integer',     'number'],
    ['decimal',     'number'],
    ['quantity',    'quantity'],
    ['choice',      'select'],
    ['open-choice', 'open-choice'],
    ['display',     'display'],
    ['date',        'date'],
    ['dateTime',    'date'],
    ['time',        'date'],
    ['url',         'url'],
    ['attachment',  'attachment'],
    ['reference',   'reference'],
    ['string',      'text'],
    ['text',        'text'],
    ['unknown',     'text'],  // fallback
  ];
  for (const [fhirType, expected] of cases) {
    it(`maps ${fhirType} → ${expected}`, () => {
      expect(fhirTypeToItemType(fhirType)).toBe(expected);
    });
  }
});

// ── fhirOptsToStr ─────────────────────────────────────────────────────────────────
describe('fhirOptsToStr', () => {
  it('returns empty string for null/undefined', () => {
    expect(fhirOptsToStr(null)).toBe('');
    expect(fhirOptsToStr(undefined)).toBe('');
  });

  it('returns empty string for empty array', () => {
    expect(fhirOptsToStr([])).toBe('');
  });

  it('formats code=display when both differ', () => {
    const opts = [{ valueCoding: { code: 'y', display: 'Yes' } }];
    expect(fhirOptsToStr(opts)).toBe('y=Yes');
  });

  it('uses display only when code === display', () => {
    const opts = [{ valueCoding: { code: 'Yes', display: 'Yes' } }];
    expect(fhirOptsToStr(opts)).toBe('Yes');
  });

  it('uses code only when display absent', () => {
    const opts = [{ valueCoding: { code: 'bmi35' } }];
    expect(fhirOptsToStr(opts)).toBe('bmi35');
  });

  it('uses display only when code absent', () => {
    const opts = [{ valueCoding: { display: 'Option A' } }];
    expect(fhirOptsToStr(opts)).toBe('Option A');
  });

  it('handles valueString options', () => {
    const opts = [{ valueString: 'alpha' }, { valueString: 'beta' }];
    expect(fhirOptsToStr(opts)).toBe('alpha, beta');
  });

  it('handles valueInteger options', () => {
    const opts = [{ valueInteger: 1 }, { valueInteger: 2 }];
    expect(fhirOptsToStr(opts)).toBe('1, 2');
  });

  it('joins multiple options with comma-space', () => {
    const opts = [
      { valueCoding: { code: 'a', display: 'Alpha' } },
      { valueCoding: { code: 'b', display: 'Beta' } },
    ];
    expect(fhirOptsToStr(opts)).toBe('a=Alpha, b=Beta');
  });

  it('filters out blank entries', () => {
    const opts = [{ valueCoding: {} }, { valueCoding: { code: 'x' } }];
    expect(fhirOptsToStr(opts)).toBe('x');
  });
});

// ── humanEnableWhen ─────────────────────────────────────────────────────────────────
describe('humanEnableWhen', () => {
  it('returns empty for null/undefined/empty', () => {
    expect(humanEnableWhen(null)).toBe('');
    expect(humanEnableWhen(undefined)).toBe('');
    expect(humanEnableWhen([])).toBe('');
  });

  it('formats answerBoolean = true as Yes', () => {
    const result = humanEnableWhen(
      [{ question: 'q1', operator: '=', answerBoolean: true }],
      'all',
      { q1: 'Diet program' }
    );
    expect(result).toBe('«Diet program» = Yes');
  });

  it('formats answerBoolean = false as No', () => {
    const result = humanEnableWhen(
      [{ question: 'q1', operator: '=', answerBoolean: false }],
      'all',
      { q1: 'Pregnant' }
    );
    expect(result).toBe('«Pregnant» = No');
  });

  it('formats answerString value', () => {
    const result = humanEnableWhen(
      [{ question: 'q1', operator: '=', answerString: 'male' }],
      'all',
      { q1: 'Gender' }
    );
    expect(result).toBe('«Gender» = «male»');
  });

  it('formats answerCoding by display', () => {
    const result = humanEnableWhen(
      [{ question: 'q1', operator: '=', answerCoding: { code: 'm', display: 'Male' } }],
      'all',
      { q1: 'Gender' }
    );
    expect(result).toBe('«Gender» = Male');
  });

  it('uses linkId as label when not in map', () => {
    const result = humanEnableWhen(
      [{ question: 'unknown-id', operator: '=', answerBoolean: true }],
      'all',
      {}
    );
    expect(result).toBe('«unknown-id» = Yes');
  });

  it('joins multiple conditions with AND by default', () => {
    const result = humanEnableWhen([
      { question: 'q1', operator: '=', answerBoolean: true },
      { question: 'q2', operator: '=', answerString: 'yes' },
    ], 'all', { q1: 'A', q2: 'B' });
    expect(result).toBe('«A» = Yes AND «B» = «yes»');
  });

  it('joins multiple conditions with OR when enableBehavior is any', () => {
    const result = humanEnableWhen([
      { question: 'q1', operator: '=', answerBoolean: true },
      { question: 'q2', operator: '=', answerBoolean: true },
    ], 'any', { q1: 'A', q2: 'B' });
    expect(result).toBe('«A» = Yes OR «B» = Yes');
  });

  it('formats != operator as ≠', () => {
    const result = humanEnableWhen(
      [{ question: 'q1', operator: '!=', answerBoolean: true }],
      'all', { q1: 'X' }
    );
    expect(result).toBe('«X» ≠ Yes');
  });

  it('formats exists operator', () => {
    const result = humanEnableWhen(
      [{ question: 'q1', operator: 'exists', answerBoolean: true }],
      'all', { q1: 'Email' }
    );
    expect(result).toBe('«Email» has answer');
  });

  it('formats answerInteger value', () => {
    const result = humanEnableWhen(
      [{ question: 'age', operator: '>=', answerInteger: 18 }],
      'all', { age: 'Age' }
    );
    expect(result).toBe('«Age» ≥ 18');
  });

  it('formats answerDecimal value', () => {
    const result = humanEnableWhen(
      [{ question: 'bmi', operator: '>', answerDecimal: 30.0 }],
      'all', { bmi: 'BMI' }
    );
    expect(result).toBe('«BMI» > 30');
  });
});

// ── applyVisibility ──────────────────────────────────────────────────────────────────
describe('applyVisibility', () => {
  function makeNode() {
    return { enableWhen: [], enableBehavior: 'all', enableWhenExpression: '' };
  }

  it('copies enableWhen array from fhirItem', () => {
    const node = makeNode();
    const fhirItem = {
      enableWhen: [{ question: 'q1', operator: '=', answerBoolean: true }],
      enableBehavior: 'all',
      extension: []
    };
    applyVisibility(node, fhirItem, {});
    expect(node.enableWhen).toHaveLength(1);
    expect(node.enableWhen[0].question).toBe('q1');
  });

  it('sets enableBehavior:any when fhirItem has any', () => {
    const node = makeNode();
    applyVisibility(node, {
      enableWhen: [{ question: 'q1', operator: '=', answerBoolean: true }],
      enableBehavior: 'any',
      extension: []
    }, {});
    expect(node.enableBehavior).toBe('any');
  });

  it('sets enableBehavior:all by default', () => {
    const node = makeNode();
    applyVisibility(node, {
      enableWhen: [{ question: 'q1', operator: '=', answerBoolean: true }],
      extension: []
    }, {});
    expect(node.enableBehavior).toBe('all');
  });

  it('copies enableWhen entries as independent objects', () => {
    const node = makeNode();
    const ew = { question: 'q1', operator: '=', answerBoolean: true };
    applyVisibility(node, { enableWhen: [ew], extension: [] }, {});
    node.enableWhen[0].question = 'mutated';
    expect(ew.question).toBe('q1'); // original not mutated
  });

  it('reads enableWhenExpression from SDC extension', () => {
    const node = makeNode();
    applyVisibility(node, {
      enableWhen: [],
      extension: [{
        url: 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-enableWhenExpression',
        valueExpression: { language: 'text/fhirpath', expression: '%age > 18' }
      }]
    }, {});
    expect(node.enableWhenExpression).toBe('%age > 18');
  });

  it('sets _enableWhenText for display', () => {
    const node = makeNode();
    applyVisibility(node, {
      enableWhen: [{ question: 'q1', operator: '=', answerBoolean: true }],
      extension: []
    }, { q1: 'My Question' });
    expect(node._enableWhenText).toContain('My Question');
    expect(node._enableWhenText).toContain('Yes');
  });

  it('does nothing for empty enableWhen and no extensions', () => {
    const node = makeNode();
    applyVisibility(node, { enableWhen: [], extension: [] }, {});
    expect(node.enableWhen).toHaveLength(0);
    expect(node.enableWhenExpression).toBe('');
    expect(node._enableWhenText).toBeUndefined();
  });
});


// ── fhirTypeToItemType ────────────────────────────────────────────────────────
