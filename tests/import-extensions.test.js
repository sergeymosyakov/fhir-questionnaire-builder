// Tests for importFHIR — extension-specific suites.
// Shares the same mock setup as import.test.js.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FHIR } from '../js/fhir/urls/fhir.js';

globalThis.CustomEvent = class CustomEvent {
  constructor(type, init) { this.type = type; this.detail = init?.detail; }
};
const _eventListeners = {};
globalThis.document = {
  dispatchEvent(e) { (_eventListeners[e.type] || []).forEach(fn => fn(e)); },
  addEventListener(type, fn) { (_eventListeners[type] = _eventListeners[type] || []).push(fn); },
};

const _tree           = [];
const _questVariables = [];
const _questContained = [];
const _values         = {};
const _questMeta      = { id: '', url: '', version: '', title: '', status: 'draft', publisher: '', description: '',
  name: '', date: '', subjectType: [], purpose: '', copyright: '', approvalDate: '', lastReviewDate: '',
  effectivePeriodStart: '', effectivePeriodEnd: '', replaces: [],
  _rawContact: null, _rawUseContext: null, _rawJurisdiction: null, _rawCode: null };
const _questDoc = { tree: _tree, meta: _questMeta, rawFhir: null, variables: _questVariables, contained: _questContained };

vi.mock('../js/state.js', () => ({
  questDoc:   _questDoc,
  answerStore: {
    data: _values,
    get:  id => _values[id],
    getAll: id => { const r = []; if (_values[id] !== undefined) r.push(_values[id]); return r; },
  },
  resetSeq:       vi.fn(),
}));

vi.mock('../js/builder/index.js', () => ({ renderTree: vi.fn() }));

const { importFHIR, configure: configureImport } = await import('../js/fhir/import.js');
configureImport({ questDoc: _questDoc });

vi.stubGlobal('alert', vi.fn());
vi.mock('../js/ui/toast.js', () => ({ showError: vi.fn(), showWarn: vi.fn() }));

// ── group import (fhirItemToNode group branch) ────────────────────────────────
describe('importFHIR — group items', () => {
  const minQ = (items = []) => ({ resourceType: 'Questionnaire', title: 'Test', item: items });
  const CONSTRAINT_URL  = FHIR.constraint;
  const SUPPORT_URL     = FHIR.supportLink;
  const HIDDEN_URL_SDC  = FHIR.hiddenSdc;
  const ITLH_KEY_GROUP_OR = 'e3a8c2f1-6b4d-4e9a-87c5:group-or';

  it('sets logicWithParent=OR when group-or constraint key is detected', () => {
    importFHIR(minQ([{
      linkId: 'g1', type: 'group', text: 'G',
      extension: [{
        url: CONSTRAINT_URL,
        extension: [
          { url: 'key',        valueId:     ITLH_KEY_GROUP_OR },
          { url: 'severity',   valueCode:   'error' },
          { url: 'human',      valueString: 'At least one required' },
          { url: 'expression', valueString: "%resource.item.where(linkId='g1.q1').answer.exists()" },
        ],
      }],
      item: [{ linkId: 'g1.q1', type: 'string', text: 'Child' }],
    }]));
    expect(_tree[0].logicWithParent).toBe('OR');
  });

  it('imports a regular (non-OR) constraint onto node.constraint', () => {
    importFHIR(minQ([{
      linkId: 'q1', type: 'string', text: 'Q',
      extension: [{
        url: CONSTRAINT_URL,
        extension: [
          { url: 'key',        valueId:     'cst-1' },
          { url: 'expression', valueString: "value.length() > 3" },
          { url: 'human',      valueString: 'Must be longer than 3 chars' },
          { url: 'severity',   valueCode:   'error' },
        ],
      }],
    }]));
    expect(_tree[0].constraint).toHaveLength(1);
    expect(_tree[0].constraint[0].key).toBe('cst-1');
    expect(_tree[0].constraint[0].expression).toBe('value.length() > 3');
  });

  it('reads _supportLinks on a group', () => {
    importFHIR(minQ([{
      linkId: 'g1', type: 'group', text: 'G',
      extension: [
        { url: SUPPORT_URL, valueUri: 'https://example.org/help1' },
        { url: SUPPORT_URL, valueUri: 'https://example.org/help2' },
      ],
      item: [{ linkId: 'g1.q1', type: 'string', text: 'Child' }],
    }]));
    expect(_tree[0]._supportLinks).toEqual([
      'https://example.org/help1',
      'https://example.org/help2',
    ]);
  });

  it('sets _hidden = true on a group using SDC URL', () => {
    importFHIR(minQ([{
      linkId: 'g1', type: 'group', text: 'G',
      extension: [{ url: HIDDEN_URL_SDC, valueBoolean: true }],
      item: [{ linkId: 'g1.q1', type: 'string', text: 'Child' }],
    }]));
    expect(_tree[0]._hidden).toBe(true);
    expect(_tree[0].children[0]._hidden).toBeUndefined();
  });
});

