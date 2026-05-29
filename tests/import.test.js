// Tests for pure helper functions exported from js/fhir/import.js.
// import.js depends on state.js (CDN) — mocked below.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// DOM stub — import.js dispatches REINIT_FORM after tree is built
globalThis.CustomEvent = class CustomEvent {
  constructor(type, init) { this.type = type; this.detail = init?.detail; }
};
globalThis.document = { dispatchEvent: vi.fn(), addEventListener: vi.fn() };

// Exposed so importFHIR tests can inspect state after import.
const _tree           = [];
const _questVariables = [];
const _questContained = [];
const _values         = {};
const _rawFhir        = { value: null };
const _questMeta      = { id: '', url: '', version: '', title: '', status: 'draft', publisher: '', description: '',
  name: '', date: '', subjectType: [], purpose: '', copyright: '', approvalDate: '', lastReviewDate: '',
  effectivePeriodStart: '', effectivePeriodEnd: '', replaces: [],
  _rawContact: null, _rawUseContext: null, _rawJurisdiction: null, _rawCode: null };

vi.mock('../js/state.js', () => ({
  ref:            v => ({ value: v }),
  tree:           _tree,
  values:         _values,
  rawFhir:        _rawFhir,
  questVariables: _questVariables,
  questContained: { splice: () => { _questContained.splice(0); }, push: (v) => _questContained.push(v) },
  questMeta:      _questMeta,
  resetSeq:       vi.fn(),
  makeGroup:      vi.fn(title => ({ type: 'group', id: 'g', title, children: [], enableWhen: [], enableBehavior: 'all', enableWhenExpression: '', mandatory: false, logicWithParent: 'AND' })),
  makeItem:       vi.fn(title => ({ type: 'item',  id: 'i', title, itemType: 'text', options: '', mandatory: false, enableWhen: [], enableBehavior: 'all', enableWhenExpression: '', constraint: [] })),
  setValue:       (id, val) => { _values[id] = val; },
  clearAllValues: () => { Object.keys(_values).forEach(k => delete _values[k]); },
}));

vi.mock('../js/builder/index.js', () => ({ renderTree: vi.fn() }));

const { fhirTypeToItemType, fhirOptsToStr, hasNonCodingOpts, humanEnableWhen, applyVisibility, importFHIR } = await import('../js/fhir/import.js');

vi.stubGlobal('alert', vi.fn());

const _showErrorMock = vi.fn();
vi.mock('../js/ui/toast.js', () => ({ showError: (...a) => _showErrorMock(...a), showWarn: vi.fn() }));

// ── fhirTypeToItemType ────────────────────────────────────────────────────────────
describe('fhirTypeToItemType', () => {
  const cases = [
    ['boolean',     'checkbox'],
    ['integer',     'integer'],
    ['decimal',     'decimal'],
    ['quantity',    'quantity'],
    ['choice',      'select'],
    ['open-choice', 'open-choice'],
    ['display',     'display'],
    ['date',        'date'],
    ['dateTime',    'dateTime'],
    ['time',        'time'],
    ['url',         'url'],
    ['attachment',  'attachment'],
    ['reference',   'reference'],
    ['string',      'text'],
    ['text',        'text'],
    ['unknown',     'text'],  // fallback
  ];
  for (const [fhirType, expected] of cases) {
    it(`maps ${fhirType} → ${expected}`, () => {
      expect(fhirTypeToItemType(fhirType)).toBe(expected);
    });
  }
});

// ── fhirOptsToStr ─────────────────────────────────────────────────────────────────
describe('fhirOptsToStr', () => {
  it('returns empty string for null/undefined', () => {
    expect(fhirOptsToStr(null)).toBe('');
    expect(fhirOptsToStr(undefined)).toBe('');
  });

  it('returns empty string for empty array', () => {
    expect(fhirOptsToStr([])).toBe('');
  });

  it('formats code=display when both differ', () => {
    const opts = [{ valueCoding: { code: 'y', display: 'Yes' } }];
    expect(fhirOptsToStr(opts)).toBe('y=Yes');
  });

  it('uses display only when code === display', () => {
    const opts = [{ valueCoding: { code: 'Yes', display: 'Yes' } }];
    expect(fhirOptsToStr(opts)).toBe('Yes');
  });

  it('uses code only when display absent', () => {
    const opts = [{ valueCoding: { code: 'bmi35' } }];
    expect(fhirOptsToStr(opts)).toBe('bmi35');
  });

  it('uses display only when code absent', () => {
    const opts = [{ valueCoding: { display: 'Option A' } }];
    expect(fhirOptsToStr(opts)).toBe('Option A');
  });

  it('handles valueString options', () => {
    const opts = [{ valueString: 'alpha' }, { valueString: 'beta' }];
    expect(fhirOptsToStr(opts)).toBe('alpha, beta');
  });

  it('handles valueInteger options', () => {
    const opts = [{ valueInteger: 1 }, { valueInteger: 2 }];
    expect(fhirOptsToStr(opts)).toBe('1, 2');
  });

  it('handles valueDate options', () => {
    const opts = [{ valueDate: '2026-06-01' }, { valueDate: '2026-07-01' }];
    expect(fhirOptsToStr(opts)).toBe('2026-06-01, 2026-07-01');
  });

  it('handles valueTime options', () => {
    const opts = [{ valueTime: '09:00:00' }, { valueTime: '14:00:00' }];
    expect(fhirOptsToStr(opts)).toBe('09:00:00, 14:00:00');
  });

  it('handles valueReference options', () => {
    const opts = [{ valueReference: { reference: 'Practitioner/p1', display: 'Dr. A' } }];
    expect(fhirOptsToStr(opts)).toBe('Practitioner/p1');
  });

  it('joins multiple options with comma-space', () => {
    const opts = [
      { valueCoding: { code: 'a', display: 'Alpha' } },
      { valueCoding: { code: 'b', display: 'Beta' } },
    ];
    expect(fhirOptsToStr(opts)).toBe('a=Alpha, b=Beta');
  });

  it('filters out blank entries', () => {
    const opts = [{ valueCoding: {} }, { valueCoding: { code: 'x' } }];
    expect(fhirOptsToStr(opts)).toBe('x');
  });
});

// ── hasNonCodingOpts ───────────────────────────────────────────────────────────
describe('hasNonCodingOpts', () => {
  it('returns false for all-valueCoding array', () => {
    expect(hasNonCodingOpts([{ valueCoding: { code: 'a' } }])).toBe(false);
  });

  it('returns true when any option is valueString', () => {
    expect(hasNonCodingOpts([{ valueCoding: { code: 'a' } }, { valueString: 'b' }])).toBe(true);
  });

  it('returns true for valueInteger', () => {
    expect(hasNonCodingOpts([{ valueInteger: 1 }])).toBe(true);
  });

  it('returns true for valueDate', () => {
    expect(hasNonCodingOpts([{ valueDate: '2026-01-01' }])).toBe(true);
  });

  it('returns false for empty array', () => {
    expect(hasNonCodingOpts([])).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(hasNonCodingOpts(null)).toBe(false);
    expect(hasNonCodingOpts(undefined)).toBe(false);
  });
});

