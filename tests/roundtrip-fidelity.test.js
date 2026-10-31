// Round-trip fidelity: input Questionnaire vs first export, per item, for every sample / fixture.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
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
const { isSTU3 } = await import('../js/fhir/stu3-shim.js');
const { FHIR } = await import('../js/fhir/urls/fhir.js');
const { BUILDER_VERSION_EXTENSION_URL } = await import('../js/fhir/format-registry.js');
const { AppEvents, EventState } = await import('../js/events.js');
EventState._set(AppEvents.APP_CONTEXT_READY, { questDoc });

const ROOT = path.resolve(import.meta.dirname, '..');
const DIRS = ['sampledata', 'tests/fixtures'];

const questionnaires = DIRS.flatMap(d =>
  fs.readdirSync(path.join(ROOT, d))
    .filter(f => f.endsWith('.json'))
    .map(f => ({ rel: `${d}/${f}`, json: JSON.parse(fs.readFileSync(path.join(ROOT, d, f), 'utf8')) })))
  .filter(f => f.json.resourceType === 'Questionnaire')
  .map(f => [f.rel, f.json]);

// Fixed clock keeps the stamped meta.lastUpdated / date comparable across cycles.
beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-01-01T00:00:00Z')); });
afterAll(() => { vi.useRealTimers(); });

const clone = o => JSON.parse(JSON.stringify(o));

function cycle(json, times = 1) {
  const outs = [];
  let cur = clone(json);
  for (let i = 0; i < times; i++) {
    expect(importFHIR(clone(cur))).not.toBe(false);
    cur = clone(buildFHIRObject(questDoc));
    outs.push(cur);
  }
  return outs;
}

function indexItems(items = [], map = new Map()) {
  for (const it of items) { map.set(it.linkId, it); indexItems(it.item, map); }
  return map;
}

// ── normalisation (documented intentional differences only) ──────────────────

// The exporter keeps only system + code of these codings (display / userSelected are intentionally not exported).
const pickSystemCode = c => ({ system: c.system, code: c.code });

// Expected exporter output for an input extension; applied to the INPUT side only, output is compared as-is.
function expectedExt(e, item) {
  const out = clone(e);
  switch (e.url) {
    // The builder always writes the SDC-namespaced hidden / entryFormat URLs.
    case FHIR.hidden: out.url = FHIR.hiddenSdc; break;
    case FHIR.entryFormat: out.url = FHIR.entryFormatSdc; break;
    // designNote is markdown in the spec; the builder writes valueMarkdown.
    case FHIR.designNote:
      if (out.valueString !== undefined) { out.valueMarkdown = out.valueString; delete out.valueString; }
      break;
    // fhirType is exported as valueString regardless of the input value[x] flavour.
    case FHIR.fhirType:
      if (out.valueCode !== undefined) { out.valueString = out.valueCode; delete out.valueCode; }
      break;
    // Only system+code of the item control coding survive; the display text is regenerated.
    case FHIR.itemControl:
      out.valueCodeableConcept = { coding: (out.valueCodeableConcept?.coding || []).map(pickSystemCode) };
      break;
    // questionnaire-unit keeps only system + code; on a quantity it becomes a unitOption. unitOption keeps its display.
    case FHIR.unit:
      if (out.valueCoding) out.valueCoding = pickSystemCode(out.valueCoding);
      if (item.type === 'quantity') out.url = FHIR.unitOption;
      break;
    // R4 slider step is integer-only; the builder rounds decimal steps up to at least 1.
    case FHIR.sliderStepValue:
      if (out.valueDecimal !== undefined) { out.valueInteger = Math.max(1, Math.round(out.valueDecimal)); delete out.valueDecimal; }
      break;
    default: break;
  }
  return out;
}

// Extension order carries no meaning (builder emits a fixed order), so compare canonically sorted.
function canon(v) {
  if (Array.isArray(v)) {
    const arr = v.map(canon);
    return arr.length && arr.every(x => x && typeof x === 'object' && 'url' in x)
      ? arr.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
      : arr;
  }
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.keys(v).sort().map(k => [k, canon(v[k])]));
  }
  return v;
}