// ── unknown extensions pass-through ──────────────────────────────────────────
describe('importFHIR — unknown extensions', () => {
  beforeEach(() => { _tree.splice(0); });

  const minQ = items => ({ resourceType: 'Questionnaire', title: 'T', item: items });

  it('collects unknown extension on an item into _unknownExtensions', () => {
    importFHIR(minQ([{
      linkId: 'q1', type: 'string', text: 'Q',
      extension: [{ url: 'https://vendor.example.com/custom', valueString: 'val' }],
    }]));
    expect(_tree[0]._unknownExtensions).toHaveLength(1);
    expect(_tree[0]._unknownExtensions[0].url).toBe('https://vendor.example.com/custom');
    expect(_tree[0]._unknownExtensions[0].valueString).toBe('val');
  });

  it('does not collect known extensions (e.g. minLength) as unknown', () => {
    importFHIR(minQ([{
      linkId: 'q1', type: 'string', text: 'Q',
      extension: [{ url: FHIR.minLength, valueInteger: 3 }],
    }]));
    expect(_tree[0]._unknownExtensions).toBeUndefined();
    expect(_tree[0]._minLength).toBe(3);
  });

  it('separates known and unknown extensions on the same item', () => {
    importFHIR(minQ([{
      linkId: 'q1', type: 'string', text: 'Q',
      extension: [
        { url: FHIR.minLength, valueInteger: 2 },
        { url: 'https://vendor.example.com/custom', valueString: 'val' },
      ],
    }]));
    expect(_tree[0]._minLength).toBe(2);
    expect(_tree[0]._unknownExtensions).toHaveLength(1);
    expect(_tree[0]._unknownExtensions[0].url).toBe('https://vendor.example.com/custom');
  });

  it('collects unknown extension on a group into _unknownExtensions', () => {
    importFHIR(minQ([{
      linkId: 'g1', type: 'group', text: 'G',
      extension: [{ url: 'https://vendor.example.com/group-ext', valueInteger: 99 }],
      item: [{ linkId: 'q1', type: 'string', text: 'Q' }],
    }]));
    expect(_tree[0]._unknownExtensions).toHaveLength(1);
    expect(_tree[0]._unknownExtensions[0].url).toBe('https://vendor.example.com/group-ext');
    expect(_tree[0]._unknownExtensions[0].valueInteger).toBe(99);
  });

  it('leaves _unknownExtensions undefined when no extensions are present', () => {
    importFHIR(minQ([{ linkId: 'q1', type: 'string', text: 'Q' }]));
    expect(_tree[0]._unknownExtensions).toBeUndefined();
  });
});


// ── replaces extension ────────────────────────────────────────────────────────
describe('importFHIR — replaces extension', () => {
  const REPLACES_URL = FHIR.replaces;
  beforeEach(() => { _tree.splice(0); _questMeta.replaces = []; });

  const minQ = (exts = []) => ({
    resourceType: 'Questionnaire', title: 'T',
    extension: exts,
    item: [{ linkId: 'q1', type: 'string', text: 'Q' }],
  });

  it('reads a single replaces extension into questMeta.replaces', () => {
    importFHIR(minQ([{ url: REPLACES_URL, valueCanonical: 'https://example.org/fhir/Questionnaire/prior|1.0' }]));
    expect(_questMeta.replaces).toEqual(['https://example.org/fhir/Questionnaire/prior|1.0']);
  });

  it('reads multiple replaces extensions into questMeta.replaces array', () => {
    importFHIR(minQ([
      { url: REPLACES_URL, valueCanonical: 'https://example.org/fhir/Questionnaire/v1' },
      { url: REPLACES_URL, valueCanonical: 'https://example.org/fhir/Questionnaire/v2' },
    ]));
    expect(_questMeta.replaces).toHaveLength(2);
    expect(_questMeta.replaces[0]).toBe('https://example.org/fhir/Questionnaire/v1');
    expect(_questMeta.replaces[1]).toBe('https://example.org/fhir/Questionnaire/v2');
  });

  it('sets replaces to [] when no replaces extensions are present', () => {
    importFHIR(minQ([]));
    expect(_questMeta.replaces).toEqual([]);
  });

  it('excludes replaces entries from _rawQuestExtensions', () => {
    importFHIR(minQ([{ url: REPLACES_URL, valueCanonical: 'https://example.org/fhir/Questionnaire/prior' }]));
    const raw = _questMeta._rawQuestExtensions || [];
    expect(raw.some(e => e.url === REPLACES_URL)).toBe(false);
  });

  it('does not include entries without valueCanonical in replaces', () => {
    importFHIR(minQ([{ url: REPLACES_URL }]));
    expect(_questMeta.replaces).toHaveLength(0);
  });
});

