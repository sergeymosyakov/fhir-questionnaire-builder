// Tests for export helpers.
// export.js imports reactive state — we mock ../js/state.js.

import { describe, it, expect, vi, afterEach } from 'vitest';

// Minimal state mock — buildFHIRObject reads tree, questVariables, rawFhir
const _tree = [];
const _questVariables = [];
const _questContained = [];
let _rawFhir = { value: null };
const _questMeta = { id: '', url: '', version: '', title: '', status: 'draft', publisher: '', description: '',
  name: '', date: '', subjectType: 'Patient', purpose: '', copyright: '', approvalDate: '', lastReviewDate: '',
  effectivePeriodStart: '', effectivePeriodEnd: '',
  _rawText: null,
  _rawContact: null, _rawUseContext: null, _rawJurisdiction: null, _rawCode: null };

vi.mock('../js/state.js', () => ({
  tree:            _tree,
  questVariables:  _questVariables,
  questContained:  _questContained,
  questMeta:       _questMeta,
  rawFhir:         _rawFhir,
  values:          {},
  _formTick:       { value: 0 },
  _bulkUpdate:     { value: false },
  ref:             v => ({ value: v }),
  reactive:        v => v,
  effect:          () => {},
  calcFormOk:      () => true,
  isMandatory:     () => false,
  CHECKABLE_TYPES: new Set(),
  showLinkId:      { value: false },
  showPrefix:      { value: false },
  resetSeq:        () => {},
  makeGroup:       () => ({}),
  makeItem:        () => ({}),
  NONEMPTY_TYPES:  new Set(),
}));

const { buildFHIRObject, exportFHIR } = await import('../js/fhir/export.js');
const { generateNarrativeDiv } = await import('../js/fhir/export.js');

// Helper: reset tree and run buildFHIRObject
function build(nodes, title = 'Test Q', vars = []) {
  _tree.splice(0, _tree.length, ...nodes);
  _questVariables.splice(0, _questVariables.length, ...vars);
  _rawFhir.value = { title };
  return buildFHIRObject();
}

// ── basic structure ───────────────────────────────────────────────────────────
describe('buildFHIRObject — structure', () => {
  it('produces a FHIR R4 Questionnaire', () => {
    const q = build([]);
    expect(q.resourceType).toBe('Questionnaire');
    expect(q.status).toBe('draft');
    expect(q.subjectType).toEqual(['Patient']);
  });

  it('uses title from rawFhir', () => {
    const q = build([], 'My Survey');
    expect(q.title).toBe('My Survey');
  });

  it('falls back to Untitled Questionnaire when rawFhir has no title', () => {
    _rawFhir.value = null;
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

  it('exports required:false when mandatory=false', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'text', mandatory: false }]);
    expect(q.item[0].required).toBe(false);
  });

  it('omits required when mandatory=null', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'text', mandatory: null }]);
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

  it('omits enableBehavior when enableBehavior is all', () => {
    const q = build([{
      id: 'q1', type: 'item', title: 'Q', itemType: 'text',
      enableWhen: [
        { question: 'q1', operator: '=', answerBoolean: true },
        { question: 'q2', operator: '=', answerString: 'yes' },
      ],
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
      enableWhen: [], constraint: [], options: '', mandatory: null,
    }]);
    expect(q.item[0].answerValueSet).toBe('http://example.org/vs/diet');
  });

  it('does not emit answerValueSet when not set on node', () => {
    const q = build([{
      id: 'q1', type: 'item', title: 'Procedure', itemType: 'select',
      enableWhen: [], constraint: [], options: 'a=Alpha', mandatory: null,
    }]);
    expect(q.item[0].answerValueSet).toBeUndefined();
  });

  it('skips answerOption when _answerValueSet is set (even if options populated)', () => {
    const q = build([{
      id: 'q1', type: 'item', title: 'Diet', itemType: 'select',
      _answerValueSet: '#vs-diet',
      options: 'veg=Vegetarian,omn=Omnivore',
      enableWhen: [], constraint: [], mandatory: null,
    }]);
    expect(q.item[0].answerValueSet).toBe('#vs-diet');
    expect(q.item[0].answerOption).toBeUndefined();
  });
});

