// Runs one answer set through a form's calculations: Show When and calculations settle together, as when a person fills the form in.
import { buildCalcCache, buildVarEnv, evalCalcNodes } from '../calc.js';
import { buildDepGraph, topoOrder } from '../dep-graph.js';
import { buildQR } from '../qr-builder.js';
import { hasCondition, enabledState } from './enabled.js';

export function walk(nodes, fn) {
  for (const n of nodes || []) { fn(n); walk(n.children, fn); }
}

/**
 * @param {{ tree: object[], base: object, fp: object, variables?: object[] }} form
 * @returns {{ byId: Map, calcs: object[], conditional: boolean, run: (scenario: object) => ({ answers: object, gave: object, qr: object, on: Set|null }|null) }}
 *   run: answers = the ones still enabled; gave = calculation id → text or null; null when the engine cannot build the scenario
 */
export function createRunner({ tree, base, fp, variables = [] }) {
  const byId = new Map();
  walk(tree, (n) => byId.set(n.id, n));
  const calcs = [...byId.values()].filter((n) => n._calculatedExpr);
  const cache = buildCalcCache(tree, variables);
  const passes = topoOrder(buildDepGraph(tree, variables)).cycles.length || variables.length ? 2 : 1; // calculations run in dependency order; a cycle or any variable (which may read another calculation) needs a second pass
  const conditional = [...byId.values()].some(hasCondition);

  function run(scenario) {
    let answers = scenario; // the answers still enabled by Show When; the rest are dropped, as a person could not give them
    let results = {};
    let envVars;
    let qr;
    let on = null;
    try {
      for (let round = 0; round < 3; round++) {
        const values = Object.fromEntries(Object.entries(answers).map(([id, v]) => [id, [v]])); // the answer store keeps a list per question
        qr = buildQR(base, values);
        results = {};
        envVars = buildVarEnv(variables, qr, fp);
        for (let pass = 0; pass < passes; pass++) { // results are written back into the response, so a later calculation reads an earlier one
          if (pass && variables.length) envVars = buildVarEnv(variables, qr, fp);
          evalCalcNodes(tree, qr, fp, results, envVars, base, cache);
        }
        if (!conditional) break;
        const state = enabledState(tree, { values, results, fp, qr, envVars });
        on = state.on;
        const next = Object.fromEntries(Object.entries(scenario).filter(([id]) => !state.off.has(id)));
        const stable = Object.keys(next).sort().join('\n') === Object.keys(answers).sort().join('\n');
        if (stable || round === 2) break; // the answers kept always match the results recorded with them
        answers = next;
      }
    } catch (_e) { return null; } // one scenario the engine cannot build must not end the whole check
    const gave = {};
    for (const c of calcs) {
      const v = [results[c.id]].flat()[0];
      gave[c.id] = v === undefined || v === null || v === '' ? null : String(v);
    }
    return { answers, gave, qr, on };
  }

  return { byId, calcs, conditional, run };
}
