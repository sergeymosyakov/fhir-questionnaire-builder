// Tests for buildFHIRObject — meta, initial values, display extensions.
// Shares the same mock setup as export.test.js.

import { describe, it, expect, vi, afterEach } from 'vitest';

const _tree = [];
const _questVariables = [];
const _questContained = [];
const _questMeta = { id: '', url: '', version: '', title: '', status: 'draft', publisher: '', description: '',
  name: '', date: '', subjectType: [], purpose: '', copyright: '', approvalDate: '', lastReviewDate: '',
  effectivePeriodStart: '', effectivePeriodEnd: '', replaces: [], _rawQuestExtensions: [], _implicitRules: '',
  _rawText: null,
  _rawContact: null, _rawUseContext: null, _rawJurisdiction: null, _rawCode: null };
const _questDoc = { tree: _tree, meta: _questMeta, rawFhir: null, variables: _questVariables, contained: _questContained };

vi.mock('../js/state.js', () => ({
  questDoc:        _questDoc,
  answerStore:     { data: {}, get: () => undefined, getAll: () => [] },
  calcFormOk:      () => true,
  isMandatory:     () => false,
  CHECKABLE_TYPES: new Set(),
  resetSeq:        () => {},
  NONEMPTY_TYPES:  new Set(),
}));

const { buildFHIRObject, configure: configureExport } = await import('../js/fhir/export.js');
const { generateNarrativeDiv } = await import('../js/fhir/export.js');
configureExport({ questDoc: _questDoc });

function build(nodes, title = 'Test Q', vars = []) {
  _tree.splice(0, _tree.length, ...nodes);
  _questVariables.splice(0, _questVariables.length, ...vars);
  _questDoc.rawFhir = { title };
  return buildFHIRObject();
}

describe('buildFHIRObject — _initialValue export', () => {
  const item = (itemType, _initialValue) => ({ id: 'q1', type: 'item', title: 'Q', itemType, _initialValue });

  it('exports boolean initial as valueBoolean', () => {
    const q = build([item('checkbox', true)]);
    expect(q.item[0].initial[0].valueBoolean).toBe(true);
  });

  it('exports decimal initial as valueDecimal', () => {
    const q = build([item('decimal', '3.14')]);
    expect(q.item[0].initial[0].valueDecimal).toBeCloseTo(3.14);
  });

  it('exports integer initial as valueInteger', () => {
    const q = build([item('integer', '42')]);
    expect(q.item[0].initial[0].valueInteger).toBe(42);
  });

  it('exports date initial as valueDate', () => {
    const q = build([item('date', '2024-01-15')]);
    expect(q.item[0].initial[0].valueDate).toBe('2024-01-15');
  });

  it('exports url initial as valueUri', () => {
    const q = build([item('url', 'https://example.com')]);
    expect(q.item[0].initial[0].valueUri).toBe('https://example.com');
  });

  it('exports select initial as valueCoding', () => {
    const q = build([item('select', 'opt1')]);
    expect(q.item[0].initial[0].valueCoding.code).toBe('opt1');
  });

  it('exports text initial as valueString', () => {
    const q = build([item('text', 'hello')]);
    expect(q.item[0].initial[0].valueString).toBe('hello');
  });

  it('omits initial when _initialValue is undefined', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'text' }]);
    expect(q.item[0].initial).toBeUndefined();
  });

  it('omits initial when _initialValue is empty string', () => {
    const q = build([item('text', '')]);
    expect(q.item[0].initial).toBeUndefined();
  });

  it('omits initial[] when item has answerOption (que-11)', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'select', _initialValue: 'opt1', options: 'opt1|opt2' }]);
    expect(q.item[0].initial).toBeUndefined();
  });

  it('omits initial[] when item has _rawAnswerOptions (que-11)', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'select', _initialValue: 'opt1', _rawAnswerOptions: [{ valueCoding: { code: 'opt1' } }] }]);
    expect(q.item[0].initial).toBeUndefined();
  });

  it('omits initial[] when item has _answerValueSet (que-11)', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'select', _initialValue: 'opt1', _answerValueSet: 'http://example.com/vs' }]);
    expect(q.item[0].initial).toBeUndefined();
  });

  it('exports initial[] when item is text (no answer options, que-11 does not apply)', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'text', _initialValue: 'hello' }]);
    expect(q.item[0].initial?.[0]?.valueString).toBe('hello');
  });
});

