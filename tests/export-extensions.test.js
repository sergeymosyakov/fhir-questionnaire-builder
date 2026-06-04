// Tests for buildFHIRObject — item-level extensions (renderXhtml, supportLinks, hidden,
// minLength, slider, decimal, contained, meta, min/maxValue, occurs, ordinals, prefixes,
// reference/quantity/expr, exportFHIR, unknown extensions, attachment, replaces,
// collapsible, openLabel, designNote, answerExpression, regex, optionExclusives,
// usageMode, itemMedia, itemWeight).

import { describe, it, expect, vi, afterEach } from 'vitest';

const _tree = [];
const _questVariables = [];
const _questContained = [];
let _rawFhir = { value: null };
const _questMeta = { id: '', url: '', version: '', title: '', status: 'draft', publisher: '', description: '',
  name: '', date: '', subjectType: [], purpose: '', copyright: '', approvalDate: '', lastReviewDate: '',
  effectivePeriodStart: '', effectivePeriodEnd: '', replaces: [], _rawQuestExtensions: [],
  _rawText: null,
  _rawContact: null, _rawUseContext: null, _rawJurisdiction: null, _rawCode: null };

vi.mock('../js/state.js', () => ({
  tree:            _tree,
  questVariables:  _questVariables,
  questContained:  _questContained,
  questMeta:       _questMeta,
  rawFhir:         _rawFhir,
  values:          {},
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

function build(nodes, title = 'Test Q', vars = []) {
  _tree.splice(0, _tree.length, ...nodes);
  _questVariables.splice(0, _questVariables.length, ...vars);
  _rawFhir.value = { title };
  return buildFHIRObject();
}

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

  it('rounds decimal slider step to valueInteger (R4 constraint)', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'decimal', _sliderStep: 0.5 }]);
    const ext = q.item[0].extension || [];
    const sliderExt = ext.find(e => e.url === SLIDER_URL);
    expect(sliderExt?.valueInteger).toBe(1); // 0.5 rounds to 1
    expect(sliderExt?.valueDecimal).toBeUndefined();
  });
});

// ── maxDecimalPlaces ──────────────────────────────────────────────────────────
describe('buildFHIRObject — _maxDecimalPlaces', () => {
  const MDP_URL = 'http://hl7.org/fhir/StructureDefinition/maxDecimalPlaces';

  it('exports maxDecimalPlaces as valueInteger', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'decimal', _maxDecimalPlaces: 2 }]);
    const ext = q.item[0].extension || [];
    const mdpExt = ext.find(e => e.url === MDP_URL);
    expect(mdpExt?.valueInteger).toBe(2);
  });

  it('exports maxDecimalPlaces = 0', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'decimal', _maxDecimalPlaces: 0 }]);
    const ext = q.item[0].extension || [];
    const mdpExt = ext.find(e => e.url === MDP_URL);
    expect(mdpExt?.valueInteger).toBe(0);
  });

  it('omits maxDecimalPlaces when undefined', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'decimal' }]);
    const ext = q.item[0].extension || [];
    expect(ext.find(e => e.url === MDP_URL)).toBeUndefined();
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

  it('exports minOccurs when repeats=true, required=true, and _minOccurs is set', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'text', repeats: true, required: true, _minOccurs: 2 }]);
    const ext = q.item[0].extension || [];
    expect(ext.find(e => e.url === MIN_OCC)?.valueInteger).toBe(2);
  });

  it('does not export minOccurs=0 when required is not set (R4 context invariant: only valid when required=true)', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'text', repeats: true, _minOccurs: 0 }]);
    const ext = q.item[0].extension || [];
    expect(ext.find(e => e.url === MIN_OCC)).toBeUndefined();
  });

  it('does not export minOccurs when repeats=true but required=false and valueInteger>0 (R4 invariant)', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'text', repeats: true, _minOccurs: 2 }]);
    const ext = q.item[0].extension || [];
    expect(ext.find(e => e.url === MIN_OCC)).toBeUndefined();
  });

  it('does not export minOccurs on display-type items (R4 invariant)', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'display', repeats: true, required: true, _minOccurs: 1 }]);
    const ext = q.item[0].extension || [];
    expect(ext.find(e => e.url === MIN_OCC)).toBeUndefined();
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