// ── sdc-questionnaire-collapsible ─────────────────────────────────────────────
describe('importFHIR — sdc-questionnaire-collapsible', () => {
  const COLL_URL = FHIR.collapsible;
  beforeEach(() => { _tree.splice(0); });

  const minQ = items => ({ resourceType: 'Questionnaire', title: 'T', item: items });

  it('reads default-closed into group._collapsible', () => {
    importFHIR(minQ([{
      linkId: 'g1', type: 'group', text: 'G',
      extension: [{ url: COLL_URL, valueCode: 'default-closed' }],
      item: [{ linkId: 'q1', type: 'string', text: 'Q' }],
    }]));
    expect(_tree[0]._collapsible).toBe('default-closed');
  });

  it('reads default-open into group._collapsible', () => {
    importFHIR(minQ([{
      linkId: 'g1', type: 'group', text: 'G',
      extension: [{ url: COLL_URL, valueCode: 'default-open' }],
      item: [{ linkId: 'q1', type: 'string', text: 'Q' }],
    }]));
    expect(_tree[0]._collapsible).toBe('default-open');
  });

  it('leaves _collapsible undefined when extension absent', () => {
    importFHIR(minQ([{
      linkId: 'g1', type: 'group', text: 'G',
      item: [{ linkId: 'q1', type: 'string', text: 'Q' }],
    }]));
    expect(_tree[0]._collapsible).toBeUndefined();
  });

  it('does not add collapsible to _unknownExtensions', () => {
    importFHIR(minQ([{
      linkId: 'g1', type: 'group', text: 'G',
      extension: [{ url: COLL_URL, valueCode: 'default-closed' }],
      item: [{ linkId: 'q1', type: 'string', text: 'Q' }],
    }]));
    const unknown = _tree[0]._unknownExtensions || [];
    expect(unknown.some(e => e.url === COLL_URL)).toBe(false);
  });
});

// ── sdc-questionnaire-openLabel ───────────────────────────────────────────────
describe('importFHIR — sdc-questionnaire-openLabel', () => {
  const OL_URL = FHIR.openLabel;
  beforeEach(() => { _tree.splice(0); });

  const minQ = items => ({ resourceType: 'Questionnaire', title: 'T', item: items });

  it('reads openLabel into node._openLabel for open-choice', () => {
    importFHIR(minQ([{
      linkId: 'q1', type: 'open-choice', text: 'Q',
      extension: [{ url: OL_URL, valueString: 'Other (please specify)' }],
    }]));
    expect(_tree[0]._openLabel).toBe('Other (please specify)');
  });

  it('leaves _openLabel undefined when extension absent', () => {
    importFHIR(minQ([{ linkId: 'q1', type: 'open-choice', text: 'Q' }]));
    expect(_tree[0]._openLabel).toBeUndefined();
  });

  it('does not read openLabel for non-open-choice types', () => {
    importFHIR(minQ([{
      linkId: 'q1', type: 'string', text: 'Q',
      extension: [{ url: OL_URL, valueString: 'Other' }],
    }]));
    expect(_tree[0]._openLabel).toBeUndefined();
  });

  it('does not add openLabel to _unknownExtensions for open-choice', () => {
    importFHIR(minQ([{
      linkId: 'q1', type: 'open-choice', text: 'Q',
      extension: [{ url: OL_URL, valueString: 'Other' }],
    }]));
    const unknown = _tree[0]._unknownExtensions || [];
    expect(unknown.some(e => e.url === OL_URL)).toBe(false);
  });
});

