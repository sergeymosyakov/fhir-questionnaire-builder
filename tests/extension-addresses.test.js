// Extensions are written with the addresses/types the specification defines; older addresses are still read.
import { describe, it, expect, vi } from 'vitest';

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
const { FHIR } = await import('../js/fhir/urls/fhir.js');
const { BaseNode } = await import('../js/nodes/base-node.js');
const { AppEvents, EventState } = await import('../js/events.js');
EventState._set(AppEvents.APP_CONTEXT_READY, { questDoc });

const SD = 'http://hl7.org/fhir/StructureDefinition/';
const cycle = (items, extension) => {
  importFHIR({ resourceType: 'Questionnaire', status: 'draft', title: 't', ...(extension ? { extension } : {}), item: items });
  return buildFHIRObject();
};
const withExts = (extension, extra = {}) => [{ linkId: 'q', type: 'string', text: 'Q', extension, ...extra }];
const exts = (q, url) => (q.item[0].extension || []).filter(e => e.url === url);

describe('item extensions: core addresses are written, legacy ones are read', () => {
  it.each([
    ['hidden', FHIR.hidden, FHIR.hiddenSdc, { valueBoolean: true }],
    ['entryFormat', FHIR.entryFormat, FHIR.entryFormatSdc, { valueString: 'yyyy' }],
    ['preferredTerminologyServer', FHIR.preferredTerminologyServer, FHIR.preferredTerminologyServerSdc, { valueUrl: 'https://tx.example.org' }],
  ])('%s: both addresses import, only the core one is exported', (_n, core, legacy, value) => {
    for (const url of [core, legacy]) {
      const q = cycle(withExts([{ url, ...value }]));
      expect(exts(q, core)).toEqual([{ url: core, ...value }]);
      expect(exts(q, legacy)).toEqual([]);
    }
  });

  it('the variable extension is the core one; the SDC-named one is still read', () => {
    for (const url of [FHIR.variable, FHIR.variableSdc]) {
      const q = cycle([], [{ url, valueExpression: { name: 'bmi', language: 'text/fhirpath', expression: '1+1' } }]);
      const vars = q.extension.filter(e => e.url === FHIR.variable || e.url === FHIR.variableSdc);
      expect(vars).toEqual([{ url: FHIR.variable, valueExpression: { name: 'bmi', language: 'text/fhirpath', expression: '1+1' } }]);
    }
  });

  it('the questionnaire-level terminology server uses the core address', () => {
    const q = cycle([], [{ url: FHIR.preferredTerminologyServerSdc, valueUrl: 'https://tx.example.org' }]);
    expect(q.extension).toEqual([{ url: FHIR.preferredTerminologyServer, valueUrl: 'https://tx.example.org' }]);
  });

  it.each([['valuePositiveInt'], ['valueInteger']])('columnCount reads %s and writes valuePositiveInt', key => {
    const q = cycle([{ linkId: 'q', type: 'choice', text: 'Q', extension: [{ url: FHIR.columnCount, [key]: 3 }], answerOption: [{ valueCoding: { code: 'a' } }] }]);
    expect(exts(q, FHIR.columnCount)).toEqual([{ url: FHIR.columnCount, valuePositiveInt: 3 }]);
  });

  it.each([FHIR.answerMedia, FHIR.answerMediaLegacy])('answer-option media %s is read and written as itemAnswerMedia', url => {
    const attachment = { contentType: 'image/png', url: 'https://example.org/a.png' };
    const q = cycle([{ linkId: 'q', type: 'choice', text: 'Q', answerOption: [{ valueCoding: { code: 'a', display: 'A' }, extension: [{ url, valueAttachment: attachment }] }] }]);
    const opt = q.item[0].answerOption[0];
    expect(opt.extension).toEqual([{ url: FHIR.answerMedia, valueAttachment: attachment }]);
    expect(FHIR.answerMedia).toBe('http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-itemAnswerMedia');
  });
});

