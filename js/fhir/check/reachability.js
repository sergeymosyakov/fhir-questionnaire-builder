// "Check my form": runs every calculation over generated answer sets and reports text results no answers can produce.
import { buildCalcCache, buildVarEnv, evalCalcNodes } from '../calc.js';
import { buildDepGraph, topoOrder } from '../dep-graph.js';
import { buildQR } from '../qr-builder.js';
import { rawOptsToPairs } from '../../utils.js';
import { collectInputs, buildScenarios } from './generators.js';
import { hasCondition, enabledState, describeWhen } from './enabled.js';

const LITERAL = /'((?:[^'\\]|\\.)*)'/g;
const yieldToUi = () => new Promise((r) => setTimeout(r, 0));
const SLICE_MS = 40;

function walk(nodes, fn) {
  for (const n of nodes || []) { fn(n); walk(n.children, fn); }
}

const literalsOf = (expr) => [...expr.matchAll(LITERAL)].map((m) => m[1]);

// Questions a calculation reads, directly or through other calculations (found by the linkIds quoted in the expression).
function dependencies(calc, byId) {
  const seen = new Set();
  const visit = (node) => {
    for (const lit of literalsOf(node._calculatedExpr || '')) {
      const dep = byId.get(lit)?.type === 'item' ? byId.get(lit) : null;
      if (dep && !seen.has(dep.id)) { seen.add(dep.id); if (dep._calculatedExpr) visit(dep); }
    }
  };
  visit(calc);
  return [...seen].map((id) => byId.get(id));
}

// The enclosing call of the character at `at`: its name and where its arguments start (quoted text is opaque in `masked`).
function callAround(masked, at) {
  let depth = 0;
  for (let i = at - 1; i >= 0; i--) {
    if (masked[i] === ')') depth++;
    else if (masked[i] === '(') {
      if (depth === 0) return { name: /([A-Za-z_]\w*)\s*$/.exec(masked.slice(0, i))?.[1] ?? '', open: i };
      depth--;
    }
  }
  return { name: '', open: -1 };
}

// The call's arguments as [start, end) ranges at its own nesting level.
function argRanges(masked, open) {
  const ranges = [];
  let depth = 0;
  let start = open + 1;
  for (let i = open + 1; i < masked.length; i++) {
    if (masked[i] === '(') depth++;
    else if (masked[i] === ')') { if (depth === 0) { ranges.push([start, i]); break; } depth--; }
    else if (masked[i] === ',' && depth === 0) { ranges.push([start, i]); start = i + 1; }
  }
  return ranges;
}

// A condition in the words of the form: the question references become the question titles.
const REF = /%resource\.(?:repeat\(item\)|item)\.where\(linkId='([^']+)'\)\.answer(?:\.\w+)*/g;
const humanize = (cond, byId) => cond.trim().replace(REF, (_m, id) => byId.get(id)?.title || id).replace(/\s+/g, ' ');

// The texts an expression can output — quoted words that stand as a branch of iif(cond, 'A', 'B') — with the condition each is given under.
function bandsOf(calc, byId, answerTexts) {
  const expr = calc._calculatedExpr;
  const masked = expr.replace(LITERAL, (m) => `'${'x'.repeat(m.length - 2)}'`);
  const bands = [];
  for (const m of expr.matchAll(LITERAL)) {
    const t = m[1].replace(/\\(.)/g, '$1'); // the text the engine returns, not the escaped source
    if (!(/,\s*$/.test(expr.slice(0, m.index)) && /^\s*[,)]/.test(expr.slice(m.index + m[0].length)))) continue;
    const call = callAround(masked, m.index);
    if (call.name !== 'iif' || !/[A-Za-z]/.test(t) || /^[a-z]+:\/\//i.test(t) || t.length <= 2 || byId.has(t) || answerTexts.has(t)) continue;
    const args = argRanges(masked, call.open);
    const pos = args.findIndex(([from, to]) => m.index >= from && m.index < to);
    const cond = args[0] ? humanize(expr.slice(args[0][0], args[0][1]), byId) : '';
    bands.push({ text: t, when: pos === 1 ? cond : `not (${cond})` });
  }
  return [...new Map(bands.map((b) => [b.text, b])).values()];
}

const KIND = { integer: 'a number without a minimum and maximum', decimal: 'a number without a minimum and maximum', date: 'a date', dateTime: 'a date', checklist: 'a multiple-choice list' };
const describeInput = (d) => `${d.title || d.id} (${KIND[d.itemType] ?? 'a question that cannot be tried automatically'})`;

/**
 * @param {{ tree: object[], base: object, fp: object, variables?: object[] }} form
 * @returns {Promise<{ scenarios: number, truncated: boolean, unshown: [{ id, title, when }], trials: [{ answers, results }], calcs: object[] }>} calcs: { id, title, status: 'ok'|'unreachable'|'no-result'|'skipped', missed?, details? [{ text, when }], reached?, reason? }
 */