// ── questMeta round-trip ──────────────────────────────────────────────────────
describe('buildFHIRObject — questMeta', () => {
  const EMPTY_META = { id: '', url: '', version: '', title: '', status: 'draft', publisher: '', description: '',
    name: '', date: '', subjectType: [], purpose: '', copyright: '', approvalDate: '', lastReviewDate: '',
    effectivePeriodStart: '', effectivePeriodEnd: '',
    copyrightLabel: '', _versionAlgorithmString: '', _versionAlgorithmCoding: null,
    _rawContact: null, _rawUseContext: null, _rawJurisdiction: null, _rawCode: null };

  afterEach(() => { Object.assign(_questMeta, EMPTY_META); });

  it('uses questMeta.id in export', () => {
    _questMeta.id = 'my-questionnaire';
    const q = buildFHIRObject();
    expect(q.id).toBe('my-questionnaire');
  });

  it('falls back to logic-builder-export when questMeta.id is empty', () => {
    _questMeta.id = '';
    const q = buildFHIRObject();
    expect(q.id).toBe('logic-builder-export');
  });

  it('uses questMeta.title (takes precedence over rawFhir.title)', () => {
    _questDoc.rawFhir = { title: 'Raw Title' };
    _questMeta.title = 'Meta Title';
    const q = buildFHIRObject();
    expect(q.title).toBe('Meta Title');
    _questDoc.rawFhir = null;
  });

  it('falls back to rawFhir.title when questMeta.title is empty', () => {
    _questDoc.rawFhir = { title: 'Raw Title' };
    _questMeta.title = '';
    const q = buildFHIRObject();
    expect(q.title).toBe('Raw Title');
    _questDoc.rawFhir = null;
  });

  it('uses questMeta.status in export', () => {
    _questMeta.status = 'active';
    const q = buildFHIRObject();
    expect(q.status).toBe('active');
  });

  it('exports url when questMeta.url is set', () => {
    _questMeta.url = 'http://example.org/fhir/Questionnaire/test';
    const q = buildFHIRObject();
    expect(q.url).toBe('http://example.org/fhir/Questionnaire/test');
  });

  it('omits url when questMeta.url is empty', () => {
    _questMeta.url = '';
    const q = buildFHIRObject();
    expect(q.url).toBeUndefined();
  });

  it('exports version when questMeta.version is set', () => {
    _questMeta.version = '2.0.1';
    const q = buildFHIRObject();
    expect(q.version).toBe('2.0.1');
  });

  it('omits version when questMeta.version is empty', () => {
    _questMeta.version = '';
    const q = buildFHIRObject();
    expect(q.version).toBeUndefined();
  });

  it('exports publisher when questMeta.publisher is set', () => {
    _questMeta.publisher = 'HL7 International';
    const q = buildFHIRObject();
    expect(q.publisher).toBe('HL7 International');
  });

  it('omits publisher when questMeta.publisher is empty', () => {
    _questMeta.publisher = '';
    const q = buildFHIRObject();
    expect(q.publisher).toBeUndefined();
  });

  it('exports description when questMeta.description is set', () => {
    _questMeta.description = 'A screening tool.';
    const q = buildFHIRObject();
    expect(q.description).toBe('A screening tool.');
  });

  it('omits description when questMeta.description is empty', () => {
    _questMeta.description = '';
    const q = buildFHIRObject();
    expect(q.description).toBeUndefined();
  });

  it('exports name when questMeta.name is set', () => {
    _questMeta.name = 'MyQuestionnaire';
    const q = buildFHIRObject();
    expect(q.name).toBe('MyQuestionnaire');
  });

  it('omits name when questMeta.name is empty', () => {
    const q = buildFHIRObject();
    expect(q.name).toBeUndefined();
  });

  it('exports subjectType when questMeta.subjectType is set', () => {
    _questMeta.subjectType = ['Patient', 'Practitioner'];
    const q = buildFHIRObject();
    expect(q.subjectType).toEqual(['Patient', 'Practitioner']);
  });

  it('omits subjectType when questMeta.subjectType is empty', () => {
    _questMeta.subjectType = [];
    const q = buildFHIRObject();
    expect(q.subjectType).toBeUndefined();
  });

  it('exports questMeta.date when set (preserves imported date)', () => {
    _questMeta.date = '2024-01-15';
    const q = buildFHIRObject();
    expect(q.date).toBe('2024-01-15');
  });

  it('falls back to today when questMeta.date is empty', () => {
    _questMeta.date = '';
    const today = new Date().toISOString().split('T')[0];
    const q = buildFHIRObject();
    expect(q.date).toBe(today);
  });

  it('exports purpose when set', () => {
    _questMeta.purpose = 'Screening tool';
    const q = buildFHIRObject();
    expect(q.purpose).toBe('Screening tool');
  });

  it('exports copyright when set', () => {
    _questMeta.copyright = '© 2024 HL7';
    const q = buildFHIRObject();
    expect(q.copyright).toBe('© 2024 HL7');
  });

  it('exports copyrightLabel (R5 native) when set', () => {
    _questMeta.copyrightLabel = 'All rights reserved';
    const q = buildFHIRObject();
    expect(q.copyrightLabel).toBe('All rights reserved');
  });

  it('exports versionAlgorithmCoding (R5 native) when set', () => {
    _questMeta._versionAlgorithmCoding = { system: 'http://hl7.org/fhir/version-algorithm', code: 'semver' };
    const q = buildFHIRObject();
    expect(q.versionAlgorithmCoding.code).toBe('semver');
  });

  it('exports versionAlgorithmString (takes precedence over Coding)', () => {
    _questMeta._versionAlgorithmString = '%v1 > %v2';
    _questMeta._versionAlgorithmCoding = { code: 'semver' };
    const q = buildFHIRObject();
    expect(q.versionAlgorithmString).toBe('%v1 > %v2');
    expect(q.versionAlgorithmCoding).toBeUndefined();
  });

  it('exports approvalDate when set', () => {
    _questMeta.approvalDate = '2024-06-01';
    const q = buildFHIRObject();
    expect(q.approvalDate).toBe('2024-06-01');
  });

  it('exports lastReviewDate when set', () => {
    _questMeta.lastReviewDate = '2025-01-01';
    const q = buildFHIRObject();
    expect(q.lastReviewDate).toBe('2025-01-01');
  });

  it('writes back _rawContact pass-through', () => {
    _questMeta._rawContact = [{ name: 'HL7', telecom: [] }];
    const q = buildFHIRObject();
    expect(q.contact).toEqual([{ name: 'HL7', telecom: [] }]);
  });

  it('writes back _rawUseContext pass-through', () => {
    _questMeta._rawUseContext = [{ code: { code: 'venue' } }];
    const q = buildFHIRObject();
    expect(q.useContext).toEqual([{ code: { code: 'venue' } }]);
  });

  it('writes back _rawJurisdiction pass-through', () => {
    _questMeta._rawJurisdiction = [{ coding: [{ system: 'urn:iso:std:iso:3166', code: 'US' }] }];
    const q = buildFHIRObject();
    expect(q.jurisdiction).toEqual([{ coding: [{ system: 'urn:iso:std:iso:3166', code: 'US' }] }]);
  });
});