// ── item.initial[] export ─────────────────────────────────────────────────────
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
});

// ── questMeta round-trip ──────────────────────────────────────────────────────
describe('buildFHIRObject — questMeta', () => {
  const EMPTY_META = { id: '', url: '', version: '', title: '', status: 'draft', publisher: '', description: '',
    name: '', date: '', subjectType: 'Patient', purpose: '', copyright: '', approvalDate: '', lastReviewDate: '',
    effectivePeriodStart: '', effectivePeriodEnd: '',
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
    _rawFhir.value = { title: 'Raw Title' };
    _questMeta.title = 'Meta Title';
    const q = buildFHIRObject();
    expect(q.title).toBe('Meta Title');
    _rawFhir.value = null;
  });

  it('falls back to rawFhir.title when questMeta.title is empty', () => {
    _rawFhir.value = { title: 'Raw Title' };
    _questMeta.title = '';
    const q = buildFHIRObject();
    expect(q.title).toBe('Raw Title');
    _rawFhir.value = null;
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

  it('exports subjectType from questMeta.subjectType (comma-separated string)', () => {
    _questMeta.subjectType = 'Patient, Practitioner';
    const q = buildFHIRObject();
    expect(q.subjectType).toEqual(['Patient', 'Practitioner']);
  });

  it('defaults subjectType to [Patient] when questMeta.subjectType is empty', () => {
    _questMeta.subjectType = '';
    const q = buildFHIRObject();
    expect(q.subjectType).toEqual(['Patient']);
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

// ── questionnaire-displayCategory ────────────────────────────────────────────
describe('buildFHIRObject — displayCategory', () => {
  const DC_URL = 'http://hl7.org/fhir/StructureDefinition/questionnaire-displayCategory';

  it('exports _displayCategory=instructions as valueCodeableConcept extension', () => {
    const q = build([{ id: 'd1', type: 'item', title: 'Info', itemType: 'display', _displayCategory: 'instructions' }]);
    const ext = q.item[0].extension || [];
    const dc = ext.find(e => e.url === DC_URL);
    expect(dc).toBeDefined();
    expect(dc.valueCodeableConcept?.coding?.[0]?.code).toBe('instructions');
  });

  it('exports _displayCategory=security as valueCodeableConcept extension', () => {
    const q = build([{ id: 'd1', type: 'item', title: 'Warning', itemType: 'display', _displayCategory: 'security' }]);
    const ext = q.item[0].extension || [];
    const dc = ext.find(e => e.url === DC_URL);
    expect(dc?.valueCodeableConcept?.coding?.[0]?.code).toBe('security');
  });

  it('exports _displayCategory=help as valueCodeableConcept extension', () => {
    const q = build([{ id: 'd1', type: 'item', title: 'Help text', itemType: 'display', _displayCategory: 'help' }]);
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
describe('buildFHIRObject — _renderXhtml', () => {
  it('exports _renderXhtml as _text rendering-xhtml extension', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'text', _renderXhtml: '<b>Bold</b>' }]);
    expect(q.item[0]._text).toBeDefined();
    const ext = q.item[0]._text.extension;
    const xhtmlExt = ext.find(e => e.url.includes('rendering-xhtml'));
    expect(xhtmlExt).toBeDefined();
    expect(xhtmlExt.valueString).toBe('<b>Bold</b>');
  });

  it('exports both _renderStyle and _renderXhtml in one _text.extension[]', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'text', _renderStyle: 'color: red', _renderXhtml: '<em>Q</em>' }]);
    const ext = q.item[0]._text.extension;
    expect(ext).toHaveLength(2);
    expect(ext.find(e => e.url.includes('rendering-style')).valueString).toBe('color: red');
    expect(ext.find(e => e.url.includes('rendering-xhtml')).valueString).toBe('<em>Q</em>');
  });

  it('omits _text when both _renderStyle and _renderXhtml are absent', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'text' }]);
    expect(q.item[0]._text).toBeUndefined();
  });
});

