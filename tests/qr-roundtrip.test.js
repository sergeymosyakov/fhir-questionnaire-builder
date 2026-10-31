// QuestionnaireResponse round-trip: import answers against a Questionnaire, rebuild, compare.
import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

globalThis.CustomEvent = class CustomEvent {
  constructor(type, init) { this.type = type; this.detail = init?.detail; }
};
const _listeners = {};
globalThis.document = {
  dispatchEvent(e) { (_listeners[e.type] || []).forEach(fn => fn(e)); },
  addEventListener(type, fn) { (_listeners[type] = _listeners[type] || []).push(fn); },
};

const questDoc = { tree: [], meta: {}, rawFhir: null, variables: [], contained: [], translations: {} };

vi.mock('../js/ui/toast.js', () => ({ showError: vi.fn(), showWarn: vi.fn(), showInfo: vi.fn() }));
vi.mock('../js/builder/index.js', () => ({ renderTree: vi.fn() }));

const { importFHIR } = await import('../js/fhir/import.js');
const { buildFHIRObject } = await import('../js/fhir/export.js');
const { importQRAnswers } = await import('../js/fhir/qr-import.js');
const { buildQR } = await import('../js/fhir/qr-builder.js');
const { FHIR } = await import('../js/fhir/urls/fhir.js');
const { AppEvents, EventState } = await import('../js/events.js');
EventState._set(AppEvents.APP_CONTEXT_READY, { questDoc });

const ROOT = path.resolve(import.meta.dirname, '..');
const DIRS = ['sampledata', 'tests/fixtures'];
const clone = o => JSON.parse(JSON.stringify(o));

const all = DIRS.flatMap(d =>
  fs.readdirSync(path.join(ROOT, d))
    .filter(f => f.endsWith('.json'))
    .map(f => ({ rel: `${d}/${f}`, json: JSON.parse(fs.readFileSync(path.join(ROOT, d, f), 'utf8')) })));
const qrs = all.filter(f => f.json.resourceType === 'QuestionnaireResponse');
const qFiles = all.filter(f => f.json.resourceType === 'Questionnaire');

// Pairs a QR with its Questionnaire: canonical url/id match first, then the same-directory <name>.fhir.json sibling.
function pairFor(qr) {
  const ref = (qr.json.questionnaire || '').split('|')[0];
  const dir = path.dirname(qr.rel);
  const byRef = qFiles.find(q => path.dirname(q.rel) === dir && ref && (q.json.url === ref || q.json.id === ref));
  if (byRef) return byRef;
  const base = path.basename(qr.rel).replace(/-response\.qr\.json$/, '');
  return qFiles.find(q => q.rel === `${dir}/${base}.fhir.json`);
}

// Answers as a { linkId: [answer…] } map over the whole QR (nested and group children included).
function answerMap(items, out = {}) {
  for (const it of items || []) {
    if (it.answer?.length) {
      // answer.item is compared via the nested linkIds; an answer carrying only sub-items has no value of its own
      const own = it.answer.map(a => { const { item: _item, ...v } = a; return v; }).filter(v => Object.keys(v).length);
      if (own.length) out[it.linkId] = (out[it.linkId] || []).concat(own);
      for (const a of it.answer) answerMap(a.item, out);
    }
    answerMap(it.item, out);
  }
  return out;
}

// Document-order list of `parent/child` linkId paths, descending through groups and answer.item alike.
function structurePaths(items, prefix = '', out = []) {
  for (const it of items || []) {
    const p = prefix + '/' + it.linkId;
    out.push(p);
    structurePaths(it.item, p, out);
    for (const a of it.answer || []) structurePaths(a.item, p, out);
  }
  return out;
}

// Rebuild enriches codings with the option's ordinalValue (used by calculatedExpression); drop it on both sides.
function canon(v) {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map(k => [k, canon(v[k])]));
  return v;
}

function normAnswer(a) {
  const v = clone(a);
  if (v.valueCoding?.extension) {
    v.valueCoding.extension = v.valueCoding.extension.filter(e => e.url !== FHIR.ordinalValue);
    if (!v.valueCoding.extension.length) delete v.valueCoding.extension;
  }
  return v;
}

function diffAnswers(input, output) {
  const diffs = [];
  for (const [id, list] of Object.entries(input)) {
    const a = list.map(normAnswer);
    const b = (output[id] || []).map(normAnswer);
    if (JSON.stringify(canon(a)) !== JSON.stringify(canon(b))) diffs.push(`${id}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`);
  }
  for (const id of Object.keys(output)) if (!(id in input)) diffs.push(`${id}: unexpected answer ${JSON.stringify(output[id])}`);
  return diffs;
}