// ── implicitRules ─────────────────────────────────────────────────────────────
describe('buildFHIRObject — implicitRules', () => {
  afterEach(() => { _questMeta._implicitRules = ''; });

  it('exports implicitRules when set', () => {
    _questMeta._implicitRules = 'https://example.org/rules';
    const q = buildFHIRObject();
    expect(q.implicitRules).toBe('https://example.org/rules');
  });

  it('omits implicitRules when empty', () => {
    _questMeta._implicitRules = '';
    const q = buildFHIRObject();
    expect(q.implicitRules).toBeUndefined();
  });
});

// ── Questionnaire.text (Narrative) ────────────────────────────────────────────────
describe('buildFHIRObject — Questionnaire.text (Narrative)', () => {
  afterEach(() => { _questMeta._rawText = null; _questMeta.title = ''; _questMeta.status = 'draft';
    _questMeta.publisher = ''; _questMeta.description = ''; _tree.splice(0); });

  it('always emits q.text (never undefined)', () => {
    const q = buildFHIRObject();
    expect(q.text).toBeDefined();
  });

  it('uses status "generated" when _rawText is null', () => {
    _questMeta._rawText = null;
    const q = buildFHIRObject();
    expect(q.text.status).toBe('generated');
  });

  it('div starts with correct XHTML namespace when generated', () => {
    const q = buildFHIRObject();
    expect(q.text.div).toMatch(/^<div xmlns="http:\/\/www\.w3\.org\/1999\/xhtml">/);
  });

  it('generated div includes questionnaire title', () => {
    _questMeta.title = 'Depression Screening';
    const q = buildFHIRObject();
    expect(q.text.div).toContain('Depression Screening');
  });

  it('generated div includes status', () => {
    _questMeta.status = 'active';
    const q = buildFHIRObject();
    expect(q.text.div).toContain('active');
  });

  it('generated div includes publisher when set', () => {
    _questMeta.publisher = 'HL7 International';
    const q = buildFHIRObject();
    expect(q.text.div).toContain('HL7 International');
  });

  it('generated div includes description when set', () => {
    _questMeta.description = 'Screens for depression.';
    const q = buildFHIRObject();
    expect(q.text.div).toContain('Screens for depression.');
  });

  it('generated div includes item linkId and text', () => {
    _tree.push({ id: 'q1', type: 'item', itemType: 'text', title: 'Feeling sad?' });
    const q = buildFHIRObject();
    expect(q.text.div).toContain('q1');
    expect(q.text.div).toContain('Feeling sad?');
  });

  it('generated div includes item type', () => {
    _tree.push({ id: 'q1', type: 'item', itemType: 'select', title: 'Choose one' });
    const q = buildFHIRObject();
    expect(q.text.div).toContain('choice');
  });

  it('generated div escapes HTML special characters in title', () => {
    _questMeta.title = '<Script> & "Injection"';
    const q = buildFHIRObject();
    expect(q.text.div).not.toContain('<Script>');
    expect(q.text.div).toContain('&lt;Script&gt;');
    expect(q.text.div).toContain('&amp;');
  });

  it('when _rawText is set, preserves status exactly', () => {
    _questMeta._rawText = { status: 'extensions', div: '<div xmlns="http://www.w3.org/1999/xhtml">custom</div>' };
    const q = buildFHIRObject();
    expect(q.text.status).toBe('extensions');
  });

  it('when _rawText is set, preserves div unchanged', () => {
    const div = '<div xmlns="http://www.w3.org/1999/xhtml"><p>Custom narrative</p></div>';
    _questMeta._rawText = { status: 'generated', div };
    const q = buildFHIRObject();
    expect(q.text.div).toBe(div);
  });

  it('generateNarrativeDiv does not include item table when item[] is empty', () => {
    const div = generateNarrativeDiv({ title: 'T', status: 'draft', item: [] });
    expect(div).not.toContain('<thead>');
  });

  it('generateNarrativeDiv nests child items with indent', () => {
    const div = generateNarrativeDiv({
      title: 'T', status: 'draft',
      item: [{ linkId: 'g1', text: 'Group', type: 'group',
        item: [{ linkId: 'q1', text: 'Q', type: 'string' }] }],
    });
    expect(div).toContain('q1');
    expect(div).toContain('\u00a0\u00a0\u00a0\u00a0');
  });
});