// ── designNote ───────────────────────────────────────────────────────────────
describe('importFHIR — designNote', () => {
  const DN_URL = FHIR.designNote;
  beforeEach(() => { _tree.splice(0); });
  const minQ = items => ({ resourceType: 'Questionnaire', title: 'T', item: items });

  it('reads valueMarkdown into item._designNote', () => {
    importFHIR(minQ([{
      linkId: 'q1', type: 'string', text: 'Q',
      extension: [{ url: DN_URL, valueMarkdown: 'Check with clinical team.' }],
    }]));
    expect(_tree[0]._designNote).toBe('Check with clinical team.');
  });

  it('reads valueString into item._designNote as fallback', () => {
    importFHIR(minQ([{
      linkId: 'q1', type: 'string', text: 'Q',
      extension: [{ url: DN_URL, valueString: 'Legacy note.' }],
    }]));
    expect(_tree[0]._designNote).toBe('Legacy note.');
  });

  it('leaves _designNote undefined when extension absent on item', () => {
    importFHIR(minQ([{ linkId: 'q1', type: 'string', text: 'Q' }]));
    expect(_tree[0]._designNote).toBeUndefined();
  });

  it('reads valueMarkdown into group._designNote', () => {
    importFHIR(minQ([{
      linkId: 'g1', type: 'group', text: 'G',
      extension: [{ url: DN_URL, valueMarkdown: 'Group-level note.' }],
      item: [{ linkId: 'q1', type: 'string', text: 'Q' }],
    }]));
    expect(_tree[0]._designNote).toBe('Group-level note.');
  });

  it('leaves _designNote undefined when extension absent on group', () => {
    importFHIR(minQ([{
      linkId: 'g1', type: 'group', text: 'G',
      item: [{ linkId: 'q1', type: 'string', text: 'Q' }],
    }]));
    expect(_tree[0]._designNote).toBeUndefined();
  });

  it('does not add designNote to item _unknownExtensions', () => {
    importFHIR(minQ([{
      linkId: 'q1', type: 'string', text: 'Q',
      extension: [{ url: DN_URL, valueMarkdown: 'Note.' }],
    }]));
    const unknown = _tree[0]._unknownExtensions || [];
    expect(unknown.some(e => e.url === DN_URL)).toBe(false);
  });
});

// ── answerExpression import ───────────────────────────────────────────────────
describe('importFHIR — answerExpression', () => {
  const AE_URL = FHIR.answerExpression;
  const minQ = (items = []) => ({ resourceType: 'Questionnaire', title: 'T', item: items });

  beforeEach(() => { _tree.splice(0); });

  it('reads answerExpression extension → node._answerExpression', () => {
    importFHIR(minQ([{
      linkId: 'q1', type: 'choice', text: 'Q',
      extension: [{
        url: AE_URL,
        valueExpression: { language: 'text/fhirpath', expression: "'a' | 'b' | 'c'" },
      }],
    }]));
    expect(_tree[0]._answerExpression).toBe("'a' | 'b' | 'c'");
  });

  it('does not set _answerExpression when extension is absent', () => {
    importFHIR(minQ([{ linkId: 'q1', type: 'choice', text: 'Q',
      answerOption: [{ valueCoding: { code: 'x', display: 'X' } }] }]));
    expect(_tree[0]._answerExpression).toBeUndefined();
  });

  it('does not add answerExpression URL to _unknownExtensions', () => {
    importFHIR(minQ([{
      linkId: 'q1', type: 'choice', text: 'Q',
      extension: [{ url: AE_URL, valueExpression: { language: 'text/fhirpath', expression: '%x' } }],
    }]));
    const unknown = _tree[0]._unknownExtensions || [];
    expect(unknown.some(e => e.url === AE_URL)).toBe(false);
  });

  it('stores empty string when valueExpression.expression is absent', () => {
    importFHIR(minQ([{
      linkId: 'q1', type: 'choice', text: 'Q',
      extension: [{ url: AE_URL, valueExpression: { language: 'text/fhirpath' } }],
    }]));
    expect(_tree[0]._answerExpression).toBe('');
  });
});

// ── candidateExpression import ────────────────────────────────────────────────
describe('importFHIR — candidateExpression', () => {
  const CE_URL = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-candidateExpression';
  const minQ = (items = []) => ({ resourceType: 'Questionnaire', title: 'T', item: items });

  beforeEach(() => { _tree.splice(0); });

  it('reads candidateExpression extension → node._candidateExpression', () => {
    importFHIR(minQ([{
      linkId: 'q1', type: 'choice', text: 'Q',
      extension: [{
        url: CE_URL,
        valueExpression: { language: 'text/fhirpath', expression: "'a' | 'b' | 'c'" },
      }],
    }]));
    expect(_tree[0]._candidateExpression).toBe("'a' | 'b' | 'c'");
  });

  it('does not set _candidateExpression when extension is absent', () => {
    importFHIR(minQ([{ linkId: 'q1', type: 'choice', text: 'Q',
      answerOption: [{ valueCoding: { code: 'x', display: 'X' } }] }]));
    expect(_tree[0]._candidateExpression).toBeUndefined();
  });

  it('does not add candidateExpression URL to _unknownExtensions', () => {
    importFHIR(minQ([{
      linkId: 'q1', type: 'choice', text: 'Q',
      extension: [{ url: CE_URL, valueExpression: { language: 'text/fhirpath', expression: '%x' } }],
    }]));
    const unknown = _tree[0]._unknownExtensions || [];
    expect(unknown.some(e => e.url === CE_URL)).toBe(false);
  });
});

