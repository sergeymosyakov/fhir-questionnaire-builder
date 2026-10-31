// Import/export fidelity regressions: group attributes, open-choice controls, R5 open answers, prototype-named languages.
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

const U = 'http://hl7.org/fhir/StructureDefinition/';
const roundTrip = items => {
  importFHIR({ resourceType: 'Questionnaire', status: 'draft', title: 't', item: items });
  return buildFHIRObject();
};
const control = code => ({ url: U + 'questionnaire-itemControl', valueCodeableConcept: { coding: [{ code }] } });
const opt = [{ valueCoding: { code: 'a', display: 'A' } }];

describe('import fidelity', () => {
  it('group keeps readOnly and usageMode', () => {
    const out = roundTrip([{
      linkId: 'g', type: 'group', text: 'G', readOnly: true,
      extension: [{ url: FHIR.usageMode, valueCode: 'capture' }],
      item: [{ linkId: 'a', type: 'string', text: 'A' }],
    }]);
    expect(out.item[0].readOnly).toBe(true);
    expect(out.item[0].extension).toContainEqual({ url: FHIR.usageMode, valueCode: 'capture' });
  });

  it.each(['radio-button', 'check-box'])('open-choice with %s control stays open-choice', code => {
    const out = roundTrip([{ linkId: 'o', type: 'open-choice', text: 'O', extension: [control(code)], answerOption: opt }]);
    expect(out.item[0].type).toBe('open-choice');
  });

  it('choice with a radio control stays choice', () => {
    const out = roundTrip([{ linkId: 'c', type: 'choice', text: 'C', extension: [control('radio-button')], answerOption: opt }]);
    expect(out.item[0].type).toBe('choice');
  });

  it('R5 coding + optionsOrString imports as open-choice', () => {
    const out = roundTrip([{ linkId: 'r', type: 'coding', text: 'R', answerConstraint: 'optionsOrString', answerOption: opt }]);
    expect(out.item[0].type).toBe('open-choice');
  });

  it.each(['valueOf', 'toString', 'constructor'])('translation language "%s" does not break import', lang => {
    const ext = { url: U + 'translation', extension: [{ url: 'lang', valueCode: lang }, { url: 'content', valueString: 'X' }] };
    const out = roundTrip([{ linkId: 'q', type: 'string', text: 'Q', _text: { extension: [ext] } }]);
    expect(out.item[0].text).toBe('Q');
  });
});
