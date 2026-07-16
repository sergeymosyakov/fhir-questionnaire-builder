// Tests for export helpers.
// export.js imports reactive state — we mock ../js/state.js.

import { describe, it, expect, vi, beforeAll } from 'vitest';

// Minimal state mock — buildFHIRObject reads questDoc via _svc
const _tree = [];
const _questVariables = [];
const _questContained = [];
const _questMeta = { id: '', url: '', version: '', title: '', status: 'draft', publisher: '', description: '',
  name: '', date: '', subjectType: [], purpose: '', copyright: '', approvalDate: '', lastReviewDate: '',
  effectivePeriodStart: '', effectivePeriodEnd: '', replaces: [], _rawQuestExtensions: [],
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
configureExport({ questDoc: _questDoc });

// Helper: reset tree and run buildFHIRObject
function build(nodes, title = 'Test Q', vars = []) {
  _tree.splice(0, _tree.length, ...nodes);
  _questVariables.splice(0, _questVariables.length, ...vars);
  _questDoc.rawFhir = { title };
  return buildFHIRObject();
}

// ── basic structure ───────────────────────────────────────────────────────────
describe('buildFHIRObject — structure', () => {
  it('produces a FHIR R4 Questionnaire', () => {
    const q = build([]);
    expect(q.resourceType).toBe('Questionnaire');
    expect(q.status).toBe('draft');
    expect(q.subjectType).toBeUndefined();
  });

  it('exports subjectType when set', () => {
    _questMeta.subjectType = ['Patient', 'Practitioner'];
    const q = buildFHIRObject();
    expect(q.subjectType).toEqual(['Patient', 'Practitioner']);
    _questMeta.subjectType = [];
  });

  it('omits subjectType when empty', () => {
    _questMeta.subjectType = [];
    const q = buildFHIRObject();
    expect(q.subjectType).toBeUndefined();
  });

  it('uses title from rawFhir', () => {
    const q = build([], 'My Survey');
    expect(q.title).toBe('My Survey');
  });

  it('falls back to Untitled Questionnaire when rawFhir has no title', () => {
    _questDoc.rawFhir = null;
    _tree.splice(0);
    const q = buildFHIRObject();
    expect(q.title).toBe('Untitled Questionnaire');
  });
});

// ── item type mapping ─────────────────────────────────────────────────────────
describe('buildFHIRObject — item type mapping', () => {
  const cases = [
    ['checkbox',    'boolean'],
    ['integer',     'integer'],
    ['decimal',     'decimal'],
    ['number',       'decimal'],
    ['text',        'string'],
    ['date',        'date'],
    ['url',         'url'],
    ['select',      'choice'],
    ['radio',       'choice'],
    ['open-choice', 'open-choice'],
    ['attachment',  'attachment'],
    ['display',     'display'],
  ];

  for (const [itemType, fhirType] of cases) {
    it(`maps ${itemType} → ${fhirType}`, () => {
      const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType }]);
      expect(q.item[0].type).toBe(fhirType);
    });
  }
});

// ── required field ────────────────────────────────────────────────────────────
describe('buildFHIRObject — required', () => {
  it('exports required:true when mandatory=true', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'text', mandatory: true }]);
    expect(q.item[0].required).toBe(true);
  });

  it('omits required when mandatory=false', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'text', mandatory: false }]);
    expect(q.item[0].required).toBeUndefined();
  });
});

// ── repeats ───────────────────────────────────────────────────────────────────
describe('buildFHIRObject — repeats', () => {
  it('exports repeats:true when node.repeats is true', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'text', repeats: true }]);
    expect(q.item[0].repeats).toBe(true);
  });

  it('omits repeats when node.repeats is false', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'text', repeats: false }]);
    expect(q.item[0].repeats).toBeUndefined();
  });

  it('omits repeats when node.repeats is absent', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'text' }]);
    expect(q.item[0].repeats).toBeUndefined();
  });
});