// ── _codes round-trip ─────────────────────────────────────────────────────────
describe('buildFHIRObject — _codes', () => {
  it('exports item.code[] when _codes is set', () => {
    const codes = [{ system: 'http://loinc.org', code: '44249-1', display: 'PHQ-9 total' }];
    const q = build([{ id: 'q1', type: 'item', itemType: 'number', title: 'Score', _codes: codes }]);
    expect(q.item[0].code).toEqual(codes);
  });

  it('exports multiple codes', () => {
    const codes = [
      { system: 'http://loinc.org', code: '44249-1', display: 'PHQ-9 total' },
      { system: 'http://snomed.info/sct', code: '720433000' },
    ];
    const q = build([{ id: 'q1', type: 'item', itemType: 'text', title: 'Q', _codes: codes }]);
    expect(q.item[0].code).toHaveLength(2);
    expect(q.item[0].code[1].system).toBe('http://snomed.info/sct');
  });

  it('omits item.code[] when _codes is empty', () => {
    const q = build([{ id: 'q1', type: 'item', itemType: 'text', title: 'Q', _codes: [] }]);
    expect(q.item[0].code).toBeUndefined();
  });

  it('omits item.code[] when _codes not set', () => {
    const q = build([{ id: 'q1', type: 'item', itemType: 'text', title: 'Q' }]);
    expect(q.item[0].code).toBeUndefined();
  });
});

