// Tests for export helpers.
// export.js imports reactive state — we mock ../js/state.js.

import { describe, it, expect, vi } from 'vitest';

// Minimal state mock — buildFHIRObject reads tree, questVariables, rawFhir
const _tree = [];
const _questVariables = [];
let _rawFhir = { value: null };

vi.mock('../js/state.js', () => ({
  tree:            _tree,
  questVariables:  _questVariables,
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

const { buildFHIRObject } = await import('../js/fhir/export.js');

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
