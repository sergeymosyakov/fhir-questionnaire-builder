// Export/import follows the FHIR Questionnaire rules: no empty item lists, no invented text, defaults and limits kept.
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
const { AppEvents, EventState } = await import('../js/events.js');
EventState._set(AppEvents.APP_CONTEXT_READY, { questDoc });

const cycle = items => {
  importFHIR({ resourceType: 'Questionnaire', status: 'draft', title: 't', item: items });
  return buildFHIRObject();
};
const opts = codes => codes.map(code => ({ valueCoding: { system: 'http://x', code, display: code.toUpperCase() } }));

describe('empty groups and missing text', () => {
  it('a group without children is exported without an item list', () => {
    const q = cycle([{ linkId: 'g', type: 'group', text: 'G' }]);
    expect(q.item[0]).not.toHaveProperty('item');
  });
  it('an item without text stays without text', () => {
    const q = cycle([{ linkId: 'q', type: 'string' }, { linkId: 'g', type: 'group', item: [{ linkId: 'c', type: 'string', text: 'C' }] }]);
    expect(q.item[0]).not.toHaveProperty('text');
    expect(q.item[1]).not.toHaveProperty('text');
  });
});

describe('maxLength and defaults', () => {
  it.each([['radio-button'], ['check-box']])('maxLength survives for an open-choice shown as %s', control => {
    const q = cycle([{ linkId: 'q', type: 'open-choice', text: 'Q', maxLength: 20, answerOption: opts(['a', 'b']),
      extension: [{ url: 'http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl', valueCodeableConcept: { coding: [{ system: 'http://hl7.org/fhir/questionnaire-item-control', code: control }] } }] }]);
    expect(q.item[0].maxLength).toBe(20);
  });
  it('an attachment default survives', () => {
    const att = { contentType: 'text/plain', title: 'note.txt', data: 'aGk=' };
    const q = cycle([{ linkId: 'q', type: 'attachment', text: 'Q', initial: [{ valueAttachment: att }] }]);
    expect(q.item[0].initial).toEqual([{ valueAttachment: att }]);
  });
  it('several preselected options of a checklist all survive', () => {
    const answerOption = opts(['a', 'b', 'c']).map((o, i) => (i < 2 ? { ...o, initialSelected: true } : o));
    const q = cycle([{ linkId: 'q', type: 'choice', text: 'Q', repeats: true, answerOption,
      extension: [{ url: 'http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl', valueCodeableConcept: { coding: [{ code: 'check-box' }] } }] }]);
    expect(q.item[0].answerOption.map(o => !!o.initialSelected)).toEqual([true, true, false]);
  });
  it('several preselected options of a repeating drop-down all survive', () => {
    const answerOption = opts(['a', 'b', 'c']).map((o, i) => (i !== 1 ? { ...o, initialSelected: true } : o));
    const q = cycle([{ linkId: 'q', type: 'choice', text: 'Q', repeats: true, answerOption }]);
    expect(q.item[0].answerOption.map(o => !!o.initialSelected)).toEqual([true, false, true]);
  });

  it('every preselected option becomes a default value in the builder model', () => {
    const answerOption = opts(['a', 'b', 'c']).map((o, i) => (i !== 1 ? { ...o, initialSelected: true } : o));
    cycle([
      { linkId: 'chk', type: 'choice', text: 'C', repeats: true, answerOption,
        extension: [{ url: 'http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl', valueCodeableConcept: { coding: [{ code: 'check-box' }] } }] },
      { linkId: 'sel', type: 'choice', text: 'S', repeats: true, answerOption },
    ]);
    const [chk, sel] = questDoc.tree;
    expect(chk._initialSelected).toBe('a,c');
    expect(chk._initialValues).toEqual(['a', 'c']);
    expect(sel._initialValues).toEqual(['a', 'c']);
  });
});

describe('checklist defaults reach the answer store', () => {
  it('a checklist with two preselected options starts with both selected', () => {
    const events = [];
    const bus = { dispatch: (name, detail) => events.push([name, detail]) };
    importFHIR({ resourceType: 'Questionnaire', status: 'draft', title: 't', item: [{ linkId: 'chk', type: 'choice', text: 'C', repeats: true,
      answerOption: opts(['a', 'b', 'c']).map((o, i) => (i !== 1 ? { ...o, initialSelected: true } : o)),
      extension: [{ url: 'http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl', valueCodeableConcept: { coding: [{ code: 'check-box' }] } }] }] }, { bus });
    const set = events.find(([, d]) => d?.id === 'chk');
    expect(set[1].value).toBe('a,c');
  });
});