// ── effectivePeriod round-trip ──────────────────────────────────────────────────────
describe('buildFHIRObject — effectivePeriod', () => {
  afterEach(() => { _questMeta.effectivePeriodStart = ''; _questMeta.effectivePeriodEnd = ''; });

  it('exports effectivePeriod when both start and end are set', () => {
    _questMeta.effectivePeriodStart = '2024-01-01';
    _questMeta.effectivePeriodEnd   = '2025-12-31';
    const q = buildFHIRObject();
    expect(q.effectivePeriod).toEqual({ start: '2024-01-01', end: '2025-12-31' });
  });

  it('exports effectivePeriod with only start', () => {
    _questMeta.effectivePeriodStart = '2024-06-01';
    const q = buildFHIRObject();
    expect(q.effectivePeriod).toEqual({ start: '2024-06-01' });
    expect(q.effectivePeriod.end).toBeUndefined();
  });

  it('exports effectivePeriod with only end', () => {
    _questMeta.effectivePeriodEnd = '2025-12-31';
    const q = buildFHIRObject();
    expect(q.effectivePeriod).toEqual({ end: '2025-12-31' });
  });

  it('omits effectivePeriod when both are empty', () => {
    const q = buildFHIRObject();
    expect(q.effectivePeriod).toBeUndefined();
  });
});

// ── Questionnaire.code[] pass-through ───────────────────────────────────────────────
describe('buildFHIRObject — _rawCode pass-through', () => {
  afterEach(() => { _questMeta._rawCode = null; });

  it('writes Questionnaire.code[] back when _rawCode is set', () => {
    const codes = [{ system: 'http://loinc.org', code: '44249-1', display: 'Test' }];
    _questMeta._rawCode = codes;
    const q = buildFHIRObject();
    expect(q.code).toEqual(codes);
  });

  it('omits Questionnaire.code[] when _rawCode is null', () => {
    const q = buildFHIRObject();
    expect(q.code).toBeUndefined();
  });
});

// ── answerOption.initialSelected export ───────────────────────────────────────────────
describe('buildFHIRObject — answerOption initialSelected', () => {
  it('marks the matching answerOption with initialSelected: true', () => {
    const q = build([{ id: 'q1', type: 'item', itemType: 'select', title: 'Q',
      options: 'a=Alpha, b=Beta, c=Gamma', _initialSelected: 'b' }]);
    const opts = q.item[0].answerOption;
    expect(opts.find(o => o.valueCoding.code === 'b').initialSelected).toBe(true);
    expect(opts.find(o => o.valueCoding.code === 'a').initialSelected).toBeUndefined();
    expect(opts.find(o => o.valueCoding.code === 'c').initialSelected).toBeUndefined();
  });

  it('does not add initialSelected when _initialSelected is not set', () => {
    const q = build([{ id: 'q1', type: 'item', itemType: 'select', title: 'Q',
      options: 'a=Alpha, b=Beta' }]);
    expect(q.item[0].answerOption.every(o => !o.initialSelected)).toBe(true);
  });

  it('works with radio item type', () => {
    const q = build([{ id: 'q1', type: 'item', itemType: 'radio', title: 'Q',
      options: 'yes=Yes, no=No', _initialSelected: 'yes' }]);
    expect(q.item[0].answerOption.find(o => o.valueCoding.code === 'yes').initialSelected).toBe(true);
  });
});

