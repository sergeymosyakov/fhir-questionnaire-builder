import { describe, it, expect } from 'vitest';

const { extractRefs, buildDepGraph, detectCycles, topoOrder } =
  await import('../js/fhir/dep-graph.js');

// ── extractRefs ───────────────────────────────────────────────────────────────
describe('extractRefs', () => {
  it('returns empty for null/empty/non-string input', () => {
    expect(extractRefs(null)).toEqual({ linkIds: [], vars: [] });
    expect(extractRefs('')).toEqual({ linkIds: [], vars: [] });
    expect(extractRefs(42)).toEqual({ linkIds: [], vars: [] });
  });

  it('extracts a single-quoted linkId reference', () => {
    const { linkIds } = extractRefs("item.where(linkId='weight').answer.valueDecimal");
    expect(linkIds).toEqual(['weight']);
  });

  it('extracts a double-quoted linkId reference', () => {
    const { linkIds } = extractRefs('item.where(linkId="height").answer.value');
    expect(linkIds).toEqual(['height']);
  });

  it('tolerates whitespace around the equals sign', () => {
    const { linkIds } = extractRefs("item.where(linkId  =  'bmi').exists()");
    expect(linkIds).toEqual(['bmi']);
  });

  it('extracts multiple distinct linkIds', () => {
    const { linkIds } = extractRefs(
      "item.where(linkId='a').answer + item.where(linkId='b').answer"
    );
    expect(linkIds.sort()).toEqual(['a', 'b']);
  });

  it('deduplicates repeated linkIds', () => {
    const { linkIds } = extractRefs(
      "item.where(linkId='a').x + item.where(linkId='a').y"
    );
    expect(linkIds).toEqual(['a']);
  });

  it('extracts %variable references', () => {
    const { vars } = extractRefs('%weightKg / (%heightM * %heightM)');
    expect(vars.sort()).toEqual(['heightM', 'weightKg']);
  });

  it('ignores %resource and %context built-ins', () => {
    const { vars } = extractRefs('%resource.item + %context.foo + %myVar');
    expect(vars).toEqual(['myVar']);
  });

  it('extracts backtick-quoted variable names', () => {
    const { vars } = extractRefs('%`my var`');
    expect(vars).toEqual(['my var']);
  });
});

// ── buildDepGraph ─────────────────────────────────────────────────────────────
describe('buildDepGraph', () => {
  it('creates an edge from enableWhen.question', () => {
    const nodes = [
      { id: 'a', type: 'item' },
      { id: 'b', type: 'item', enableWhen: [{ question: 'a', operator: '=', answerBoolean: true }] },
    ];
    const g = buildDepGraph(nodes);
    expect([...g.edges.get('b')]).toEqual(['a']);
    expect([...g.edges.get('a')]).toEqual([]);
  });

  it('creates edges from calculatedExpression linkId refs', () => {
    const nodes = [
      { id: 'weight', type: 'item' },
      { id: 'height', type: 'item' },
      { id: 'bmi', type: 'item', _calculatedExpr: "item.where(linkId='weight').answer / item.where(linkId='height').answer" },
    ];
    const g = buildDepGraph(nodes);
    expect([...g.edges.get('bmi')].sort()).toEqual(['height', 'weight']);
  });

  it('flattens nested groups', () => {
    const nodes = [
      { id: 'g', type: 'group', children: [
        { id: 'x', type: 'item' },
        { id: 'y', type: 'item', enableWhen: [{ question: 'x' }] },
      ] },
    ];
    const g = buildDepGraph(nodes);
    expect(g.nodeIds.sort()).toEqual(['g', 'x', 'y']);
    expect([...g.edges.get('y')]).toEqual(['x']);
  });

  it('records references to unknown linkIds in missing', () => {
    const nodes = [
      { id: 'a', type: 'item', enableWhen: [{ question: 'ghost' }] },
    ];
    const g = buildDepGraph(nodes);
    expect([...g.missing.get('a')]).toEqual(['ghost']);
    expect([...g.edges.get('a')]).toEqual([]);
  });

  it('does not create node edges for variable references', () => {
    const nodes = [
      { id: 'a', type: 'item', _calculatedExpr: '%bmiCalc' },
    ];
    const vars = [{ name: 'bmiCalc', expression: 'x' }];
    const g = buildDepGraph(nodes, vars);
    expect([...g.edges.get('a')]).toEqual([]);
    expect(g.missing.has('a')).toBe(false);
    expect(g.varNames.has('bmiCalc')).toBe(true);
  });

  it('ignores a self-referential enableWhen', () => {
    const nodes = [
      { id: 'a', type: 'item', enableWhen: [{ question: 'a' }] },
    ];
    const g = buildDepGraph(nodes);
    expect([...g.edges.get('a')]).toEqual([]);
  });
});

