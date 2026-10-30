// Regression tests for FHIR-layer code-review fixes (eval, form-checks, export/import round-trip,
// QR builder, answer-store/translation key safety, quest-document reset, change-type, search).

import { describe, it, expect, vi, afterEach } from 'vitest';
import { FHIR } from '../js/fhir/urls/fhir.js';
import { APP_URL } from '../js/fhir/urls/app.js';

const _showError = vi.fn();
vi.mock('../js/ui/toast.js', () => ({ showError: (...a) => _showError(...a), showWarn: vi.fn(), showInfo: vi.fn() }));

const { compareValue }      = await import('../js/eval.js');
const { calcFormOk }        = await import('../js/fhir/form-checks.js');
const { QuestDocument }     = await import('../js/fhir/quest-document.js');
const { importFHIR }        = await import('../js/fhir/import.js');
const { buildFHIRObject }   = await import('../js/fhir/export.js');
const { buildQR }           = await import('../js/fhir/qr-builder.js');
const { importQRAnswers }   = await import('../js/fhir/qr-import.js');
const { AnswerStore }       = await import('../js/answer-store.js');
const { changeNodeType }    = await import('../js/nodes/change-type.js');
const { createItemNode } = await import('../js/nodes/index.js');
const { searchFhir }        = await import('../js/fhir/fhir-search.js');

const makeBus = () => ({ dispatch: vi.fn(), on: vi.fn(() => () => {}) });
function load(q) {
  const bus = makeBus();
  const questDoc = new QuestDocument(bus);
  const ok = importFHIR({ resourceType: 'Questionnaire', status: 'draft', ...q }, { questDoc, bus });
  return { questDoc, ok };
}
const roundTrip = q => buildFHIRObject(load(q).questDoc);

// ── 1. enableWhen on date / dateTime / time / reference ──────────────────────
describe('compareValue — temporal and reference answers', () => {
  it('answerDate compares chronologically', () => {
    const ew = op => ({ operator: op, answerDate: '2024-03-10' });
    expect(compareValue('2024-03-10', ew('='))).toBe(true);
    expect(compareValue('2024-03-09', ew('='))).toBe(false);
    expect(compareValue('2024-03-09', ew('!='))).toBe(true);
    expect(compareValue('2024-04-01', ew('>'))).toBe(true);
    expect(compareValue('2024-03-10', ew('>'))).toBe(false);
    expect(compareValue('2024-03-10', ew('>='))).toBe(true);
    expect(compareValue('2023-12-31', ew('<'))).toBe(true);
    expect(compareValue('2024-03-10', ew('<='))).toBe(true);
    // a lexicographic/numeric coercion would get this wrong
    expect(compareValue('2024-9-1', { operator: '<', answerDate: '2024-10-01' })).toBe(true);
  });
  it('answerDateTime compares timestamps', () => {
    const ew = { operator: '>', answerDateTime: '2024-03-10T10:00:00Z' };
    expect(compareValue('2024-03-10T11:00:00Z', ew)).toBe(true);
    expect(compareValue('2024-03-10T09:00:00Z', ew)).toBe(false);
  });
  it('answerTime compares time of day', () => {
    const ew = op => ({ operator: op, answerTime: '09:30:00' });
    expect(compareValue('10:00', ew('>'))).toBe(true);
    expect(compareValue('09:30', ew('='))).toBe(true);
    expect(compareValue('08:59:59', ew('<'))).toBe(true);
  });
  it('missing or unparseable current value fails everything but !=', () => {
    expect(compareValue(undefined, { operator: '=', answerDate: '2024-03-10' })).toBe(false);
    expect(compareValue(undefined, { operator: '!=', answerDate: '2024-03-10' })).toBe(true);
    expect(compareValue('junk', { operator: '>', answerDate: '2024-03-10' })).toBe(false);
  });
  it('answerReference compares by reference string', () => {
    const ew = op => ({ operator: op, answerReference: { reference: 'Patient/1' } });
    expect(compareValue({ reference: 'Patient/1' }, ew('='))).toBe(true);
    expect(compareValue({ reference: 'Patient/2' }, ew('='))).toBe(false);
    expect(compareValue({ reference: 'Patient/2' }, ew('!='))).toBe(true);
    expect(compareValue('Patient/1', ew('='))).toBe(true);
  });
  it('existing types are unchanged', () => {
    expect(compareValue('5', { operator: '>', answerInteger: 3 })).toBe(true);
    expect(compareValue('a', { operator: '=', answerString: 'a' })).toBe(true);
  });
});

