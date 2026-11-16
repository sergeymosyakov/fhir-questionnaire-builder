// The calculated expressions of the shipped templates and of the gallery, and generated responses to run them on.
// Pure (no DOM): shared by the round-trip tests and the coverage measurement.
import fs from 'node:fs';
import path from 'node:path';
import fhirpath from 'fhirpath';
import fhirpath_r4_model from 'fhirpath/fhir-context/r4/index.js';
import { EXPR_GALLERY, resolveGalleryPattern } from '../../js/fhir/expr-builder/gallery/index.js';
import { parseExpression } from '../../js/fhir/expr-builder/parse.js';
import { BlockKind } from '../../js/fhir/expr-builder/model.js';
import { loadFhirpath } from './fhirpath-node.js';

export const fp = loadFhirpath();
const attempt = (fn) => { try { return fn(); } catch { return null; } };
const TYPE_OF = { valueBoolean: 'checkbox', valueInteger: 'integer', valueDecimal: 'decimal', valueCoding: 'radio', valueString: 'string' };

// Every calculated/initial expression: the gallery patterns (filled with generic decimal questions) and the templates.
export function collectExpressions() {
  const out = [];
  const ref = (k) => `%resource.item.where(linkId='${k}').answer.valueDecimal`;
  for (const p of EXPR_GALLERY) {
    const sel = {};
    for (const s of p.slots) {
      const row = (k) => ({ ref: ref(k), transformId: s.transforms?.[0]?.id });
      sel[s.key] = s.repeatable ? { rows: [row(s.key + '1'), row(s.key + '2')] } : row(s.key);
    }
    const text = attempt(() => resolveGalleryPattern(p, sel));
    if (text) out.push({ id: 'gallery:' + p.id, text });
  }
  const walk = (n, fn) => {
    if (!n || typeof n !== 'object') return;
    for (const [k, v] of Object.entries(n)) {
      if (k === 'extension' && Array.isArray(v)) v.forEach((e) => { if (e.valueExpression?.expression && /calculated|initial/i.test(e.url)) fn(e.valueExpression.expression); });
      if (v && typeof v === 'object') walk(v, fn);
    }
  };
  for (const f of fs.readdirSync('templates').filter((x) => x.endsWith('.template.json')).sort()) {
    const seen = new Map();
    walk(JSON.parse(fs.readFileSync(path.join('templates', f), 'utf8')), (text) => {
      const name = f.replace('.template.json', '');
      const n = (seen.get(name) ?? 0) + 1;
      seen.set(name, n);
      out.push({ id: `template:${name}#${n}`, text });
    });
  }
  return out;
}

// Questions the expressions refer to, typed from the accessor they use.
export function collectItems(exprs) {
  const items = new Map();
  const visit = (b) => {
    if (!b || typeof b !== 'object') return;
    if (b.kind === BlockKind.ITEM_REF) {
      const id = b.segments.join('/');
      if (!items.has(id)) items.set(id, { id: b.segments.at(-1), label: id, itemType: TYPE_OF[b.value?.split('.')[0]] || 'decimal', segments: b.segments, answerAt: [] });
    }
    // the questions a scale total or a filter looks at are top-level questions found by their linkId
    const top = (id, itemType) => { if (!items.has(id)) items.set(id, { id, label: id, itemType, segments: [id], answerAt: [] }); };
    if (b.kind === 'answerScores') b.linkIds.forEach((id) => top(id, 'radio'));
    if (b.kind === BlockKind.PIPELINE) top(b.source.linkId, TYPE_OF[b.source.accessor?.split('.')[0]] || 'decimal');
    for (const v of Object.values(b)) { if (Array.isArray(v)) v.forEach(visit); else if (v && typeof v === 'object') visit(v); }
  };
  for (const e of exprs) visit(parseExpression(e.text, fp));
  return [...items.values()];
}

