// Answer sets for "Check my form": the inputs a form has, and a small set of scenarios that walks every one of them to its limits.
import { rawOptsToPairs } from '../../utils.js';

const CHOICE = new Set(['select', 'radio', 'open-choice']);
const NUMBER = new Set(['integer', 'decimal']);
const MIN_SCENARIOS = 300;
const MAX_SCENARIOS = 1500;
const PER_INPUT = 7; // ladder (2), values and unanswered (up to 5) each question needs

// Every question the generator can answer, in form order. Questions inside a repeating group and calculated ones are not inputs.
export function collectInputs(nodes, inGroup = false, out = []) {
  for (const n of nodes || []) {
    const repeating = inGroup || (n.type === 'group' && n.repeats);
    if (n.type === 'item' && !n._calculatedExpr && !repeating) {
      const input = inputOf(n);
      if (input) out.push(input);
    }
    if (n.children?.length) collectInputs(n.children, repeating, out);
  }
  return out;
}

// Lowest and highest answer of a question, or null when it has no known limits (a number without both bounds).
function inputOf(n) {
  if (CHOICE.has(n.itemType)) {
    const codes = rawOptsToPairs(n._rawAnswerOptions).map((o) => o.code).filter((c) => c !== '' && c != null);
    return codes.length ? { id: n.id, kind: 'choice', values: codes, lo: codes[0], hi: codes[codes.length - 1] } : null;
  }
  if (n.itemType === 'checkbox') return { id: n.id, kind: 'boolean', values: [false, true], lo: false, hi: true };
  if (NUMBER.has(n.itemType) && Number.isFinite(n._minValue) && Number.isFinite(n._maxValue) && n._minValue <= n._maxValue) {
    const mid = (n._minValue + n._maxValue) / 2;
    const values = [...new Set([n._minValue, mid, n._maxValue])];
    return { id: n.id, kind: 'number', values, lo: n._minValue, hi: n._maxValue };
  }
  return null;
}

// Extremes, a "ladder" (the first k questions at the top, the rest at the bottom), one question at a time, and unanswered ones.
export function buildScenarios(inputs, cap = Math.min(MAX_SCENARIOS, Math.max(MIN_SCENARIOS, PER_INPUT * inputs.length + 3))) {
  const seen = new Set();
  const out = [];
  const add = (values) => {
    const key = JSON.stringify(values);
    if (!seen.has(key)) { seen.add(key); out.push(values); }
  };
  const fill = (pick) => Object.fromEntries(inputs.map((i) => [i.id, pick(i)]).filter(([, v]) => v !== undefined));
  add({});
  add(fill((i) => i.lo));
  add(fill((i) => i.hi));
  // Interleaved per question, so a cap cuts the last questions evenly instead of dropping one whole kind of combination.
  const pos = new Map(inputs.map((input, k) => [input, k]));
  for (const [k, input] of inputs.entries()) {
    if (out.length > cap) break; // no point building what the cap drops
    add(fill((i) => (pos.get(i) <= k ? i.hi : i.lo)));
    add(fill((i) => (pos.get(i) <= k ? i.lo : i.hi)));
    for (const v of input.values) add({ ...fill((i) => i.lo), [input.id]: v });
    for (const side of ['lo', 'hi']) { // this question unanswered while all the others sit at one end
      const rest = fill((i) => i[side]);
      delete rest[input.id];
      add(rest);
    }
  }
  const kept = out.slice(0, cap);
  kept.truncated = out.length > cap; // a very large form: later combinations were left out
  return kept;
}