// ── _optionPrefixes ───────────────────────────────────────────────────────────
describe('buildFHIRObject — _optionPrefixes', () => {
  const PFX_URL = 'http://hl7.org/fhir/StructureDefinition/questionnaire-optionPrefix';
  const ORD_URL = 'http://hl7.org/fhir/StructureDefinition/ordinalValue';

  it('adds questionnaire-optionPrefix extension to answerOption', () => {
    const q = build([{
      id: 'q1', type: 'item', title: 'Q', itemType: 'select',
      options: 'a=Option A,b=Option B',
      _optionPrefixes: { a: 'A.', b: 'B.' },
    }]);
    const opts = q.item[0].answerOption || [];
    const optA = opts.find(o => o.valueCoding?.code === 'a');
    const optB = opts.find(o => o.valueCoding?.code === 'b');
    expect(optA?.extension?.find(e => e.url === PFX_URL)?.valueString).toBe('A.');
    expect(optB?.extension?.find(e => e.url === PFX_URL)?.valueString).toBe('B.');
  });

  it('omits questionnaire-optionPrefix extension when _optionPrefixes is absent', () => {
    const q = build([{
      id: 'q1', type: 'item', title: 'Q', itemType: 'select',
      options: 'a=Option A',
    }]);
    const opts = q.item[0].answerOption || [];
    expect(opts[0].extension).toBeUndefined();
  });

  it('emits both ordinalValue and optionPrefix extensions on same option', () => {
    const q = build([{
      id: 'q1', type: 'item', title: 'Q', itemType: 'select',
      options: 'a=Option A',
      _optionOrdinals: { a: 0 },
      _optionPrefixes: { a: 'A.' },
    }]);
    const opts = q.item[0].answerOption || [];
    const exts = opts[0].extension || [];
    expect(exts.find(e => e.url === ORD_URL)?.valueDecimal).toBe(0);
    expect(exts.find(e => e.url === PFX_URL)?.valueString).toBe('A.');
  });

  it('only emits prefix for codes present in _optionPrefixes', () => {
    const q = build([{
      id: 'q1', type: 'item', title: 'Q', itemType: 'select',
      options: 'a=Option A,b=Option B',
      _optionPrefixes: { a: 'A.' },
    }]);
    const opts = q.item[0].answerOption || [];
    const optB = opts.find(o => o.valueCoding?.code === 'b');
    expect(optB?.extension).toBeUndefined();
  });
});

// ── _optionSystems ────────────────────────────────────────────────────────────
describe('buildFHIRObject — _optionSystems', () => {
  it('includes system in valueCoding when _optionSystems is set', () => {
    const q = build([{
      id: 'q1', type: 'item', title: 'Q', itemType: 'select',
      options: 'a=Option A,b=Option B',
      _optionSystems: { a: 'http://example.org/codes', b: 'http://loinc.org' },
    }]);
    const opts = q.item[0].answerOption || [];
    const optA = opts.find(o => o.valueCoding?.code === 'a');
    const optB = opts.find(o => o.valueCoding?.code === 'b');
    expect(optA?.valueCoding?.system).toBe('http://example.org/codes');
    expect(optB?.valueCoding?.system).toBe('http://loinc.org');
  });

  it('omits system in valueCoding when _optionSystems is absent', () => {
    const q = build([{
      id: 'q1', type: 'item', title: 'Q', itemType: 'select',
      options: 'a=Option A',
    }]);
    const opts = q.item[0].answerOption || [];
    expect(opts[0].valueCoding?.system).toBeUndefined();
  });

  it('only includes system for codes present in _optionSystems', () => {
    const q = build([{
      id: 'q1', type: 'item', title: 'Q', itemType: 'select',
      options: 'a=Option A,b=Option B',
      _optionSystems: { a: 'http://example.org/codes' },
    }]);
    const opts = q.item[0].answerOption || [];
    const optB = opts.find(o => o.valueCoding?.code === 'b');
    expect(optB?.valueCoding?.system).toBeUndefined();
  });

  it('system appears before code in valueCoding (FHIR property order)', () => {
    const q = build([{
      id: 'q1', type: 'item', title: 'Q', itemType: 'select',
      options: 'a=Option A',
      _optionSystems: { a: 'http://example.org/codes' },
    }]);
    const coding = q.item[0].answerOption[0].valueCoding;
    const keys = Object.keys(coding);
    expect(keys.indexOf('system')).toBeLessThan(keys.indexOf('code'));
  });
});