// ── 2. minLength / regex on optional items ───────────────────────────────────
describe('calcFormOk — format rules on optional text', () => {
  const store = map => ({ get: id => map[id] });
  it('optional item with explicit mandatory=false still fails minLength/regex when non-empty', () => {
    const n = { id: 'q', itemType: 'text', mandatory: false, _minLength: 5, _regex: '^[a-z]+$' };
    expect(calcFormOk(n, store({ q: 'abc' }))).toBe(false);
    expect(calcFormOk(n, store({ q: 'ABCDEF' }))).toBe(false);
    expect(calcFormOk(n, store({ q: 'abcdef' }))).toBe(true);
  });
  it('empty optional value stays ok', () => {
    const n = { id: 'q', itemType: 'text', mandatory: false, _minLength: 5, _regex: '^[a-z]+$' };
    expect(calcFormOk(n, store({}))).toBe(true);
    expect(calcFormOk(n, store({ q: '' }))).toBe(true);
  });
  it('items without format rules are unaffected', () => {
    expect(calcFormOk({ id: 'q', itemType: 'quantity', mandatory: false }, store({ q: { value: 1 } }))).toBe(true);
  });
});

// ── 3. minOccurs gated on mandatory ──────────────────────────────────────────
describe('export — minOccurs', () => {
  it('is exported for a mandatory repeating item and survives a round-trip', () => {
    const out = roundTrip({ item: [{
      linkId: 'a', text: 'A', type: 'string', required: true, repeats: true,
      extension: [{ url: FHIR.minOccurs, valueInteger: 2 }],
    }] });
    expect(out.item[0].required).toBe(true);
    expect(out.item[0].extension.filter(e => e.url === FHIR.minOccurs)).toEqual([{ url: FHIR.minOccurs, valueInteger: 2 }]);
  });
  it('is omitted when the item is not required (que-minoccurs-1)', () => {
    const { questDoc } = load({ item: [{ linkId: 'a', text: 'A', type: 'string', repeats: true,
      extension: [{ url: FHIR.minOccurs, valueInteger: 2 }] }] });
    const out = buildFHIRObject(questDoc);
    expect((out.item[0].extension || []).some(e => e.url === FHIR.minOccurs)).toBe(false);
  });
});

// ── 4. initial quantity / choice ─────────────────────────────────────────────
describe('export — item.initial', () => {
  it('quantity initial exports valueQuantity, not [object Object]', () => {
    const out = roundTrip({ item: [{ linkId: 'a', text: 'A', type: 'quantity',
      initial: [{ valueQuantity: { value: 5, unit: 'kg' } }] }] });
    expect(out.item[0].initial).toEqual([{ valueQuantity: { value: 5, unit: 'kg' } }]);
  });
  it('choice initial keeps system/display when the stored value carries them', () => {
    const { questDoc } = load({ item: [{ linkId: 'a', text: 'A', type: 'choice' }] });
    questDoc.tree[0]._initialValue = { system: 'http://s', code: 'c', display: 'Cee' };
    const out = buildFHIRObject(questDoc);
    expect(out.item[0].initial).toEqual([{ valueCoding: { system: 'http://s', code: 'c', display: 'Cee' } }]);
  });
});

// ── 5. text vs string ────────────────────────────────────────────────────────
describe('FHIR text vs string', () => {
  it('round-trips both types', () => {
    const out = roundTrip({ item: [
      { linkId: 'a', text: 'A', type: 'text' },
      { linkId: 'b', text: 'B', type: 'string' },
    ] });
    expect(out.item.map(i => i.type)).toEqual(['text', 'string']);
  });
  it('builder-created text item exports string', () => {
    const { questDoc } = load({ item: [] });
    questDoc.tree.push(createItemNode('text', { id: 'n' }));
    expect(buildFHIRObject(questDoc).item[0].type).toBe('string');
  });
  it('flag does not survive a type change', () => {
    const { questDoc } = load({ item: [{ linkId: 'a', text: 'A', type: 'text' }] });
    const asInt = changeNodeType(questDoc.tree[0], 'integer', questDoc.tree);
    const back  = changeNodeType(asInt, 'text', questDoc.tree);
    expect(buildFHIRObject(questDoc).item[0].type).toBe('string');
    expect(back._fhirText).toBeUndefined();
  });
});