// ── isSubject import ──────────────────────────────────────────────────────────
describe('importFHIR — isSubject', () => {
  const IS_URL = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-isSubject';
  const minQ = (items = []) => ({ resourceType: 'Questionnaire', title: 'T', item: items });

  beforeEach(() => { _tree.splice(0); });

  it('reads isSubject extension → node._isSubject', () => {
    importFHIR(minQ([{
      linkId: 'q1', type: 'reference', text: 'Q',
      extension: [{ url: IS_URL, valueBoolean: true }],
    }]));
    expect(_tree[0]._isSubject).toBe(true);
  });

  it('does not set _isSubject when extension is absent', () => {
    importFHIR(minQ([{ linkId: 'q1', type: 'reference', text: 'Q' }]));
    expect(_tree[0]._isSubject).toBeUndefined();
  });

  it('does not add isSubject URL to _unknownExtensions', () => {
    importFHIR(minQ([{
      linkId: 'q1', type: 'reference', text: 'Q',
      extension: [{ url: IS_URL, valueBoolean: true }],
    }]));
    const unknown = _tree[0]._unknownExtensions || [];
    expect(unknown.some(e => e.url === IS_URL)).toBe(false);
  });
});

// ── columnCount import ────────────────────────────────────────────────────────
describe('importFHIR — columnCount', () => {
  const CC_URL = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-columnCount';
  const minQ = (items = []) => ({ resourceType: 'Questionnaire', title: 'T', item: items });

  beforeEach(() => { _tree.splice(0); });

  it('reads columnCount extension → node._columnCount', () => {
    importFHIR(minQ([{
      linkId: 'q1', type: 'choice', text: 'Q',
      answerOption: [{ valueCoding: { code: 'a', display: 'A' } }],
      extension: [{ url: CC_URL, valueInteger: 3 }],
    }]));
    expect(_tree[0]._columnCount).toBe(3);
  });

  it('ignores columnCount of 1 or less', () => {
    importFHIR(minQ([{
      linkId: 'q1', type: 'choice', text: 'Q',
      answerOption: [{ valueCoding: { code: 'a', display: 'A' } }],
      extension: [{ url: CC_URL, valueInteger: 1 }],
    }]));
    expect(_tree[0]._columnCount).toBeUndefined();
  });

  it('does not set _columnCount when extension is absent', () => {
    importFHIR(minQ([{ linkId: 'q1', type: 'choice', text: 'Q',
      answerOption: [{ valueCoding: { code: 'a', display: 'A' } }] }]));
    expect(_tree[0]._columnCount).toBeUndefined();
  });

  it('does not add columnCount URL to _unknownExtensions', () => {
    importFHIR(minQ([{
      linkId: 'q1', type: 'choice', text: 'Q',
      answerOption: [{ valueCoding: { code: 'a', display: 'A' } }],
      extension: [{ url: CC_URL, valueInteger: 2 }],
    }]));
    const unknown = _tree[0]._unknownExtensions || [];
    expect(unknown.some(e => e.url === CC_URL)).toBe(false);
  });
});

// ── regex ──────────────────────────────────────────────────────────────────
describe('_regex', () => {
  const RX_URL = FHIR.regex;
  const minQ = (items = []) => ({ resourceType: 'Questionnaire', title: 'T', item: items });

  beforeEach(() => { _tree.splice(0); });

  it('reads regex valueString into node._regex', () => {
    importFHIR(minQ([{
      linkId: 'q1', type: 'string', text: 'Q',
      extension: [{ url: RX_URL, valueString: '^[A-Z]{2}\\d{4}$' }],
    }]));
    expect(_tree[0]._regex).toBe('^[A-Z]{2}\\d{4}$');
  });

  it('does not set _regex when extension is absent', () => {
    importFHIR(minQ([{ linkId: 'q1', type: 'string', text: 'Q' }]));
    expect(_tree[0]._regex).toBeUndefined();
  });

  it('does not add regex URL to _unknownExtensions', () => {
    importFHIR(minQ([{
      linkId: 'q1', type: 'string', text: 'Q',
      extension: [{ url: RX_URL, valueString: '.*' }],
    }]));
    const unknown = _tree[0]._unknownExtensions || [];
    expect(unknown.some(e => e.url === RX_URL)).toBe(false);
  });
});

// ── optionExclusive ─────────────────────────────────────────────────────────
describe('_optionExclusives', () => {
  const OE_URL = FHIR.optionExclusive;
  const minQ = (items = []) => ({ resourceType: 'Questionnaire', title: 'T', item: items });

  beforeEach(() => { _tree.splice(0); });

  it('reads optionExclusive into _optionExclusives map', () => {
    importFHIR(minQ([{
      linkId: 'q1', type: 'choice', text: 'Q', repeats: true,
      answerOption: [
        { valueCoding: { code: 'a', display: 'A' } },
        { valueCoding: { code: 'none', display: 'None' }, extension: [{ url: OE_URL, valueBoolean: true }] },
      ],
    }]));
    expect(_tree[0]._optionExclusives).toEqual({ none: true });
  });

  it('does not set _optionExclusives when no option has the extension', () => {
    importFHIR(minQ([{
      linkId: 'q1', type: 'choice', text: 'Q',
      answerOption: [
        { valueCoding: { code: 'a', display: 'A' } },
      ],
    }]));
    expect(_tree[0]._optionExclusives).toBeUndefined();
  });
});