// ── referenceResource / quantityUnit / calculatedExpr / initialExpr ───────────
describe('buildFHIRObject — reference, quantity, expr extensions', () => {
  const REF_URL      = 'http://hl7.org/fhir/StructureDefinition/questionnaire-referenceResource';
  const UNIT_URL     = 'http://hl7.org/fhir/StructureDefinition/questionnaire-unit';
  const UNIT_OPT_URL = 'http://hl7.org/fhir/StructureDefinition/questionnaire-unitOption';
  const CALC_URL = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-calculatedExpression';
  const INIT_URL = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-initialExpression';

  it('exports referenceResource for reference item type', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'reference', referenceResource: 'Patient' }]);
    const ext = q.item[0].extension || [];
    expect(ext.find(e => e.url === REF_URL)?.valueCode).toBe('Patient');
  });

  it('exports questionnaire-unit for integer/decimal types (R4 invariant: only integer/decimal)', () => {
    for (const itemType of ['integer', 'decimal']) {
      const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType, quantityUnit: 'kg' }]);
      const ext = q.item[0].extension || [];
      expect(ext.find(e => e.url === UNIT_URL)?.valueCoding?.code).toBe('kg');
    }
  });

  it('exports questionnaire-unitOption (not questionnaire-unit) for quantity with single quantityUnit (R4 invariant)', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'quantity', quantityUnit: 'kg' }]);
    const ext = q.item[0].extension || [];
    expect(ext.find(e => e.url === UNIT_URL)).toBeUndefined();
    expect(ext.find(e => e.url === UNIT_OPT_URL)?.valueCoding?.code).toBe('kg');
  });

  it('exports questionnaire-unitOption when _unitOptions is set', () => {
    const q = build([{
      id: 'q1', type: 'item', title: 'Q', itemType: 'quantity',
      _unitOptions: [
        { system: 'http://unitsofmeasure.org', code: 'kg', display: 'kg' },
        { system: 'http://unitsofmeasure.org', code: '[lb_av]', display: 'lb' },
      ],
    }]);
    const ext = q.item[0].extension || [];
    const uoExts = ext.filter(e => e.url === UNIT_OPT_URL);
    expect(uoExts).toHaveLength(2);
    expect(uoExts[0].valueCoding).toEqual({ system: 'http://unitsofmeasure.org', code: 'kg', display: 'kg' });
    expect(uoExts[1].valueCoding).toEqual({ system: 'http://unitsofmeasure.org', code: '[lb_av]', display: 'lb' });
  });

  it('does not emit unitOption when _unitOptions is absent', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'quantity' }]);
    const ext = q.item[0].extension || [];
    expect(ext.some(e => e.url === UNIT_OPT_URL)).toBe(false);
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
    vi.stubGlobal('document', {
      createElement: vi.fn(() => anchor),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
    });
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