// ── 6. known extensions are not duplicated ───────────────────────────────────
describe('import/export — shortText, maxDecimalPlaces, min/max of dates', () => {
  const count = (item, url) => (item.extension || []).filter(e => e.url === url).length;
  it('shortText and maxDecimalPlaces are exported once, even after repeated round-trips', () => {
    const q = { item: [
      { linkId: 'a', text: 'A', type: 'decimal', extension: [
        { url: FHIR.shortText, valueString: 'short' }, { url: FHIR.maxDecimalPlaces, valueInteger: 2 } ] },
      { linkId: 'g', text: 'G', type: 'group', extension: [{ url: FHIR.shortText, valueString: 'gs' }] },
    ] };
    const once  = roundTrip(q);
    const twice = roundTrip(once);
    for (const out of [once, twice]) {
      expect(count(out.item[0], FHIR.shortText)).toBe(1);
      expect(count(out.item[0], FHIR.maxDecimalPlaces)).toBe(1);
      expect(count(out.item[1], FHIR.shortText)).toBe(1);
    }
  });
  it('date minValue/maxValue are preserved instead of dropped', () => {
    const exts = [{ url: FHIR.minValue, valueDate: '2020-01-01' }, { url: FHIR.maxValue, valueDate: '2030-01-01' }];
    const out = roundTrip({ item: [{ linkId: 'd', text: 'D', type: 'date', extension: exts }] });
    expect(out.item[0].extension).toEqual(expect.arrayContaining(exts));
  });
  it('numeric minValue is still exported exactly once', () => {
    const out = roundTrip({ item: [{ linkId: 'n', text: 'N', type: 'integer',
      extension: [{ url: FHIR.minValue, valueInteger: 1 }] }] });
    expect(count(out.item[0], FHIR.minValue)).toBe(1);
  });
});

// ── 7. QuestDocument.reset ───────────────────────────────────────────────────
describe('QuestDocument.reset', () => {
  it('clears translations, launch contexts and modifierExtension', () => {
    const doc = new QuestDocument(makeBus());
    const tr = doc.translations;
    doc.translations.fr = { title: 'x', items: {}, opts: {}, ui: {}, xhtml: {}, markdown: {} };
    doc.meta.launchContexts = [{ name: 'patient', type: 'Patient', description: '' }];
    doc.meta._rawModifierExtension = [{ url: 'u', valueString: 'v' }];
    doc.reset();
    expect(doc.translations).toBe(tr);
    expect(Object.keys(doc.translations)).toEqual([]);
    expect(doc.meta.launchContexts).toEqual([]);
    expect(doc.meta._rawModifierExtension).toEqual([]);
  });
});

// ── 8. importFHIR result ─────────────────────────────────────────────────────
describe('importFHIR return value', () => {
  it('false on invalid input, true on success', () => {
    const bus = makeBus();
    const questDoc = new QuestDocument(bus);
    expect(importFHIR('{not json', { questDoc, bus })).toBe(false);
    expect(importFHIR({ resourceType: 'Patient' }, { questDoc, bus })).toBe(false);
    expect(importFHIR({ resourceType: 'Questionnaire', item: [] }, { questDoc, bus })).toBe(true);
  });
});

// ── 9. prototype-pollution safety ────────────────────────────────────────────
describe('prototype-pollution safety', () => {
  afterEach(() => { delete Object.prototype.title; delete Object.prototype[0]; });
  it('AnswerStore ignores __proto__ linkIds', () => {
    const s = new AnswerStore(makeBus());
    s.set('__proto__', 'x');
    s.set('__proto__$$1', 'y');
    s.addInstance('__proto__');
    s.set('child', 'z', [{ id: '__proto__', idx: 0 }]);
    s.merge(JSON.parse('{"__proto__": ["p"]}'));
    expect({}[0]).toBeUndefined();
    expect(Object.getPrototypeOf(s.data)).toBe(Object.prototype);
    expect(s.get('__proto__')).toBeUndefined();
  });
  it('AnswerStore still handles constructor-like ids as plain keys', () => {
    const s = new AnswerStore(makeBus());
    s.set('constructor', 'v');
    expect(s.get('constructor')).toBe('v');
    expect(typeof {}.constructor).toBe('function');
  });
  it('translations keyed by __proto__ do not pollute Object.prototype', () => {
    const ext = lang => ({ url: FHIR.translation, extension: [{ url: 'lang', valueCode: lang }, { url: 'content', valueString: 'T' }] });
    const { ok, questDoc } = load({ _title: { extension: [ext('__proto__'), ext('fr')] }, item: [] });
    expect(ok).toBe(true);
    expect({}.title).toBeUndefined();
    expect(questDoc.translations.fr.title).toBe('T');
  });
  it('importQRAnswers skips __proto__ linkId', () => {
    const values = {};
    const qr = JSON.parse('{"resourceType":"QuestionnaireResponse","item":[{"linkId":"__proto__","answer":[{"valueString":"x"}]}]}');
    importQRAnswers(qr, values, [{ id: '__proto__' }]);
    expect(Object.getPrototypeOf(values)).toBe(Object.prototype);
  });
});