// ── enableWhen ────────────────────────────────────────────────────────────────
describe('buildFHIRObject — enableWhen', () => {
  it('exports enableWhen array directly', () => {
    const q = build([{
      id: 'q1', type: 'item', title: 'Q', itemType: 'text',
      enableWhen: [{ question: 'age-item', operator: '=', answerBoolean: true }],
      enableBehavior: 'all',
    }]);
    expect(q.item[0].enableWhen).toHaveLength(1);
    expect(q.item[0].enableWhen[0].question).toBe('age-item');
    expect(q.item[0].enableWhen[0].operator).toBe('=');
    expect(q.item[0].enableWhen[0].answerBoolean).toBe(true);
  });

  it('sets enableBehavior:any when node.enableBehavior is any', () => {
    const q = build([{
      id: 'q1', type: 'item', title: 'Q', itemType: 'text',
      enableWhen: [
        { question: 'q1', operator: '=', answerBoolean: true },
        { question: 'q2', operator: '=', answerString: 'yes' },
      ],
      enableBehavior: 'any',
    }]);
    expect(q.item[0].enableBehavior).toBe('any');
  });

  it('writes enableBehavior:all when enableWhen has >1 condition (que-12)', () => {
    const q = build([{
      id: 'q1', type: 'item', title: 'Q', itemType: 'text',
      enableWhen: [
        { question: 'q1', operator: '=', answerBoolean: true },
        { question: 'q2', operator: '=', answerString: 'yes' },
      ],
      enableBehavior: 'all',
    }]);
    expect(q.item[0].enableBehavior).toBe('all');
  });

  it('omits enableBehavior when enableWhen has only 1 condition and behavior is all', () => {
    const q = build([{
      id: 'q1', type: 'item', title: 'Q', itemType: 'text',
      enableWhen: [{ question: 'q1', operator: '=', answerBoolean: true }],
      enableBehavior: 'all',
    }]);
    expect(q.item[0].enableBehavior).toBeUndefined();
  });

  it('omits enableWhen when array is empty', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'text', enableWhen: [] }]);
    expect(q.item[0].enableWhen).toBeUndefined();
  });

  it('exports enableWhenExpression as SDC extension', () => {
    const q = build([{
      id: 'q1', type: 'item', title: 'Q', itemType: 'text',
      enableWhen: [], enableBehavior: 'all',
      enableWhenExpression: '%age > 18',
    }]);
    const ext = q.item[0].extension || [];
    const ewe = ext.find(e => e.url.includes('enableWhenExpression'));
    expect(ewe).toBeDefined();
    expect(ewe.valueExpression.expression).toBe('%age > 18');
  });

  it('copies enableWhen entries as independent objects', () => {
    const ew = { question: 'q1', operator: '=', answerBoolean: true };
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'text', enableWhen: [ew], enableBehavior: 'all' }]);
    expect(q.item[0].enableWhen[0]).not.toBe(ew);
    expect(q.item[0].enableWhen[0].question).toBe('q1');
  });
});

// ── questionnaire-constraint ──────────────────────────────────────────────────
describe('buildFHIRObject — constraint', () => {
  it('exports constraint[] as questionnaire-constraint extensions', () => {
    const q = build([{
      id: 'q1', type: 'item', title: 'Q', itemType: 'text',
      enableWhen: [],
      constraint: [{
        key: 'bmi-ok',
        expression: '%bmi < 50',
        human: 'BMI must be less than 50',
        severity: 'error',
      }],
    }]);
    const ext = q.item[0].extension || [];
    const c = ext.find(e => e.url === 'http://hl7.org/fhir/StructureDefinition/questionnaire-constraint');
    expect(c).toBeDefined();
    expect(c.extension.find(e => e.url === 'key')?.valueId).toBe('bmi-ok');
    expect(c.extension.find(e => e.url === 'expression')?.valueString).toBe('%bmi < 50');
    expect(c.extension.find(e => e.url === 'human')?.valueString).toBe('BMI must be less than 50');
    expect(c.extension.find(e => e.url === 'severity')?.valueCode).toBe('error');
  });

  it('skips constraints without expression', () => {
    const q = build([{
      id: 'q1', type: 'item', title: 'Q', itemType: 'text',
      enableWhen: [],
      constraint: [{ key: 'k', expression: '', human: 'h', severity: 'error' }],
    }]);
    const ext = q.item[0].extension || [];
    expect(ext.some(e => e.url.includes('questionnaire-constraint'))).toBe(false);
  });

  it('omits extension for empty constraint array', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'text', enableWhen: [], constraint: [] }]);
    const ext = q.item[0].extension || [];
    expect(ext.some(e => e.url.includes('questionnaire-constraint'))).toBe(false);
  });
});

