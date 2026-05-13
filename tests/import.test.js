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
  makeGroup:      vi.fn(title => ({ type: 'group', id: 'g', title, children: [], visibilityRule: '', conditionRule: '', mandatory: null, logicWithParent: 'AND' })),
  makeItem:       vi.fn(title => ({ type: 'item',  id: 'i', title, itemType: 'text', options: '', mandatory: null, visibilityRule: '', conditionRule: '' })),
}));

vi.mock('../js/render-builder.js', () => ({ renderTree: vi.fn() }));

const { enableWhenToExpr, fhirTypeToItemType, fhirOptsToStr } = await import('../js/fhir/import.js');

// ── fhirTypeToItemType ────────────────────────────────────────────────────────
describe('fhirTypeToItemType', () => {
  const cases = [
    ['boolean',   'checkbox'],
    ['integer',   'number'],
    ['decimal',   'number'],
    ['quantity',  'quantity'],
    ['choice',    'select'],
    ['open-choice', 'open-choice'],
    ['display',   'display'],
    ['date',      'date'],
    ['dateTime',  'date'],
    ['time',      'date'],
    ['url',       'url'],
    ['attachment','attachment'],
    ['reference', 'reference'],
    ['string',    'text'],
    ['text',      'text'],
    ['unknown',   'text'],  // fallback
  ];
  for (const [fhirType, expected] of cases) {
    it(`maps ${fhirType} → ${expected}`, () => {
      expect(fhirTypeToItemType(fhirType)).toBe(expected);
    });
  }
});

// ── fhirOptsToStr ─────────────────────────────────────────────────────────────
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

// ── enableWhenToExpr ──────────────────────────────────────────────────────────
describe('enableWhenToExpr', () => {
  it('returns empty string for null/undefined/empty', () => {
    expect(enableWhenToExpr(null)).toBe('');
    expect(enableWhenToExpr(undefined)).toBe('');
    expect(enableWhenToExpr([])).toBe('');
  });

  it('handles answerBoolean = true', () => {
    expect(enableWhenToExpr([{ question: 'q1', operator: '=', answerBoolean: true }]))
      .toBe("values['q1'] == true");
  });

  it('handles answerBoolean = false', () => {
    expect(enableWhenToExpr([{ question: 'q1', operator: '=', answerBoolean: false }]))
      .toBe("values['q1'] == false");
  });

  it('handles answerString', () => {
    expect(enableWhenToExpr([{ question: 'q1', operator: '=', answerString: 'yes' }]))
      .toBe("values['q1'] == 'yes'");
  });

  it('handles answerInteger', () => {
    expect(enableWhenToExpr([{ question: 'q1', operator: '=', answerInteger: 5 }]))
      .toBe("values['q1'] == 5");
  });

  it('handles answerDecimal', () => {
    expect(enableWhenToExpr([{ question: 'q1', operator: '=', answerDecimal: 3.5 }]))
      .toBe("values['q1'] == 3.5");
  });

  it('handles answerCoding by code', () => {
    expect(enableWhenToExpr([{ question: 'q1', operator: '=', answerCoding: { code: 'male' } }]))
      .toBe("values['q1'] == 'male'");
  });

  it('handles answerCoding by display when no code', () => {
    expect(enableWhenToExpr([{ question: 'q1', operator: '=', answerCoding: { display: 'Male' } }]))
      .toBe("values['q1'] == 'Male'");
  });

  it('handles != operator', () => {
    expect(enableWhenToExpr([{ question: 'q1', operator: '!=', answerBoolean: true }]))
      .toBe("values['q1'] != true");
  });

  it('maps = operator to == in JS', () => {
    const expr = enableWhenToExpr([{ question: 'q1', operator: '=', answerBoolean: true }]);
    expect(expr).toContain('==');
    expect(expr).not.toContain('===');
  });

  it('handles exists:true operator', () => {
    expect(enableWhenToExpr([{ question: 'q1', operator: 'exists', answerBoolean: true }]))
      .toBe("values['q1'] !== undefined");
  });

  it('handles exists:false operator', () => {
    expect(enableWhenToExpr([{ question: 'q1', operator: 'exists', answerBoolean: false }]))
      .toBe("values['q1'] === undefined");
  });

  it('handles >= operator', () => {
    expect(enableWhenToExpr([{ question: 'age', operator: '>=', answerInteger: 18 }]))
      .toBe("values['age'] >= 18");
  });

  it('handles <= operator', () => {
    expect(enableWhenToExpr([{ question: 'age', operator: '<=', answerInteger: 65 }]))
      .toBe("values['age'] <= 65");
  });

  it('joins multiple conditions with &&', () => {
    const expr = enableWhenToExpr([
      { question: 'q1', operator: '=', answerBoolean: true },
      { question: 'q2', operator: '=', answerString: 'yes' },
    ]);
    expect(expr).toBe("values['q1'] == true && values['q2'] == 'yes'");
  });

  it('falls back to true for unknown answer type', () => {
    expect(enableWhenToExpr([{ question: 'q1', operator: '=' }]))
      .toBe("values['q1'] == true");
  });
});