// ── humanEnableWhen ─────────────────────────────────────────────────────────────────
describe('humanEnableWhen', () => {
  it('returns empty for null/undefined/empty', () => {
    expect(humanEnableWhen(null)).toBe('');
    expect(humanEnableWhen(undefined)).toBe('');
    expect(humanEnableWhen([])).toBe('');
  });

  it('formats answerBoolean = true as Yes', () => {
    const result = humanEnableWhen(
      [{ question: 'q1', operator: '=', answerBoolean: true }],
      'all',
      { q1: 'Diet program' }
    );
    expect(result).toBe('«Diet program» = Yes');
  });

  it('formats answerBoolean = false as No', () => {
    const result = humanEnableWhen(
      [{ question: 'q1', operator: '=', answerBoolean: false }],
      'all',
      { q1: 'Pregnant' }
    );
    expect(result).toBe('«Pregnant» = No');
  });

  it('formats answerString value', () => {
    const result = humanEnableWhen(
      [{ question: 'q1', operator: '=', answerString: 'male' }],
      'all',
      { q1: 'Gender' }
    );
    expect(result).toBe('«Gender» = «male»');
  });

  it('formats answerCoding by display', () => {
    const result = humanEnableWhen(
      [{ question: 'q1', operator: '=', answerCoding: { code: 'm', display: 'Male' } }],
      'all',
      { q1: 'Gender' }
    );
    expect(result).toBe('«Gender» = Male');
  });

  it('uses linkId as label when not in map', () => {
    const result = humanEnableWhen(
      [{ question: 'unknown-id', operator: '=', answerBoolean: true }],
      'all',
      {}
    );
    expect(result).toBe('«unknown-id» = Yes');
  });

  it('joins multiple conditions with AND by default', () => {
    const result = humanEnableWhen([
      { question: 'q1', operator: '=', answerBoolean: true },
      { question: 'q2', operator: '=', answerString: 'yes' },
    ], 'all', { q1: 'A', q2: 'B' });
    expect(result).toBe('«A» = Yes AND «B» = «yes»');
  });

  it('joins multiple conditions with OR when enableBehavior is any', () => {
    const result = humanEnableWhen([
      { question: 'q1', operator: '=', answerBoolean: true },
      { question: 'q2', operator: '=', answerBoolean: true },
    ], 'any', { q1: 'A', q2: 'B' });
    expect(result).toBe('«A» = Yes OR «B» = Yes');
  });

  it('formats != operator as ≠', () => {
    const result = humanEnableWhen(
      [{ question: 'q1', operator: '!=', answerBoolean: true }],
      'all', { q1: 'X' }
    );
    expect(result).toBe('«X» ≠ Yes');
  });

  it('formats exists operator', () => {
    const result = humanEnableWhen(
      [{ question: 'q1', operator: 'exists', answerBoolean: true }],
      'all', { q1: 'Email' }
    );
    expect(result).toBe('«Email» has answer');
  });

  it('formats answerInteger value', () => {
    const result = humanEnableWhen(
      [{ question: 'age', operator: '>=', answerInteger: 18 }],
      'all', { age: 'Age' }
    );
    expect(result).toBe('«Age» ≥ 18');
  });

  it('formats answerDecimal value', () => {
    const result = humanEnableWhen(
      [{ question: 'bmi', operator: '>', answerDecimal: 30.0 }],
      'all', { bmi: 'BMI' }
    );
    expect(result).toBe('«BMI» > 30');
  });

  it('falls back to ? for unrecognised answer type', () => {
    const result = humanEnableWhen(
      [{ question: 'q1', operator: '=' }],
      'all', { q1: 'Q' }
    );
    expect(result).toBe('«Q» = ?');
  });
});

// ── applyVisibility ──────────────────────────────────────────────────────────────────
describe('applyVisibility', () => {
  function makeNode() {
    return { enableWhen: [], enableBehavior: 'all', enableWhenExpression: '' };
  }

  it('copies enableWhen array from fhirItem', () => {
    const node = makeNode();
    const fhirItem = {
      enableWhen: [{ question: 'q1', operator: '=', answerBoolean: true }],
      enableBehavior: 'all',
      extension: []
    };
    applyVisibility(node, fhirItem, {});
    expect(node.enableWhen).toHaveLength(1);
    expect(node.enableWhen[0].question).toBe('q1');
  });

  it('sets enableBehavior:any when fhirItem has any', () => {
    const node = makeNode();
    applyVisibility(node, {
      enableWhen: [{ question: 'q1', operator: '=', answerBoolean: true }],
      enableBehavior: 'any',
      extension: []
    }, {});
    expect(node.enableBehavior).toBe('any');
  });

  it('sets enableBehavior:all by default', () => {
    const node = makeNode();
    applyVisibility(node, {
      enableWhen: [{ question: 'q1', operator: '=', answerBoolean: true }],
      extension: []
    }, {});
    expect(node.enableBehavior).toBe('all');
  });

  it('copies enableWhen entries as independent objects', () => {
    const node = makeNode();
    const ew = { question: 'q1', operator: '=', answerBoolean: true };
    applyVisibility(node, { enableWhen: [ew], extension: [] }, {});
    node.enableWhen[0].question = 'mutated';
    expect(ew.question).toBe('q1'); // original not mutated
  });

  it('reads enableWhenExpression from SDC extension', () => {
    const node = makeNode();
    applyVisibility(node, {
      enableWhen: [],
      extension: [{
        url: 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-enableWhenExpression',
        valueExpression: { language: 'text/fhirpath', expression: '%age > 18' }
      }]
    }, {});
    expect(node.enableWhenExpression).toBe('%age > 18');
  });

  it('sets _enableWhenText for display', () => {
    const node = makeNode();
    applyVisibility(node, {
      enableWhen: [{ question: 'q1', operator: '=', answerBoolean: true }],
      extension: []
    }, { q1: 'My Question' });
    expect(node._enableWhenText).toContain('My Question');
    expect(node._enableWhenText).toContain('Yes');
  });

  it('does nothing for empty enableWhen and no extensions', () => {
    const node = makeNode();
    applyVisibility(node, { enableWhen: [], extension: [] }, {});
    expect(node.enableWhen).toHaveLength(0);
    expect(node.enableWhenExpression).toBe('');
    expect(node._enableWhenText).toBeUndefined();
  });
});