describe('expressions and flags keep what the file said', () => {
  const choice = extension => [{ linkId: 'q', type: 'choice', text: 'Q', extension, answerOption: [{ valueCoding: { code: 'a' } }] }];
  it.each([[FHIR.answerExpression], [FHIR.candidateExpression]])('%s keeps a non-FHIRPath language', url => {
    const q = cycle(choice([{ url, valueExpression: { language: 'application/x-fhir-query', expression: 'Condition?patient={{%patient.id}}' } }]));
    expect(exts(q, url)).toEqual([{ url, valueExpression: { language: 'application/x-fhir-query', expression: 'Condition?patient={{%patient.id}}' } }]);
  });
  it('an expression without a language is written as FHIRPath', () => {
    const q = cycle(choice([{ url: FHIR.answerExpression, valueExpression: { expression: '%x' } }]));
    expect(exts(q, FHIR.answerExpression)[0].valueExpression.language).toBe('text/fhirpath');
  });
  it.each(['component', 'member', 'derived', 'independent'])('observationExtract keeps the relationship code %s', code => {
    const q = cycle(withExts([{ url: FHIR.observationExtract, valueCode: code }]));
    expect(exts(q, FHIR.observationExtract)).toEqual([{ url: FHIR.observationExtract, valueCode: code }]);
  });
  it('a boolean observationExtract is unchanged', () => {
    expect(exts(cycle(withExts([{ url: FHIR.observationExtract, valueBoolean: false }])), FHIR.observationExtract))
      .toEqual([{ url: FHIR.observationExtract, valueBoolean: false }]);
  });
  it('the core addresses are the specification ones', () => {
    expect(FHIR.hidden).toBe(SD + 'questionnaire-hidden');
    expect(FHIR.entryFormat).toBe(SD + 'entryFormat');
    expect(FHIR.variable).toBe(SD + 'variable');
    expect(FHIR.preferredTerminologyServer).toBe(SD + 'preferredTerminologyServer');
  });
});

describe('review follow-ups', () => {
  it('a group-level legacy sdc preferredTerminologyServer is read and rewritten at the core address', () => {
    const q = cycle([{ linkId: 'g', type: 'group', text: 'G',
      extension: [{ url: FHIR.preferredTerminologyServerSdc, valueUrl: 'https://tx.example.org' }],
      item: [{ linkId: 'c', type: 'string', text: 'C' }] }]);
    expect(q.item[0].extension).toEqual([{ url: FHIR.preferredTerminologyServer, valueUrl: 'https://tx.example.org' }]);
  });

  it('applyPatch ignores prototype-polluting keys', () => {
    const node = { applyPatch: BaseNode.prototype.applyPatch };
    node.applyPatch(JSON.parse('{"__proto__":{"evil":1},"constructor":"x","title":"T"}'));
    expect(node.title).toBe('T');
    expect(node.evil).toBeUndefined();
    expect(node.constructor).toBe(Object);
  });

  it('observationExtract code is only written while extraction is on', async () => {
    const { STATES_SECTIONS } = await import('../js/ui/modals/states-sections/registry.js');
    await import('../js/ui/modals/states-sections/observation-extract.js');
    const section = STATES_SECTIONS.find(x => x.constructor.name === 'ObservationExtractSection');
    const node = { _observationExtract: true, _observationExtractCode: 'member' };
    node.applyPatch = BaseNode.prototype.applyPatch;
    node.applyPatch(section.buildPatch({ draftObsExtract: 'true' }, node));
    expect(node._observationExtractCode).toBe('member');
    node.applyPatch(section.buildPatch({ draftObsExtract: 'false' }, node));
    expect(node._observationExtract).toBe(false);
    expect(node._observationExtractCode).toBeUndefined();
    node.applyPatch(section.buildPatch({ draftObsExtract: 'true' }, node));
    expect(node._observationExtractCode).toBeUndefined();
  });

  it('editing an answerExpression resets its non-FHIRPath language; an unchanged one keeps it', async () => {
    const { ANSWER_TYPE_SECTIONS } = await import('../js/ui/modals/answer-type/registry.js');
    await import('../js/ui/modals/answer-type/sections/choice.js');
    const section = ANSWER_TYPE_SECTIONS.find(x => x.constructor.name === 'ChoiceSection');
    const node = { itemType: 'select', _answerExpression: 'Patient?x=1', _answerExpressionLanguage: 'application/x-fhir-query' };
    section.commit({ draftSrc: 'expression', draftAnswerExpr: 'Patient?x=1', draftCandidateExpr: '' }, node, questDoc, null);
    expect(node._answerExpressionLanguage).toBe('application/x-fhir-query');
    section.commit({ draftSrc: 'expression', draftAnswerExpr: 'item.answer.value', draftCandidateExpr: '' }, node, questDoc, null);
    expect(node._answerExpressionLanguage).toBeUndefined();
  });
});