// ── questionnaire-supportLink ─────────────────────────────────────────────────
describe('buildFHIRObject — _supportLinks', () => {
  const SL_URL = 'http://hl7.org/fhir/StructureDefinition/questionnaire-supportLink';

  it('exports a single support link as one extension entry', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'text',
      _supportLinks: ['https://example.com/help'] }]);
    const ext = q.item[0].extension || [];
    const links = ext.filter(e => e.url === SL_URL);
    expect(links).toHaveLength(1);
    expect(links[0].valueUri).toBe('https://example.com/help');
  });

  it('exports multiple support links as multiple extension entries', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'text',
      _supportLinks: ['https://a.example.com', 'https://b.example.com'] }]);
    const ext = q.item[0].extension || [];
    const links = ext.filter(e => e.url === SL_URL);
    expect(links).toHaveLength(2);
    expect(links.map(l => l.valueUri)).toEqual(['https://a.example.com', 'https://b.example.com']);
  });

  it('omits support link extension when _supportLinks is absent', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'text' }]);
    const ext = q.item[0].extension || [];
    expect(ext.filter(e => e.url === SL_URL)).toHaveLength(0);
  });

  it('omits empty-string entries from _supportLinks', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'text',
      _supportLinks: ['', 'https://example.com'] }]);
    const ext = q.item[0].extension || [];
    const links = ext.filter(e => e.url === SL_URL);
    expect(links).toHaveLength(1);
    expect(links[0].valueUri).toBe('https://example.com');
  });
});

// ── sdc-questionnaire-hidden ───────────────────────────────────────────────────
describe('buildFHIRObject — _hidden', () => {
  const HIDDEN_URL = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-hidden';

  it('exports sdc-questionnaire-hidden = true when _hidden is set', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'text', _hidden: true }]);
    const ext = q.item[0].extension || [];
    const hiddenExts = ext.filter(e => e.url === HIDDEN_URL);
    expect(hiddenExts).toHaveLength(1);
    expect(hiddenExts[0].valueBoolean).toBe(true);
  });

  it('omits hidden extension when _hidden is falsy', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'text' }]);
    const ext = q.item[0].extension || [];
    expect(ext.filter(e => e.url === HIDDEN_URL)).toHaveLength(0);
  });

  it('exports sdc-questionnaire-hidden on a group', () => {
    const q = build([{ id: 'g1', type: 'group', title: 'G', _hidden: true, children: [
      { id: 'g1.q1', type: 'item', title: 'Child', itemType: 'text' }
    ]}]);
    const ext = q.item[0].extension || [];
    const hiddenExts = ext.filter(e => e.url === HIDDEN_URL);
    expect(hiddenExts).toHaveLength(1);
    expect(hiddenExts[0].valueBoolean).toBe(true);
    // child item should NOT have the extension
    const childExt = q.item[0].item[0].extension || [];
    expect(childExt.filter(e => e.url === HIDDEN_URL)).toHaveLength(0);
  });
});

describe('buildFHIRObject — _minLength', () => {
  const ML_URL = 'http://hl7.org/fhir/StructureDefinition/minLength';

  it('exports minLength as SDC extension with valueInteger', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'text', _minLength: 5 }]);
    const ext = q.item[0].extension || [];
    const minLenExt = ext.find(e => e.url === ML_URL);
    expect(minLenExt?.valueInteger).toBe(5);
  });

  it('omits minLength extension when _minLength is absent', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'text' }]);
    const ext = q.item[0].extension || [];
    expect(ext.filter(e => e.url === ML_URL)).toHaveLength(0);
  });

  it('exports minLength = 1 (minimum valid value)', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'string', _minLength: 1 }]);
    const ext = q.item[0].extension || [];
    expect(ext.find(e => e.url === ML_URL)?.valueInteger).toBe(1);
  });
});

// ── sliderStepValue ───────────────────────────────────────────────────────────
describe('buildFHIRObject — _sliderStep', () => {
  const SLIDER_URL = 'http://hl7.org/fhir/StructureDefinition/questionnaire-sliderStepValue';

  it('exports integer slider step as valueInteger', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'integer', _sliderStep: 5 }]);
    const ext = q.item[0].extension || [];
    const sliderExt = ext.find(e => e.url === SLIDER_URL);
    expect(sliderExt?.valueInteger).toBe(5);
    expect(sliderExt?.valueDecimal).toBeUndefined();
  });

  it('exports decimal slider step as valueDecimal', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'decimal', _sliderStep: 0.5 }]);
    const ext = q.item[0].extension || [];
    const sliderExt = ext.find(e => e.url === SLIDER_URL);
    expect(sliderExt?.valueDecimal).toBe(0.5);
    expect(sliderExt?.valueInteger).toBeUndefined();
  });
});