// ── importFHIR ───────────────────────────────────────────────────────────────
describe('importFHIR', () => {
  beforeEach(() => {
    _tree.splice(0);
    _questVariables.splice(0);
    _questContained.splice(0);
    Object.keys(_values).forEach(k => delete _values[k]);
    _rawFhir.value = null;
    Object.assign(_questMeta, { id: '', url: '', version: '', title: '', status: 'draft', publisher: '', description: '',
      name: '', date: '', subjectType: [], purpose: '', copyright: '', approvalDate: '', lastReviewDate: '',
      effectivePeriodStart: '', effectivePeriodEnd: '',
      _rawContact: null, _rawUseContext: null, _rawJurisdiction: null, _rawCode: null });
    vi.mocked(_showErrorMock).mockClear();
  });

  const minQ = (items = [], ext = []) => ({
    resourceType: 'Questionnaire',
    title: 'Test',
    extension: ext,
    item: items,
  });

  it('rejects non-Questionnaire JSON and calls showError', () => {
    importFHIR({ resourceType: 'Patient' });
    expect(_showErrorMock).toHaveBeenCalled();
    expect(_tree).toHaveLength(0);
  });

  it('rejects invalid JSON string and calls showError', () => {
    importFHIR('{ not valid json }');
    expect(_showErrorMock).toHaveBeenCalled();
    expect(_tree).toHaveLength(0);
  });

  it('accepts JSON string input', () => {
    importFHIR(JSON.stringify(minQ([{ linkId: 'q1', type: 'string', text: 'Q' }])));
    expect(_tree).toHaveLength(1);
  });

  it('imports a flat text item', () => {
    importFHIR(minQ([{ linkId: 'q1', type: 'string', text: 'Name' }]));
    expect(_tree).toHaveLength(1);
    expect(_tree[0].id).toBe('q1');
    expect(_tree[0].title).toBe('Name');
  });

  it('imports a group with children', () => {
    importFHIR(minQ([{
      linkId: 'g1', type: 'group', text: 'Section',
      item: [{ linkId: 'q1', type: 'string', text: 'Q' }],
    }]));
    expect(_tree).toHaveLength(1);
    expect(_tree[0].type).toBe('group');
    expect(_tree[0].id).toBe('g1');
    expect(_tree[0].children).toHaveLength(1);
    expect(_tree[0].children[0].id).toBe('q1');
  });

  it('imports required flag', () => {
    importFHIR(minQ([{ linkId: 'q1', type: 'string', text: 'Q', required: true }]));
    expect(_tree[0].mandatory).toBe(true);
  });

  it('imports repeats:true', () => {
    importFHIR(minQ([{ linkId: 'q1', type: 'string', text: 'Q', repeats: true }]));
    expect(_tree[0].repeats).toBe(true);
  });

  it('leaves repeats unset when not present in FHIR', () => {
    importFHIR(minQ([{ linkId: 'q1', type: 'string', text: 'Q' }]));
    // makeItem mock does not set repeats, so it is falsy / undefined
    expect(_tree[0].repeats).toBeFalsy();
  });

  it('imports questionnaire-level SDC variables', () => {
    const SDC_VAR_URL = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-variable';
    importFHIR(minQ([], [
      { url: SDC_VAR_URL, valueExpression: { name: 'bmi', expression: '%w/%h' } },
    ]));
    expect(_questVariables).toHaveLength(1);
    expect(_questVariables[0].name).toBe('bmi');
    expect(_questVariables[0].expression).toBe('%w/%h');
  });

  it('sets rawFhir after import', () => {
    const q = minQ();
    importFHIR(q);
    expect(_rawFhir.value).toBe(q);
  });

  it('clears tree before importing new questionnaire', () => {
    _tree.push({ id: 'stale' });
    importFHIR(minQ([{ linkId: 'q1', type: 'string', text: 'Q' }]));
    expect(_tree).toHaveLength(1);
    expect(_tree[0].id).toBe('q1');
  });

  it('imports contained[] resources into questContained', () => {
    importFHIR({
      resourceType: 'Questionnaire',
      contained: [
        { resourceType: 'ValueSet',  id: 'vs-1', title: 'Test VS' },
        { resourceType: 'CodeSystem', id: 'cs-1', title: 'Test CS' },
      ],
      item: [],
    });
    expect(_questContained).toHaveLength(2);
    expect(_questContained[0].id).toBe('vs-1');
    expect(_questContained[1].resourceType).toBe('CodeSystem');
  });

  it('clears questContained on re-import when no contained present', () => {
    _questContained.push({ resourceType: 'ValueSet', id: 'old' });
    importFHIR(minQ([]));
    expect(_questContained).toHaveLength(0);
  });

  it('stores answerValueSet URL on the imported node', () => {
    importFHIR(minQ([{
      linkId: 'q1', type: 'choice', text: 'Diet',
      answerValueSet: 'http://example.org/vs/diet',
    }]));
    expect(_tree[0]._answerValueSet).toBe('http://example.org/vs/diet');
  });

  it('does not set _answerValueSet when not present in FHIR item', () => {
    importFHIR(minQ([{
      linkId: 'q1', type: 'choice', text: 'Procedure',
      answerOption: [{ valueCoding: { code: 'a', display: 'A' } }],
    }]));
    expect(_tree[0]._answerValueSet).toBeUndefined();
  });

  it('resolves local #vs-id answerValueSet into node.options from contained[]', () => {
    importFHIR({
      resourceType: 'Questionnaire',
      contained: [{
        resourceType: 'ValueSet',
        id: 'vs-diet',
        compose: { include: [{ system: 'http://example.org', concept: [
          { code: 'veg', display: 'Vegetarian' },
          { code: 'omn', display: 'Omnivore' },
        ]}]}
      }],
      item: [{ linkId: 'q1', type: 'choice', text: 'Diet', answerValueSet: '#vs-diet' }],
    });
    expect(_tree[0]._answerValueSet).toBe('#vs-diet');
    expect(_tree[0].options).toBe('veg=Vegetarian,omn=Omnivore');
  });

  it('leaves options empty for external answerValueSet URL', () => {
    importFHIR(minQ([{
      linkId: 'q1', type: 'choice', text: 'Occupation',
      answerValueSet: 'http://hl7.org/fhir/ValueSet/occupation-snomed-ct',
    }]));
    expect(_tree[0]._answerValueSet).toBe('http://hl7.org/fhir/ValueSet/occupation-snomed-ct');
    expect(_tree[0].options).toBe('');
  });

  // ── questMeta population ──────────────────────────────────────────────────────
  it('populates questMeta.id from the questionnaire', () => {
    importFHIR({ resourceType: 'Questionnaire', id: 'my-q', item: [] });
    expect(_questMeta.id).toBe('my-q');
  });

  it('populates questMeta.url from the questionnaire', () => {
    importFHIR({ resourceType: 'Questionnaire', url: 'http://example.org/fhir/q', item: [] });
    expect(_questMeta.url).toBe('http://example.org/fhir/q');
  });

  it('populates questMeta.version from the questionnaire', () => {
    importFHIR({ resourceType: 'Questionnaire', version: '1.2.3', item: [] });
    expect(_questMeta.version).toBe('1.2.3');
  });

  it('populates questMeta.title from the questionnaire', () => {
    importFHIR({ resourceType: 'Questionnaire', title: 'PHQ-9', item: [] });
    expect(_questMeta.title).toBe('PHQ-9');
  });

  it('populates questMeta.status from the questionnaire', () => {
    importFHIR({ resourceType: 'Questionnaire', status: 'active', item: [] });
    expect(_questMeta.status).toBe('active');
  });

  it('defaults questMeta.status to draft when not present in FHIR', () => {
    importFHIR({ resourceType: 'Questionnaire', item: [] });
    expect(_questMeta.status).toBe('draft');
  });

  it('populates questMeta.publisher from the questionnaire', () => {
    importFHIR({ resourceType: 'Questionnaire', publisher: 'HL7', item: [] });
    expect(_questMeta.publisher).toBe('HL7');
  });

  it('populates questMeta.description from the questionnaire', () => {
    importFHIR({ resourceType: 'Questionnaire', description: 'A screening tool.', item: [] });
    expect(_questMeta.description).toBe('A screening tool.');
  });

  it('populates questMeta.name from the questionnaire', () => {
    importFHIR({ resourceType: 'Questionnaire', name: 'MyQuestionnaire', item: [] });
    expect(_questMeta.name).toBe('MyQuestionnaire');
  });

  it('populates questMeta.date from the questionnaire', () => {
    importFHIR({ resourceType: 'Questionnaire', date: '2024-03-15', item: [] });
    expect(_questMeta.date).toBe('2024-03-15');
  });

  it('populates questMeta.subjectType as array', () => {
    importFHIR({ resourceType: 'Questionnaire', subjectType: ['Patient', 'Practitioner'], item: [] });
    expect(_questMeta.subjectType).toEqual(['Patient', 'Practitioner']);
  });

  it('defaults questMeta.subjectType to empty array when not present', () => {
    importFHIR({ resourceType: 'Questionnaire', item: [] });
    expect(_questMeta.subjectType).toEqual([]);
  });

  it('populates questMeta.purpose from the questionnaire', () => {
    importFHIR({ resourceType: 'Questionnaire', purpose: 'Screening', item: [] });
    expect(_questMeta.purpose).toBe('Screening');
  });

  it('populates questMeta.copyright from the questionnaire', () => {
    importFHIR({ resourceType: 'Questionnaire', copyright: '© HL7', item: [] });
    expect(_questMeta.copyright).toBe('© HL7');
  });

  it('populates questMeta.approvalDate from the questionnaire', () => {
    importFHIR({ resourceType: 'Questionnaire', approvalDate: '2023-01-01', item: [] });
    expect(_questMeta.approvalDate).toBe('2023-01-01');
  });

  it('populates questMeta.lastReviewDate from the questionnaire', () => {
    importFHIR({ resourceType: 'Questionnaire', lastReviewDate: '2024-06-01', item: [] });
    expect(_questMeta.lastReviewDate).toBe('2024-06-01');
  });

  it('stores contact[] as _rawContact pass-through', () => {
    const contact = [{ name: 'HL7', telecom: [] }];
    importFHIR({ resourceType: 'Questionnaire', contact, item: [] });
    expect(_questMeta._rawContact).toEqual(contact);
  });

  it('stores useContext[] as _rawUseContext pass-through', () => {
    const useContext = [{ code: { code: 'venue' } }];
    importFHIR({ resourceType: 'Questionnaire', useContext, item: [] });
    expect(_questMeta._rawUseContext).toEqual(useContext);
  });

  it('stores jurisdiction[] as _rawJurisdiction pass-through', () => {
    const jurisdiction = [{ coding: [{ system: 'urn:iso:std:iso:3166', code: 'US' }] }];
    importFHIR({ resourceType: 'Questionnaire', jurisdiction, item: [] });
    expect(_questMeta._rawJurisdiction).toEqual(jurisdiction);
  });

  it('resets pass-through fields to null on re-import without those fields', () => {
    importFHIR({ resourceType: 'Questionnaire', contact: [{ name: 'A' }], item: [] });
    importFHIR({ resourceType: 'Questionnaire', item: [] });
    expect(_questMeta._rawContact).toBeNull();
  });

  it('resets questMeta fields to empty on re-import', () => {
    importFHIR({ resourceType: 'Questionnaire', id: 'first', url: 'http://first.org', publisher: 'Pub', item: [] });
    importFHIR({ resourceType: 'Questionnaire', item: [] });
    expect(_questMeta.id).toBe('');
    expect(_questMeta.url).toBe('');
    expect(_questMeta.publisher).toBe('');
  });

  // ── _codes import ───────────────────────────────────────────────────────────
  describe('_codes', () => {
    it('imports item.code[] into node._codes', () => {
      const codes = [{ system: 'http://loinc.org', code: '44249-1', display: 'PHQ-9 total' }];
      importFHIR(minQ([{ linkId: 'q1', type: 'decimal', text: 'Score', code: codes }]));
      expect(_tree[0]._codes).toEqual(codes);
    });

    it('imports multiple codes', () => {
      const codes = [
        { system: 'http://loinc.org', code: '44249-1' },
        { system: 'http://snomed.info/sct', code: '720433000', display: 'PHQ-9' },
      ];
      importFHIR(minQ([{ linkId: 'q1', type: 'decimal', text: 'Score', code: codes }]));
      expect(_tree[0]._codes).toHaveLength(2);
      expect(_tree[0]._codes[1].system).toBe('http://snomed.info/sct');
    });

    it('does not set _codes when item.code[] is absent', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'string', text: 'Q' }]));
      expect(_tree[0]._codes).toBeUndefined();
    });

    it('does not set _codes when item.code[] is empty', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'string', text: 'Q', code: [] }]));
      expect(_tree[0]._codes).toBeUndefined();
    });
  });

  // ── effectivePeriod import ──────────────────────────────────────────────────
  describe('effectivePeriod', () => {
    it('populates effectivePeriodStart from questionnaire', () => {
      importFHIR({ resourceType: 'Questionnaire', effectivePeriod: { start: '2024-01-01' }, item: [] });
      expect(_questMeta.effectivePeriodStart).toBe('2024-01-01');
    });

    it('populates effectivePeriodEnd from questionnaire', () => {
      importFHIR({ resourceType: 'Questionnaire', effectivePeriod: { end: '2025-12-31' }, item: [] });
      expect(_questMeta.effectivePeriodEnd).toBe('2025-12-31');
    });

    it('reads both start and end when present', () => {
      importFHIR({ resourceType: 'Questionnaire', effectivePeriod: { start: '2024-01-01', end: '2025-12-31' }, item: [] });
      expect(_questMeta.effectivePeriodStart).toBe('2024-01-01');
      expect(_questMeta.effectivePeriodEnd).toBe('2025-12-31');
    });

    it('defaults effectivePeriod fields to empty when not present', () => {
      importFHIR({ resourceType: 'Questionnaire', item: [] });
      expect(_questMeta.effectivePeriodStart).toBe('');
      expect(_questMeta.effectivePeriodEnd).toBe('');
    });
  });

  // ── Questionnaire.code[] pass-through ──────────────────────────────────────
  describe('_rawCode pass-through', () => {
    it('stores Questionnaire.code[] as _rawCode', () => {
      const code = [{ system: 'http://loinc.org', code: '44249-1', display: 'PHQ-9' }];
      importFHIR({ resourceType: 'Questionnaire', code, item: [] });
      expect(_questMeta._rawCode).toEqual(code);
    });

    it('sets _rawCode to null when code[] is absent', () => {
      importFHIR({ resourceType: 'Questionnaire', item: [] });
      expect(_questMeta._rawCode).toBeNull();
    });

    it('sets _rawCode to null when code[] is not an array', () => {
      importFHIR({ resourceType: 'Questionnaire', code: 'bad', item: [] });
      expect(_questMeta._rawCode).toBeNull();
    });
  });

  // ── answerOption.initialSelected import ────────────────────────────────────
  describe('answerOption.initialSelected', () => {
    it('reads initialSelected into node._initialSelected', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'choice', text: 'Q',
        answerOption: [
          { valueCoding: { code: 'yes', display: 'Yes' }, initialSelected: true },
          { valueCoding: { code: 'no',  display: 'No'  } },
        ],
      }]));
      expect(_tree[0]._initialSelected).toBe('yes');
    });

    it('sets _initialValue from initialSelected when no item.initial[]', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'choice', text: 'Q',
        answerOption: [{ valueCoding: { code: 'yes' }, initialSelected: true }],
      }]));
      expect(_tree[0]._initialValue).toBe('yes');
    });

    it('item.initial[] takes precedence over initialSelected for _initialValue', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'choice', text: 'Q',
        answerOption: [{ valueCoding: { code: 'yes' }, initialSelected: true }],
        initial: [{ valueCoding: { code: 'no' } }],
      }]));
      expect(_tree[0]._initialSelected).toBe('yes');
      expect(_tree[0]._initialValue).toBe('no');
    });

    it('does not set _initialSelected when no option is marked', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'choice', text: 'Q',
        answerOption: [{ valueCoding: { code: 'yes' } }, { valueCoding: { code: 'no' } }],
      }]));
      expect(_tree[0]._initialSelected).toBeUndefined();
    });

    it('reads initialSelected from valueString option', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'open-choice', text: 'Q',
        answerOption: [{ valueString: 'maybe', initialSelected: true }],
      }]));
      expect(_tree[0]._initialSelected).toBe('maybe');
    });
  });

  // ── _rawAnswerOptions (non-Coding round-trip) ──────────────────────────────
  describe('_rawAnswerOptions', () => {
    it('is set when any answerOption is valueString', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'choice', text: 'Q',
        answerOption: [{ valueString: 'Email' }, { valueString: 'Phone' }],
      }]));
      expect(_tree[0]._rawAnswerOptions).toEqual([{ valueString: 'Email' }, { valueString: 'Phone' }]);
    });

    it('is set when any answerOption is valueInteger', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'choice', text: 'Q',
        answerOption: [{ valueInteger: 0 }, { valueInteger: 1 }],
      }]));
      expect(_tree[0]._rawAnswerOptions).toEqual([{ valueInteger: 0 }, { valueInteger: 1 }]);
    });

    it('is set when any answerOption is valueDate', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'choice', text: 'Q',
        answerOption: [{ valueDate: '2026-06-01' }],
      }]));
      expect(_tree[0]._rawAnswerOptions).toEqual([{ valueDate: '2026-06-01' }]);
    });

    it('is set when any answerOption is valueTime', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'choice', text: 'Q',
        answerOption: [{ valueTime: '09:00:00' }],
      }]));
      expect(_tree[0]._rawAnswerOptions).toEqual([{ valueTime: '09:00:00' }]);
    });

    it('is set when mixed valueCoding + valueString', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'choice', text: 'Q',
        answerOption: [
          { valueCoding: { code: 'a', display: 'A' } },
          { valueString: 'b' },
        ],
      }]));
      expect(_tree[0]._rawAnswerOptions).toHaveLength(2);
    });

    it('is NOT set when all answerOptions are valueCoding', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'choice', text: 'Q',
        answerOption: [
          { valueCoding: { code: 'y', display: 'Yes' } },
          { valueCoding: { code: 'n', display: 'No' } },
        ],
      }]));
      expect(_tree[0]._rawAnswerOptions).toBeUndefined();
    });

    it('node.options string is still populated for display', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'choice', text: 'Q',
        answerOption: [{ valueString: 'Email' }, { valueString: 'Phone' }],
      }]));
      expect(_tree[0].options).toBe('Email, Phone');
    });
  });
  describe('item.initial[] multi-value', () => {
    it('reads multiple initial values for a repeating item into _initialValues', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'string', text: 'Q', repeats: true,
        initial: [{ valueString: 'a' }, { valueString: 'b' }, { valueString: 'c' }],
      }]));
      expect(_tree[0]._initialValues).toEqual(['a', 'b', 'c']);
      expect(_tree[0]._initialValue).toBe('a');
    });

    it('reads single initial value without _initialValues for non-repeating item', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'string', text: 'Q',
        initial: [{ valueString: 'hello' }],
      }]));
      expect(_tree[0]._initialValue).toBe('hello');
      expect(_tree[0]._initialValues).toBeUndefined();
    });

    it('reads single initial value without _initialValues even for repeating item', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'string', text: 'Q', repeats: true,
        initial: [{ valueString: 'only' }],
      }]));
      expect(_tree[0]._initialValue).toBe('only');
      expect(_tree[0]._initialValues).toBeUndefined();
    });

    it('reads integer initial values (stored as strings for form fields)', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'integer', text: 'Q', repeats: true,
        initial: [{ valueInteger: 3 }, { valueInteger: 7 }],
      }]));
      expect(_tree[0]._initialValues).toEqual(['3', '7']);
    });

    it('reads date initial value', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'date', text: 'Q',
        initial: [{ valueDate: '2024-06-01' }],
      }]));
      expect(_tree[0]._initialValue).toBe('2024-06-01');
    });

    it('reads quantity initial value preserving unit', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'quantity', text: 'Q',
        initial: [{ valueQuantity: { value: 72.5, unit: 'kg' } }],
      }]));
      expect(_tree[0]._initialValue).toEqual({ value: '72.5', unit: 'kg' });
    });

    it('reads quantity with no value as object with empty strings', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'quantity', text: 'Q',
        initial: [{ valueQuantity: { unit: 'kg' } }],
      }]));
      expect(_tree[0]._initialValue).toEqual({ value: '', unit: 'kg' });
    });

    it('populates values correctly: base id=first, $$1..N=extras, $$n=extra count', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'string', text: 'Q', repeats: true,
        initial: [{ valueString: 'a' }, { valueString: 'b' }, { valueString: 'c' }],
      }]));
      expect(_values['q1']).toBe('a');
      expect(_values['q1$$1']).toBe('b');
      expect(_values['q1$$2']).toBe('c');
      expect(_values['q1$$n']).toBe(2); // 2 extra rows beyond the primary
      expect(_values['q1$$3']).toBeUndefined();
    });
  });

  // ── sdc-questionnaire-entryFormat ────────────────────────────────────────
  describe('_entryFormat', () => {
    const EF_URL     = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-entryFormat';
    const EF_URL_R4  = 'http://hl7.org/fhir/StructureDefinition/entryFormat';

    it('reads entryFormat valueString into node._entryFormat', () => {
      importFHIR(minQ([{
        linkId: 'q1', type: 'string', text: 'Date',
        extension: [{ url: EF_URL, valueString: 'MM/DD/YYYY' }],
      }]));
      expect(_tree[0]._entryFormat).toBe('MM/DD/YYYY');
    });

    it('does not set _entryFormat when extension is absent', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'string', text: 'Q' }]));
      expect(_tree[0]._entryFormat).toBeUndefined();
    });

    it('does not set _entryFormat when entryFormat extension has no valueString', () => {
      importFHIR(minQ([{
        linkId: 'q1', type: 'integer', text: 'Q',
        extension: [{ url: EF_URL }],
      }]));
      expect(_tree[0]._entryFormat).toBeUndefined();
    });

    it('reads R4 entryFormat alias URL into node._entryFormat', () => {
      importFHIR(minQ([{
        linkId: 'q1', type: 'string', text: 'Date',
        extension: [{ url: EF_URL_R4, valueString: 'DD/MM/YYYY' }],
      }]));
      expect(_tree[0]._entryFormat).toBe('DD/MM/YYYY');
    });

    it('prefers SDC URL over R4 alias when both are present', () => {
      importFHIR(minQ([{
        linkId: 'q1', type: 'string', text: 'Date',
        extension: [
          { url: EF_URL,    valueString: 'SDC-value' },
          { url: EF_URL_R4, valueString: 'R4-value'  },
        ],
      }]));
      expect(_tree[0]._entryFormat).toBe('SDC-value');
    });
  });

  // ── questionnaire-choiceOrientation ──────────────────────────────────────
  describe('_choiceOrientation', () => {
    const CO_URL = 'http://hl7.org/fhir/StructureDefinition/questionnaire-choiceOrientation';

    it('reads vertical valueCode into node._choiceOrientation', () => {
      importFHIR(minQ([{
        linkId: 'q1', type: 'choice', text: 'Pick one',
        extension: [{ url: CO_URL, valueCode: 'vertical' }],
        answerOption: [{ valueCoding: { code: 'a', display: 'A' } }],
      }]));
      expect(_tree[0]._choiceOrientation).toBe('vertical');
    });

    it('reads horizontal valueCode into node._choiceOrientation', () => {
      importFHIR(minQ([{
        linkId: 'q1', type: 'choice', text: 'Pick one',
        extension: [{ url: CO_URL, valueCode: 'horizontal' }],
        answerOption: [{ valueCoding: { code: 'a', display: 'A' } }],
      }]));
      expect(_tree[0]._choiceOrientation).toBe('horizontal');
    });

    it('does not set _choiceOrientation when extension is absent', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'choice', text: 'Pick one',
        answerOption: [{ valueCoding: { code: 'a', display: 'A' } }] }]));
      expect(_tree[0]._choiceOrientation).toBeUndefined();
    });
  });

  // ── questionnaire-displayCategory ────────────────────────────────────────
  describe('_displayCategory', () => {
    const DC_URL = 'http://hl7.org/fhir/StructureDefinition/questionnaire-displayCategory';

    it('reads instructions code into node._displayCategory', () => {
      importFHIR(minQ([{
        linkId: 'd1', type: 'display', text: 'Read this',
        extension: [{ url: DC_URL, valueCodeableConcept: { coding: [{ code: 'instructions' }] } }],
      }]));
      expect(_tree[0]._displayCategory).toBe('instructions');
    });

    it('reads security code into node._displayCategory', () => {
      importFHIR(minQ([{
        linkId: 'd1', type: 'display', text: 'Warning',
        extension: [{ url: DC_URL, valueCodeableConcept: { coding: [{ code: 'security' }] } }],
      }]));
      expect(_tree[0]._displayCategory).toBe('security');
    });

    it('reads help code into node._displayCategory', () => {
      importFHIR(minQ([{
        linkId: 'd1', type: 'display', text: 'Need help?',
        extension: [{ url: DC_URL, valueCodeableConcept: { coding: [{ code: 'help' }] } }],
      }]));
      expect(_tree[0]._displayCategory).toBe('help');
    });

    it('does not set _displayCategory when extension is absent', () => {
      importFHIR(minQ([{ linkId: 'd1', type: 'display', text: 'Plain display' }]));
      expect(_tree[0]._displayCategory).toBeUndefined();
    });
  });

  // ── _renderXhtml ────────────────────────────────────────────────────────────
  describe('_renderXhtml', () => {
    it('reads rendering-xhtml into node._renderXhtml', () => {
      importFHIR(minQ([{
        linkId: 'q1', type: 'string', text: 'Plain',
        _text: { extension: [{ url: 'http://hl7.org/fhir/StructureDefinition/rendering-xhtml', valueString: '<b>Bold</b>' }] }
      }]));
      expect(_tree[0]._renderXhtml).toBe('<b>Bold</b>');
    });

    it('reads both rendering-style and rendering-xhtml from same _text.extension[]', () => {
      importFHIR(minQ([{
        linkId: 'q1', type: 'string', text: 'Mixed',
        _text: { extension: [
          { url: 'http://hl7.org/fhir/StructureDefinition/rendering-style', valueString: 'color: red' },
          { url: 'http://hl7.org/fhir/StructureDefinition/rendering-xhtml',  valueString: '<em>Mixed</em>' }
        ]}
      }]));
      expect(_tree[0]._renderStyle).toBe('color: red');
      expect(_tree[0]._renderXhtml).toBe('<em>Mixed</em>');
    });

    it('does not set _renderXhtml when _text is absent', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'string', text: 'Plain' }]));
      expect(_tree[0]._renderXhtml).toBeUndefined();
    });
  });

  // ── questionnaire-supportLink ─────────────────────────────────────────────
  describe('_supportLinks import', () => {
    const SL_URL = 'http://hl7.org/fhir/StructureDefinition/questionnaire-supportLink';

    it('reads a single supportLink URI into _supportLinks array', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'string', text: 'Q',
        extension: [{ url: SL_URL, valueUri: 'https://example.com/help' }]
      }]));
      expect(_tree[0]._supportLinks).toEqual(['https://example.com/help']);
    });

    it('reads multiple supportLink URIs', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'string', text: 'Q',
        extension: [
          { url: SL_URL, valueUri: 'https://a.example.com' },
          { url: SL_URL, valueUri: 'https://b.example.com' },
        ]
      }]));
      expect(_tree[0]._supportLinks).toEqual(['https://a.example.com', 'https://b.example.com']);
    });

    it('does not set _supportLinks when extension is absent', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'string', text: 'Q' }]));
      expect(_tree[0]._supportLinks).toBeUndefined();
    });

    it('ignores supportLink entries without valueUri', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'string', text: 'Q',
        extension: [{ url: SL_URL }]
      }]));
      expect(_tree[0]._supportLinks).toBeUndefined();
    });
  });

  // ── sdc-questionnaire-hidden ───────────────────────────────────────────────
  describe('_hidden import', () => {
    const HIDDEN_URL    = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-hidden';
    const HIDDEN_URL_R4 = 'http://hl7.org/fhir/StructureDefinition/questionnaire-hidden';

    it('sets _hidden = true for an item with sdc-questionnaire-hidden = true', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'string', text: 'Q',
        extension: [{ url: HIDDEN_URL, valueBoolean: true }]
      }]));
      expect(_tree[0]._hidden).toBe(true);
    });

    it('does not set _hidden when extension is absent', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'string', text: 'Q' }]));
      expect(_tree[0]._hidden).toBeUndefined();
    });

    it('does not set _hidden when valueBoolean is false', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'string', text: 'Q',
        extension: [{ url: HIDDEN_URL, valueBoolean: false }]
      }]));
      expect(_tree[0]._hidden).toBeUndefined();
    });

    it('sets _hidden = true on a group item', () => {
      importFHIR(minQ([{ linkId: 'g1', type: 'group', text: 'G',
        extension: [{ url: HIDDEN_URL, valueBoolean: true }],
        item: [{ linkId: 'g1.q1', type: 'string', text: 'Child' }]
      }]));
      expect(_tree[0]._hidden).toBe(true);
      expect(_tree[0].children[0]._hidden).toBeUndefined();
    });

    it('sets _hidden = true for an item using R4 questionnaire-hidden URL', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'string', text: 'Q',
        extension: [{ url: HIDDEN_URL_R4, valueBoolean: true }]
      }]));
      expect(_tree[0]._hidden).toBe(true);
    });

    it('does not set _hidden when R4 URL has valueBoolean false', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'string', text: 'Q',
        extension: [{ url: HIDDEN_URL_R4, valueBoolean: false }]
      }]));
      expect(_tree[0]._hidden).toBeUndefined();
    });

    it('sets _hidden = true on a group using R4 questionnaire-hidden URL', () => {
      importFHIR(minQ([{ linkId: 'g1', type: 'group', text: 'G',
        extension: [{ url: HIDDEN_URL_R4, valueBoolean: true }],
        item: [{ linkId: 'g1.q1', type: 'string', text: 'Child' }]
      }]));
      expect(_tree[0]._hidden).toBe(true);
      expect(_tree[0].children[0]._hidden).toBeUndefined();
    });
  });

  // ── minLength ────────────────────────────────────────────────────────────
  describe('_minLength', () => {
    const ML_URL = 'http://hl7.org/fhir/StructureDefinition/minLength';

    it('reads minLength valueInteger into node._minLength', () => {
      importFHIR(minQ([{
        linkId: 'q1', type: 'string', text: 'Q',
        extension: [{ url: ML_URL, valueInteger: 3 }],
      }]));
      expect(_tree[0]._minLength).toBe(3);
    });

    it('does not set _minLength when extension is absent', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'string', text: 'Q' }]));
      expect(_tree[0]._minLength).toBeUndefined();
    });

    it('does not set _minLength when valueInteger is absent from extension', () => {
      importFHIR(minQ([{
        linkId: 'q1', type: 'string', text: 'Q',
        extension: [{ url: ML_URL }],
      }]));
      expect(_tree[0]._minLength).toBeUndefined();
    });
  });

  // ── _minValue / _maxValue ─────────────────────────────────────────────────
  describe('_minValue / _maxValue', () => {
    const MIN_URL = 'http://hl7.org/fhir/StructureDefinition/minValue';
    const MAX_URL = 'http://hl7.org/fhir/StructureDefinition/maxValue';

    it('reads minValue integer extension into _minValue', () => {
      importFHIR(minQ([{
        linkId: 'q1', type: 'integer', text: 'Q',
        extension: [{ url: MIN_URL, valueInteger: 0 }],
      }]));
      expect(_tree[0]._minValue).toBe(0);
    });

    it('reads maxValue decimal extension into _maxValue', () => {
      importFHIR(minQ([{
        linkId: 'q1', type: 'decimal', text: 'Q',
        extension: [{ url: MAX_URL, valueDecimal: 9.9 }],
      }]));
      expect(_tree[0]._maxValue).toBe(9.9);
    });
  });

  // ── referenceResource / quantityUnit / calculatedExpr / initialExpr ────────
  describe('reference, quantity, calculated/initial expressions', () => {
    const REF_URL  = 'http://hl7.org/fhir/StructureDefinition/questionnaire-referenceResource';
    const UNIT_URL = 'http://hl7.org/fhir/StructureDefinition/questionnaire-unit';
    const CALC_URL = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-calculatedExpression';
    const INIT_URL = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-initialExpression';

    it('reads referenceResource from reference item', () => {
      importFHIR(minQ([{
        linkId: 'q1', type: 'reference', text: 'Q',
        extension: [{ url: REF_URL, valueCode: 'Patient' }],
      }]));
      expect(_tree[0].referenceResource).toBe('Patient');
    });

    it('reads quantityUnit from questionnaire-unit extension', () => {
      importFHIR(minQ([{
        linkId: 'q1', type: 'quantity', text: 'Q',
        extension: [{ url: UNIT_URL, valueCoding: { code: 'kg', system: 'http://unitsofmeasure.org' } }],
      }]));
      expect(_tree[0].quantityUnit).toBe('kg');
    });

    it('reads _calculatedExpr from SDC calculatedExpression extension', () => {
      importFHIR(minQ([{
        linkId: 'q1', type: 'decimal', text: 'Q',
        extension: [{ url: CALC_URL, valueExpression: { language: 'text/fhirpath', expression: '%total * 2' } }],
      }]));
      expect(_tree[0]._calculatedExpr).toBe('%total * 2');
    });

    it('reads _initialExpr from SDC initialExpression extension', () => {
      importFHIR(minQ([{
        linkId: 'q1', type: 'string', text: 'Q',
        extension: [{ url: INIT_URL, valueExpression: { language: 'text/fhirpath', expression: '%patient.name' } }],
      }]));
      expect(_tree[0]._initialExpr).toBe('%patient.name');
    });
  });

  // ── _sliderStep ───────────────────────────────────────────────────────────
  describe('_sliderStep', () => {
    const SLIDER_URL = 'http://hl7.org/fhir/StructureDefinition/questionnaire-sliderStepValue';

    it('reads sliderStepValue integer into _sliderStep', () => {
      importFHIR(minQ([{
        linkId: 'q1', type: 'integer', text: 'Q',
        extension: [{ url: SLIDER_URL, valueInteger: 1 }],
      }]));
      expect(_tree[0]._sliderStep).toBe(1);
    });
  });

  // ── _maxDecimalPlaces ─────────────────────────────────────────────────────
  describe('_maxDecimalPlaces', () => {
    const MDP_URL = 'http://hl7.org/fhir/StructureDefinition/maxDecimalPlaces';

    it('reads maxDecimalPlaces valueInteger into _maxDecimalPlaces', () => {
      importFHIR(minQ([{
        linkId: 'q1', type: 'decimal', text: 'Q',
        extension: [{ url: MDP_URL, valueInteger: 2 }],
      }]));
      expect(_tree[0]._maxDecimalPlaces).toBe(2);
    });

    it('reads maxDecimalPlaces = 0', () => {
      importFHIR(minQ([{
        linkId: 'q1', type: 'decimal', text: 'Q',
        extension: [{ url: MDP_URL, valueInteger: 0 }],
      }]));
      expect(_tree[0]._maxDecimalPlaces).toBe(0);
    });

    it('does not set _maxDecimalPlaces when extension is absent', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'decimal', text: 'Q' }]));
      expect(_tree[0]._maxDecimalPlaces).toBeUndefined();
    });
  });

  // ── questionnaire-itemControl ─────────────────────────────────────────────
  describe('questionnaire-itemControl', () => {
    const IC_URL = 'http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl';
    const ic = code => ({ url: IC_URL, valueCodeableConcept: { coding: [{ system: 'http://hl7.org/fhir/questionnaire-item-control', code }] } });

    it('check-box on choice → checklist itemType', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'choice', text: 'Q', extension: [ic('check-box')] }]));
      expect(_tree[0].itemType).toBe('checklist');
    });

    it('radio-button on choice → radio itemType', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'choice', text: 'Q', extension: [ic('radio-button')] }]));
      expect(_tree[0].itemType).toBe('radio');
    });

    it('autocomplete on choice → select with _itemControl', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'choice', text: 'Q', extension: [ic('autocomplete')] }]));
      expect(_tree[0].itemType).toBe('select');
      expect(_tree[0]._itemControl).toBe('autocomplete');
    });

    it('drop-down on choice → select with _itemControl', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'choice', text: 'Q', extension: [ic('drop-down')] }]));
      expect(_tree[0].itemType).toBe('select');
      expect(_tree[0]._itemControl).toBe('drop-down');
    });

    it('text-area on string → text with _itemControl', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'string', text: 'Q', extension: [ic('text-area')] }]));
      expect(_tree[0].itemType).toBe('text');
      expect(_tree[0]._itemControl).toBe('text-area');
    });

    it('text-box on string → text with _itemControl', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'string', text: 'Q', extension: [ic('text-box')] }]));
      expect(_tree[0].itemType).toBe('text');
      expect(_tree[0]._itemControl).toBe('text-box');
    });

    it('spinner on integer → integer with _itemControl', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'integer', text: 'Q', extension: [ic('spinner')] }]));
      expect(_tree[0].itemType).toBe('integer');
      expect(_tree[0]._itemControl).toBe('spinner');
    });

    it('no itemControl extension → no _itemControl property', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'choice', text: 'Q' }]));
      expect(_tree[0]._itemControl).toBeUndefined();
    });
  });

  // ── _maxFileSizeMB ────────────────────────────────────────────────────────
  describe('_maxFileSizeMB', () => {
    const MS_URL = 'http://hl7.org/fhir/StructureDefinition/maxSize';

    it('reads maxSize valueDecimal into node._maxFileSizeMB', () => {
      importFHIR(minQ([{
        linkId: 'q1', type: 'attachment', text: 'Q',
        extension: [{ url: MS_URL, valueDecimal: 5 }],
      }]));
      expect(_tree[0]._maxFileSizeMB).toBe(5);
    });

    it('reads fractional maxSize into _maxFileSizeMB', () => {
      importFHIR(minQ([{
        linkId: 'q1', type: 'attachment', text: 'Q',
        extension: [{ url: MS_URL, valueDecimal: 2.5 }],
      }]));
      expect(_tree[0]._maxFileSizeMB).toBe(2.5);
    });

    it('does not set _maxFileSizeMB when extension is absent', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'attachment', text: 'Q' }]));
      expect(_tree[0]._maxFileSizeMB).toBeUndefined();
    });

    it('does not collect maxSize as unknown extension', () => {
      importFHIR(minQ([{
        linkId: 'q1', type: 'attachment', text: 'Q',
        extension: [{ url: MS_URL, valueDecimal: 10 }],
      }]));
      expect(_tree[0]._unknownExtensions).toBeUndefined();
    });
  });

  // ── _mimeTypes ────────────────────────────────────────────────────────────
  describe('_mimeTypes', () => {
    const MT_URL = 'http://hl7.org/fhir/StructureDefinition/mimeType';

    it('reads multiple mimeType extensions into node._mimeTypes array', () => {
      importFHIR(minQ([{
        linkId: 'q1', type: 'attachment', text: 'Q',
        extension: [
          { url: MT_URL, valueCode: 'image/jpeg' },
          { url: MT_URL, valueCode: 'application/pdf' },
        ],
      }]));
      expect(_tree[0]._mimeTypes).toEqual(['image/jpeg', 'application/pdf']);
    });

    it('reads a single mimeType extension into a one-element array', () => {
      importFHIR(minQ([{
        linkId: 'q1', type: 'attachment', text: 'Q',
        extension: [{ url: MT_URL, valueCode: 'image/*' }],
      }]));
      expect(_tree[0]._mimeTypes).toEqual(['image/*']);
    });

    it('does not set _mimeTypes when no mimeType extensions are present', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'attachment', text: 'Q' }]));
      expect(_tree[0]._mimeTypes).toBeUndefined();
    });

    it('does not collect mimeType as unknown extension', () => {
      importFHIR(minQ([{
        linkId: 'q1', type: 'attachment', text: 'Q',
        extension: [{ url: MT_URL, valueCode: 'image/jpeg' }],
      }]));
      expect(_tree[0]._unknownExtensions).toBeUndefined();
    });

    it('ignores mimeType entries without valueCode', () => {
      importFHIR(minQ([{
        linkId: 'q1', type: 'attachment', text: 'Q',
        extension: [
          { url: MT_URL, valueCode: 'image/jpeg' },
          { url: MT_URL },
        ],
      }]));
      expect(_tree[0]._mimeTypes).toEqual(['image/jpeg']);
    });
  });

  // ── _optionOrdinals ───────────────────────────────────────────────────────
  describe('_optionOrdinals', () => {
    const ORD_URL = 'http://hl7.org/fhir/StructureDefinition/ordinalValue';

    it('reads ordinalValue from answerOption.extension', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'choice', text: 'Q',
        answerOption: [{
          valueCoding: { code: 'a', display: 'Option A' },
          extension: [{ url: ORD_URL, valueDecimal: 1.0 }],
        }],
      }]));
      expect(_tree[0]._optionOrdinals).toEqual({ a: 1.0 });
    });

    it('reads ordinalValue from answerOption.valueCoding.extension (older style)', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'choice', text: 'Q',
        answerOption: [{
          valueCoding: {
            code: 'b', display: 'Option B',
            extension: [{ url: ORD_URL, valueDecimal: 2.0 }],
          },
        }],
      }]));
      expect(_tree[0]._optionOrdinals).toEqual({ b: 2.0 });
    });
  });

  // ── _optionPrefixes ───────────────────────────────────────────────────────
  describe('_optionPrefixes', () => {
    const PFX_URL = 'http://hl7.org/fhir/StructureDefinition/questionnaire-optionPrefix';

    it('reads questionnaire-optionPrefix from answerOption.extension', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'choice', text: 'Q',
        answerOption: [
          {
            valueCoding: { code: 'a', display: 'Option A' },
            extension: [{ url: PFX_URL, valueString: 'A.' }],
          },
          {
            valueCoding: { code: 'b', display: 'Option B' },
            extension: [{ url: PFX_URL, valueString: 'B.' }],
          },
        ],
      }]));
      expect(_tree[0]._optionPrefixes).toEqual({ a: 'A.', b: 'B.' });
    });

    it('ignores options without questionnaire-optionPrefix extension', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'choice', text: 'Q',
        answerOption: [
          { valueCoding: { code: 'a', display: 'Option A' } },
        ],
      }]));
      expect(_tree[0]._optionPrefixes).toBeUndefined();
    });

    it('handles mixed options (some with prefix, some without)', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'choice', text: 'Q',
        answerOption: [
          {
            valueCoding: { code: 'la1', display: 'Never' },
            extension: [{ url: PFX_URL, valueString: '1.' }],
          },
          { valueCoding: { code: 'la2', display: 'Sometimes' } },
        ],
      }]));
      expect(_tree[0]._optionPrefixes).toEqual({ la1: '1.' });
    });

    it('reads prefix alongside ordinalValue on the same option', () => {
      const ORD_URL = 'http://hl7.org/fhir/StructureDefinition/ordinalValue';
      importFHIR(minQ([{ linkId: 'q1', type: 'choice', text: 'Q',
        answerOption: [{
          valueCoding: { code: 'a', display: 'Option A' },
          extension: [
            { url: ORD_URL, valueDecimal: 0 },
            { url: PFX_URL, valueString: 'A.' },
          ],
        }],
      }]));
      expect(_tree[0]._optionOrdinals).toEqual({ a: 0 });
      expect(_tree[0]._optionPrefixes).toEqual({ a: 'A.' });
    });
  });

  // ── initialSelected with integer option ──────────────────────────────────
  describe('answerOption.initialSelected valueInteger', () => {
    it('reads initialSelected from valueInteger option', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'choice', text: 'Q',
        answerOption: [{ valueInteger: 42, initialSelected: true }],
      }]));
      expect(_tree[0]._initialSelected).toBe('42');
    });
  });

  // ── initial[] with unrecognised value type ────────────────────────────────
  describe('item.initial[] unrecognised type', () => {
    it('ignores initial entries with no recognised value type', () => {
      importFHIR(minQ([{ linkId: 'q1', type: 'string', text: 'Q',
        initial: [{}],
      }]));
      expect(_tree[0]._initialValue).toBeUndefined();
    });
  });

  // ── non-group item with sub-items (synthetic group wrap) ──────────────────
  describe('non-group item with sub-items', () => {
    it('wraps a non-group question with item[] in a synthetic group', () => {
      importFHIR(minQ([{
        linkId: 'q1', type: 'string', text: 'Parent',
        item: [{ linkId: 'q1.1', type: 'string', text: 'Child' }],
      }]));
      expect(_tree[0].type).toBe('group');
      expect(_tree[0].id).toBe('q1-grp');
      expect(_tree[0].children).toHaveLength(2); // parent item + child
    });
  });
});