// ── mimeType (attachment) ─────────────────────────────────────────────────────
describe('buildFHIRObject — _mimeTypes', () => {
  const MT_URL = 'http://hl7.org/fhir/StructureDefinition/mimeType';

  it('exports each mimeType as a separate extension entry with valueCode', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'attachment', _mimeTypes: ['image/jpeg', 'application/pdf'] }]);
    const ext = q.item[0].extension || [];
    const entries = ext.filter(e => e.url === MT_URL);
    expect(entries).toHaveLength(2);
    expect(entries[0].valueCode).toBe('image/jpeg');
    expect(entries[1].valueCode).toBe('application/pdf');
  });

  it('exports a single mimeType as one extension entry', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'attachment', _mimeTypes: ['image/*'] }]);
    const ext = q.item[0].extension || [];
    const entries = ext.filter(e => e.url === MT_URL);
    expect(entries).toHaveLength(1);
    expect(entries[0].valueCode).toBe('image/*');
  });

  it('omits mimeType extensions when _mimeTypes is absent', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'attachment' }]);
    const ext = q.item[0].extension || [];
    expect(ext.filter(e => e.url === MT_URL)).toHaveLength(0);
  });

  it('omits mimeType extensions when _mimeTypes is empty', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'attachment', _mimeTypes: [] }]);
    const ext = q.item[0].extension || [];
    expect(ext.filter(e => e.url === MT_URL)).toHaveLength(0);
  });

  it('can export both maxFileSizeMB and mimeTypes on the same item', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'attachment', _maxFileSizeMB: 5, _mimeTypes: ['image/jpeg'] }]);
    const ext = q.item[0].extension || [];
    expect(ext.find(e => e.url === 'http://hl7.org/fhir/StructureDefinition/maxSize')?.valueDecimal).toBe(5);
    expect(ext.find(e => e.url === MT_URL)?.valueCode).toBe('image/jpeg');
  });
});

// ── replaces extension ────────────────────────────────────────────────────────
describe('buildFHIRObject — replaces extension', () => {
  const REPLACES_URL = 'http://hl7.org/fhir/StructureDefinition/replaces';
  afterEach(() => { _questMeta.replaces = []; });

  it('exports a single replaces URL as one extension entry', () => {
    _questMeta.replaces = ['http://example.org/fhir/Questionnaire/prior|1.0'];
    const q = build([]);
    const entries = (q.extension || []).filter(e => e.url === REPLACES_URL);
    expect(entries).toHaveLength(1);
    expect(entries[0].valueCanonical).toBe('http://example.org/fhir/Questionnaire/prior|1.0');
  });

  it('exports multiple replaces URLs as separate extension entries', () => {
    _questMeta.replaces = [
      'http://example.org/fhir/Questionnaire/v1',
      'http://example.org/fhir/Questionnaire/v2',
    ];
    const q = build([]);
    const entries = (q.extension || []).filter(e => e.url === REPLACES_URL);
    expect(entries).toHaveLength(2);
    expect(entries[0].valueCanonical).toBe('http://example.org/fhir/Questionnaire/v1');
    expect(entries[1].valueCanonical).toBe('http://example.org/fhir/Questionnaire/v2');
  });

  it('omits replaces entries when array is empty', () => {
    _questMeta.replaces = [];
    const q = build([]);
    const entries = (q.extension || []).filter(e => e.url === REPLACES_URL);
    expect(entries).toHaveLength(0);
  });

  it('trims whitespace from replaces URLs', () => {
    _questMeta.replaces = ['  http://example.org/fhir/Questionnaire/prior  '];
    const q = build([]);
    const entries = (q.extension || []).filter(e => e.url === REPLACES_URL);
    expect(entries[0].valueCanonical).toBe('http://example.org/fhir/Questionnaire/prior');
  });

  it('skips blank and whitespace-only replaces entries', () => {
    _questMeta.replaces = ['http://example.org/fhir/Questionnaire/prior', '  ', ''];
    const q = build([]);
    const entries = (q.extension || []).filter(e => e.url === REPLACES_URL);
    expect(entries).toHaveLength(1);
  });
});