// ── answerOption for select/radio ─────────────────────────────────────────────
describe('buildFHIRObject — answerOption', () => {
  it('exports answerOption for select', () => {
    const q = build([{
      id: 'q1', type: 'item', title: 'Q', itemType: 'select', options: 'a=Alpha,b=Beta',
    }]);
    expect(q.item[0].answerOption).toHaveLength(2);
    expect(q.item[0].answerOption[0].valueCoding.code).toBe('a');
  });

  it('exports answerOption for open-choice', () => {
    const q = build([{
      id: 'q1', type: 'item', title: 'Q', itemType: 'open-choice', options: 'x=Xray,y=Yellow',
    }]);
    expect(q.item[0].answerOption).toHaveLength(2);
    expect(q.item[0].answerOption[1].valueCoding.code).toBe('y');
  });

  it('exports radio-button itemControl extension for radio', () => {
    const q = build([{
      id: 'q1', type: 'item', title: 'Q', itemType: 'radio', options: 'a=A,b=B',
    }]);
    const ext = q.item[0].extension || [];
    expect(ext.some(e => e.url.includes('questionnaire-itemControl'))).toBe(true);
  });

  it('exports check-box itemControl extension for checklist', () => {
    const q = build([{
      id: 'q1', type: 'item', title: 'Q', itemType: 'checklist', options: 'a=A,b=B',
    }]);
    const ext = q.item[0].extension || [];
    const ic = ext.find(e => e.url.includes('questionnaire-itemControl'));
    expect(ic).toBeDefined();
    expect(ic.valueCodeableConcept.coding[0].code).toBe('check-box');
  });

  it('checklist exports as FHIR type choice with repeats true', () => {
    const q = build([{
      id: 'q1', type: 'item', title: 'Q', itemType: 'checklist', options: 'a=A,b=B',
    }]);
    expect(q.item[0].type).toBe('choice');
    expect(q.item[0].repeats).toBe(true);
  });

  it('checklist exports answerOption', () => {
    const q = build([{
      id: 'q1', type: 'item', title: 'Q', itemType: 'checklist', options: 'a=A,b=B',
    }]);
    expect(q.item[0].answerOption).toHaveLength(2);
  });

  it('exports _itemControl as itemControl extension (autocomplete)', () => {
    const q = build([{
      id: 'q1', type: 'item', title: 'Q', itemType: 'select', options: 'a=A', _itemControl: 'autocomplete',
    }]);
    const ext = q.item[0].extension || [];
    const ic = ext.find(e => e.url.includes('questionnaire-itemControl'));
    expect(ic).toBeDefined();
    expect(ic.valueCodeableConcept.coding[0].code).toBe('autocomplete');
  });

  it('exports _itemControl as itemControl extension (flyover on display)', () => {
    const q = build([{
      id: 'q1', type: 'item', title: 'Hover help', itemType: 'display', _itemControl: 'flyover',
    }]);
    const ext = q.item[0].extension || [];
    const ic = ext.find(e => e.url.includes('questionnaire-itemControl'));
    expect(ic).toBeDefined();
    expect(ic.valueCodeableConcept.coding[0].code).toBe('flyover');
  });

  it('exports _itemControl as itemControl extension (header on group)', () => {
    const q = build([{
      id: 'g1', type: 'group', title: 'Section', _itemControl: 'header',
      children: [{ id: 'g1.1', type: 'item', title: 'Q', itemType: 'text' }],
    }]);
    const ext = q.item[0].extension || [];
    const ic = ext.find(e => e.url.includes('questionnaire-itemControl'));
    expect(ic).toBeDefined();
    expect(ic.valueCodeableConcept.coding[0].code).toBe('header');
    expect(q.item[0].type).toBe('group');
  });

  it('exports _itemControl as itemControl extension (text-area)', () => {
    const q = build([{
      id: 'q1', type: 'item', title: 'Q', itemType: 'text', _itemControl: 'text-area',
    }]);
    const ext = q.item[0].extension || [];
    const ic = ext.find(e => e.url.includes('questionnaire-itemControl'));
    expect(ic).toBeDefined();
    expect(ic.valueCodeableConcept.coding[0].code).toBe('text-area');
  });

  it('exports _itemControl as itemControl extension (spinner)', () => {
    const q = build([{
      id: 'q1', type: 'item', title: 'Q', itemType: 'integer', _itemControl: 'spinner',
    }]);
    const ext = q.item[0].extension || [];
    const ic = ext.find(e => e.url.includes('questionnaire-itemControl'));
    expect(ic).toBeDefined();
    expect(ic.valueCodeableConcept.coding[0].code).toBe('spinner');
  });

  it('does not export itemControl when _itemControl is absent and type is select', () => {
    const q = build([{
      id: 'q1', type: 'item', title: 'Q', itemType: 'select', options: 'a=A',
    }]);
    const ext = q.item[0].extension || [];
    expect(ext.some(e => e.url.includes('questionnaire-itemControl'))).toBe(false);
  });
});