// ── 10. change-type keeps children ───────────────────────────────────────────
describe('changeNodeType — children', () => {
  it('does not abort listeners of children the new node still owns', () => {
    const parent = createItemNode('text', { id: 'p' });
    const child = createItemNode('text', { id: 'c' });
    parent.children.push(child);
    parent._ac = new AbortController();
    child._ac = new AbortController();
    const out = changeNodeType(parent, 'integer', [parent]);
    expect(out.children).toContain(child);
    expect(child._ac.signal.aborted).toBe(false);
    expect(parent._ac.signal.aborted).toBe(true);
  });
});

// ── 11. QR builder ───────────────────────────────────────────────────────────
describe('buildQR — value edge cases', () => {
  const qrOf = (item, v) => buildQR({ item: [item] }, { [item.linkId]: [v] }).item[0];
  it('cleared integer/decimal is omitted, not 0', () => {
    expect(qrOf({ linkId: 'i', type: 'integer' }, '').answer).toBeUndefined();
    expect(qrOf({ linkId: 'd', type: 'decimal' }, '').answer).toBeUndefined();
    expect(qrOf({ linkId: 'i', type: 'integer' }, '0').answer).toEqual([{ valueInteger: 0 }]);
  });
  const opts = [{ valueCoding: { code: 'a', display: 'A' } }];
  it('open-choice free text is valueString; a defined option stays a coding', () => {
    const item = { linkId: 'o', type: 'open-choice', answerOption: opts };
    expect(qrOf(item, 'something else').answer).toEqual([{ valueString: 'something else' }]);
    expect(qrOf(item, 'a').answer[0].valueCoding.code).toBe('a');
  });
  it('open-choice without answerOption keeps coding (value-set backed)', () => {
    expect(qrOf({ linkId: 'o', type: 'open-choice', answerValueSet: 'http://vs' }, 'x').answer)
      .toEqual([{ valueCoding: { code: 'x' } }]);
  });
  it('open-choice free text round-trips through QR import', () => {
    const item = { linkId: 'o', type: 'open-choice', answerOption: opts };
    const qr = buildQR({ item: [item] }, { o: ['free'] });
    const values = {};
    importQRAnswers(qr, values, [{ id: 'o' }]);
    expect(values.o).toEqual(['free']);
  });
  it('attachment answers never become "[object ...]" strings', () => {
    const out = qrOf({ linkId: 'f', type: 'attachment' }, { name: 'a.pdf', size: 1, type: 'application/pdf' });
    expect(out.answer).toBeUndefined();
  });
});

// ── 12. translation passthrough stripped once translations are cleared ───────
describe('export — stale translation extensions', () => {
  it('drops ui/xhtml/markdown translation passthrough when no languages remain', () => {
    const ext = url => ({ url, extension: [{ url: 'lang', valueCode: 'fr' }, { url: 'strings', valueString: '{"a":"b"}' }] });
    const keep = { url: 'http://example.org/keep', valueString: 'k' };
    const { questDoc } = load({ extension: [ext(APP_URL.uiTranslations), ext(APP_URL.xhtmlTranslations), ext(APP_URL.markdownTranslations), keep], item: [] });
    expect(buildFHIRObject(questDoc).extension.length).toBe(4);
    for (const k of Object.keys(questDoc.translations)) delete questDoc.translations[k];
    expect(buildFHIRObject(questDoc).extension).toEqual([keep]);
  });
});

// ── 14. fhir-search resourceType validation ──────────────────────────────────
describe('searchFhir — resourceType validation', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('does not issue a request for a malformed resource type', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    expect(await searchFhir('Patient?x=1', 'a', 10, { fhirBase: 'https://h/fhir' })).toEqual([]);
    expect(await searchFhir('../Patient', 'a', 10, { fhirBase: 'https://h/fhir' })).toEqual([]);
    expect(f).not.toHaveBeenCalled();
  });
});

// ── fhirType extension round-trip (export writes valueString) ────────────────
describe('questionnaire-fhirType round-trip', () => {
  it('is read back from valueString and exported once', () => {
    const q = { item: [{ linkId: 'a', text: 'A', type: 'string',
      extension: [{ url: FHIR.fhirType, valueString: 'HumanName' }] }] };
    const once = roundTrip(q);
    const twice = roundTrip(once);
    for (const out of [once, twice]) {
      expect(out.item[0].extension.filter(e => e.url === FHIR.fhirType)).toEqual([{ url: FHIR.fhirType, valueString: 'HumanName' }]);
    }
  });
});
