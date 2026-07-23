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

  it('keeps multi-element array result as array', () => {
    const fpMulti = { evaluate: vi.fn(() => [1, 2, 3]) };
    const vars = [{ name: 'list', expression: 'multi' }];
    const env = buildVarEnv(vars, {}, fpMulti);
    expect(env.list).toEqual([1, 2, 3]);
  });

  it('does not crash on expression error, skips variable', () => {
    const fpBad = { evaluate: vi.fn(() => { throw new Error('bad'); }) };
    const vars = [{ name: 'x', expression: 'bad' }];
    const env = buildVarEnv(vars, {}, fpBad);
    expect(env).toEqual({});
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

  it('preserves nested child answers (answer[0].item) when writing back a parent calc value', () => {
    // Regression: a readOnly boolean parent with children (its own value is
    // computed) must keep answer[0].item after write-back — otherwise the QR is
    // corrupted and any expression traversing answer.item (or a downstream calc)
    // sees the children as gone.
    const base = { item: [
      { linkId: 'p', type: 'boolean', item: [{ linkId: 'c', type: 'boolean' }] },
    ] };
    const qr = { resourceType: 'QuestionnaireResponse', item: [
      { linkId: 'p', answer: [{ item: [{ linkId: 'c', answer: [{ valueBoolean: true }] }] }] },
    ] };
    const tree = [
      { id: 'p', type: 'item', itemType: 'checkbox', _calculatedExpr: 'true', _readOnly: true,
        children: [{ id: 'c', type: 'item', itemType: 'checkbox', children: [] }] },
    ];
    const values = {};
    evalCalcNodes(tree, qr, fpMock, values, {}, base);
    const p = qr.item.find(i => i.linkId === 'p');
    expect(p.answer[0].valueBoolean).toBe(true);                    // value written back
    expect(p.answer[0].item?.[0]?.linkId).toBe('c');               // children preserved
    expect(p.answer[0].item[0].answer[0].valueBoolean).toBe(true); // child answer intact
  });

  it('does not crash on expression error, leaves value undefined', () => {
    const fpBad = { evaluate: vi.fn(() => { throw new Error('bad expr'); }) };
    const nodes = [{ id: 'q1', type: 'item', itemType: 'checkbox', _calculatedExpr: 'bad', _readOnly: true }];
    const values = {};
    expect(() => evalCalcNodes(nodes, {}, fpBad, values)).not.toThrow();
    expect(values.q1).toBeUndefined();
  });

  it('stores empty string when result array is empty', () => {
    const fpEmpty = { evaluate: vi.fn(() => []) };
    const nodes = [{ id: 'q1', type: 'item', itemType: 'text', _calculatedExpr: 'x', _readOnly: true }];
    const values = {};
    evalCalcNodes(nodes, {}, fpEmpty, values);
    expect(values.q1).toBe('');
  });

  it('stores empty string when result is non-array scalar without index 0', () => {
    const fpScalar = { evaluate: vi.fn(() => 42) };
    const nodes = [{ id: 'q1', type: 'item', itemType: 'text', _calculatedExpr: 'x', _readOnly: true }];
    const values = {};
    evalCalcNodes(nodes, {}, fpScalar, values);
    expect(values.q1).toBe(''); // 42[0] is undefined → falls through to ''
  });

  it('resolves a calc chain in topological order regardless of tree order', () => {
    // FHIRPath stub: reads valueDecimal of a referenced item from the live QR.
    const fpChain = {
      evaluate: (qr, expr) => {
        const readDec = (lid) => {
          const fhirItem = (qr.item || []).find(i => i.linkId === lid);
          return fhirItem?.answer?.[0]?.valueDecimal;
        };
        if (expr.includes("linkId='a'")) { const v = readDec('a'); return v !== undefined ? [v * 2] : []; }
        if (expr.includes("linkId='b'")) { const v = readDec('b'); return v !== undefined ? [v + 1] : []; }
        return [];
      },
    };
    // Tree order is reversed (c before b) to prove topo ordering is applied.
    const nodes = [
      { id: 'c', type: 'item', itemType: 'decimal', _readOnly: true, _calculatedExpr: "item.where(linkId='b').answer.valueDecimal + 1" },
      { id: 'b', type: 'item', itemType: 'decimal', _readOnly: true, _calculatedExpr: "item.where(linkId='a').answer.valueDecimal * 2" },
      { id: 'a', type: 'item', itemType: 'decimal' },
    ];
    const base = { resourceType: 'Questionnaire', item: [
      { linkId: 'c', type: 'decimal' }, { linkId: 'b', type: 'decimal' }, { linkId: 'a', type: 'decimal' },
    ] };
    const qr = { resourceType: 'QuestionnaireResponse', item: [
      { linkId: 'c' }, { linkId: 'b' }, { linkId: 'a', answer: [{ valueDecimal: 10 }] },
    ] };
    const values = {};
    evalCalcNodes(nodes, qr, fpChain, values, {}, base);
    expect(values.b).toBe('20'); // a(10) * 2
    expect(values.c).toBe('21'); // b(20) + 1
  });
});