function reload(qr, q) {
  expect(importFHIR(clone(q))).not.toBe(false);
  const values = {};
  const res = importQRAnswers(clone(qr), values, questDoc.tree);
  expect(res.ok).toBe(true);
  return { res, values, rebuilt: buildQR(buildFHIRObject(questDoc), values) };
}

describe('sample QuestionnaireResponse round-trip', () => {
  it('discovers QuestionnaireResponse files', () => {
    expect(qrs.map(f => f.rel).sort()).toEqual([
      'sampledata/example-bariatric-response.qr.json',
      'sampledata/phq-9-response.qr.json',
      'sampledata/who-emcare-treatment-response.qr.json',
    ]);
  });

  it('every QuestionnaireResponse is paired with a Questionnaire', () => {
    expect(qrs.filter(f => !pairFor(f)).map(f => f.rel)).toEqual([]);
  });

  it.each(qrs.map(f => [f.rel, f]))('%s: rebuilt answers equal the loaded answers', (_rel, qr) => {
    const q = pairFor(qr);
    const { res, rebuilt } = reload(qr.json, q.json);
    expect(res.unmatched).toEqual([]);
    expect(diffAnswers(answerMap(qr.json.item), answerMap(rebuilt.item))).toEqual([]);
  });

  // The rebuilt QR follows the Questionnaire's order and nesting (the sample QRs are not always in that order),
  // so every answered input path must exist there and the whole structure must equal the Questionnaire's.
  it.each(qrs.map(f => [f.rel, f]))('%s: group membership is preserved and order follows the Questionnaire', (_rel, qr) => {
    const q = pairFor(qr);
    const { rebuilt } = reload(qr.json, q.json);
    const got = structurePaths(rebuilt.item);
    expect(structurePaths(qr.json.item).filter(p => !got.includes(p))).toEqual([]);
    expect(got).toEqual(structurePaths(q.json.item));
  });
});

// ── Synthetic coverage of every answer shape ─────────────────────────────────

const SYN_Q = {
  resourceType: 'Questionnaire', id: 'qr-shapes', url: 'http://example.org/Questionnaire/qr-shapes', status: 'draft', title: 'QR shapes',
  item: [
    { linkId: 'bool', text: 'bool', type: 'boolean' },
    { linkId: 'dec', text: 'dec', type: 'decimal' },
    { linkId: 'int', text: 'int', type: 'integer' },
    { linkId: 'date', text: 'date', type: 'date' },
    { linkId: 'dt', text: 'dt', type: 'dateTime' },
    { linkId: 'time', text: 'time', type: 'time' },
    { linkId: 'str', text: 'str', type: 'string' },
    { linkId: 'txt', text: 'txt', type: 'text' },
    { linkId: 'url', text: 'url', type: 'url' },
    { linkId: 'qty', text: 'qty', type: 'quantity' },
    { linkId: 'ref', text: 'ref', type: 'reference' },
    { linkId: 'att', text: 'att', type: 'attachment' },
    { linkId: 'choice', text: 'choice', type: 'choice', answerOption: [
      { valueCoding: { system: 'http://example.org/cs', code: 'a', display: 'A' } },
      { valueCoding: { system: 'http://example.org/cs', code: 'b', display: 'B' } },
    ] },
    { linkId: 'choice-str', text: 'choice-str', type: 'choice', answerOption: [{ valueString: 'one' }, { valueString: 'two' }] },
    { linkId: 'choice-int', text: 'choice-int', type: 'choice', answerOption: [{ valueInteger: 1 }, { valueInteger: 2 }] },
    { linkId: 'open', text: 'open', type: 'open-choice', answerOption: [
      { valueCoding: { system: 'http://example.org/cs', code: 'a', display: 'A' } },
    ] },
    { linkId: 'open-vs', text: 'open-vs', type: 'open-choice', answerValueSet: 'http://example.org/ValueSet/vs' },
    { linkId: 'multi', text: 'multi', type: 'string', repeats: true },
    { linkId: 'multi-choice', text: 'multi-choice', type: 'choice', repeats: true, answerOption: [
      { valueCoding: { system: 'http://example.org/cs', code: 'a', display: 'A' } },
      { valueCoding: { system: 'http://example.org/cs', code: 'b', display: 'B' } },
    ] },
    { linkId: 'parent', text: 'parent', type: 'boolean', item: [{ linkId: 'child', text: 'child', type: 'string' }] },
    { linkId: 'grp', text: 'grp', type: 'group', item: [{ linkId: 'in-grp', text: 'in-grp', type: 'string' }] },
    { linkId: 'rg', text: 'rg', type: 'group', repeats: true, item: [
      { linkId: 'rg-name', text: 'rg-name', type: 'string' },
      { linkId: 'rg-n', text: 'rg-n', type: 'integer' },
    ] },
  ],
};