describe('enableWhen operator names', () => {
  it('older operator names are read as the FHIR operators', () => {
    cycle([
      { linkId: 'a', type: 'string', text: 'A' },
      { linkId: 'b', type: 'string', text: 'B', enableWhen: [{ question: 'a', operator: 'not-equal', answerString: 'x' }] },
    ]);
    expect(questDoc.tree[1].enableWhen[0].operator).toBe('!=');
  });
});

describe('Default value editor', () => {
  it('replacing or clearing a default drops the imported list of values', async () => {
    const { INITIAL_SECTIONS } = await import('../js/ui/modals/initial-sections/registry.js');
    await import('../js/ui/modals/initial-sections/init-value.js');
    const section = INITIAL_SECTIONS.find(x => x.constructor.name === 'InitValueSection') || INITIAL_SECTIONS[0];
    const node = { id: 'q', itemType: 'text', _initialValue: 'a', _initialValues: ['a', 'c'] };
    section.commit({ draftValue: 'z' }, node);
    expect(node._initialValues).toBeUndefined();
    node._initialValues = ['a', 'c'];
    section.commit({ draftValue: '' }, node);
    expect(node._initialValues).toBeUndefined();
    expect(node._initialValue).toBeUndefined();
  });
});

describe('R5 documents', () => {
  const R5_MARKER = { url: 'https://sergeymosyakov.github.io/fhir-questionnaire-builder/StructureDefinition/builder-target-version', valueCode: '5.0.0' };
  const r5 = items => {
    importFHIR({ resourceType: 'Questionnaire', status: 'draft', title: 't', extension: [R5_MARKER], item: items });
    return buildFHIRObject();
  };
  it('open-choice questions survive re-import, with or without the version marker', () => {
    const items = [{ linkId: 'q', type: 'coding', text: 'Q', answerConstraint: 'optionsOrString', answerOption: opts(['a', 'b']) }];
    expect(r5(items).item[0].type).toBe('open-choice');
    importFHIR({ resourceType: 'Questionnaire', status: 'draft', title: 't', item: items });
    expect(buildFHIRObject().item[0].type).toBe('open-choice');
  });
  it('a plain coding question stays a choice question', () => {
    expect(r5([{ linkId: 'q', type: 'coding', text: 'Q', answerOption: opts(['a']) }]).item[0].type).toBe('choice');
  });
});

describe('Answer Type editor', () => {
  it('changing the answer source drops the contained / expansion warnings of the old one', async () => {
    const { ANSWER_TYPE_SECTIONS } = await import('../js/ui/modals/answer-type/registry.js');
    await import('../js/ui/modals/answer-type/sections/choice.js');
    const section = ANSWER_TYPE_SECTIONS.find(x => x.constructor.name === 'ChoiceSection');
    const node = () => ({ itemType: 'select', _answerValueSet: '#vs', _containedVsUnsupported: ['filters the concepts of x'], _vsExpansionIssue: 'cut off' });
    const manual = node();
    section.commit({ draftSrc: 'options', draftOptionRows: [{ code: 'a', label: 'A', score: '', prefix: '', weight: '', system: '' }] }, manual, questDoc, null);
    expect(manual._containedVsUnsupported).toBeUndefined();
    expect(manual._vsExpansionIssue).toBeUndefined();
    const expr = node();
    section.commit({ draftSrc: 'expression', draftAnswerExpr: 'x', draftCandidateExpr: '' }, expr, questDoc, null);
    expect(expr._containedVsUnsupported).toBeUndefined();
    const other = node();
    questDoc.contained = [{ resourceType: 'ValueSet', id: 'ok', compose: { include: [{ system: 'http://s', concept: [{ code: 'a' }] }] } }];
    section.commit({ draftSrc: 'valueset', draftAVS: '#ok' }, other, questDoc, null);
    questDoc.contained = [];
    expect(other._containedVsUnsupported).toBeUndefined();
    expect(other._vsExpansionIssue).toBeUndefined();
  });
});