function expectedExtList(list, item) {
  const sameUnit = (a, b) => a.valueCoding?.system === b.valueCoding?.system && a.valueCoding?.code === b.valueCoding?.code;
  // On a quantity the default unit merges into an equal unitOption (which keeps its display).
  const raw = (list || []).filter(e => !(item.type === 'quantity' && e.url === FHIR.unit &&
    list.some(o => o.url === FHIR.unitOption && sameUnit(o, e))));
  let exts = raw.map(e => expectedExt(e, item));
  // Dropped on purpose: displayCategory on display items and minOccurs on non-required / non-repeating items (R4 invariants).
  if (item.type === 'display') exts = exts.filter(e => e.url !== FHIR.displayCategory);
  if (!(item.required && item.repeats)) exts = exts.filter(e => e.url !== FHIR.minOccurs);
  // questionnaire-unit + identical questionnaire-unitOption collapse into one unitOption.
  const seen = new Set();
  exts = exts.filter(e => e.url !== FHIR.unitOption || !seen.has(JSON.stringify(e)) && seen.add(JSON.stringify(e)));
  return canon(exts);
}

const hasAnswerSource = item =>
  item.answerOption || item.answerValueSet ||
  (item.extension || []).some(e => e.url === FHIR.answerExpression || e.url === FHIR.candidateExpression);

// Reduces an item to the supported properties the importer claims, in comparable form.
function projectItem(item, orig, isOutput) {
  const p = {
    type: item.type === 'coding' ? 'choice' : item.type, // DSTU2 legacy 'coding' is upgraded to choice
    required: !!item.required,                           // absent == false
    repeats: !!item.repeats,
    readOnly: !!item.readOnly,
    prefix: item.prefix,
    definition: item.definition,
    code: item.code,
    maxLength: item.maxLength,
    answerValueSet: item.answerValueSet,
    answerOption: item.answerOption && canon(item.answerOption),
    enableWhen: item.enableWhen,
    // enableBehavior "all" is the default and only written when enableWhen.count() > 1
    enableBehavior: item.enableBehavior === 'all' && (item.enableWhen || []).length <= 1 ? undefined : item.enableBehavior,
    _text: item._text && canon(item._text),
    extension: isOutput ? canon(item.extension || []) : expectedExtList(item.extension, orig),
  };
  // Missing text is replaced by the linkId as the visible title.
  if (!isOutput || orig.text !== undefined) p.text = item.text;
  // que-11 / que-8: initial[] is suppressed when an answer source exists or on display items.
  if (!hasAnswerSource(orig) && orig.type !== 'display') p.initial = item.initial;
  return p;
}

function diffItems(input, output) {
  const outMap = indexItems(output.item);
  const diffs = [];
  for (const [linkId, orig] of indexItems(input.item)) {
    const out = outMap.get(linkId);
    if (!out) { diffs.push(`${linkId}: missing in export`); continue; }
    const a = projectItem(orig, orig, false);
    const b = projectItem(out, orig, true);
    for (const k of Object.keys(a)) {
      if (JSON.stringify(canon(a[k])) !== JSON.stringify(canon(b[k]))) {
        diffs.push(`${linkId}.${k}: ${JSON.stringify(a[k])} -> ${JSON.stringify(b[k])}`);
      }
    }
  }
  return diffs;
}

describe('input vs first export — supported item properties', () => {

  it('discovers Questionnaires', () => {
    expect(questionnaires.length).toBeGreaterThan(40);
  });

  // STU3 files are checked separately: their input shape is intentionally upgraded to R4.
  const r4 = questionnaires.filter(([, j]) => !isSTU3(j));
  it.each(r4)('%s: first export keeps every supported item property', (_rel, json) => {
    const [first] = cycle(json);
    expect(diffItems(json, first)).toEqual([]);
  });
});

// ── Questionnaire root ───────────────────────────────────────────────────────

// Items are compared by the per-item test above.
const ROOT_SKIPPED = new Set(['item']);