// ── group import (fhirItemToNode group branch) ────────────────────────────────
describe('importFHIR — group items', () => {
  const minQ = (items = []) => ({ resourceType: 'Questionnaire', title: 'Test', item: items });
  const CONSTRAINT_URL  = 'http://hl7.org/fhir/StructureDefinition/questionnaire-constraint';
  const SUPPORT_URL     = 'http://hl7.org/fhir/StructureDefinition/questionnaire-supportLink';
  const HIDDEN_URL_SDC  = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-hidden';
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
      extension: [{ url: 'http://vendor.example.com/custom', valueString: 'val' }],
    }]));
    expect(_tree[0]._unknownExtensions).toHaveLength(1);
    expect(_tree[0]._unknownExtensions[0].url).toBe('http://vendor.example.com/custom');
    expect(_tree[0]._unknownExtensions[0].valueString).toBe('val');
  });

  it('does not collect known extensions (e.g. minLength) as unknown', () => {
    importFHIR(minQ([{
      linkId: 'q1', type: 'string', text: 'Q',
      extension: [{ url: 'http://hl7.org/fhir/StructureDefinition/minLength', valueInteger: 3 }],
    }]));
    expect(_tree[0]._unknownExtensions).toBeUndefined();
    expect(_tree[0]._minLength).toBe(3);
  });

  it('separates known and unknown extensions on the same item', () => {
    importFHIR(minQ([{
      linkId: 'q1', type: 'string', text: 'Q',
      extension: [
        { url: 'http://hl7.org/fhir/StructureDefinition/minLength', valueInteger: 2 },
        { url: 'http://vendor.example.com/custom', valueString: 'val' },
      ],
    }]));
    expect(_tree[0]._minLength).toBe(2);
    expect(_tree[0]._unknownExtensions).toHaveLength(1);
    expect(_tree[0]._unknownExtensions[0].url).toBe('http://vendor.example.com/custom');
  });

  it('collects unknown extension on a group into _unknownExtensions', () => {
    importFHIR(minQ([{
      linkId: 'g1', type: 'group', text: 'G',
      extension: [{ url: 'http://vendor.example.com/group-ext', valueInteger: 99 }],
      item: [{ linkId: 'q1', type: 'string', text: 'Q' }],
    }]));
    expect(_tree[0]._unknownExtensions).toHaveLength(1);
    expect(_tree[0]._unknownExtensions[0].url).toBe('http://vendor.example.com/group-ext');
    expect(_tree[0]._unknownExtensions[0].valueInteger).toBe(99);
  });

  it('leaves _unknownExtensions undefined when no extensions are present', () => {
    importFHIR(minQ([{ linkId: 'q1', type: 'string', text: 'Q' }]));
    expect(_tree[0]._unknownExtensions).toBeUndefined();
  });
});