// ── contained resources ───────────────────────────────────────────────────────
describe('buildFHIRObject — contained', () => {
  afterEach(() => { _questContained.splice(0); });

  it('exports contained resources when questContained is non-empty', () => {
    _questContained.push({ resourceType: 'ValueSet', id: 'vs1' });
    const q = build([]);
    expect(q.contained).toHaveLength(1);
    expect(q.contained[0].id).toBe('vs1');
  });

  it('omits contained when questContained is empty', () => {
    const q = build([]);
    expect(q.contained).toBeUndefined();
  });
});

// ── resource meta ─────────────────────────────────────────────────────────────
describe('buildFHIRObject — resource meta', () => {
  afterEach(() => {
    delete _questMeta._metaVersionId;
    delete _questMeta._metaSource;
    delete _questMeta._metaLastUpdated;
    delete _questMeta._rawMetaProfile;
    delete _questMeta._rawMetaTag;
    delete _questMeta._rawMetaSecurity;
  });

  it('writes q.meta when _metaVersionId is set', () => {
    _questMeta._metaVersionId = 'v2';
    _questMeta._metaSource = 'https://example.org';
    _questMeta._rawMetaProfile = ['http://hl7.org/fhir/StructureDefinition/Questionnaire'];
    _questMeta._rawMetaTag = [{ system: 'http://example.org', code: 'tag1' }];
    _questMeta._rawMetaSecurity = [{ system: 'http://example.org', code: 'sec1' }];
    const q = build([]);
    expect(q.meta).toBeDefined();
    expect(q.meta.versionId).toBe('v2');
    expect(q.meta.source).toBe('https://example.org');
    expect(q.meta.profile).toEqual(['http://hl7.org/fhir/StructureDefinition/Questionnaire']);
    expect(q.meta.tag).toEqual([{ system: 'http://example.org', code: 'tag1' }]);
    expect(q.meta.security).toEqual([{ system: 'http://example.org', code: 'sec1' }]);
    expect(q.meta.lastUpdated).toBeDefined();
  });

  it('omits q.meta when no meta fields are set', () => {
    _questMeta._metaVersionId = '';
    _questMeta._rawMetaProfile = [];
    _questMeta._rawMetaTag = [];
    _questMeta._rawMetaSecurity = [];
    const q = build([]);
    expect(q.meta).toBeUndefined();
  });
});

// ── maxValue ──────────────────────────────────────────────────────────────────
describe('buildFHIRObject — _maxValue', () => {
  const MAX_URL = 'http://hl7.org/fhir/StructureDefinition/maxValue';

  it('exports integer _maxValue as valueInteger', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'integer', _maxValue: 100 }]);
    const ext = q.item[0].extension || [];
    expect(ext.find(e => e.url === MAX_URL)?.valueInteger).toBe(100);
  });

  it('exports decimal _maxValue as valueDecimal', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'decimal', _maxValue: 9.9 }]);
    const ext = q.item[0].extension || [];
    expect(ext.find(e => e.url === MAX_URL)?.valueDecimal).toBe(9.9);
  });
});

// ── minOccurs / maxOccurs ─────────────────────────────────────────────────────
describe('buildFHIRObject — minOccurs/maxOccurs', () => {
  const MIN_OCC = 'http://hl7.org/fhir/StructureDefinition/questionnaire-minOccurs';
  const MAX_OCC = 'http://hl7.org/fhir/StructureDefinition/questionnaire-maxOccurs';

  it('exports minOccurs when repeats=true and _minOccurs is set', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'text', repeats: true, _minOccurs: 2 }]);
    const ext = q.item[0].extension || [];
    expect(ext.find(e => e.url === MIN_OCC)?.valueInteger).toBe(2);
  });

  it('exports maxOccurs when repeats=true and _maxOccurs is set', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'text', repeats: true, _maxOccurs: 5 }]);
    const ext = q.item[0].extension || [];
    expect(ext.find(e => e.url === MAX_OCC)?.valueInteger).toBe(5);
  });

  it('does not export minOccurs/maxOccurs when repeats is false', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'text', repeats: false, _minOccurs: 1, _maxOccurs: 3 }]);
    const ext = q.item[0].extension || [];
    expect(ext.find(e => e.url === MIN_OCC)).toBeUndefined();
    expect(ext.find(e => e.url === MAX_OCC)).toBeUndefined();
  });
});