export async function checkForm({ tree, base, fp, variables = [], onProgress }) {
  if (!fp) throw new Error('the FHIRPath engine is not loaded');
  const byId = new Map();
  walk(tree, (n) => byId.set(n.id, n));
  const answerTexts = new Set();
  walk(tree, (n) => rawOptsToPairs(n._rawAnswerOptions).forEach((o) => { answerTexts.add(o.code); answerTexts.add(o.display); }));
  const inputs = collectInputs(tree);
  walk(tree, (n) => (n.enableWhen || []).forEach((ew) => { // a number a Show When rule compares with is a value worth trying
    const v = ew.answerInteger ?? ew.answerDecimal;
    const input = inputs.find((i) => i.id === ew.question);
    if (input?.kind !== 'number' || !Number.isFinite(v)) return;
    for (const x of ew.operator === '>' ? [v + 1] : ew.operator === '<' ? [v - 1] : [v]) { // a strict comparison needs the neighbour, not the value
      if (x >= input.lo && x <= input.hi && !input.values.includes(x)) input.values.push(x);
    }
  }));
  const inputIds = new Set(inputs.map((i) => i.id));
  const calcs = [...byId.values()].filter((n) => n._calculatedExpr);
  const scenarios = buildScenarios(inputs);
  const cache = buildCalcCache(tree, variables);
  const passes = topoOrder(buildDepGraph(tree, variables)).cycles.length || variables.length ? 2 : 1; // calculations run in dependency order; a cycle or a variable (not in the graph) needs a second look

  const reached = new Map(calcs.map((c) => [c.id, new Set()]));
  const trials = []; // every combination tried, with what each calculation gave
  const conditional = [...byId.values()].some(hasCondition);
  const enabledEver = new Set(); // questions Show When enabled for at least one answer set
  onProgress?.(0, scenarios.length);
  let sliceStart = Date.now();
  for (let s = 0; s < scenarios.length; s++) {
    if (Date.now() - sliceStart > SLICE_MS) { onProgress?.(s, scenarios.length); await yieldToUi(); sliceStart = Date.now(); } // before the work, so a run of failing scenarios still yields
    let answers = scenarios[s]; // the answers still enabled by Show When; the rest are dropped, as a person could not give them
    let results = {};
    let envVars;
    try {
      for (let round = 0; round < 3; round++) {
        const values = Object.fromEntries(Object.entries(answers).map(([id, v]) => [id, [v]])); // the answer store keeps a list per question
        const qr = buildQR(base, values);
        results = {};
        envVars = buildVarEnv(variables, qr, fp);
        for (let pass = 0; pass < passes; pass++) { // results are written back into the response, so a later calculation reads an earlier one
          if (pass && variables.length) envVars = buildVarEnv(variables, qr, fp);
          evalCalcNodes(tree, qr, fp, results, envVars, base, cache);
        }
        if (!conditional) break;
        const { off, on } = enabledState(tree, { values, results, fp, qr, envVars });
        const next = Object.fromEntries(Object.entries(scenarios[s]).filter(([id]) => !off.has(id)));
        const stable = Object.keys(next).sort().join('\n') === Object.keys(answers).sort().join('\n');
        if (stable || round === 2) { on.forEach((id) => enabledEver.add(id)); }
        if (stable || round === 2) break; // the answers kept always match the results recorded with them
        answers = next;
      }
    } catch (_e) { continue; } // one scenario the engine cannot build must not end the whole check
    const gave = {};
    for (const c of calcs) {
      const v = [results[c.id]].flat()[0];
      gave[c.id] = v === undefined || v === null || v === '' ? null : String(v);
      if (gave[c.id] !== null) reached.get(c.id).add(gave[c.id]);
    }
    trials.push({ answers, results: gave });
  }

  onProgress?.(scenarios.length, scenarios.length);
  const report = calcs.map((c) => {
    const title = c.title || c.id;
    const reads = dependencies(c, byId).filter((d) => !d._calculatedExpr);
    const unknown = reads.filter((d) => !inputIds.has(d.id));
    const readIds = reads.map((d) => d.id);
    const via = dependencies(c, byId).filter((d) => d._calculatedExpr).map((d) => d.id);
    if (unknown.length) return { id: c.id, title, reads: readIds, via, status: 'skipped', reason: `it reads ${unknown.map(describeInput).join(', ')}, which cannot be tried automatically` };
    const got = [...reached.get(c.id)];
    if (!got.length) return { id: c.id, title, reads: readIds, via, status: 'no-result', reached: got };
    const lost = bandsOf(c, byId, answerTexts).filter((b) => !got.includes(b.text));
    return { id: c.id, title, reads: readIds, via, status: lost.length ? 'unreachable' : 'ok', missed: lost.map((b) => b.text), details: lost, reached: got };
  });
  // A question with a Show When rule that no answer set enabled — only judged when every question the rule reads can be tried.
  const settable = (id) => inputIds.has(id) || byId.get(id)?._calculatedExpr;
  const inRepeat = new Set();
  walk(tree, (n) => { if (n.type === 'group' && n.repeats) walk(n.children, (c) => inRepeat.add(c.id)); }); // the preview does not evaluate Show When inside a repeating group
  const unshown = !conditional ? [] : [...byId.values()].filter((n) => n.type === 'item' && n.enableWhen?.length && !n.enableWhenExpression
    && !inRepeat.has(n.id) && !enabledEver.has(n.id) && n.enableWhen.every((ew) => settable(ew.question))).map((n) => ({ id: n.id, title: n.title || n.id, when: describeWhen(n, (id) => byId.get(id)?.title || id) }));
  return { scenarios: scenarios.length, truncated: scenarios.truncated, calcs: report, trials, unshown };
}