// ── sdc-questionnaire-collapsible ─────────────────────────────────────────────
describe('buildFHIRObject — sdc-questionnaire-collapsible', () => {
  const COLL_URL = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-collapsible';

  it('exports default-closed as valueCode on a group', () => {
    const q = build([{ id: 'g1', type: 'group', title: 'G', _collapsible: 'default-closed', children: [] }]);
    const ext = (q.item[0].extension || []).find(e => e.url === COLL_URL);
    expect(ext).toBeDefined();
    expect(ext.valueCode).toBe('default-closed');
  });

  it('exports default-open as valueCode on a group', () => {
    const q = build([{ id: 'g1', type: 'group', title: 'G', _collapsible: 'default-open', children: [] }]);
    const ext = (q.item[0].extension || []).find(e => e.url === COLL_URL);
    expect(ext?.valueCode).toBe('default-open');
  });

  it('omits collapsible extension when _collapsible is undefined', () => {
    const q = build([{ id: 'g1', type: 'group', title: 'G', children: [] }]);
    const ext = (q.item[0].extension || []).find(e => e.url === COLL_URL);
    expect(ext).toBeUndefined();
  });

  it('does not write collapsible extension on item nodes', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'text', _collapsible: 'default-closed' }]);
    const ext = (q.item[0].extension || []).find(e => e.url === COLL_URL);
    expect(ext).toBeUndefined();
  });
});

// ── sdc-questionnaire-openLabel ───────────────────────────────────────────────
describe('buildFHIRObject — sdc-questionnaire-openLabel', () => {
  const OL_URL = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-openLabel';

  it('exports openLabel as valueString on open-choice', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'open-choice', _openLabel: 'Other (please specify)' }]);
    const ext = (q.item[0].extension || []).find(e => e.url === OL_URL);
    expect(ext?.valueString).toBe('Other (please specify)');
  });

  it('omits openLabel when _openLabel is undefined', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'open-choice' }]);
    const ext = (q.item[0].extension || []).find(e => e.url === OL_URL);
    expect(ext).toBeUndefined();
  });

  it('does not write openLabel for non-open-choice types', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'text', _openLabel: 'Other' }]);
    const ext = (q.item[0].extension || []).find(e => e.url === OL_URL);
    expect(ext).toBeUndefined();
  });
});

// ── designNote ───────────────────────────────────────────────────────────────
describe('buildFHIRObject — designNote', () => {
  const DN_URL = 'http://hl7.org/fhir/StructureDefinition/designNote';
  const build = nodes => { _tree.splice(0, _tree.length, ...nodes); return buildFHIRObject(); };

  it('exports _designNote on item as valueMarkdown extension', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'string', _designNote: 'Check this.' }]);
    const ext = (q.item[0].extension || []).find(e => e.url === DN_URL);
    expect(ext?.valueMarkdown).toBe('Check this.');
  });

  it('exports _designNote on group as valueMarkdown extension', () => {
    const q = build([{ id: 'g1', type: 'group', title: 'G', _designNote: 'Group note.', children: [
      { id: 'q1', type: 'item', title: 'Q', itemType: 'string' },
    ] }]);
    const ext = (q.item[0].extension || []).find(e => e.url === DN_URL);
    expect(ext?.valueMarkdown).toBe('Group note.');
  });

  it('omits designNote extension when _designNote is absent', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'string' }]);
    const ext = (q.item[0].extension || []).find(e => e.url === DN_URL);
    expect(ext).toBeUndefined();
  });

  it('round-trips designNote: node with _designNote exports correct extension', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'string', _designNote: 'Round-trip note.' }]);
    const ext = (q.item[0].extension || []).find(e => e.url === DN_URL);
    expect(ext?.valueMarkdown).toBe('Round-trip note.');
  });
});