// ── item.initial[] multiple values (repeating items) ──────────────────────────────
describe('buildFHIRObject — multi-initial for repeating items', () => {
  it('exports all _initialValues as item.initial[] for a repeating item', () => {
    const q = build([{ id: 'q1', type: 'item', itemType: 'text', title: 'Q',
      repeats: true, _initialValues: ['foo', 'bar', 'baz'] }]);
    expect(q.item[0].initial).toHaveLength(3);
    expect(q.item[0].initial[0]).toEqual({ valueString: 'foo' });
    expect(q.item[0].initial[2]).toEqual({ valueString: 'baz' });
  });

  it('falls back to single _initialValue when _initialValues is absent', () => {
    const q = build([{ id: 'q1', type: 'item', itemType: 'text', title: 'Q',
      repeats: true, _initialValue: 'hello' }]);
    expect(q.item[0].initial).toEqual([{ valueString: 'hello' }]);
  });

  it('omits initial[] for a repeating item with no initial data', () => {
    const q = build([{ id: 'q1', type: 'item', itemType: 'text', title: 'Q', repeats: true }]);
    expect(q.item[0].initial).toBeUndefined();
  });

  it('exports integer type initial values correctly', () => {
    const q = build([{ id: 'q1', type: 'item', itemType: 'integer', title: 'Q',
      repeats: true, _initialValues: ['3', '7'] }]);
    expect(q.item[0].initial[0]).toEqual({ valueInteger: 3 });
    expect(q.item[0].initial[1]).toEqual({ valueInteger: 7 });
  });
});

// ── sdc-questionnaire-entryFormat ────────────────────────────────────────────
describe('buildFHIRObject — entryFormat', () => {
  const EF_URL = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-entryFormat';

  it('exports _entryFormat as sdc-questionnaire-entryFormat extension', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'text', _entryFormat: 'MM/DD/YYYY' }]);
    const ext = q.item[0].extension || [];
    const ef = ext.find(e => e.url === EF_URL);
    expect(ef).toBeDefined();
    expect(ef.valueString).toBe('MM/DD/YYYY');
  });

  it('does not emit entryFormat extension when _entryFormat is absent', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'text' }]);
    const ext = q.item[0].extension || [];
    expect(ext.some(e => e.url === EF_URL)).toBe(false);
  });

  it('exports entryFormat for non-text types such as integer', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'integer', _entryFormat: '###' }]);
    const ext = q.item[0].extension || [];
    const ef = ext.find(e => e.url === EF_URL);
    expect(ef?.valueString).toBe('###');
  });
});

// ── questionnaire-choiceOrientation ──────────────────────────────────────────
describe('buildFHIRObject — choiceOrientation', () => {
  const CO_URL = 'http://hl7.org/fhir/StructureDefinition/questionnaire-choiceOrientation';

  it('exports _choiceOrientation=vertical as valueCode extension', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'radio', options: 'a=A', _choiceOrientation: 'vertical' }]);
    const ext = q.item[0].extension || [];
    const co = ext.find(e => e.url === CO_URL);
    expect(co).toBeDefined();
    expect(co.valueCode).toBe('vertical');
  });

  it('exports _choiceOrientation=horizontal as valueCode extension', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'radio', options: 'a=A', _choiceOrientation: 'horizontal' }]);
    const ext = q.item[0].extension || [];
    const co = ext.find(e => e.url === CO_URL);
    expect(co?.valueCode).toBe('horizontal');
  });

  it('does not emit choiceOrientation extension when _choiceOrientation is absent', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'radio', options: 'a=A' }]);
    const ext = q.item[0].extension || [];
    expect(ext.some(e => e.url === CO_URL)).toBe(false);
  });
});