// ── evalInitialExprNodes ──────────────────────────────────────────────────────
const { evalInitialExprNodes } = await import('../js/fhir/calc.js');

describe('evalInitialExprNodes', () => {
  it('does nothing when no _initialExpr', () => {
    const nodes = [{ id: 'q1', type: 'item' }];
    const values = {};
    evalInitialExprNodes(nodes, {}, fpMock, values);
    expect(values).toEqual({});
  });

  it('evaluates a text initial expression', () => {
    const fpText = { evaluate: vi.fn(() => ['preloaded']) };
    const nodes = [{ id: 'q1', type: 'item', itemType: 'text', _initialExpr: 'expr' }];
    const values = {};
    evalInitialExprNodes(nodes, {}, fpText, values);
    expect(values.q1).toBe('preloaded');
  });

  it('evaluates a checkbox initial expression (true)', () => {
    const nodes = [{ id: 'chk', type: 'item', itemType: 'checkbox', _initialExpr: 'true' }];
    const values = {};
    evalInitialExprNodes(nodes, {}, fpMock, values);
    expect(values.chk).toBe(true);
  });

  it('evaluates a checkbox initial expression (false)', () => {
    const nodes = [{ id: 'chk', type: 'item', itemType: 'checkbox', _initialExpr: 'false' }];
    const values = {};
    evalInitialExprNodes(nodes, {}, fpMock, values);
    expect(values.chk).toBe(false);
  });

  it('stores empty string when result is empty array', () => {
    const fpEmpty = { evaluate: vi.fn(() => []) };
    const nodes = [{ id: 'q1', type: 'item', itemType: 'text', _initialExpr: 'expr' }];
    const values = {};
    evalInitialExprNodes(nodes, {}, fpEmpty, values);
    expect(values.q1).toBe('');
  });

  it('recurses into group children', () => {
    const nodes = [{
      id: 'g', type: 'group', children: [
        { id: 'inner', type: 'item', itemType: 'checkbox', _initialExpr: 'true' },
      ],
    }];
    const values = {};
    evalInitialExprNodes(nodes, {}, fpMock, values);
    expect(values.inner).toBe(true);
  });

  it('does not crash on expression error', () => {
    const fpBad = { evaluate: vi.fn(() => { throw new Error('fail'); }) };
    const nodes = [{ id: 'q1', type: 'item', itemType: 'text', _initialExpr: 'bad' }];
    const values = {};
    expect(() => evalInitialExprNodes(nodes, {}, fpBad, values)).not.toThrow();
    expect(values.q1).toBeUndefined();
  });

  it('passes envVars into evaluate call', () => {
    const fpSpy = { evaluate: vi.fn(() => ['x']) };
    const nodes = [{ id: 'q1', type: 'item', itemType: 'text', _initialExpr: 'expr' }];
    evalInitialExprNodes(nodes, { id: 'qr1' }, fpSpy, {}, { myVar: 1 });
    expect(fpSpy.evaluate).toHaveBeenCalledWith(
      { id: 'qr1' },
      'expr',
      expect.objectContaining({ resource: { id: 'qr1' }, myVar: 1 }),
    );
  });
});