// ── detectCycles ──────────────────────────────────────────────────────────────
describe('detectCycles', () => {
  it('reports no cycles for an acyclic graph', () => {
    const nodes = [
      { id: 'a', type: 'item' },
      { id: 'b', type: 'item', enableWhen: [{ question: 'a' }] },
      { id: 'c', type: 'item', enableWhen: [{ question: 'b' }] },
    ];
    expect(detectCycles(buildDepGraph(nodes))).toEqual([]);
  });

  it('detects a two-node cycle A↔B', () => {
    const nodes = [
      { id: 'a', type: 'item', _calculatedExpr: "item.where(linkId='b').answer" },
      { id: 'b', type: 'item', _calculatedExpr: "item.where(linkId='a').answer" },
    ];
    const cycles = detectCycles(buildDepGraph(nodes));
    expect(cycles.length).toBeGreaterThan(0);
    // first and last entry of a reported cycle are identical (closed loop)
    const cyc = cycles[0];
    expect(cyc[0]).toBe(cyc[cyc.length - 1]);
    expect(new Set(cyc)).toEqual(new Set(['a', 'b']));
  });

  it('detects a three-node cycle A→B→C→A', () => {
    const nodes = [
      { id: 'a', type: 'item', _calculatedExpr: "item.where(linkId='c').answer" },
      { id: 'b', type: 'item', _calculatedExpr: "item.where(linkId='a').answer" },
      { id: 'c', type: 'item', _calculatedExpr: "item.where(linkId='b').answer" },
    ];
    const cycles = detectCycles(buildDepGraph(nodes));
    expect(cycles.length).toBeGreaterThan(0);
    expect(new Set(cycles[0])).toEqual(new Set(['a', 'b', 'c']));
  });
});

// ── topoOrder ─────────────────────────────────────────────────────────────────
describe('topoOrder', () => {
  it('orders a dependency chain so dependencies come first', () => {
    const nodes = [
      { id: 'c', type: 'item', _calculatedExpr: "item.where(linkId='b').answer" },
      { id: 'b', type: 'item', _calculatedExpr: "item.where(linkId='a').answer" },
      { id: 'a', type: 'item' },
    ];
    const { order, cycles } = topoOrder(buildDepGraph(nodes));
    expect(cycles).toEqual([]);
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'));
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('c'));
  });

  it('keeps all independent nodes in the order', () => {
    const nodes = [
      { id: 'a', type: 'item' },
      { id: 'b', type: 'item' },
      { id: 'c', type: 'item' },
    ];
    const { order } = topoOrder(buildDepGraph(nodes));
    expect(order.sort()).toEqual(['a', 'b', 'c']);
  });

  it('appends cyclic nodes and reports the cycle', () => {
    const nodes = [
      { id: 'a', type: 'item', _calculatedExpr: "item.where(linkId='b').answer" },
      { id: 'b', type: 'item', _calculatedExpr: "item.where(linkId='a').answer" },
      { id: 'free', type: 'item' },
    ];
    const { order, cycles } = topoOrder(buildDepGraph(nodes));
    expect(order.sort()).toEqual(['a', 'b', 'free']);
    expect(cycles.length).toBeGreaterThan(0);
  });
});