// ── answerExpression export ───────────────────────────────────────────────────
describe('buildFHIRObject — answerExpression', () => {
  const AE_URL = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-answerExpression';
  const _build = nodes => { _tree.splice(0, _tree.length, ...nodes); _rawFhir.value = { title: 'T' }; return buildFHIRObject(); };

  it('exports _answerExpression as valueExpression extension', () => {
    const q = _build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'select', options: '', _answerExpression: "'a' | 'b'" }]);
    const ext = (q.item[0].extension || []).find(e => e.url === AE_URL);
    expect(ext?.valueExpression?.expression).toBe("'a' | 'b'");
    expect(ext?.valueExpression?.language).toBe('text/fhirpath');
  });

  it('omits answerOption when _answerExpression is set', () => {
    const q = _build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'select', options: 'a=A,b=B', _answerExpression: "'a' | 'b'" }]);
    expect(q.item[0].answerOption).toBeUndefined();
  });

  it('does not export answerExpression extension when _answerExpression is absent', () => {
    const q = _build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'select', options: 'a=A' }]);
    const ext = (q.item[0].extension || []).find(e => e.url === AE_URL);
    expect(ext).toBeUndefined();
  });

  it('round-trips: node with _answerExpression exports correct extension and no answerOption', () => {
    const expr = "%resource.item.where(linkId='score').answer.valueInteger >= 10";
    const q = _build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'radio', options: '', _answerExpression: expr }]);
    const ext = (q.item[0].extension || []).find(e => e.url === AE_URL);
    expect(ext?.valueExpression?.expression).toBe(expr);
    expect(q.item[0].answerOption).toBeUndefined();
  });

  it('still exports answerOption when _answerExpression is absent but options exist', () => {
    const q = _build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'select', options: 'a=A,b=B' }]);
    expect(q.item[0].answerOption).toHaveLength(2);
  });
});

// ── regex ──────────────────────────────────────────────────────────────────
describe('buildFHIRObject — _regex', () => {
  const RX_URL = 'http://hl7.org/fhir/StructureDefinition/regex';

  it('exports regex extension when _regex is set', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'text', _regex: '^[A-Z]+$' }]);
    const ext = (q.item[0].extension || []).find(e => e.url === RX_URL);
    expect(ext).toBeDefined();
    expect(ext.valueString).toBe('^[A-Z]+$');
  });

  it('omits regex extension when _regex is absent', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'text' }]);
    const ext = (q.item[0].extension || []).find(e => e.url === RX_URL);
    expect(ext).toBeUndefined();
  });
});

// ── optionExclusive ─────────────────────────────────────────────────────────
describe('buildFHIRObject — _optionExclusives', () => {
  const OE_URL = 'http://hl7.org/fhir/StructureDefinition/questionnaire-optionExclusive';

  it('exports optionExclusive extension on the matching answerOption', () => {
    const q = build([{
      id: 'q1', type: 'item', title: 'Q', itemType: 'checklist',
      options: 'a=A,none=None',
      _optionExclusives: { none: true },
    }]);
    const opts = q.item[0].answerOption;
    expect(opts).toHaveLength(2);
    const noneOpt = opts.find(o => o.valueCoding.code === 'none');
    const oeExt = (noneOpt.extension || []).find(e => e.url === OE_URL);
    expect(oeExt).toBeDefined();
    expect(oeExt.valueBoolean).toBe(true);
    // Non-exclusive option should not have the extension
    const aOpt = opts.find(o => o.valueCoding.code === 'a');
    const aOeExt = (aOpt.extension || []).find(e => e.url === OE_URL);
    expect(aOeExt).toBeUndefined();
  });

  it('does not export optionExclusive when _optionExclusives is absent', () => {
    const q = build([{
      id: 'q1', type: 'item', title: 'Q', itemType: 'checklist',
      options: 'a=A,b=B',
    }]);
    const opts = q.item[0].answerOption;
    for (const opt of opts) {
      const oeExt = (opt.extension || []).find(e => e.url === OE_URL);
      expect(oeExt).toBeUndefined();
    }
  });
});

