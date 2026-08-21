// Regression: a choice option whose display contains a comma must not be split
// into multiple options across the import → export round-trip.

import { describe, it, expect, vi } from 'vitest';
import { hasCommaInCodingOpts } from '../js/fhir/import-helpers.js';

globalThis.CustomEvent = class CustomEvent {
  constructor(type, init) { this.type = type; this.detail = init?.detail; }
};
const _eventListeners = {};
globalThis.document = {
  dispatchEvent(e) { (_eventListeners[e.type] || []).forEach(fn => fn(e)); },
  addEventListener(type, fn) { (_eventListeners[type] = _eventListeners[type] || []).push(fn); },
};

const _tree = [];
const _values = {};
const _questMeta = { id: '', url: '', version: '', title: '', status: 'draft', publisher: '', description: '',
  name: '', date: '', subjectType: [], purpose: '', copyright: '', approvalDate: '', lastReviewDate: '',
  effectivePeriodStart: '', effectivePeriodEnd: '', replaces: [],
  _rawContact: null, _rawUseContext: null, _rawJurisdiction: null, _rawCode: null };
const _questDoc = { tree: _tree, meta: _questMeta, rawFhir: null, variables: [], contained: [], translations: {} };

vi.mock('../js/state.js', () => ({
  questDoc: _questDoc,
  answerStore: { data: _values, get: id => _values[id], getAll: () => [] },
  resetSeq: vi.fn(),
}));
vi.mock('../js/builder/index.js', () => ({ renderTree: vi.fn() }));
vi.mock('../js/ui/toast.js', () => ({ showError: vi.fn(), showWarn: vi.fn() }));
vi.stubGlobal('alert', vi.fn());

const { importFHIR } = await import('../js/fhir/import.js');
const { nodeToFHIRItem } = await import('../js/fhir/export.js');
const { AppEvents, EventState } = await import('../js/events.js');
EventState._set(AppEvents.APP_CONTEXT_READY, { questDoc: _questDoc });

const COMMA_DISPLAY = 'E1220 - Wheelchair, adult size, heavy duty, elevating legrests';
const minQ = items => ({ resourceType: 'Questionnaire', title: 'Test', item: items });
const choiceItem = opts => ({
  linkId: 'q1', type: 'choice', text: 'Select codes', repeats: true,
  answerOption: opts.map(o => ({ valueCoding: o })),
});

describe('hasCommaInCodingOpts', () => {
  it('detects a comma inside a valueCoding display', () => {
    expect(hasCommaInCodingOpts([{ valueCoding: { code: 'E1220', display: COMMA_DISPLAY } }])).toBe(true);
  });
  it('is false for comma-free coding options', () => {
    expect(hasCommaInCodingOpts([{ valueCoding: { code: 'E1039', display: 'E1039 - Transport chair' } }])).toBe(false);
  });
});

describe('import → export round-trip with comma in option display', () => {
  it('keeps a comma-containing option as a single option (not split)', () => {
    importFHIR(minQ([choiceItem([
      { code: 'E1220', display: COMMA_DISPLAY },
      { code: 'E1039', display: 'E1039 - Transport chair' },
    ])]));

    expect(_tree[0]._rawAnswerOptions).toHaveLength(2);
    expect(_tree[0]._rawAnswerOptions[0].valueCoding.display).toBe(COMMA_DISPLAY);

    const out = nodeToFHIRItem(_tree[0]);
    expect(out.answerOption).toHaveLength(2);
    expect(out.answerOption[0].valueCoding.display).toBe(COMMA_DISPLAY);
    expect(out.answerOption[0].valueCoding.code).toBe('E1220');
  });

  it('leaves comma-free coding options on the plain options path', () => {
    importFHIR(minQ([choiceItem([
      { code: 'E1039', display: 'E1039 - Transport chair' },
      { code: 'K0002', display: 'K0002 - Standard hemi wheelchair' },
    ])]));

    expect(_tree[0]._rawAnswerOptions).toBeUndefined();
    const out = nodeToFHIRItem(_tree[0]);
    expect(out.answerOption).toHaveLength(2);
  });
});