describe('input vs first export — Questionnaire root fields', () => {

  const r4 = questionnaires.filter(([, j]) => !isSTU3(j));
  // The internal export keeps versionAlgorithm as the R5 native field (the versioned save downgrades it
  // to the extension) and never re-emits the builder-target-version stamp (added by the versioned save).
  const rootView = j => {
    const v = clone(j);
    const ext = v.extension || [];
    const va = ext.find(e => e.url === FHIR.artifactVersionAlgorithm);
    if (va) {
      if (va.valueString !== undefined) v.versionAlgorithmString = va.valueString;
      else v.versionAlgorithmCoding = va.valueCoding;
    }
    if (v.meta) {
      // The export stamps a fresh lastUpdated
      delete v.meta.lastUpdated;
      if (!Object.keys(v.meta).length) delete v.meta;
    }
    const rest = ext.filter(e => e.url !== FHIR.artifactVersionAlgorithm && e.url !== BUILDER_VERSION_EXTENSION_URL);
    if (rest.length) v.extension = rest; else delete v.extension;
    return v;
  };

  it.each(r4)('%s: root fields survive', (_rel, json) => {
    const [first] = cycle(json);
    const a = rootView(json);
    const b = rootView(first);
    const diffs = [];
    for (const k of Object.keys(a)) {
      if (ROOT_SKIPPED.has(k)) continue;
      if (JSON.stringify(canon(a[k])) !== JSON.stringify(canon(b[k]))) {
        diffs.push(`${k}: ${JSON.stringify(a[k])} -> ${JSON.stringify(b[k])}`);
      }
    }
    // Absent id / date / text are generated on export (default id, today's date, a generated narrative); any other new root field is a leak.
    const generated = { id: 'logic-builder-export', date: '2026-01-01', text: b.text?.status === 'generated' ? b.text : undefined };
    for (const k of Object.keys(b)) {
      if (ROOT_SKIPPED.has(k) || k in a) continue;
      if (k in generated && JSON.stringify(b[k]) === JSON.stringify(generated[k])) continue;
      diffs.push(`${k}: <absent> -> ${JSON.stringify(b[k])}`);
    }
    expect(diffs).toEqual([]);
  });
});

// ── Unsupported extensions pass through unchanged and are never duplicated ───

const UNKNOWN = (n, extra = {}) => ({ url: `http://example.org/StructureDefinition/unknown-${n}`, valueString: `v-${n}`, ...extra });

function unknownExtQuestionnaire() {
  return {
    resourceType: 'Questionnaire',
    id: 'unknown-ext',
    status: 'draft',
    title: 'Unknown extensions',
    extension: [
      UNKNOWN('root-a'),
      UNKNOWN('root-nested', { valueString: undefined, extension: [{ url: 'k', valueCode: 'x' }, { url: 'n', valueInteger: 3 }] }),
    ],
    item: [
      {
        linkId: 'g1', text: 'Group', type: 'group',
        extension: [UNKNOWN('group-a')],
        item: [
          {
            linkId: 'q-choice', text: 'Choice', type: 'choice',
            extension: [UNKNOWN('item-a'), UNKNOWN('item-b', { valueBoolean: true, valueString: undefined })],
            answerOption: [
              { valueCoding: { system: 'http://example.org/cs', code: 'a', display: 'A' }, extension: [UNKNOWN('opt-a')] },
              { valueCoding: { system: 'http://example.org/cs', code: 'b', display: 'B' }, extension: [UNKNOWN('opt-b'), UNKNOWN('opt-c')] },
            ],
          },
          { linkId: 'q-string', text: 'String', type: 'string', extension: [UNKNOWN('item-c', { valueInteger: 7, valueString: undefined })] },
        ],
      },
    ],
  };
}