// ── answerOption _rawAnswerOptions round-trip ─────────────────────────────────
describe('buildFHIRObject — _rawAnswerOptions round-trip', () => {
  it('exports valueString options as valueString (not valueCoding)', () => {
    const q = build([{
      id: 'q1', type: 'item', title: 'Q', itemType: 'select', options: 'Email, Phone',
      _rawAnswerOptions: [{ valueString: 'Email' }, { valueString: 'Phone' }],
    }]);
    expect(q.item[0].answerOption[0].valueString).toBe('Email');
    expect(q.item[0].answerOption[0].valueCoding).toBeUndefined();
  });

  it('exports valueInteger options as valueInteger', () => {
    const q = build([{
      id: 'q1', type: 'item', title: 'Q', itemType: 'select', options: '0, 1',
      _rawAnswerOptions: [{ valueInteger: 0 }, { valueInteger: 1 }],
    }]);
    expect(q.item[0].answerOption[0].valueInteger).toBe(0);
    expect(q.item[0].answerOption[0].valueCoding).toBeUndefined();
  });

  it('exports valueDate options as valueDate', () => {
    const q = build([{
      id: 'q1', type: 'item', title: 'Q', itemType: 'select', options: '2026-06-01',
      _rawAnswerOptions: [{ valueDate: '2026-06-01' }],
    }]);
    expect(q.item[0].answerOption[0].valueDate).toBe('2026-06-01');
    expect(q.item[0].answerOption[0].valueCoding).toBeUndefined();
  });

  it('exports valueTime options as valueTime', () => {
    const q = build([{
      id: 'q1', type: 'item', title: 'Q', itemType: 'select', options: '09:00:00',
      _rawAnswerOptions: [{ valueTime: '09:00:00' }],
    }]);
    expect(q.item[0].answerOption[0].valueTime).toBe('09:00:00');
    expect(q.item[0].answerOption[0].valueCoding).toBeUndefined();
  });

  it('exports valueReference options as valueReference', () => {
    const q = build([{
      id: 'q1', type: 'item', title: 'Q', itemType: 'select', options: 'Practitioner/p1',
      _rawAnswerOptions: [{ valueReference: { reference: 'Practitioner/p1', display: 'Dr. A' } }],
    }]);
    expect(q.item[0].answerOption[0].valueReference?.reference).toBe('Practitioner/p1');
    expect(q.item[0].answerOption[0].valueCoding).toBeUndefined();
  });

  it('preserves initialSelected on non-Coding round-trip', () => {
    const q = build([{
      id: 'q1', type: 'item', title: 'Q', itemType: 'select',
      options: 'Email, Phone',
      _rawAnswerOptions: [{ valueString: 'Email' }, { valueString: 'Phone' }],
      _initialSelected: 'Phone',
    }]);
    const selected = q.item[0].answerOption.find(o => o.initialSelected);
    expect(selected?.valueString).toBe('Phone');
  });

  it('uses options string path when _rawAnswerOptions absent', () => {
    const q = build([{
      id: 'q1', type: 'item', title: 'Q', itemType: 'select', options: 'a=Alpha',
    }]);
    expect(q.item[0].answerOption[0].valueCoding?.code).toBe('a');
  });
});