// ── replaces extension ────────────────────────────────────────────────────────
describe('importFHIR — replaces extension', () => {
  const REPLACES_URL = 'http://hl7.org/fhir/StructureDefinition/replaces';
  beforeEach(() => { _tree.splice(0); _questMeta.replaces = []; });

  const minQ = (exts = []) => ({
    resourceType: 'Questionnaire', title: 'T',
    extension: exts,
    item: [{ linkId: 'q1', type: 'string', text: 'Q' }],
  });

  it('reads a single replaces extension into questMeta.replaces', () => {
    importFHIR(minQ([{ url: REPLACES_URL, valueCanonical: 'http://example.org/fhir/Questionnaire/prior|1.0' }]));
    expect(_questMeta.replaces).toEqual(['http://example.org/fhir/Questionnaire/prior|1.0']);
  });

  it('reads multiple replaces extensions into questMeta.replaces array', () => {
    importFHIR(minQ([
      { url: REPLACES_URL, valueCanonical: 'http://example.org/fhir/Questionnaire/v1' },
      { url: REPLACES_URL, valueCanonical: 'http://example.org/fhir/Questionnaire/v2' },
    ]));
    expect(_questMeta.replaces).toHaveLength(2);
    expect(_questMeta.replaces[0]).toBe('http://example.org/fhir/Questionnaire/v1');
    expect(_questMeta.replaces[1]).toBe('http://example.org/fhir/Questionnaire/v2');
  });

  it('sets replaces to [] when no replaces extensions are present', () => {
    importFHIR(minQ([]));
    expect(_questMeta.replaces).toEqual([]);
  });

  it('excludes replaces entries from _rawQuestExtensions', () => {
    importFHIR(minQ([{ url: REPLACES_URL, valueCanonical: 'http://example.org/fhir/Questionnaire/prior' }]));
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
  const COLL_URL = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-collapsible';
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
  const OL_URL = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-openLabel';
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
  const DN_URL = 'http://hl7.org/fhir/StructureDefinition/designNote';
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
  const AE_URL = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-answerExpression';
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