// ── _minValue ─────────────────────────────────────────────────────────────────
describe('buildFHIRObject — _minValue', () => {
  const MIN_URL = 'http://hl7.org/fhir/StructureDefinition/minValue';

  it('exports integer _minValue as valueInteger', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'integer', _minValue: 1 }]);
    const ext = q.item[0].extension || [];
    expect(ext.find(e => e.url === MIN_URL)?.valueInteger).toBe(1);
  });

  it('exports decimal _minValue as valueDecimal', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'decimal', _minValue: 0.5 }]);
    const ext = q.item[0].extension || [];
    expect(ext.find(e => e.url === MIN_URL)?.valueDecimal).toBe(0.5);
  });
});

// ── _optionOrdinals ───────────────────────────────────────────────────────────
describe('buildFHIRObject — _optionOrdinals', () => {
  const ORD_URL = 'http://hl7.org/fhir/StructureDefinition/ordinalValue';

  it('adds ordinalValue extension to answerOption when _optionOrdinals is set', () => {
    const q = build([{
      id: 'q1', type: 'item', title: 'Q', itemType: 'select',
      options: 'a=Option A,b=Option B',
      _optionOrdinals: { a: 1.0, b: 2.0 },
    }]);
    const opts = q.item[0].answerOption || [];
    const optA = opts.find(o => o.valueCoding?.code === 'a');
    expect(optA?.extension?.[0]?.url).toBe(ORD_URL);
    expect(optA?.extension?.[0]?.valueDecimal).toBe(1.0);
  });

  it('omits ordinalValue extension when _optionOrdinals is absent', () => {
    const q = build([{
      id: 'q1', type: 'item', title: 'Q', itemType: 'select',
      options: 'a=Option A',
    }]);
    const opts = q.item[0].answerOption || [];
    expect(opts[0].extension).toBeUndefined();
  });
});

// ── referenceResource / quantityUnit / calculatedExpr / initialExpr ───────────
describe('buildFHIRObject — reference, quantity, expr extensions', () => {
  const REF_URL  = 'http://hl7.org/fhir/StructureDefinition/questionnaire-referenceResource';
  const UNIT_URL = 'http://hl7.org/fhir/StructureDefinition/questionnaire-unit';
  const CALC_URL = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-calculatedExpression';
  const INIT_URL = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-initialExpression';

  it('exports referenceResource for reference item type', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'reference', referenceResource: 'Patient' }]);
    const ext = q.item[0].extension || [];
    expect(ext.find(e => e.url === REF_URL)?.valueCode).toBe('Patient');
  });

  it('exports questionnaire-unit for quantity item type', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'quantity', quantityUnit: 'kg' }]);
    const ext = q.item[0].extension || [];
    expect(ext.find(e => e.url === UNIT_URL)?.valueCoding?.code).toBe('kg');
  });

  it('exports SDC calculatedExpression when _calculatedExpr is set', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'decimal', _calculatedExpr: '%total * 2' }]);
    const ext = q.item[0].extension || [];
    expect(ext.find(e => e.url === CALC_URL)?.valueExpression?.expression).toBe('%total * 2');
  });

  it('exports SDC initialExpression when _initialExpr is set', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'string', _initialExpr: '%patient.name' }]);
    const ext = q.item[0].extension || [];
    expect(ext.find(e => e.url === INIT_URL)?.valueExpression?.expression).toBe('%patient.name');
  });
});