describe('unsupported extensions: pass-through over 3 cycles', () => {
  const input = unknownExtQuestionnaire();
  let outs;
  beforeAll(() => { outs = cycle(input, 3); });
  const unknownOnly = list => (list || []).filter(e => e.url.startsWith('http://example.org/'));
  const urls = list => (list || []).map(e => e.url);

  it('questionnaire-level extensions are unchanged after each cycle', () => {
    for (const out of outs) expect(unknownOnly(out.extension)).toEqual(unknownOnly(input.extension));
  });

  it('item-level and group-level extensions are unchanged after each cycle', () => {
    const inMap = indexItems(input.item);
    for (const out of outs) {
      const outMap = indexItems(out.item);
      for (const id of ['g1', 'q-choice', 'q-string']) {
        expect(unknownOnly(outMap.get(id).extension)).toEqual(unknownOnly(inMap.get(id).extension));
      }
    }
  });

  it('answerOption-level extensions are unchanged after each cycle', () => {
    const inOpts = indexItems(input.item).get('q-choice').answerOption.map(o => o.extension);
    for (const out of outs) {
      const outOpts = indexItems(out.item).get('q-choice').answerOption.map(o => unknownOnly(o.extension));
      expect(outOpts).toEqual(inOpts);
    }
  });

  it('no extension URL is duplicated at any level', () => {
    for (const out of outs) {
      const lists = [out.extension];
      for (const it of indexItems(out.item).values()) {
        lists.push(it.extension);
        for (const o of it.answerOption || []) lists.push(o.extension);
      }
      for (const l of lists) expect(new Set(urls(l)).size).toBe(urls(l).length);
    }
  });

  it('cycles 2 and 3 equal cycle 1', () => {
    expect(outs[1]).toEqual(outs[0]);
    expect(outs[2]).toEqual(outs[0]);
  });
});

// ── min/max bounds keep their exact value[x] type ────────────────────────────

const bound = (url, key, value) => ({ url, [key]: value });
const boundQuestionnaire = items => ({ resourceType: 'Questionnaire', id: 'bounds', status: 'draft', title: 'Bounds', item: items });
const boundItem = (linkId, type, min, max) => ({
  linkId, text: linkId, type,
  extension: [bound(FHIR.minValue, ...min), bound(FHIR.maxValue, ...max)],
});

describe('min/max value bounds', () => {
  const cases = [
    ['date', ['valueDate', '2020-01-01'], ['valueDate', '2030-12-31']],
    ['dateTime', ['valueDateTime', '2020-01-01T08:00:00Z'], ['valueDateTime', '2030-12-31T18:30:00Z']],
    ['time', ['valueTime', '08:00:00'], ['valueTime', '18:30:00']],
    ['decimal', ['valueDecimal', 50], ['valueDecimal', 250]],
    ['decimal', ['valueDecimal', 0.5], ['valueDecimal', 99.5]],
    ['integer', ['valueInteger', 1], ['valueInteger', 10]],
  ].map(([type, min, max]) => [`${type} ${min[0]} ${min[1]}..${max[1]}`, type, min, max]);

  it.each(cases)('%s bounds survive 3 cycles with the same value[x] type', (_name, type, min, max) => {
    const input = boundQuestionnaire([boundItem('b', type, min, max)]);
    for (const out of cycle(input, 3)) {
      const exts = indexItems(out.item).get('b').extension;
      expect(exts.filter(e => e.url === FHIR.minValue)).toEqual([bound(FHIR.minValue, ...min)]);
      expect(exts.filter(e => e.url === FHIR.maxValue)).toEqual([bound(FHIR.maxValue, ...max)]);
    }
  });

  it('numeric bounds still drive preview validation (_minValue/_maxValue stay numeric)', () => {
    importFHIR(clone(boundQuestionnaire([boundItem('n', 'decimal', ['valueDecimal', 5], ['valueDecimal', 9])])));
    const n = questDoc.tree[0];
    expect([n._minValue, n._maxValue]).toEqual([5, 9]);
  });

  it('date bounds are stored apart from the numeric fields', () => {
    importFHIR(clone(boundQuestionnaire([boundItem('d', 'date', ['valueDate', '2020-01-01'], ['valueDate', '2030-01-01'])])));
    const d = questDoc.tree[0];
    expect([d._minValue, d._maxValue]).toEqual([undefined, undefined]);
    expect(d._minValueRaw).toEqual({ valueDate: '2020-01-01' });
  });

  it('a bound with an unsupported value[x] stays in pass-through exactly once', () => {
    const odd = { url: FHIR.minValue, valueQuantity: { value: 1, unit: 'kg' } };
    const input = boundQuestionnaire([{ linkId: 'q', text: 'q', type: 'quantity', extension: [odd] }]);
    for (const out of cycle(input, 3)) {
      expect(indexItems(out.item).get('q').extension.filter(e => e.url === FHIR.minValue)).toEqual([odd]);
    }
  });
});

// ── Intentional exporter normalisations: exact output form ───────────────────