// ── groups ────────────────────────────────────────────────────────────────────
describe('buildFHIRObject — groups', () => {
  it('exports group with children', () => {
    const q = build([{
      id: 'g1', type: 'group', title: 'Section',
      children: [{ id: 'q1', type: 'item', title: 'Q', itemType: 'text' }],
    }]);
    expect(q.item[0].type).toBe('group');
    expect(q.item[0].item).toHaveLength(1);
    expect(q.item[0].item[0].linkId).toBe('q1');
  });

  it('exports enableBehavior:any from node.enableBehavior for a group', () => {
    const q = build([{
      id: 'g1', type: 'group', title: 'G',
      enableWhen: [{ question: 'q1', operator: '=', answerBoolean: true }],
      enableBehavior: 'any',
      children: [],
    }]);
    expect(q.item[0].enableBehavior).toBe('any');
  });

  it('does not set enableBehavior on group with no enableWhen', () => {
    const q = build([{
      id: 'g1', type: 'group', title: 'G',
      enableWhen: [], enableBehavior: 'all',
      children: [],
    }]);
    expect(q.item[0].enableBehavior).toBeUndefined();
  });
});

// ── SDC variables ─────────────────────────────────────────────────────────────
describe('buildFHIRObject — SDC variables', () => {
  it('includes sdc-questionnaire-variable extensions when vars present', () => {
    const q = build([], 'Q', [{ name: 'bmiCalc', expression: '%weight / (%height * %height)' }]);
    expect(q.extension).toHaveLength(1);
    expect(q.extension[0].valueExpression.name).toBe('bmiCalc');
  });

  it('omits extension when no variables', () => {
    const q = build([], 'Q', []);
    expect(q.extension).toBeUndefined();
  });

  it('skips variables without name or expression', () => {
    const q = build([], 'Q', [{ name: '', expression: 'x' }, { name: 'y', expression: '' }]);
    expect(q.extension).toBeUndefined();
  });
});

