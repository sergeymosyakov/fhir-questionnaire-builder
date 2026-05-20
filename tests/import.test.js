// Tests for pure helper functions exported from js/fhir/import.js.
// import.js depends on state.js (CDN) — mocked below.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Exposed so importFHIR tests can inspect state after import.
const _tree           = [];
const _questVariables = [];
const _questContained = [];
const _values         = {};
const _rawFhir        = { value: null };
const _bulkUpdate     = { value: false };
const _questMeta      = { id: '', url: '', version: '', title: '', status: 'draft', publisher: '', description: '',
  name: '', date: '', subjectType: 'Patient', purpose: '', copyright: '', approvalDate: '', lastReviewDate: '',
  effectivePeriodStart: '', effectivePeriodEnd: '',
  _rawContact: null, _rawUseContext: null, _rawJurisdiction: null, _rawCode: null };

vi.mock('../js/state.js', () => ({
  tree:           _tree,
  values:         _values,
  rawFhir:        _rawFhir,
  questVariables: _questVariables,
  questContained: { splice: () => { _questContained.splice(0); }, push: (v) => _questContained.push(v) },
  questMeta:      _questMeta,
  _bulkUpdate:    _bulkUpdate,
  resetSeq:       vi.fn(),
  makeGroup:      vi.fn(title => ({ type: 'group', id: 'g', title, children: [], enableWhen: [], enableBehavior: 'all', enableWhenExpression: '', mandatory: null, logicWithParent: 'AND' })),
  makeItem:       vi.fn(title => ({ type: 'item',  id: 'i', title, itemType: 'text', options: '', mandatory: null, enableWhen: [], enableBehavior: 'all', enableWhenExpression: '', constraint: [] })),
  setValue:       (id, val) => { _values[id] = val; },
  clearAllValues: () => { Object.keys(_values).forEach(k => delete _values[k]); },
}));

vi.mock('../js/render-builder.js', () => ({ renderTree: vi.fn() }));

const { fhirTypeToItemType, fhirOptsToStr, humanEnableWhen, applyVisibility, importFHIR } = await import('../js/fhir/import.js');

vi.stubGlobal('alert', vi.fn());

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
      name: '', date: '', subjectType: 'Patient', purpose: '', copyright: '', approvalDate: '', lastReviewDate: '',
      effectivePeriodStart: '', effectivePeriodEnd: '',
      _rawContact: null, _rawUseContext: null, _rawJurisdiction: null, _rawCode: null });
    vi.mocked(alert).mockClear();
  });

  const minQ = (items = [], ext = []) => ({
    resourceType: 'Questionnaire',
    title: 'Test',
    extension: ext,
    item: items,
  });

  it('rejects non-Questionnaire JSON and calls alert', () => {
    importFHIR({ resourceType: 'Patient' });
    expect(alert).toHaveBeenCalled();
    expect(_tree).toHaveLength(0);
  });

  it('rejects invalid JSON string and calls alert', () => {
    importFHIR('{ not valid json }');
    expect(alert).toHaveBeenCalled();
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

  it('populates questMeta.subjectType as comma-separated string', () => {
    importFHIR({ resourceType: 'Questionnaire', subjectType: ['Patient', 'Practitioner'], item: [] });
    expect(_questMeta.subjectType).toBe('Patient, Practitioner');
  });

  it('defaults questMeta.subjectType to Patient when not present', () => {
    importFHIR({ resourceType: 'Questionnaire', item: [] });
    expect(_questMeta.subjectType).toBe('Patient');
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

  // ── item.initial[] multiple values for repeating items ─────────────────────
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
  });

  // ── sdc-questionnaire-entryFormat ────────────────────────────────────────
  describe('_entryFormat', () => {
    const EF_URL = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-entryFormat';

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
});

