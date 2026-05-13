// Tests for export helpers.
// export.js imports reactive state — we mock ../js/state.js.

import { describe, it, expect, vi } from 'vitest';

// Minimal state mock — buildFHIRObject reads tree, questVariables, rawFhir
const _tree = [];
const _questVariables = [];
let _rawFhir = { value: null };

vi.mock('../js/state.js', () => ({
  tree:           _tree,
  questVariables: _questVariables,
  rawFhir:        _rawFhir,
  // other exports used by state — provide stubs
  values:         {},
  _formTick:      { value: 0 },
  _bulkUpdate:    { value: false },
  ref:            v => ({ value: v }),
  reactive:       v => v,
  effect:         () => {},
  evalRule:       () => true,
  calcFormOk:     () => true,
  isMandatory:    () => false,
  CHECKABLE_TYPES: new Set(),
  autoFilledIds:  new Set(),
  showLinkId:     { value: false },
  showPrefix:     { value: false },
  resetSeq:       () => {},
  makeGroup:      () => ({}),
  makeItem:       () => ({}),
  NONEMPTY_TYPES: new Set(),
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
    ['number',      'decimal'],
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

// ── visibilityRule → enableWhen ───────────────────────────────────────────────
describe('buildFHIRObject — visibilityRule to enableWhen', () => {
  it('converts simple == rule to enableWhen', () => {
    const q = build([{
      id: 'q1', type: 'item', title: 'Q', itemType: 'text',
      visibilityRule: "values['age-item'] == true",
    }]);
    expect(q.item[0].enableWhen).toBeDefined();
    expect(q.item[0].enableWhen[0].question).toBe('age-item');
    expect(q.item[0].enableWhen[0].operator).toBe('=');
    expect(q.item[0].enableWhen[0].answerBoolean).toBe(true);
  });

  it('stores complex rule as extension', () => {
    const q = build([{
      id: 'q1', type: 'item', title: 'Q', itemType: 'text',
      visibilityRule: "age > 18 && gender === 'male'",
    }]);
    expect(q.item[0].enableWhen).toBeUndefined();
    expect(q.item[0].extension?.some(e =>
      e.url.includes('visibilityRule')
    )).toBe(true);
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

  it('sets enableBehavior:any for OR groups', () => {
    const q = build([{
      id: 'g1', type: 'group', title: 'G', logicWithParent: 'OR', children: [],
    }]);
    expect(q.item[0].enableBehavior).toBe('any');
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