// ── usageMode ──────────────────────────────────────────────────────────────
describe('usageMode', () => {
  const UM_URL = FHIR.usageMode;
  const minQ = (items = []) => ({ resourceType: 'Questionnaire', title: 'T', item: items });
  beforeEach(() => { _tree.splice(0); });

  it('reads usageMode valueCode into _usageMode', () => {
    importFHIR(minQ([{ linkId: 'q1', type: 'string', text: 'Q', extension: [{ url: UM_URL, valueCode: 'capture' }] }]));
    expect(_tree[0]._usageMode).toBe('capture');
  });

  it('does not set _usageMode when absent', () => {
    importFHIR(minQ([{ linkId: 'q1', type: 'string', text: 'Q' }]));
    expect(_tree[0]._usageMode).toBeUndefined();
  });

  it('does not add usageMode URL to _unknownExtensions', () => {
    importFHIR(minQ([{ linkId: 'q1', type: 'string', text: 'Q', extension: [{ url: UM_URL, valueCode: 'display' }] }]));
    expect((_tree[0]._unknownExtensions || []).some(e => e.url === UM_URL)).toBe(false);
  });
});

// ── itemMedia ──────────────────────────────────────────────────────────────
describe('itemMedia', () => {
  const IM_URL = FHIR.itemMedia;
  const minQ = (items = []) => ({ resourceType: 'Questionnaire', title: 'T', item: items });
  beforeEach(() => { _tree.splice(0); });

  it('reads itemMedia valueAttachment into _itemMedia', () => {
    importFHIR(minQ([{ linkId: 'q1', type: 'display', text: 'Q', extension: [{ url: IM_URL, valueAttachment: { url: 'https://ex.com/img.png', contentType: 'image/png' } }] }]));
    expect(_tree[0]._itemMedia).toEqual({ url: 'https://ex.com/img.png', contentType: 'image/png' });
  });
});

// ── itemWeight (answerOption-level) ────────────────────────────────────────
describe('itemWeight', () => {
  const IW_URL = FHIR.itemWeight;
  const minQ = (items = []) => ({ resourceType: 'Questionnaire', title: 'T', item: items });
  beforeEach(() => { _tree.splice(0); });

  it('reads itemWeight into _optionWeights map', () => {
    importFHIR(minQ([{
      linkId: 'q1', type: 'choice', text: 'Q',
      answerOption: [
        { valueCoding: { code: 'a', display: 'A' }, extension: [{ url: IW_URL, valueDecimal: 1.5 }] },
        { valueCoding: { code: 'b', display: 'B' }, extension: [{ url: IW_URL, valueDecimal: 3 }] },
      ],
    }]));
    expect(_tree[0]._optionWeights).toEqual({ a: 1.5, b: 3 });
  });

  it('does not set _optionWeights when no option has itemWeight', () => {
    importFHIR(minQ([{ linkId: 'q1', type: 'choice', text: 'Q', answerOption: [{ valueCoding: { code: 'a', display: 'A' } }] }]));
    expect(_tree[0]._optionWeights).toBeUndefined();
  });

  it('reads itemWeight from valueCoding.extension fallback', () => {
    importFHIR(minQ([{
      linkId: 'q1', type: 'choice', text: 'Q',
      answerOption: [
        { valueCoding: { code: 'x', display: 'X', extension: [{ url: IW_URL, valueDecimal: 5 }] } },
      ],
    }]));
    expect(_tree[0]._optionWeights).toEqual({ x: 5 });
  });
});

// ── referenceFilter ───────────────────────────────────────────────────────────
describe('referenceFilter', () => {
  const RF_URL = FHIR.referenceFilter;
  const minQ = (items = []) => ({ resourceType: 'Questionnaire', title: 'T', item: items });
  beforeEach(() => { _tree.splice(0); });

  it('reads referenceFilter into _referenceFilter', () => {
    importFHIR(minQ([{
      linkId: 'q1', type: 'reference', text: 'Ref',
      extension: [{ url: RF_URL, valueString: "status = 'active'" }],
    }]));
    expect(_tree[0]._referenceFilter).toBe("status = 'active'");
  });

  it('does not set _referenceFilter when absent', () => {
    importFHIR(minQ([{ linkId: 'q1', type: 'reference', text: 'Ref' }]));
    expect(_tree[0]._referenceFilter).toBeUndefined();
  });
});

