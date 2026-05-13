import { describe, it, expect, vi } from 'vitest';

// fhirpath mock — minimal subset needed by buildVarEnv / evalCalcNodes
const fpMock = {
  evaluate: vi.fn((qr, expr, env) => {
    // Simple expression router for test purposes
    if (expr === 'item.where(linkId=\'weight\').answer.valueDecimal') {
      const item = (qr.item || []).find(i => i.linkId === 'weight');
      return item?.answer?.[0]?.valueDecimal !== undefined
        ? [item.answer[0].valueDecimal]
        : [];
    }
    if (expr === 'item.where(linkId=\'height\').answer.valueDecimal / 100') {
      const item = (qr.item || []).find(i => i.linkId === 'height');
      const h = item?.answer?.[0]?.valueDecimal;
      return h !== undefined ? [h / 100] : [];
    }
    if (expr === '%bmiCalc') return [env.bmiCalc ?? null];
    if (expr === 'true')  return [true];
    if (expr === 'false') return [false];
    return [];
  }),
};

const { buildVarEnv, evalCalcNodes } = await import('../js/fhir/calc.js');

// ── buildVarEnv ───────────────────────────────────────────────────────────────
describe('buildVarEnv', () => {
  it('returns empty env for empty variables', () => {
    expect(buildVarEnv([], {}, fpMock)).toEqual({});
  });

  it('skips variables without name or expression', () => {
    const vars = [{ name: '', expression: 'true' }, { name: 'x', expression: '' }];
    expect(buildVarEnv(vars, {}, fpMock)).toEqual({});
  });

  it('evaluates a simple variable', () => {
    const qr = {
      item: [{ linkId: 'weight', answer: [{ valueDecimal: 80 }] }],
    };
    const vars = [{ name: 'weightKg', expression: "item.where(linkId='weight').answer.valueDecimal" }];
    const env = buildVarEnv(vars, qr, fpMock);
    expect(env.weightKg).toBe(80);
  });

  it('unwraps single-element array result', () => {
    const qr = { item: [{ linkId: 'weight', answer: [{ valueDecimal: 70 }] }] };
    const vars = [{ name: 'w', expression: "item.where(linkId='weight').answer.valueDecimal" }];
    const env = buildVarEnv(vars, qr, fpMock);
    expect(env.w).toBe(70); // unwrapped from [70]
  });
});

// ── evalCalcNodes ─────────────────────────────────────────────────────────────
describe('evalCalcNodes', () => {
  it('does nothing when no calc nodes', () => {
    const nodes = [{ id: 'q1', type: 'item' }];
    const values = {};
    evalCalcNodes(nodes, {}, fpMock, values);
    expect(values).toEqual({});
  });

  it('evaluates a boolean calc node (checkbox)', () => {
    const nodes = [{ id: 'flag', type: 'item', itemType: 'checkbox', _calculatedExpr: 'true', _readOnly: true }];
    const values = {};
    evalCalcNodes(nodes, {}, fpMock, values);
    expect(values.flag).toBe(true);
  });

  it('evaluates a false boolean calc node', () => {
    const nodes = [{ id: 'flag', type: 'item', itemType: 'checkbox', _calculatedExpr: 'false', _readOnly: true }];
    const values = {};
    evalCalcNodes(nodes, {}, fpMock, values);
    expect(values.flag).toBe(false);
  });

  it('evaluates a text calc node (joins result)', () => {
    const fpText = { evaluate: vi.fn(() => ['hello']) };
    const nodes = [{ id: 'note', type: 'item', itemType: 'text', _calculatedExpr: 'anything', _readOnly: true }];
    const values = {};
    evalCalcNodes(nodes, {}, fpText, values);
    expect(values.note).toBe('hello');
  });

  it('skips non-readOnly calc nodes', () => {
    const nodes = [{ id: 'q1', type: 'item', _calculatedExpr: 'true', _readOnly: false }];
    const values = {};
    evalCalcNodes(nodes, {}, fpMock, values);
    expect(values.q1).toBeUndefined();
  });

  it('recurses into group children', () => {
    const nodes = [{
      id: 'g', type: 'group', children: [
        { id: 'inner', type: 'item', itemType: 'checkbox', _calculatedExpr: 'true', _readOnly: true },
      ],
    }];
    const values = {};
    evalCalcNodes(nodes, {}, fpMock, values);
    expect(values.inner).toBe(true);
  });

  it('does not crash on expression error, leaves value undefined', () => {
    const fpBad = { evaluate: vi.fn(() => { throw new Error('bad expr'); }) };
    const nodes = [{ id: 'q1', type: 'item', itemType: 'checkbox', _calculatedExpr: 'bad', _readOnly: true }];
    const values = {};
    expect(() => evalCalcNodes(nodes, {}, fpBad, values)).not.toThrow();
    expect(values.q1).toBeUndefined();
  });
});