// ── sdc-questionnaire-choiceColumn ───────────────────────────────────────────
describe('buildFHIRObject — choiceColumn', () => {
  const CC_URL = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-choiceColumn';

  it('exports _choiceColumns as complex extensions', () => {
    const q = build([{
      id: 'q1', type: 'item', title: 'Q', itemType: 'select', options: 'a=A',
      _choiceColumns: [
        { path: 'code', label: 'Code', forDisplay: false },
        { path: 'display', label: 'Name', width: { value: 60, unit: '%' }, forDisplay: true },
      ],
    }]);
    const ext = q.item[0].extension || [];
    const cols = ext.filter(e => e.url === CC_URL);
    expect(cols).toHaveLength(2);
    expect(cols[0].extension).toContainEqual({ url: 'path', valueString: 'code' });
    expect(cols[0].extension).toContainEqual({ url: 'label', valueString: 'Code' });
    expect(cols[0].extension).toContainEqual({ url: 'forDisplay', valueBoolean: false });
    expect(cols[1].extension).toContainEqual({ url: 'path', valueString: 'display' });
    expect(cols[1].extension).toContainEqual({ url: 'width', valueQuantity: { value: 60, unit: '%' } });
    expect(cols[1].extension).toContainEqual({ url: 'forDisplay', valueBoolean: true });
  });

  it('does not emit choiceColumn extension when _choiceColumns is absent', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'select', options: 'a=A' }]);
    const ext = q.item[0].extension || [];
    expect(ext.some(e => e.url === CC_URL)).toBe(false);
  });
});

// ── questionnaire-displayCategory ────────────────────────────────────────────
describe('buildFHIRObject — displayCategory', () => {
  const DC_URL = 'http://hl7.org/fhir/StructureDefinition/questionnaire-displayCategory';

  it('suppresses displayCategory on display-type items (R4 only allows it on groups)', () => {
    const q = build([{ id: 'd1', type: 'item', title: 'Info', itemType: 'display', _displayCategory: 'instructions' }]);
    const ext = q.item[0].extension || [];
    const dc = ext.find(e => e.url === DC_URL);
    expect(dc).toBeUndefined();
  });

  it('exports _displayCategory=instructions on group items as valueCodeableConcept', () => {
    const q = build([{ id: 'g1', type: 'group', title: 'Section', _displayCategory: 'instructions', children: [] }]);
    const ext = q.item[0].extension || [];
    const dc = ext.find(e => e.url === DC_URL);
    expect(dc).toBeDefined();
    expect(dc.valueCodeableConcept?.coding?.[0]?.code).toBe('instructions');
  });

  it('exports _displayCategory=security on group items', () => {
    const q = build([{ id: 'g1', type: 'group', title: 'Section', _displayCategory: 'security', children: [] }]);
    const ext = q.item[0].extension || [];
    const dc = ext.find(e => e.url === DC_URL);
    expect(dc?.valueCodeableConcept?.coding?.[0]?.code).toBe('security');
  });

  it('exports _displayCategory=help on group items', () => {
    const q = build([{ id: 'g1', type: 'group', title: 'Section', _displayCategory: 'help', children: [] }]);
    const ext = q.item[0].extension || [];
    const dc = ext.find(e => e.url === DC_URL);
    expect(dc?.valueCodeableConcept?.coding?.[0]?.code).toBe('help');
  });

  it('does not emit displayCategory extension when _displayCategory is absent', () => {
    const q = build([{ id: 'd1', type: 'item', title: 'Plain', itemType: 'display' }]);
    const ext = q.item[0].extension || [];
    expect(ext.some(e => e.url === DC_URL)).toBe(false);
  });
});

// ── _renderXhtml ──────────────────────────────────────────────────────────────