// Response shapes for one expression. Every question gets its own value (so swapping two operands is visible), the
// values are scaled to cross thresholds, one question is left out at a time, and the first question is put just below
// and just above each number the expression compares with. Scale totals get coded answers carrying ordinal scores;
// a question an expression filters by (a pipeline) gets an answer of the kind its accessor reads.
export function responsesFor(text, block) {
  const refs = [];
  const seen = new Set();
  const scoreSets = [];
  const pipes = [];
  const visit = (b) => {
    if (!b || typeof b !== 'object') return;
    if (b.kind === BlockKind.ITEM_REF) { const key = b.segments.join('/') + '|' + b.value; if (!seen.has(key)) { seen.add(key); refs.push(b); } }
    if (b.kind === 'answerScores') scoreSets.push(b);
    if (b.kind === BlockKind.PIPELINE) pipes.push(b.source);
    for (const v of Object.values(b)) { if (Array.isArray(v)) v.forEach(visit); else if (v && typeof v === 'object') visit(v); }
  };
  visit(block);
  const literals = [...text.matchAll(/'([^']+)'/g)].map((m) => m[1]).filter((s) => !/^(?:[a-z][\w-]*)$/i.test(s) || /^LA/.test(s));
  const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37];
  const numbers = [...new Set([...text.matchAll(/(?<![\w.'])(\d+(?:\.\d+)?)(?![\w.'])/g)].map((m) => Number(m[1])))].filter((n) => n > 0).slice(0, 8);

  const byAccessor = (acc, i, scale, override) => {
    const a = acc?.split('.')[0];
    if (a === 'valueBoolean') return { valueBoolean: (i + Math.round(scale * 10)) % 2 === 0 };
    if (a === 'valueInteger') return { valueInteger: Math.round(override ?? PRIMES[i % PRIMES.length] * scale) };
    if (a === 'valueCoding') return { valueCoding: { system: 'http://loinc.org', code: literals[(i + Math.round(scale * 10)) % Math.max(literals.length, 1)] ?? 'x' } };
    if (a === 'valueString') return { valueString: 'abc'.slice(0, 1 + (i % 3)) };
    return { valueDecimal: override ?? PRIMES[i % PRIMES.length] * scale };
  };
  const scoreAnswer = (set, setNo, i, scale) => ({
    valueCoding: { system: 'http://loinc.org', code: 'c' + i, extension: [{ url: set.url, valueDecimal: (i * 7 + setNo * 3 + Math.floor(scale * 37)) % 5 }] },
  });

  // pick = { ref(r, i), score(set, setNo, id, i), pipe(p, i) } → a value, or null to leave the question out
  const build = (pick) => {
    const root = [];
    refs.forEach((r, i) => {
      const v = pick.ref(r, i);
      if (!v) return;
      let list = root;
      r.segments.forEach((seg, k) => {
        let node = list.find((x) => x.linkId === seg);
        if (!node) { node = { linkId: seg, item: [] }; list.push(node); }
        if (k === r.segments.length - 1) node.answer = [v];
        list = node.item;
      });
    });
    scoreSets.forEach((set, setNo) => set.linkIds.forEach((id, i) => {
      const v = pick.score(set, setNo, id, i);
      if (v && !root.some((x) => x.linkId === id)) root.push({ linkId: id, answer: [v] });
    }));
    pipes.forEach((p, i) => {
      const v = pick.pipe(p, i);
      if (v && !root.some((x) => x.linkId === p.linkId)) root.push({ linkId: p.linkId, answer: [v] });
    });
    const clean = (l) => l.map((n) => ({ ...n, item: n.item?.length ? clean(n.item) : undefined }));
    return { resourceType: 'QuestionnaireResponse', status: 'in-progress', item: clean(root) };
  };
  const all = (scale, over = {}) => ({
    ref: (r, i) => byAccessor(r.value, i, scale, i === over.refIndex ? over.refValue : undefined),
    score: (set, setNo, id, i) => (over.skipScore === id ? null : scoreAnswer(set, setNo, i, scale)),
    pipe: (p, i) => byAccessor(p.accessor, i, scale),
    ...over.pick,
  });
  const none = { ref: () => null, score: () => null, pipe: () => null };
  const out = [build(none)];
  for (const scale of [0.01, 0.1, 0.5, 1, 3, 20, 400]) out.push(build(all(scale)));
  refs.forEach((_, skip) => out.push(build({ ...all(1), ref: (r, i) => (i === skip ? null : byAccessor(r.value, i, 1)) })));
  scoreSets.forEach((set) => set.linkIds.slice(0, 15).forEach((id) => out.push(build(all(1, { skipScore: id })))));
  out.push(build(all(1, { refIndex: 0, refValue: 0 })));
  out.push(build(all(1, { refIndex: 1, refValue: -3 })));
  for (const n of numbers) for (const f of [0.999, 1, 1.001]) out.push(build(all(1, { refIndex: 0, refValue: n * f })));
  return out;
}

export const evaluate = (qr, expr) => { try { return JSON.stringify(fhirpath.evaluate(qr, expr, { resource: qr }, fhirpath_r4_model)); } catch (e) { return 'ERR ' + e.message; } };