// ── usageMode ──────────────────────────────────────────────────────────────
describe('usageMode export', () => {
  const UM_URL = 'http://hl7.org/fhir/StructureDefinition/questionnaire-usageMode';

  it('exports _usageMode as valueCode extension', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'text', _usageMode: 'capture' }]);
    const ext = q.item[0].extension.find(e => e.url === UM_URL);
    expect(ext).toEqual({ url: UM_URL, valueCode: 'capture' });
  });

  it('does not export usageMode when absent', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'text' }]);
    const ext = (q.item[0].extension || []).find(e => e.url === UM_URL);
    expect(ext).toBeUndefined();
  });
});

// ── itemMedia ──────────────────────────────────────────────────────────────
describe('itemMedia export', () => {
  const IM_URL = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-itemMedia';

  it('exports _itemMedia as valueAttachment', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'text', _itemMedia: { url: 'https://ex.com/i.png', contentType: 'image/png' } }]);
    const ext = q.item[0].extension.find(e => e.url === IM_URL);
    expect(ext.valueAttachment).toEqual({ url: 'https://ex.com/i.png', contentType: 'image/png' });
  });
});

// ── itemWeight (answerOption level) ────────────────────────────────────────
describe('itemWeight export', () => {
  const IW_URL = 'http://hl7.org/fhir/StructureDefinition/itemWeight';

  it('exports _optionWeights as itemWeight extension on answerOption', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'radio', options: 'a=A,b=B', _optionWeights: { a: 1.5, b: 3 } }]);
    const opts = q.item[0].answerOption;
    const aExt = opts[0].extension.find(e => e.url === IW_URL);
    expect(aExt.valueDecimal).toBe(1.5);
    const bExt = opts[1].extension.find(e => e.url === IW_URL);
    expect(bExt.valueDecimal).toBe(3);
  });

  it('does not export itemWeight when _optionWeights is absent', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'radio', options: 'a=A' }]);
    const ext = (q.item[0].answerOption[0].extension || []).find(e => e.url === IW_URL);
    expect(ext).toBeUndefined();
  });

  it('exports answerMedia on raw answerOptions', () => {
    const AM_URL = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-answerMedia';
    const q = build([{
      id: 'q1', type: 'item', title: 'Q', itemType: 'radio', options: 'a=A',
      _rawAnswerOptions: [{ valueCoding: { code: 'a', display: 'A' } }],
      _answerMedias: { a: { url: 'https://ex.com/a.jpg', contentType: 'image/jpeg' } },
    }]);
    const amExt = q.item[0].answerOption[0].extension.find(e => e.url === AM_URL);
    expect(amExt.valueAttachment.url).toBe('https://ex.com/a.jpg');
  });
});

// ── referenceFilter ───────────────────────────────────────────────────────────
describe('referenceFilter export', () => {
  const RF_URL = 'http://hl7.org/fhir/StructureDefinition/questionnaire-referenceFilter';

  it('exports _referenceFilter as extension', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'reference', _referenceFilter: "status = 'active'" }]);
    const ext = q.item[0].extension.find(e => e.url === RF_URL);
    expect(ext.valueString).toBe("status = 'active'");
  });

  it('does not export referenceFilter when absent', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'reference' }]);
    const ext = (q.item[0].extension || []).find(e => e.url === RF_URL);
    expect(ext).toBeUndefined();
  });
});

// ── referenceProfile ──────────────────────────────────────────────────────────
describe('referenceProfile export', () => {
  const RP_URL = 'http://hl7.org/fhir/StructureDefinition/questionnaire-referenceProfile';

  it('exports _referenceProfiles as repeating extension', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'reference', _referenceProfiles: ['http://ex.com/P1', 'http://ex.com/P2'] }]);
    const exts = q.item[0].extension.filter(e => e.url === RP_URL);
    expect(exts).toHaveLength(2);
    expect(exts[0].valueCanonical).toBe('http://ex.com/P1');
    expect(exts[1].valueCanonical).toBe('http://ex.com/P2');
  });

  it('does not export referenceProfile when absent', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'reference' }]);
    const exts = (q.item[0].extension || []).filter(e => e.url === RP_URL);
    expect(exts).toHaveLength(0);
  });
});

