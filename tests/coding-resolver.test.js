// system/display for value-set-backed choice answers: resolved from options, expansion cache or a loaded response.
import { describe, it, expect } from 'vitest';
import { makeCodingResolver, collectResponseCodings } from '../js/fhir/coding-resolver.js';
import { buildQR } from '../js/fhir/qr-builder.js';
import { importQRAnswers } from '../js/fhir/qr-import.js';
import { AnswerStore } from '../js/answer-store.js';
import { FHIR } from '../js/fhir/urls/fhir.js';

const SYS = 'http://example.org/cs';
const vsItem = { linkId: 'q', type: 'choice', answerValueSet: 'http://example.org/ValueSet/vs' };
const codesOf = qr => qr.item[0].answer.map(a => a.valueCoding);

describe('makeCodingResolver', () => {
  it('reads contained-value-set options of the node', () => {
    const tree = [{ id: 'q', children: [], _rawAnswerOptions: [{ valueCoding: { system: SYS, code: 'a', display: 'A' } }] }];
    expect(makeCodingResolver(tree)('q', 'a')).toEqual({ system: SYS, display: 'A' });
  });
  it('reads the expansion cache of an external value set', () => {
    const tree = [{ id: 'g', children: [{ id: 'q', children: [], _vsCache: [{ code: 'x', display: 'X', system: SYS }] }] }];
    expect(makeCodingResolver(tree)('q', 'x')).toEqual({ system: SYS, display: 'X' });
  });
  it('falls back to codings remembered from a loaded response', () => {
    const remembered = collectResponseCodings([{ linkId: 'q', answer: [{ valueCoding: { system: SYS, code: 'z', display: 'Z' } }] }]);
    expect(makeCodingResolver([{ id: 'q', children: [] }], remembered)('q', 'z')).toEqual({ system: SYS, display: 'Z' });
  });
  it('returns null for an unknown code and is safe for prototype-named ids', () => {
    const resolve = makeCodingResolver([{ id: 'q', children: [] }], collectResponseCodings([]));
    expect(resolve('q', 'nope')).toBeNull();
    expect(resolve('constructor', 'toString')).toBeNull();
    const plain = makeCodingResolver([{ id: 'constructor', children: [] }], {});
    expect(plain('constructor', 'toString')).toBeNull();
    expect(plain('hasOwnProperty', 'x')).toBeNull();
  });
  it('the question\'s own value set wins; a loaded response fills in only what it lacks', () => {
    const tree = [{ id: 'q', children: [], _vsCache: [{ code: 'a', display: 'Fresh', system: '' }] }];
    const remembered = collectResponseCodings([{ linkId: 'q', answer: [{ valueCoding: { system: SYS, code: 'a', display: 'Stale' } }] }]);
    expect(makeCodingResolver(tree, remembered)('q', 'a')).toEqual({ system: SYS, display: 'Fresh' });
  });
});

describe('collectResponseCodings', () => {
  it('skips items without a linkId', () => {
    expect(Object.keys(collectResponseCodings([{ answer: [{ valueCoding: { system: SYS, code: 'a' } }] }]))).toEqual([]);
  });
  it('finds codings in nested items and answer items, skipping codes without detail', () => {
    const out = collectResponseCodings([
      { linkId: 'g', item: [{ linkId: 'a', answer: [{ valueCoding: { code: 'c1', display: 'One' } }] }] },
      { linkId: 'p', answer: [{ valueBoolean: true, item: [{ linkId: 'b', answer: [{ valueCoding: { system: SYS, code: 'c2' } }] }] }] },
      { linkId: 'bare', answer: [{ valueCoding: { code: 'only-code' } }] },
    ]);
    expect(out.a.c1).toEqual({ display: 'One' });
    expect(out.b.c2).toEqual({ system: SYS });
    expect(out.bare).toBeUndefined();
  });
});

describe('QR build with a resolver', () => {
  const resolve = (id, code) => (id === 'q' && code === 'a' ? { system: SYS, display: 'A' } : null);
  it('adds system and display to a value-set-backed choice answer', () => {
    expect(codesOf(buildQR({ item: [vsItem] }, { q: ['a'] }, resolve))).toEqual([{ system: SYS, code: 'a', display: 'A' }]);
  });
  it('is unchanged without a resolver or for an unresolved code', () => {
    expect(codesOf(buildQR({ item: [vsItem] }, { q: ['a'] }))).toEqual([{ code: 'a' }]);
    expect(codesOf(buildQR({ item: [vsItem] }, { q: ['b'] }, resolve))).toEqual([{ code: 'b' }]);
  });
  it('does not touch items that list their options directly', () => {
    const item = { linkId: 'q', type: 'choice', answerOption: [{ valueCoding: { system: 'http://other', code: 'a', display: 'Own' } }] };
    expect(codesOf(buildQR({ item: [item] }, { q: ['a'] }, resolve))).toEqual([{ system: 'http://other', code: 'a', display: 'Own' }]);
  });
  it('enriches every selected code of a value-set checklist', () => {
    const ctl = [{ url: FHIR.itemControl, valueCodeableConcept: { coding: [{ code: 'check-box' }] } }];
    const item = { ...vsItem, repeats: true, extension: ctl };
    const both = (id, code) => ({ system: SYS, display: code.toUpperCase() });
    const qr = buildQR({ item: [item] }, { q: ['a,b'] }, both);
    expect(codesOf(qr)).toEqual([{ system: SYS, code: 'a', display: 'A' }, { system: SYS, code: 'b', display: 'B' }]);
  });
});

describe('load then re-export keeps codings even when the value set is not expanded', () => {
  it('round-trips system and display of a loaded response', () => {
    const tree = [{ id: 'q', itemType: 'select', children: [] }];
    const answer = [{ valueCoding: { system: SYS, code: 'a', display: 'A' } }];
    const values = {};
    const { codings } = importQRAnswers({ resourceType: 'QuestionnaireResponse', item: [{ linkId: 'q', answer }] }, values, tree);
    const store = new AnswerStore({ on() {} });
    store.replaceAll(values, codings);
    const qr = buildQR({ item: [vsItem] }, store.toValueMap(), store.codingResolver(tree));
    expect(qr.item[0].answer).toEqual([{ valueCoding: answer[0].valueCoding }]);
  });
  it('clearing the store forgets the remembered codings', () => {
    const store = new AnswerStore({ on() {} });
    store.replaceAll({}, collectResponseCodings([{ linkId: 'q', answer: [{ valueCoding: { system: SYS, code: 'a' } }] }]));
    store.clear();
    expect(store.codingResolver([{ id: 'q', children: [] }])('q', 'a')).toBeNull();
  });
});