// ── referenceProfile ──────────────────────────────────────────────────────────
describe('referenceProfile', () => {
  const RP_URL = FHIR.referenceProfile;
  const minQ = (items = []) => ({ resourceType: 'Questionnaire', title: 'T', item: items });
  beforeEach(() => { _tree.splice(0); });

  it('reads referenceProfile into _referenceProfiles array', () => {
    importFHIR(minQ([{
      linkId: 'q1', type: 'reference', text: 'Ref',
      extension: [
        { url: RP_URL, valueCanonical: 'https://example.com/Profile1' },
        { url: RP_URL, valueCanonical: 'https://example.com/Profile2' },
      ],
    }]));
    expect(_tree[0]._referenceProfiles).toEqual(['https://example.com/Profile1', 'https://example.com/Profile2']);
  });

  it('does not set _referenceProfiles when absent', () => {
    importFHIR(minQ([{ linkId: 'q1', type: 'reference', text: 'Ref' }]));
    expect(_tree[0]._referenceProfiles).toBeUndefined();
  });
});

// ── signatureRequired (item-level) ────────────────────────────────────────────
describe('signatureRequired (item)', () => {
  const SIG_URL = FHIR.signatureRequired;
  const minQ = (items = []) => ({ resourceType: 'Questionnaire', title: 'T', item: items });
  beforeEach(() => { _tree.splice(0); });

  it('reads signatureRequired into _signatureRequired array', () => {
    importFHIR(minQ([{
      linkId: 'q1', type: 'string', text: 'Q',
      extension: [{
        url: SIG_URL,
        valueCodeableConcept: { coding: [{ system: 'urn:iso-astm:E1762-95:2013', code: '1.2.840.10065.1.12.1.1', display: "Author's Signature" }] },
      }],
    }]));
    expect(_tree[0]._signatureRequired).toEqual([{ system: 'urn:iso-astm:E1762-95:2013', code: '1.2.840.10065.1.12.1.1', display: "Author's Signature" }]);
  });

  it('reads multiple signatureRequired entries', () => {
    importFHIR(minQ([{
      linkId: 'q1', type: 'string', text: 'Q',
      extension: [
        { url: SIG_URL, valueCodeableConcept: { coding: [{ system: 'urn:iso-astm:E1762-95:2013', code: '1.2.840.10065.1.12.1.1', display: "Author's Signature" }] } },
        { url: SIG_URL, valueCodeableConcept: { coding: [{ system: 'urn:iso-astm:E1762-95:2013', code: '1.2.840.10065.1.12.1.5', display: 'Verification Signature' }] } },
      ],
    }]));
    expect(_tree[0]._signatureRequired).toHaveLength(2);
  });

  it('does not set _signatureRequired when absent', () => {
    importFHIR(minQ([{ linkId: 'q1', type: 'string', text: 'Q' }]));
    expect(_tree[0]._signatureRequired).toBeUndefined();
  });
});

// ── answerConstraint (R5 native + R4/R4B builder-private extension) ───────────
describe('import answerConstraint', () => {
  const minQ = (items = []) => ({ resourceType: 'Questionnaire', title: 'T', item: items });
  const AC_EXT_URL =
    'https://sergeymosyakov.github.io/fhir-questionnaire-builder/StructureDefinition/item-answerConstraint';
  const DD_EXT_URL =
    'https://sergeymosyakov.github.io/fhir-questionnaire-builder/StructureDefinition/item-disabledDisplay';

  it('reads answerConstraint from fhirItem', () => {
    importFHIR(minQ([{ linkId: 'q1', type: 'choice', text: 'Q', answerConstraint: 'optionsOnly' }]));
    expect(_tree[0]._answerConstraint).toBe('optionsOnly');
  });

  it('reads optionsOrString value', () => {
    importFHIR(minQ([{ linkId: 'q1', type: 'choice', text: 'Q', answerConstraint: 'optionsOrString' }]));
    expect(_tree[0]._answerConstraint).toBe('optionsOrString');
  });

  it('does not set _answerConstraint when absent', () => {
    importFHIR(minQ([{ linkId: 'q1', type: 'choice', text: 'Q' }]));
    expect(_tree[0]._answerConstraint).toBeUndefined();
  });

  it('reads answerConstraint from the builder-private downgrade extension', () => {
    importFHIR(minQ([{
      linkId: 'q1', type: 'choice', text: 'Q',
      extension: [{ url: AC_EXT_URL, valueCode: 'optionsOrType' }],
    }]));
    expect(_tree[0]._answerConstraint).toBe('optionsOrType');
  });

  it('reads disabledDisplay from the builder-private downgrade extension', () => {
    importFHIR(minQ([{
      linkId: 'q1', type: 'choice', text: 'Q',
      extension: [{ url: DD_EXT_URL, valueCode: 'hidden' }],
    }]));
    expect(_tree[0]._disabledDisplay).toBe('hidden');
  });
});