describe('exporter normalises these extensions to a fixed form', () => {
  const exts = (type, extension) => {
    const input = { resourceType: 'Questionnaire', id: 'norm', status: 'draft', title: 'Norm', item: [{ linkId: 'q', text: 'q', type, extension }] };
    return indexItems(cycle(input)[0].item).get('q').extension;
  };
  const find = (list, url) => list.filter(e => e.url === url);

  it('hidden and entryFormat use the SDC-namespaced URLs', () => {
    const out = exts('string', [{ url: FHIR.hidden, valueBoolean: true }, { url: FHIR.entryFormat, valueString: 'yyyy' }]);
    expect(find(out, FHIR.hiddenSdc)).toEqual([{ url: FHIR.hiddenSdc, valueBoolean: true }]);
    expect(find(out, FHIR.entryFormatSdc)).toEqual([{ url: FHIR.entryFormatSdc, valueString: 'yyyy' }]);
    expect(find(out, FHIR.hidden)).toEqual([]);
    expect(find(out, FHIR.entryFormat)).toEqual([]);
  });

  it('designNote string becomes valueMarkdown', () => {
    const out = exts('string', [{ url: FHIR.designNote, valueString: 'note' }]);
    expect(find(out, FHIR.designNote)).toEqual([{ url: FHIR.designNote, valueMarkdown: 'note' }]);
  });

  it('fhirType code becomes valueString', () => {
    const out = exts('string', [{ url: FHIR.fhirType, valueCode: 'Patient' }]);
    expect(find(out, FHIR.fhirType)).toEqual([{ url: FHIR.fhirType, valueString: 'Patient' }]);
  });

  it.each([[0.4, 1], [2.6, 3], [4, 4]])('slider step %s exports as valueInteger %s', (step, expected) => {
    const out = exts('decimal', [{ url: FHIR.sliderStepValue, [Number.isInteger(step) ? 'valueInteger' : 'valueDecimal']: step }]);
    expect(find(out, FHIR.sliderStepValue)).toEqual([{ url: FHIR.sliderStepValue, valueInteger: expected }]);
  });

  it('itemControl coding keeps only system + code (display is intentionally not exported)', () => {
    const coding = { system: FHIR.itemControlCS, code: 'slider', display: 'Slider', userSelected: true };
    const out = exts('integer', [{ url: FHIR.itemControl, valueCodeableConcept: { coding: [coding], text: 'Slider' } }]);
    expect(find(out, FHIR.itemControl)).toEqual([{ url: FHIR.itemControl, valueCodeableConcept: { coding: [{ system: coding.system, code: 'slider' }] } }]);
  });

  it('questionnaire-unit keeps only system + code (display is intentionally not exported)', () => {
    const out = exts('decimal', [{ url: FHIR.unit, valueCoding: { system: 'http://unitsofmeasure.org', code: 'kg', display: 'kilogram' } }]);
    expect(find(out, FHIR.unit)).toEqual([{ url: FHIR.unit, valueCoding: { system: 'http://unitsofmeasure.org', code: 'kg' } }]);
  });
});

// ── STU3 input is stable after the first normalisation ───────────────────────

describe('STU3 round-trip stability', () => {
  const stu3 = questionnaires.filter(([, j]) => isSTU3(j));

  it('discovers STU3 Questionnaires', () => {
    expect(stu3.map(([rel]) => rel)).toEqual(expect.arrayContaining(['sampledata/phq-9.stu3.fhir.json', 'tests/fixtures/phq-9.stu3.fhir.json']));
  });

  it.each(stu3)('%s: cycles 2 and 3 equal cycle 1', (_rel, json) => {
    const [c1, c2, c3] = cycle(json, 3);
    expect(c2).toEqual(c1);
    expect(c3).toEqual(c1);
  });

  it.each(stu3)('%s: no linkId or answer option is lost', (_rel, json) => {
    const [c1] = cycle(json);
    const out = indexItems(c1.item);
    for (const [linkId, orig] of indexItems(json.item)) {
      expect(out.has(linkId)).toBe(true);
      const opts = orig.option || orig.answerOption || [];
      expect((out.get(linkId).answerOption || []).length).toBe(opts.length);
    }
  });
});