// ── signatureRequired (item-level) ────────────────────────────────────────────
describe('signatureRequired export (item)', () => {
  const SIG_URL = 'http://hl7.org/fhir/StructureDefinition/questionnaire-signatureRequired';

  it('exports _signatureRequired as repeating extension', () => {
    const q = build([{
      id: 'q1', type: 'item', title: 'Q', itemType: 'text',
      _signatureRequired: [
        { system: 'urn:iso-astm:E1762-95:2013', code: '1.2.840.10065.1.12.1.1', display: "Author's Signature" },
        { system: 'urn:iso-astm:E1762-95:2013', code: '1.2.840.10065.1.12.1.5', display: 'Verification Signature' },
      ],
    }]);
    const exts = q.item[0].extension.filter(e => e.url === SIG_URL);
    expect(exts).toHaveLength(2);
    expect(exts[0].valueCodeableConcept.coding[0].code).toBe('1.2.840.10065.1.12.1.1');
  });

  it('does not export signatureRequired when absent', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'text' }]);
    const exts = (q.item[0].extension || []).filter(e => e.url === SIG_URL);
    expect(exts).toHaveLength(0);
  });
});

// ── answerConstraint (R4B/R5 item-level) ─────────────────────────────────────
describe('answerConstraint export (item)', () => {
  it('exports answerConstraint when set to optionsOnly', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'choice', _answerConstraint: 'optionsOnly' }]);
    expect(q.item[0].answerConstraint).toBe('optionsOnly');
  });

  it('exports answerConstraint when set to optionsOrType', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'choice', _answerConstraint: 'optionsOrType' }]);
    expect(q.item[0].answerConstraint).toBe('optionsOrType');
  });

  it('does not export answerConstraint when absent', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'choice' }]);
    expect(q.item[0].answerConstraint).toBeUndefined();
  });
});

// ── questionnaire-baseType / questionnaire-fhirType ───────────────────────────
describe('buildFHIRObject — _baseType / _fhirType', () => {
  const BASE_URL = 'http://hl7.org/fhir/StructureDefinition/questionnaire-baseType';
  const FHIR_URL = 'http://hl7.org/fhir/StructureDefinition/questionnaire-fhirType';

  it('exports _baseType as questionnaire-baseType extension with valueCode', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'string', _baseType: 'string' }]);
    const ext = q.item[0].extension || [];
    expect(ext.find(e => e.url === BASE_URL)?.valueCode).toBe('string');
  });

  it('exports _fhirType as questionnaire-fhirType extension with valueString (R4 spec)', () => {
    const q = build([{ id: 'g1', type: 'group', title: 'G', children: [], _fhirType: 'HumanName' }]);
    const ext = q.item[0].extension || [];
    expect(ext.find(e => e.url === FHIR_URL)?.valueString).toBe('HumanName');
  });

  it('exports both baseType and fhirType when both set', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'string', _baseType: 'HumanName', _fhirType: 'HumanName' }]);
    const ext = q.item[0].extension || [];
    expect(ext.find(e => e.url === BASE_URL)?.valueCode).toBe('HumanName');
    expect(ext.find(e => e.url === FHIR_URL)?.valueString).toBe('HumanName');
  });

  it('omits questionnaire-baseType when _baseType is absent', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'string' }]);
    const ext = q.item[0].extension || [];
    expect(ext.filter(e => e.url === BASE_URL)).toHaveLength(0);
  });

  it('omits questionnaire-fhirType when _fhirType is absent', () => {
    const q = build([{ id: 'q1', type: 'item', title: 'Q', itemType: 'string' }]);
    const ext = q.item[0].extension || [];
    expect(ext.filter(e => e.url === FHIR_URL)).toHaveLength(0);
  });
});