// ── exportFHIR ────────────────────────────────────────────────────────────────
describe('exportFHIR', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('creates a download anchor and triggers a click', () => {
    const anchor = { href: '', download: '', click: vi.fn() };
    const mockCreateObjectURL = vi.fn(() => 'blob:mock');
    const mockRevokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: mockCreateObjectURL, revokeObjectURL: mockRevokeObjectURL });
    vi.stubGlobal('document', { createElement: vi.fn(() => anchor) });
    vi.stubGlobal('Blob', class MockBlob { constructor(parts, opts) { this.parts = parts; this.type = opts?.type; } });

    exportFHIR('my-questionnaire.json');

    expect(anchor.download).toBe('my-questionnaire.json');
    expect(anchor.click).toHaveBeenCalled();
    expect(mockRevokeObjectURL).toHaveBeenCalled();
  });
});


// ── _unknownExtensions pass-through ──────────────────────────────────────────
describe('_unknownExtensions pass-through', () => {
  it('writes unknown extensions to item.extension[]', () => {
    const node = {
      id: 'q1', title: 'Q1', type: 'item', itemType: 'text',
      _unknownExtensions: [{ url: 'http://vendor.example.com/custom', valueString: 'val' }],
    };
    const q = build([node]);
    const ext = q.item[0].extension;
    expect(ext).toBeDefined();
    const custom = ext.find(e => e.url === 'http://vendor.example.com/custom');
    expect(custom).toBeDefined();
    expect(custom.valueString).toBe('val');
  });

  it('appends unknown extensions after known ones', () => {
    const node = {
      id: 'q1', title: 'Q1', type: 'item', itemType: 'text',
      _minLength: 3,
      _unknownExtensions: [{ url: 'http://vendor.example.com/custom', valueBoolean: true }],
    };
    const q = build([node]);
    const ext = q.item[0].extension;
    expect(ext.length).toBeGreaterThanOrEqual(2);
    const minLen = ext.find(e => e.url === 'http://hl7.org/fhir/StructureDefinition/minLength');
    const custom = ext.find(e => e.url === 'http://vendor.example.com/custom');
    expect(minLen).toBeDefined();
    expect(custom).toBeDefined();
    expect(custom.valueBoolean).toBe(true);
  });

  it('does not add extension[] when _unknownExtensions is empty', () => {
    const node = { id: 'q1', title: 'Q1', type: 'item', itemType: 'text', _unknownExtensions: [] };
    const q = build([node]);
    expect(q.item[0].extension).toBeUndefined();
  });

  it('deep-clones unknown extensions (no shared references)', () => {
    const src = { url: 'http://vendor.example.com/custom', valueString: 'val' };
    const node = {
      id: 'q1', title: 'Q1', type: 'item', itemType: 'text',
      _unknownExtensions: [src],
    };
    const q = build([node]);
    const exported = q.item[0].extension.find(e => e.url === 'http://vendor.example.com/custom');
    expect(exported).not.toBe(src);
    expect(exported.valueString).toBe('val');
  });
});

// ── maxSize (attachment) ──────────────────────────────────────────────────────
describe('buildFHIRObject — _maxFileSizeMB', () => {
  const MS_URL = 'http://hl7.org/fhir/StructureDefinition/maxSize';

  it('exports maxFileSizeMB as maxSize extension with valueDecimal', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'attachment', _maxFileSizeMB: 5 }]);
    const ext = q.item[0].extension || [];
    const msExt = ext.find(e => e.url === MS_URL);
    expect(msExt?.valueDecimal).toBe(5);
  });

  it('exports fractional maxFileSizeMB as valueDecimal', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'attachment', _maxFileSizeMB: 2.5 }]);
    const ext = q.item[0].extension || [];
    expect(ext.find(e => e.url === MS_URL)?.valueDecimal).toBe(2.5);
  });

  it('omits maxSize extension when _maxFileSizeMB is absent', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'attachment' }]);
    const ext = q.item[0].extension || [];
    expect(ext.filter(e => e.url === MS_URL)).toHaveLength(0);
  });

  it('omits maxSize extension when _maxFileSizeMB is null', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'attachment', _maxFileSizeMB: null }]);
    const ext = q.item[0].extension || [];
    expect(ext.filter(e => e.url === MS_URL)).toHaveLength(0);
  });
});