const SYN_ANSWERS = {
  bool: [{ valueBoolean: false }],
  dec: [{ valueDecimal: 0 }],
  int: [{ valueInteger: 0 }],
  date: [{ valueDate: '2024-02-29' }],
  dt: [{ valueDateTime: '2024-02-29T10:20:30Z' }],
  time: [{ valueTime: '10:20:30' }],
  str: [{ valueString: 'text' }],
  txt: [{ valueString: 'line1\nline2' }],
  url: [{ valueUri: 'http://example.org/x' }],
  qty: [{ valueQuantity: { value: 72.5, unit: 'kg', system: 'http://unitsofmeasure.org', code: 'kg' } }],
  ref: [{ valueReference: { reference: 'Patient/1', display: 'John Doe' } }],
  att: [{ valueAttachment: { contentType: 'text/plain', url: 'http://example.org/a.txt', title: 'a.txt' } }],
  choice: [{ valueCoding: { system: 'http://example.org/cs', code: 'b', display: 'B' } }],
  'choice-str': [{ valueString: 'two' }],
  'choice-int': [{ valueInteger: 2 }],
  open: [{ valueString: 'free text' }],
  'open-vs': [{ valueString: 'free text' }],
  multi: [{ valueString: 'x' }, { valueString: 'y' }, { valueString: 'z' }],
  'multi-choice': [
    { valueCoding: { system: 'http://example.org/cs', code: 'a', display: 'A' } },
    { valueCoding: { system: 'http://example.org/cs', code: 'b', display: 'B' } },
  ],
};

function synQR(overrides = {}) {
  const answers = { ...SYN_ANSWERS, ...overrides };
  return {
    resourceType: 'QuestionnaireResponse', questionnaire: SYN_Q.url, status: 'completed',
    item: [
      ...Object.entries(answers).filter(([id]) => id !== 'in-grp' && id !== 'child').map(([linkId, answer]) => ({ linkId, answer })),
    ],
  };
}

describe('QuestionnaireResponse answer shapes', () => {
  const shapes = Object.keys(SYN_ANSWERS).map(id => [id]);

  // A free-text answer to an open-choice backed only by a ValueSet cannot be told from a coded answer in the plain store.
  const KNOWN_GAP = new Set(['open-vs']);
  it.each(shapes.filter(([id]) => !KNOWN_GAP.has(id)))('%s: answer survives import then rebuild', id => {
    const qr = synQR();
    const { rebuilt } = reload(qr, SYN_Q);
    const got = answerMap(rebuilt.item)[id];
    expect(got && got.map(normAnswer).map(canon)).toEqual(SYN_ANSWERS[id].map(normAnswer).map(canon));
  });

  it('open-vs: free text over a ValueSet-only open-choice is exported as valueCoding (known limitation, tracked separately)', () => {
    const { rebuilt } = reload(synQR(), SYN_Q);
    expect(answerMap(rebuilt.item)['open-vs']).toEqual([{ valueCoding: { code: 'free text' } }]);
  });

  it('repeating group instances keep their own answers and order', () => {
    const qr = { ...synQR(), item: [
      { linkId: 'rg', item: [{ linkId: 'rg-name', answer: [{ valueString: 'first' }] }, { linkId: 'rg-n', answer: [{ valueInteger: 1 }] }] },
      { linkId: 'rg', item: [{ linkId: 'rg-name', answer: [{ valueString: 'second' }] }, { linkId: 'rg-n', answer: [{ valueInteger: 2 }] }] },
    ] };
    const { rebuilt } = reload(qr, SYN_Q);
    expect(rebuilt.item.filter(i => i.linkId === 'rg')).toEqual(qr.item);
  });

  it('nested answer.item answers survive', () => {
    const qr = { ...synQR(), item: [{ linkId: 'parent', answer: [{ valueBoolean: true, item: [{ linkId: 'child', answer: [{ valueString: 'kid' }] }] }] }] };
    const { rebuilt } = reload(qr, SYN_Q);
    const m = answerMap(rebuilt.item);
    expect(m.parent).toEqual([{ valueBoolean: true }]);
    expect(m.child).toEqual([{ valueString: 'kid' }]);
  });

  it('group child answers survive', () => {
    const qr = { ...synQR(), item: [{ linkId: 'grp', item: [{ linkId: 'in-grp', answer: [{ valueString: 'g' }] }] }] };
    const { rebuilt } = reload(qr, SYN_Q);
    expect(answerMap(rebuilt.item)['in-grp']).toEqual([{ valueString: 'g' }]);
  });

  it('cleared answers (empty / absent answer[]) stay cleared and add no answers', () => {
    const qr = { ...synQR(), item: [{ linkId: 'str', answer: [] }, { linkId: 'dec' }, { linkId: 'int', answer: [{}] }] };
    const { values, rebuilt } = reload(qr, SYN_Q);
    expect(values.str).toBeUndefined();
    expect(answerMap(rebuilt.item)).toEqual({});
  });
});