// ── OR group — logicWithParent round-trip ──────────────────────────────────────
describe('buildFHIRObject — OR group constraint', () => {
  it('exports system OR-group constraint when logicWithParent is OR', () => {
    const q = build([{
      id: 'g1', type: 'group', title: 'G', logicWithParent: 'OR',
      children: [
        { id: 'c1', type: 'item', title: 'A', itemType: 'text' },
        { id: 'c2', type: 'item', title: 'B', itemType: 'text' },
      ],
    }]);
    const ext = q.item[0].extension || [];
    const orExt = ext.find(e => e.url === 'http://hl7.org/fhir/StructureDefinition/questionnaire-constraint');
    expect(orExt).toBeDefined();
    const key = orExt.extension.find(e => e.url === 'key')?.valueId;
    expect(key).toMatch(/group-or/);
    const expr = orExt.extension.find(e => e.url === 'expression')?.valueString;
    expect(expr).toContain("linkId='c1'");
    expect(expr).toContain("linkId='c2'");
    expect(expr).toContain(' or ');
  });

  it('does not export OR-group constraint when logicWithParent is AND', () => {
    const q = build([{
      id: 'g1', type: 'group', title: 'G', logicWithParent: 'AND',
      children: [{ id: 'c1', type: 'item', title: 'A', itemType: 'text' }],
    }]);
    const ext = q.item[0].extension || [];
    const orExt = ext.find(e =>
      e.url === 'http://hl7.org/fhir/StructureDefinition/questionnaire-constraint' &&
      e.extension?.find(x => x.url === 'key' && String(x.valueId).includes('group-or'))
    );
    expect(orExt).toBeUndefined();
  });

  it('user constraints are preserved alongside OR-group constraint', () => {
    const q = build([{
      id: 'g1', type: 'group', title: 'G', logicWithParent: 'OR',
      constraint: [{ key: 'user-rule', severity: 'error', human: 'msg', expression: '%age > 0' }],
      children: [{ id: 'c1', type: 'item', title: 'A', itemType: 'text' }],
    }]);
    const allConstraints = (q.item[0].extension || []).filter(
      e => e.url === 'http://hl7.org/fhir/StructureDefinition/questionnaire-constraint'
    );
    expect(allConstraints).toHaveLength(2);
    const keys = allConstraints.map(c => c.extension.find(e => e.url === 'key')?.valueId);
    expect(keys).toContain('user-rule');
    expect(keys.some(k => String(k).includes('group-or'))).toBe(true);
  });
});

// ── _renderStyle ──────────────────────────────────────────────────────────────
describe('buildFHIRObject — _renderStyle', () => {
  it('exports _renderStyle as _text rendering-style extension', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'text', _renderStyle: 'color: red; font-weight: bold' }]);
    expect(q.item[0]._text).toBeDefined();
    expect(q.item[0]._text.extension[0].url).toContain('rendering-style');
    expect(q.item[0]._text.extension[0].valueString).toBe('color: red; font-weight: bold');
  });

  it('omits _text when _renderStyle is empty or absent', () => {
    const q1 = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'text', _renderStyle: '' }]);
    expect(q1.item[0]._text).toBeUndefined();

    const q2 = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'text' }]);
    expect(q2.item[0]._text).toBeUndefined();
  });
});

// ── Questionnaire.contained[] ─────────────────────────────────────────────────
describe('buildFHIRObject — contained[]', () => {
  it('omits contained when questContained is empty', () => {
    _questContained.splice(0);
    const q = build([]);
    expect(q.contained).toBeUndefined();
  });

  it('exports questContained as Questionnaire.contained', () => {
    _questContained.splice(0);
    _questContained.push({ resourceType: 'ValueSet', id: 'vs-1', title: 'Test VS' });
    const q = build([]);
    expect(q.contained).toHaveLength(1);
    expect(q.contained[0].id).toBe('vs-1');
    _questContained.splice(0);
  });

  it('deep-copies contained resources (mutations do not affect state)', () => {
    _questContained.splice(0);
    const src = { resourceType: 'ValueSet', id: 'vs-2', title: 'Original' };
    _questContained.push(src);
    const q = build([]);
    q.contained[0].title = 'Mutated';
    expect(src.title).toBe('Original');
    _questContained.splice(0);
  });
});

