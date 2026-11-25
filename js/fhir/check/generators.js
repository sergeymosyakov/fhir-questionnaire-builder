// Answer sets for "Check my form": the inputs a form has, and a small set of scenarios that walks every one of them to its limits.
import { rawOptsToPairs } from '../../utils.js';

const CHOICE = new Set(['select', 'radio', 'open-choice']);
const NUMBER = new Set(['integer', 'decimal']);
const DATE = new Set(['date', 'dateTime']);
const SHIFTS = [{ y: -100 }, { y: -50 }, { y: -25 }, { y: -1 }, { m: -1 }, { d: -7 }, { d: -1 }, {}, { d: 1 }, { d: 7 }, { m: 1 }, { y: 1 }, { y: 25 }, { y: 50 }]; // an age, a past event, a due date: calendar steps from today
const MIN_SCENARIOS = 300;
const MAX_SCENARIOS = 1500;
const RANDOM_SETS = 300; // formulas of several unbounded numbers need matching pairs
const PER_INPUT = 11; // ladder (2), values and unanswered (up to 9) each question needs

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

// Lowest and highest answer of a question, or null when it has no known limits (none for a question the generator cannot answer).
function inputOf(n) {
  if (CHOICE.has(n.itemType)) {
    const codes = rawOptsToPairs(n._rawAnswerOptions).map((o) => o.code).filter((c) => c !== '' && c != null);
    return codes.length ? { id: n.id, kind: 'choice', values: codes, lo: codes[0], hi: codes[codes.length - 1] } : null;
  }
  if (n.itemType === 'checkbox') return { id: n.id, kind: 'boolean', values: [false, true], lo: false, hi: true };
  if (DATE.has(n.itemType)) { // relative to today: nobody knows if it is a birth date or the last period
    const day = ({ y = 0, m = 0, d = 0 }) => {
      const t = new Date();
      t.setFullYear(t.getFullYear() + y, t.getMonth() + m, t.getDate() + d);
      return [t.getFullYear(), t.getMonth() + 1, t.getDate()].map((x, i) => String(x).padStart(i ? 2 : 4, '0')).join('-'); // local, as the app's today()
    };
    const dayOf = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
    const [min, max] = [dayOf(n._minValueRaw), dayOf(n._maxValueRaw)];
    let days = SHIFTS.map(day).filter((v) => (!min || v >= min) && (!max || v <= max));
    if (!days.length) days = [min ?? max];
    const values = days.map((v) => (n.itemType === 'date' ? v : `${v}T12:00:00`));
    return { id: n.id, kind: 'date', values, lo: values[0], hi: values[values.length - 1], sampled: !(min && max) };
  }
  if (NUMBER.has(n.itemType)) { // without limits: positive numbers 1-100, a spread rather than a guess at a realistic range
    const given = (v) => Number.isFinite(v);
    const whole = n.itemType === 'integer';
    const edge = (v, up) => (whole ? (up ? Math.floor(v) : Math.ceil(v)) : v); // a whole number must sit inside a fractional limit
    const lo = edge(given(n._minValue) ? n._minValue : Math.min(1, given(n._maxValue) ? n._maxValue : 1), false);
    const hi = edge(given(n._maxValue) ? n._maxValue : Math.max(100, lo), true);
    if (lo > hi) return null;
    const point = (f) => { const v = lo + (hi - lo) * f; return whole ? Math.round(v) : v; };
    const values = [...new Set([lo, point(0.25), point(0.5), point(0.75), hi])];
    return { id: n.id, kind: 'number', integer: whole, values, lo, hi, sampled: !(given(n._minValue) && given(n._maxValue)) };
  }
  return null;
}

// Extremes, a "ladder" (the first k questions at the top, the rest at the bottom), one question at a time, and unanswered ones.
export function buildScenarios(inputs, cap = Math.min(MAX_SCENARIOS, Math.max(MIN_SCENARIOS, PER_INPUT * inputs.length + 3)), withRandom = false) {
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
  if (withRandom) kept.push(...randomSets(inputs)); // only when a calculation reads a number tried without its own limits
  return kept;
}

// Seeded, so the same form always gives the same report.
function randomSets(inputs) {
  let a = 0x9e3779b9;
  const rnd = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = (i) => {
    if (i.kind !== 'number') return i.values[Math.floor(rnd() * i.values.length)];
    const v = i.lo + rnd() * (i.hi - i.lo);
    return Math.min(i.hi, Math.max(i.lo, i.integer ? Math.round(v) : Math.round(v * 10) / 10));
  };
  return Array.from({ length: RANDOM_SETS }, () => Object.fromEntries(inputs.map((i) => [i.id, pick(i)])));
}