describe('cleared values in the answer store', () => {
  it.each([
    ['str', ''], ['txt', ''], ['date', ''], ['dt', ''], ['time', ''], ['url', ''], ['choice', ''], ['open', ''],
    ['dec', ''], ['int', ''],
    ['str', undefined], ['choice', null], ['dec', null],
  ])('%s cleared to %j adds no answer', (id, cleared) => {
    importFHIR(clone(SYN_Q));
    const qr = buildQR(buildFHIRObject(questDoc), { [id]: [cleared] });
    expect(answerMap(qr.item)[id]).toBeUndefined();
  });
});

describe('QuestionnaireResponse root fields', () => {
  it('documents the known losses: status resets, identity / authorship fields are not re-emitted', () => {
    const qr = {
      resourceType: 'QuestionnaireResponse', id: 'qr-1', questionnaire: SYN_Q.url, status: 'completed',
      subject: { reference: 'Patient/1' }, authored: '2024-01-01T00:00:00Z', author: { reference: 'Practitioner/2' },
      extension: [{ url: 'http://example.org/ext', valueString: 'x' }],
      item: [{ linkId: 'str', answer: [{ valueString: 'text' }] }],
    };
    const { res, rebuilt } = reload(qr, SYN_Q);
    expect(res.meta.subject).toBe('Patient/1');
    expect(rebuilt.status).toBe('in-progress');
    expect(rebuilt.questionnaire).toBe(SYN_Q.url);
    for (const k of ['id', 'subject', 'authored', 'author', 'extension']) expect(rebuilt[k]).toBeUndefined();
  });
});

describe('importQRAnswers — guards and extension limits', () => {
  it('skips a __proto__ linkId without polluting the store or Object.prototype', () => {
    importFHIR(clone(SYN_Q));
    const values = {};
    const qr = { resourceType: 'QuestionnaireResponse', item: [
      { linkId: '__proto__', answer: [{ valueString: 'polluted' }] },
      { linkId: 'str', answer: [{ valueString: 'ok' }] },
    ] };
    const res = importQRAnswers(qr, values, questDoc.tree);
    expect(res.loaded).toBe(1);
    expect(values.str).toEqual(['ok']);
    expect(Object.getPrototypeOf(values)).toBe(Object.prototype);
    expect(({}).polluted).toBeUndefined();
  });

  // Answer-level extensions are not read by importQRAnswers, so they are not preserved (unsupported).
  it('answer-level extensions are dropped (unsupported)', () => {
    const qr = { ...synQR(), item: [{ linkId: 'str', answer: [{ valueString: 'text', extension: [{ url: 'http://example.org/ext', valueString: 'x' }] }] }] };
    const { rebuilt } = reload(qr, SYN_Q);
    expect(rebuilt.item.find(i => i.linkId === 'str').answer).toEqual([{ valueString: 'text' }]);
  });
});

describe('Questionnaire _title extensions', () => {
  it('survive import then export, translation extensions excluded', () => {
    const keep = { url: 'http://example.org/ext/title-style', valueString: 'bold' };
    const q = { resourceType: 'Questionnaire', id: 'title-ext', status: 'draft', title: 'T', _title: { extension: [keep] },
      item: [{ linkId: 'a', text: 'a', type: 'string' }] };
    expect(importFHIR(clone(q))).not.toBe(false);
    expect(buildFHIRObject(questDoc)._title).toEqual({ extension: [keep] });
  });
});
