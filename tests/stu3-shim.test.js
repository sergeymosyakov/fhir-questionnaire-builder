import { describe, it, expect } from 'vitest';
import { isSTU3, normaliseSTU3 } from '../js/fhir/stu3-shim.js';

// ── helpers ───────────────────────────────────────────────────────────────────
function q(items = []) {
  return { resourceType: 'Questionnaire', item: items };
}
function qv(ver, items = []) {
  return { resourceType: 'Questionnaire', meta: { fhirVersion: ver }, item: items };
}

// ── isSTU3 ─────────────────────────────────────────────────────────────────────

describe('isSTU3 — detection', () => {
  it('returns false for plain R4 questionnaire with no STU3 fields', () => {
    expect(isSTU3(q([{ linkId: 'q1', type: 'string' }]))).toBe(false);
  });

  it('returns false for non-Questionnaire resource', () => {
    expect(isSTU3({ resourceType: 'Patient' })).toBe(false);
  });

  it('returns false for null input', () => {
    expect(isSTU3(null)).toBe(false);
  });

  it('detects STU3 by meta.fhirVersion 3.x', () => {
    expect(isSTU3(qv('3.0.2'))).toBe(true);
  });

  it('detects STU3 by meta.fhirVersion 1.x (DSTU2)', () => {
    expect(isSTU3(qv('1.0.2'))).toBe(true);
  });

  it('does not flag R4 version as STU3', () => {
    expect(isSTU3(qv('4.0.1'))).toBe(false);
  });

  it('detects STU3 by item.option[]', () => {
    const json = q([{ linkId: 'q1', type: 'choice', option: [{ valueCoding: { code: 'a' } }] }]);
    expect(isSTU3(json)).toBe(true);
  });

  it('detects STU3 by item.options reference', () => {
    const json = q([{ linkId: 'q1', type: 'choice', options: { reference: '#vs-1' } }]);
    expect(isSTU3(json)).toBe(true);
  });

  it('detects STU3 by enableWhen.hasAnswer', () => {
    const json = q([{
      linkId: 'q2', type: 'string',
      enableWhen: [{ question: 'q1', hasAnswer: true }],
    }]);
    expect(isSTU3(json)).toBe(true);
  });

  it('detects STU3 by initialInteger on item', () => {
    const json = q([{ linkId: 'q1', type: 'integer', initialInteger: 0 }]);
    expect(isSTU3(json)).toBe(true);
  });

  it('detects STU3 fields nested in child items', () => {
    const json = q([{
      linkId: 'g1', type: 'group',
      item: [{ linkId: 'q1', type: 'choice', option: [{ valueCoding: { code: 'a' } }] }],
    }]);
    expect(isSTU3(json)).toBe(true);
  });
});

// ── normaliseSTU3 — passthrough ────────────────────────────────────────────────

describe('normaliseSTU3 — R4 passthrough', () => {
  it('returns the same object when already R4', () => {
    const json = q([{ linkId: 'q1', type: 'string' }]);
    expect(normaliseSTU3(json)).toBe(json); // same reference — no clone
  });
});

// ── normaliseSTU3 — option → answerOption ─────────────────────────────────────

describe('normaliseSTU3 — option[] → answerOption[]', () => {
  it('renames item.option to item.answerOption', () => {
    const json = q([{
      linkId: 'q1', type: 'choice',
      option: [{ valueCoding: { code: 'a', display: 'A' } }],
    }]);
    const result = normaliseSTU3(json);
    expect(result.item[0].answerOption).toEqual([{ valueCoding: { code: 'a', display: 'A' } }]);
    expect(result.item[0].option).toBeUndefined();
  });

  it('does not overwrite existing answerOption if present', () => {
    const json = q([{
      linkId: 'q1', type: 'choice',
      answerOption: [{ valueCoding: { code: 'x' } }],
      option: [{ valueCoding: { code: 'y' } }],
    }]);
    const result = normaliseSTU3(json);
    // answerOption already present — option field left as-is by _convertOptions
    expect(result.item[0].answerOption[0].valueCoding.code).toBe('x');
  });

  it('converts option[] in nested items', () => {
    const json = q([{
      linkId: 'g1', type: 'group',
      item: [{ linkId: 'q1', type: 'choice', option: [{ valueCoding: { code: 'b' } }] }],
    }]);
    const result = normaliseSTU3(json);
    expect(result.item[0].item[0].answerOption).toBeDefined();
    expect(result.item[0].item[0].option).toBeUndefined();
  });
});

// ── normaliseSTU3 — options reference → answerValueSet ────────────────────────