// ── item.answerValueSet ───────────────────────────────────────────────────────
describe('buildFHIRObject — answerValueSet', () => {
  it('exports node._answerValueSet as item.answerValueSet', () => {
    const q = build([{
      id: 'q1', type: 'item', title: 'Diet', itemType: 'select',
      _answerValueSet: 'http://example.org/vs/diet',
      enableWhen: [], constraint: [], options: '', mandatory: false,
    }]);
    expect(q.item[0].answerValueSet).toBe('http://example.org/vs/diet');
  });

  it('does not emit answerValueSet when not set on node', () => {
    const q = build([{
      id: 'q1', type: 'item', title: 'Procedure', itemType: 'select',
      enableWhen: [], constraint: [], options: 'a=Alpha', mandatory: false,
    }]);
    expect(q.item[0].answerValueSet).toBeUndefined();
  });

  it('skips answerOption when _answerValueSet is set (even if options populated)', () => {
    const q = build([{
      id: 'q1', type: 'item', title: 'Diet', itemType: 'select',
      _answerValueSet: '#vs-diet',
      options: 'veg=Vegetarian,omn=Omnivore',
      enableWhen: [], constraint: [], mandatory: false,
    }]);
    expect(q.item[0].answerValueSet).toBe('#vs-diet');
    expect(q.item[0].answerOption).toBeUndefined();
  });

  it('que-5: suppresses answerValueSet on url item (type not in allowed list)', () => {
    const q = build([{
      id: 'q1', type: 'item', title: 'URL', itemType: 'url',
      _answerValueSet: 'http://example.org/vs',
      enableWhen: [], constraint: [], options: '', mandatory: false,
    }]);
    expect(q.item[0].answerValueSet).toBeUndefined();
  });

  it('que-5: suppresses answerValueSet on attachment item', () => {
    const q = build([{
      id: 'q1', type: 'item', title: 'File', itemType: 'attachment',
      _answerValueSet: 'http://example.org/vs',
      enableWhen: [], constraint: [], mandatory: false,
    }]);
    expect(q.item[0].answerValueSet).toBeUndefined();
  });
});

// ── generateNarrativeDiv ─────────────────────────────────────────────────────

describe('generateNarrativeDiv', () => {
  let generateNarrativeDiv;
  beforeAll(async () => {
    ({ generateNarrativeDiv } = await import('../js/fhir/export.js'));
  });

  it('returns a div string containing the questionnaire title', () => {
    const html = generateNarrativeDiv({ title: 'My Q', status: 'draft', item: [] });
    expect(html).toContain('My Q');
    expect(html).toContain('<div');
  });

  it('includes status and publisher when present', () => {
    const html = generateNarrativeDiv({ title: 'T', status: 'active', publisher: 'ACME', item: [] });
    expect(html).toContain('active');
    expect(html).toContain('ACME');
  });

  it('lists item linkIds in the narrative', () => {
    const html = generateNarrativeDiv({
      title: 'T', status: 'draft',
      item: [{ linkId: 'q1', text: 'Question 1', type: 'boolean' }],
    });
    expect(html).toContain('q1');
  });
});

// ── translation export (_exportTranslations / _translationExt / _mergeTranslationExts) ──