// ── questionnaire-baseType / questionnaire-fhirType ───────────────────────────
describe('import baseType / fhirType', () => {
  const BASE_TYPE_URL = FHIR.baseType;
  const FHIR_TYPE_URL = FHIR.fhirType;
  const minQ = (items = []) => ({ resourceType: 'Questionnaire', title: 'T', item: items });
  beforeEach(() => { _tree.splice(0); });

  it('reads baseType into _baseType on item', () => {
    importFHIR(minQ([{
      linkId: 'q1', type: 'string', text: 'Q',
      definition: 'http://hl7.org/fhir/StructureDefinition/Patient#Patient.name.family',
      extension: [{ url: BASE_TYPE_URL, valueCode: 'string' }],
    }]));
    expect(_tree[0]._baseType).toBe('string');
  });

  it('reads fhirType into _fhirType on item', () => {
    importFHIR(minQ([{
      linkId: 'q1', type: 'group', text: 'Q',
      definition: 'http://hl7.org/fhir/StructureDefinition/Patient#Patient.name',
      extension: [{ url: FHIR_TYPE_URL, valueCode: 'HumanName' }],
    }]));
    expect(_tree[0]._fhirType).toBe('HumanName');
  });

  it('reads both baseType and fhirType when both present', () => {
    importFHIR(minQ([{
      linkId: 'q1', type: 'group', text: 'Q',
      extension: [
        { url: BASE_TYPE_URL, valueCode: 'HumanName' },
        { url: FHIR_TYPE_URL, valueCode: 'HumanName' },
      ],
    }]));
    expect(_tree[0]._baseType).toBe('HumanName');
    expect(_tree[0]._fhirType).toBe('HumanName');
  });

  it('does not set _baseType when absent', () => {
    importFHIR(minQ([{ linkId: 'q1', type: 'string', text: 'Q' }]));
    expect(_tree[0]._baseType).toBeUndefined();
  });

  it('does not set _fhirType when absent', () => {
    importFHIR(minQ([{ linkId: 'q1', type: 'string', text: 'Q' }]));
    expect(_tree[0]._fhirType).toBeUndefined();
  });
});

// ── versionAlgorithm[x] / copyrightLabel (R5 native + R4 artifact extensions) ──
describe('import versionAlgorithm / copyrightLabel', () => {
  const VA_EXT = FHIR.artifactVersionAlgorithm;
  const CL_EXT = FHIR.artifactCopyrightLabel;
  const q = (extra = {}) => ({ resourceType: 'Questionnaire', title: 'T', item: [], ...extra });
  beforeEach(() => { _tree.splice(0); });

  it('reads R5 native versionAlgorithmCoding + copyrightLabel', () => {
    importFHIR(q({
      versionAlgorithmCoding: { system: FHIR.versionAlgorithm, code: 'semver' },
      copyrightLabel: 'All rights reserved',
    }));
    expect(_questMeta._versionAlgorithmCoding.code).toBe('semver');
    expect(_questMeta._versionAlgorithmString).toBe('');
    expect(_questMeta.copyrightLabel).toBe('All rights reserved');
  });

  it('reads R5 native versionAlgorithmString', () => {
    importFHIR(q({ versionAlgorithmString: '%v1 > %v2' }));
    expect(_questMeta._versionAlgorithmString).toBe('%v1 > %v2');
    expect(_questMeta._versionAlgorithmCoding).toBeNull();
  });

  it('reads R4 artifact-versionAlgorithm + artifact-copyrightLabel extensions', () => {
    importFHIR(q({
      extension: [
        { url: VA_EXT, valueCoding: { system: FHIR.versionAlgorithm, code: 'integer' } },
        { url: CL_EXT, valueString: 'Some rights reserved' },
      ],
    }));
    expect(_questMeta._versionAlgorithmCoding.code).toBe('integer');
    expect(_questMeta.copyrightLabel).toBe('Some rights reserved');
  });

  it('excludes the artifact-* extensions from _rawQuestExtensions', () => {
    importFHIR(q({
      extension: [
        { url: VA_EXT, valueString: 'natural' },
        { url: CL_EXT, valueString: 'x' },
      ],
    }));
    const raw = _questMeta._rawQuestExtensions || [];
    expect(raw.some(e => e.url === VA_EXT)).toBe(false);
    expect(raw.some(e => e.url === CL_EXT)).toBe(false);
  });

  it('defaults to empty when neither field nor extension present', () => {
    importFHIR(q());
    expect(_questMeta._versionAlgorithmString).toBe('');
    expect(_questMeta._versionAlgorithmCoding).toBeNull();
    expect(_questMeta.copyrightLabel).toBe('');
  });
});