describe('normaliseSTU3 — options reference → answerValueSet', () => {
  it('converts item.options.reference to item.answerValueSet', () => {
    const json = q([{
      linkId: 'q1', type: 'choice',
      options: { reference: '#vs-diet' },
    }]);
    const result = normaliseSTU3(json);
    expect(result.item[0].answerValueSet).toBe('#vs-diet');
    expect(result.item[0].options).toBeUndefined();
  });

  it('converts external options reference URL', () => {
    const json = q([{
      linkId: 'q1', type: 'choice',
      options: { reference: 'http://example.org/ValueSet/my-vs' },
    }]);
    const result = normaliseSTU3(json);
    expect(result.item[0].answerValueSet).toBe('http://example.org/ValueSet/my-vs');
  });
});

// ── normaliseSTU3 — enableWhen.hasAnswer ──────────────────────────────────────

describe('normaliseSTU3 — enableWhen.hasAnswer → operator: exists', () => {
  it('converts hasAnswer: true to operator: exists, answerBoolean: true', () => {
    const json = q([{
      linkId: 'q2', type: 'string',
      enableWhen: [{ question: 'q1', hasAnswer: true }],
    }]);
    const result = normaliseSTU3(json);
    const ew = result.item[0].enableWhen[0];
    expect(ew.operator).toBe('exists');
    expect(ew.answerBoolean).toBe(true);
    expect(ew.hasAnswer).toBeUndefined();
  });

  it('converts hasAnswer: false to operator: exists, answerBoolean: false', () => {
    const json = q([{
      linkId: 'q2', type: 'string',
      enableWhen: [{ question: 'q1', hasAnswer: false }],
    }]);
    const result = normaliseSTU3(json);
    const ew = result.item[0].enableWhen[0];
    expect(ew.operator).toBe('exists');
    expect(ew.answerBoolean).toBe(false);
  });

  it('adds operator: = for implicit STU3 equality (answer field, no operator)', () => {
    const json = q([{
      linkId: 'q2', type: 'string',
      enableWhen: [{ question: 'q1', answerCoding: { code: 'yes' } }],
    }]);
    const result = normaliseSTU3(json);
    const ew = result.item[0].enableWhen[0];
    expect(ew.operator).toBe('=');
    expect(ew.answerCoding.code).toBe('yes');
  });

  it('leaves already-R4 enableWhen entries unchanged', () => {
    // Already has operator — should not be touched
    const json = qv('4.0.1', [{
      linkId: 'q2', type: 'string',
      enableWhen: [{ question: 'q1', operator: '=', answerBoolean: true }],
    }]);
    const result = normaliseSTU3(json);
    expect(result).toBe(json); // R4 → no-op, same reference
  });
});

// ── normaliseSTU3 — initial<Type> → initial[] ─────────────────────────────────

describe('normaliseSTU3 — initial<Type> → item.initial[]', () => {
  const cases = [
    ['initialBoolean',   'valueBoolean',   true],
    ['initialDecimal',   'valueDecimal',   3.14],
    ['initialInteger',   'valueInteger',   42],
    ['initialDate',      'valueDate',      '2024-01-01'],
    ['initialDateTime',  'valueDateTime',  '2024-01-01T00:00:00'],
    ['initialTime',      'valueTime',      '09:00:00'],
    ['initialString',    'valueString',    'hello'],
    ['initialUri',       'valueUri',       'http://example.org'],
    ['initialCoding',    'valueCoding',    { code: 'a', display: 'A' }],
    ['initialQuantity',  'valueQuantity',  { value: 70, unit: 'kg' }],
  ];

  for (const [stu3Key, r4Key, value] of cases) {
    it(`converts ${stu3Key} → initial[0].${r4Key}`, () => {
      const item = { linkId: 'q1', type: 'string', [stu3Key]: value };
      // inject STU3 detection via option[]
      item.option = [];
      const json = q([item]);
      const result = normaliseSTU3(json);
      expect(result.item[0].initial).toEqual([{ [r4Key]: value }]);
      expect(result.item[0][stu3Key]).toBeUndefined();
    });
  }

  it('does not overwrite existing R4 initial[] array', () => {
    const json = q([{
      linkId: 'q1', type: 'integer',
      initial: [{ valueInteger: 5 }],
      option: [],
    }]);
    const result = normaliseSTU3(json);
    expect(result.item[0].initial).toEqual([{ valueInteger: 5 }]);
  });
});

// ── normaliseSTU3 — immutability ──────────────────────────────────────────────

describe('normaliseSTU3 — does not mutate original', () => {
  it('original object is unchanged after normalisation', () => {
    const original = q([{
      linkId: 'q1', type: 'choice',
      option: [{ valueCoding: { code: 'a' } }],
    }]);
    const originalOptionRef = original.item[0].option;
    normaliseSTU3(original);
    expect(original.item[0].option).toBe(originalOptionRef); // not mutated
    expect(original.item[0].answerOption).toBeUndefined();
  });
});