describe('buildFHIRObject — translations export', () => {
  it('writes _title.extension translation when questDoc.translations has title', () => {
    _tree.length = 0;
    _questDoc.translations = {
      es: { title: 'Cuestionario', items: {}, opts: {}, ui: {} },
    };
    const q = buildFHIRObject();
    expect(q._title?.extension).toBeDefined();
    const ext = q._title.extension.find(e => e.extension?.some(x => x.valueCode === 'es'));
    expect(ext).toBeTruthy();
    _questDoc.translations = null;
  });

  it('writes item _text.extension translation for a translated item', () => {
    _tree.length = 0;
    _tree.push({
      id: 'q1', type: 'item', itemType: 'text', title: 'Question',
      enableWhen: [], constraint: [], options: '', mandatory: false, repeats: false, children: [],
    });
    _questDoc.translations = {
      es: { title: '', items: { q1: 'Pregunta' }, opts: {}, ui: {} },
    };
    const q = buildFHIRObject();
    const item = q.item[0];
    expect(item._text?.extension).toBeDefined();
    _tree.length = 0;
    _questDoc.translations = null;
  });

  it('does not add _title extension when no translations set', () => {
    _tree.length = 0;
    _questDoc.translations = null;
    const q = buildFHIRObject();
    expect(q._title).toBeUndefined();
  });

  it('writes ui-translations extension for languages with ui strings', () => {
    _tree.length = 0;
    _questDoc.translations = {
      de: { title: '', items: {}, opts: {}, ui: { next: 'Weiter' }, xhtml: {} },
    };
    const q = buildFHIRObject();
    const UI_TRANS_URL = 'http://fhir-qb.app/StructureDefinition/ui-translations';
    const uiExt = (q.extension || []).find(e => e.url === UI_TRANS_URL);
    expect(uiExt).toBeDefined();
    const langSub    = uiExt.extension.find(s => s.url === 'lang');
    const stringsSub = uiExt.extension.find(s => s.url === 'strings');
    expect(langSub?.valueCode).toBe('de');
    expect(JSON.parse(stringsSub.valueString)).toEqual({ next: 'Weiter' });
    _questDoc.translations = null;
  });

  it('writes xhtml-translations extension for languages with xhtml strings', () => {
    _tree.length = 0;
    _questDoc.translations = {
      de: { title: '', items: {}, opts: {}, ui: {}, xhtml: { intro: '<p>Text</p>' } },
    };
    const q = buildFHIRObject();
    const XHTML_TRANS_URL = 'http://fhir-qb.app/StructureDefinition/xhtml-translations';
    const xhtmlExt = (q.extension || []).find(e => e.url === XHTML_TRANS_URL);
    expect(xhtmlExt).toBeDefined();
    const strings = JSON.parse(xhtmlExt.extension.find(s => s.url === 'strings').valueString);
    expect(strings.intro).toBe('<p>Text</p>');
    _questDoc.translations = null;
  });

  it('writes answerOption label translations (_valueCoding._display.extension)', () => {
    _tree.length = 0;
    _tree.push({
      id: 'q1', type: 'item', itemType: 'radio', title: 'Choice Q',
      enableWhen: [], constraint: [], options: 'M, F', mandatory: false, repeats: false, children: [],
    });
    _questDoc.translations = {
      de: { title: '', items: {}, opts: { 'q1__M': 'Männlich' }, ui: {}, xhtml: {} },
    };
    const q = buildFHIRObject();
    const ao = q.item?.[0]?.answerOption?.find(a => a.valueCoding?.code === 'M');
    expect(ao?._valueCoding?._display?.extension).toBeDefined();
    const ext = ao._valueCoding._display.extension.find(e =>
      e.extension?.some(x => x.valueCode === 'de')
    );
    expect(ext).toBeTruthy();
    expect(ext.extension.find(x => x.url === 'content')?.valueString).toBe('Männlich');
    _tree.length = 0;
    _questDoc.translations = null;
  });

  it('_mergeTranslationExts preserves existing non-translation extensions', () => {
    _tree.length = 0;
    // First export: sets up _title extension
    _questDoc.translations = {
      es: { title: 'Primera', items: {}, opts: {}, ui: {}, xhtml: {} },
    };
    buildFHIRObject();
    // Second export: same language, different content — mergeTranslationExts should replace
    _questDoc.translations = {
      es: { title: 'Segunda', items: {}, opts: {}, ui: {}, xhtml: {} },
    };
    const q2 = buildFHIRObject();
    const TRANSLATION_URL = 'http://hl7.org/fhir/StructureDefinition/translation';
    const transExts = (q2._title?.extension || []).filter(e => e.url === TRANSLATION_URL);
    // Should have exactly one translation ext for 'es', not duplicate
    const esExts = transExts.filter(e => e.extension?.some(x => x.valueCode === 'es'));
    expect(esExts).toHaveLength(1);
    expect(esExts[0].extension.find(x => x.url === 'content')?.valueString).toBe('Segunda');
    _questDoc.translations = null;
  });
});
