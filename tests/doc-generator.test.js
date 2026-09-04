// ── Unit tests: generateQuestionnaireDoc() documentation model builder ────────
import { describe, it, expect, vi, beforeAll } from 'vitest';

// generateQuestionnaireDoc() delegates to validateTree(), which calls
// window.fhirpath for FHIRPath syntax checks — stub so the module loads in Node.
beforeAll(() => {
  globalThis.window = { fhirpath: { compile: vi.fn() } };
});

const { generateQuestionnaireDoc, DOC_LEGEND, buildItemTree } = await import('../js/fhir/doc-generator.js');
const { COPYRIGHT_HTML } = await import('../js/ui/copyright-notice.js');
const { loadFhirpath } = await import('./helpers/fhirpath-node.js');
const fp = loadFhirpath();

const makeItem = (overrides = {}) => ({
  id: 'q1', type: 'item', title: 'Question 1',
  itemType: 'text', options: '', mandatory: false, repeats: false,
  enableWhen: [], enableBehavior: 'all', enableWhenExpression: '',
  constraint: [], children: [],
  ...overrides,
});

const baseDeps = (tree, extra = {}) => ({
  tree, questMeta: { title: 'Demo', status: 'draft' }, values: {}, variables: [], translations: {},
  ...extra,
});

describe('generateQuestionnaireDoc — empty tree', () => {
  it('returns an empty item list with no validation/audit issues', () => {
    const doc = generateQuestionnaireDoc(baseDeps([]));
    expect(doc.items).toEqual([]);
    expect(doc.validation).toEqual([]);
    expect(doc.audit).toEqual([]);
  });

  it('includes the legend and the shared copyright notice', () => {
    const doc = generateQuestionnaireDoc(baseDeps([]));
    expect(doc.legend).toBe(DOC_LEGEND);
    expect(doc.copyrightHtml).toBe(COPYRIGHT_HTML);
  });

  it('legend documents the Group/Question badges (one per line), translation, and appearance notations', () => {
    const labels = DOC_LEGEND.map(l => l.label);
    expect(labels).toContain('Group');
    expect(labels).toContain('Question');
    expect(labels).toContain('Translation');
    expect(labels).toContain('Appearance');
  });
});

describe('generateQuestionnaireDoc — variables & contained resources', () => {
  it('defaults to empty arrays when not supplied', () => {
    const doc = generateQuestionnaireDoc(baseDeps([]));
    expect(doc.variables).toEqual([]);
    expect(doc.contained).toEqual([]);
  });

  it('passes through the questionnaire-level variables and contained resources verbatim', () => {
    const variables = [{ name: 'age', expression: '%patient.birthDate' }];
    const contained = [{ resourceType: 'ValueSet', id: 'vs1', status: 'active' }];
    const doc = generateQuestionnaireDoc(baseDeps([], { variables, contained }));
    expect(doc.variables).toEqual(variables);
    expect(doc.contained).toEqual(contained);
  });
});

describe('generateQuestionnaireDoc — prefix', () => {
  it('is null when the item has no _prefix', () => {
    const doc = generateQuestionnaireDoc(baseDeps([makeItem()]));
    expect(doc.items[0].prefix).toBeNull();
  });

  it('surfaces node._prefix as entry.prefix', () => {
    const doc = generateQuestionnaireDoc(baseDeps([makeItem({ _prefix: '9.4' })]));
    expect(doc.items[0].prefix).toBe('9.4');
  });
});

describe('generateQuestionnaireDoc — cardinality', () => {
  it('non-mandatory, non-repeating item is 0..1', () => {
    const doc = generateQuestionnaireDoc(baseDeps([makeItem()]));
    expect(doc.items[0].cardinality).toBe('0..1');
  });

  it('mandatory item is 1..1', () => {
    const doc = generateQuestionnaireDoc(baseDeps([makeItem({ mandatory: true })]));
    expect(doc.items[0].cardinality).toBe('1..1');
  });

  it('repeating item with no maxOccurs is 0..*', () => {
    const doc = generateQuestionnaireDoc(baseDeps([makeItem({ repeats: true })]));
    expect(doc.items[0].cardinality).toBe('0..*');
  });

  it('mandatory + repeating with an explicit maxOccurs uses it', () => {
    const doc = generateQuestionnaireDoc(baseDeps([makeItem({ mandatory: true, repeats: true, _maxOccurs: 3 })]));
    expect(doc.items[0].cardinality).toBe('1..3');
  });
});

describe('generateQuestionnaireDoc — flags', () => {
  it('sets one flag glyph per active feature', () => {
    const doc = generateQuestionnaireDoc(baseDeps([makeItem({
      mandatory: true, repeats: true, _readOnly: true, _calculatedExpr: '1+1',
      enableWhen: [{ question: 'x', operator: '=', answerBoolean: true }],
      constraint: [{ key: 'c1', severity: 'error', human: 'must be set', expression: 'true' }],
      _supportLinks: ['https://example.org'],
    })]));
    const f = doc.items[0].flags;
    expect(f).toContain('*');
    expect(f).toContain('\u21BB');
    expect(f).toContain('\uD83D\uDD12');
    expect(f).toContain('\u26A1');
    expect(f).toContain('\uD83D\uDC41');
    expect(f).toContain('\u26A0\uFE0F');
    expect(f).toContain('\uD83D\uDD17');
  });

  it('is an empty string when nothing applies', () => {
    const doc = generateQuestionnaireDoc(baseDeps([makeItem()]));
    expect(doc.items[0].flags).toBe('');
  });
});

describe('generateQuestionnaireDoc — appearance', () => {
  it('is null when no custom presentation is set', () => {
    const doc = generateQuestionnaireDoc(baseDeps([makeItem()]));
    expect(doc.items[0].appearance).toBeNull();
  });

  it('describes bold/italic/color from _renderStyle', () => {
    const doc = generateQuestionnaireDoc(baseDeps([makeItem({ _renderStyle: 'font-weight:bold;font-style:italic;color:#ff0000' })]));
    expect(doc.items[0].appearance).toBe('bold, italic, color: #ff0000');
  });

  it('notes custom XHTML/Markdown formatting without reproducing it', () => {
    const doc = generateQuestionnaireDoc(baseDeps([makeItem({ _renderXhtml: '<b>hi</b>' })]));
    expect(doc.items[0].appearance).toBe('custom XHTML formatting');
    const doc2 = generateQuestionnaireDoc(baseDeps([makeItem({ _renderMarkdown: '**hi**' })]));
    expect(doc2.items[0].appearance).toBe('custom Markdown formatting');
  });

  it('combines style and rich-text notes when both are present', () => {
    const doc = generateQuestionnaireDoc(baseDeps([makeItem({ _renderStyle: 'font-weight:bold', _renderMarkdown: '**hi**' })]));
    expect(doc.items[0].appearance).toBe('bold; custom Markdown formatting');
  });
});

// Tree-node builders matching doc-generator.js's shape, for concise assertions.
const leaf = (human, code = null) => ({ type: 'LEAF', human, code });
const and  = (...children) => ({ type: 'AND', children });
const or   = (...children) => ({ type: 'OR', children });
const not  = (child) => ({ type: 'NOT', child });

describe('generateQuestionnaireDoc — visibility', () => {
  it('renders a single standard enableWhen as a bare leaf, no code', () => {
    const tree = [
      makeItem({ id: 'q1', title: 'Allergies?' }),
      makeItem({ id: 'q2', title: 'Which allergies?', enableWhen: [{ question: 'q1', operator: '=', answerBoolean: true }] }),
    ];
    const doc = generateQuestionnaireDoc(baseDeps(tree));
    const q2 = doc.items.find(i => i.id === 'q2');
    expect(q2.visibility).toEqual({ tree: leaf('the value selected for \u00ABAllergies?\u00BB equals Yes'), code: null });
  });

  it('spells out comparison operators as words, never as a bare symbol', () => {
    const tree = [
      makeItem({ id: 'q1', title: 'Age' }),
      makeItem({ id: 'q2', enableWhen: [{ question: 'q1', operator: '>=', answerInteger: 18 }] }),
    ];
    const doc = generateQuestionnaireDoc(baseDeps(tree));
    expect(doc.items.find(i => i.id === 'q2').visibility.tree).toEqual(leaf('the value selected for \u00ABAge\u00BB is at least 18'));
  });

  it('joins multiple AND/OR conditions as sibling leaves under one AND/OR node', () => {
    const tree = [
      makeItem({ id: 'q1', title: 'Q1' }),
      makeItem({ id: 'q2', title: 'Q2' }),
      makeItem({
        id: 'q3',
        enableWhen: [
          { question: 'q1', operator: '=', answerBoolean: true },
          { question: 'q2', operator: '=', answerBoolean: false },
        ],
      }),
    ];
    const doc = generateQuestionnaireDoc(baseDeps(tree));
    expect(doc.items.find(i => i.id === 'q3').visibility.tree).toEqual(and(
      leaf('the value selected for \u00ABQ1\u00BB equals Yes'),
      leaf('the value selected for \u00ABQ2\u00BB equals No'),
    ));
  });

  it('phrases the exists operator (with/without an answer) in words', () => {
    const tree = [
      makeItem({ id: 'q1', title: 'Q1' }),
      makeItem({ id: 'q2', enableWhen: [{ question: 'q1', operator: 'exists', answerBoolean: true }] }),
      makeItem({ id: 'q3', enableWhen: [{ question: 'q1', operator: 'exists', answerBoolean: false }] }),
    ];
    const doc = generateQuestionnaireDoc(baseDeps(tree));
    expect(doc.items.find(i => i.id === 'q2').visibility.tree).toEqual(leaf('a value is selected for \u00ABQ1\u00BB'));
    expect(doc.items.find(i => i.id === 'q3').visibility.tree).toEqual(leaf('no value is selected for \u00ABQ1\u00BB'));
  });

  it('prefers enableWhenExpression, keeping the raw FHIRPath as the top-level code', () => {
    const item = makeItem({ enableWhenExpression: "%resource.item.where(linkId='q1').answer.exists()" });
    const doc = generateQuestionnaireDoc(baseDeps([item]));
    expect(doc.items[0].visibility.code).toBe("%resource.item.where(linkId='q1').answer.exists()");
  });

  it('without fp, the tree is a single unrecognized leaf holding the full text as code', () => {
    const item = makeItem({ enableWhenExpression: "%resource.item.where(linkId='q1').answer.exists()" });
    const doc = generateQuestionnaireDoc(baseDeps([item]));
    expect(doc.items[0].visibility.tree).toEqual(leaf(null, "%resource.item.where(linkId='q1').answer.exists()"));
  });

  it('is null when no visibility condition is set', () => {
    const doc = generateQuestionnaireDoc(baseDeps([makeItem()]));
    expect(doc.items[0].visibility).toBeNull();
  });
});

describe('generateQuestionnaireDoc — expression human interpretation (with fp)', () => {
  it('describes an enableWhenExpression item reference in plain English', () => {
    const tree = [
      makeItem({ id: 'q1', title: 'Smoker?' }),
      makeItem({ id: 'q2', enableWhenExpression: "%resource.item.where(linkId='q1').answer.exists()" }),
    ];
    const doc = generateQuestionnaireDoc(baseDeps(tree, { fp }));
    const q2 = doc.items.find(i => i.id === 'q2');
    expect(q2.visibility.tree).toEqual(leaf('the answer to \u00ABSmoker?\u00BB has an answer', "%resource.item.where(linkId='q1').answer.exists()"));
    expect(q2.visibility.code).toBe("%resource.item.where(linkId='q1').answer.exists()");
  });

  it('describes a calculatedExpression built from two item references', () => {
    const tree = [
      makeItem({ id: 'weight', title: 'Weight' }),
      makeItem({ id: 'height', title: 'Height' }),
      makeItem({
        id: 'bmi',
        _calculatedExpr: "%resource.item.where(linkId='weight').answer.valueDecimal / %resource.item.where(linkId='height').answer.valueDecimal",
      }),
    ];
    const doc = generateQuestionnaireDoc(baseDeps(tree, { fp }));
    const bmi = doc.items.find(i => i.id === 'bmi');
    expect(bmi.calculated.tree.human).toBe('the answer to \u00ABWeight\u00BB divided by the answer to \u00ABHeight\u00BB');
  });

  it('describes an initialExpression literal', () => {
    const item = makeItem({ id: 'q1', _initialExpr: '5' });
    const doc = generateQuestionnaireDoc(baseDeps([item], { fp }));
    expect(doc.items[0].initial).toEqual({ tree: leaf('5', '5'), code: '5' });
  });

  it('falls back to an unrecognized leaf (code only) when the expression is not a modeled shape', () => {
    const item = makeItem({ id: 'q1', _calculatedExpr: 'today().is-not-a-real-fn-xyz()' });
    const doc = generateQuestionnaireDoc(baseDeps([item], { fp }));
    expect(doc.items[0].calculated.tree).toEqual(leaf(null, 'today().is-not-a-real-fn-xyz()'));
  });

  it('calculated/initial are null when the fields are unset', () => {
    const doc = generateQuestionnaireDoc(baseDeps([makeItem()], { fp }));
    expect(doc.items[0].calculated).toBeNull();
    expect(doc.items[0].initial).toBeNull();
  });
});

describe('generateQuestionnaireDoc — real-world compound expressions (aggregate-over-set + and/or)', () => {
  // Common in externally-authored questionnaires (e.g. payer medical-policy
  // forms): a parent "criteria met" checkbox computed from several children,
  // often as `where(linkId='a' or 'b' or …).answer.valueBoolean.allTrue()`
  // ANDed with an "all referenced items are answered" guard. The block model
  // alone can't represent this (falls to `raw`) — describeExpr must recover it
  // via expandAggregateOverSet (the same helper Build's condition editor uses),
  // expanding it into a nested AND/OR of leaves rather than one leaf.
  const critTree = () => [
    makeItem({ id: 'c1', title: 'Criterion A' }),
    makeItem({ id: 'c2', title: 'Criterion B' }),
  ];

  it('describes a bare allTrue() aggregate as an AND of per-item comparisons', () => {
    const tree = [...critTree(), makeItem({
      id: 'parent',
      _calculatedExpr: "%resource.item.where(linkId='c1' or 'c2').answer.valueBoolean.allTrue()",
    })];
    const doc = generateQuestionnaireDoc(baseDeps(tree, { fp }));
    expect(doc.items.find(i => i.id === 'parent').calculated.tree).toEqual(and(
      leaf('the answer to \u00ABCriterion A\u00BB equals Yes', "%resource.item.where(linkId='c1').answer.valueBoolean = true"),
      leaf('the answer to \u00ABCriterion B\u00BB equals Yes', "%resource.item.where(linkId='c2').answer.valueBoolean = true"),
    ));
  });

  it('describes a bare anyTrue() aggregate as an OR of per-item comparisons', () => {
    const tree = [...critTree(), makeItem({
      id: 'parent',
      _calculatedExpr: "%resource.item.where(linkId='c1' or 'c2').answer.valueBoolean.anyTrue()",
    })];
    const doc = generateQuestionnaireDoc(baseDeps(tree, { fp }));
    const result = doc.items.find(i => i.id === 'parent').calculated.tree;
    expect(result.type).toBe('OR');
    expect(result.children.map(c => c.human)).toEqual([
      'the answer to \u00ABCriterion A\u00BB equals Yes',
      'the answer to \u00ABCriterion B\u00BB equals Yes',
    ]);
  });

  it('describes the full real-world compound shape as a top-level AND of the aggregate and the answered-guard', () => {
    const expr = "%resource.item.where(linkId='c1' or 'c2').answer.valueBoolean.allTrue() and "
      + "(%resource.item.where(linkId='c1').answer.valueBoolean.exists() and %resource.item.where(linkId='c2').answer.valueBoolean.exists())";
    const tree = [...critTree(), makeItem({ id: 'parent', _calculatedExpr: expr })];
    const doc = generateQuestionnaireDoc(baseDeps(tree, { fp }));
    const result = doc.items.find(i => i.id === 'parent').calculated.tree;
    expect(result.type).toBe('AND');
    expect(result.children).toHaveLength(2);
    expect(result.children[0].type).toBe('AND'); // the allTrue() aggregate, expanded
    expect(result.children[0].children.map(c => c.human)).toEqual([
      'the answer to \u00ABCriterion A\u00BB equals Yes',
      'the answer to \u00ABCriterion B\u00BB equals Yes',
    ]);
    expect(result.children[1].type).toBe('AND'); // the answered-guard
    expect(result.children[1].children.map(c => c.human)).toEqual([
      'the answer to \u00ABCriterion A\u00BB has an answer',
      'the answer to \u00ABCriterion B\u00BB has an answer',
    ]);
  });

  it('recovers the count($this=true) >= 1 idiom as an anyTrue()-equivalent OR', () => {
    const expr = "%resource.item.where(linkId='c1' or 'c2').answer.valueBoolean.where($this = true).count() >= 1";
    const tree = [...critTree(), makeItem({ id: 'parent', _calculatedExpr: expr })];
    const doc = generateQuestionnaireDoc(baseDeps(tree, { fp }));
    const result = doc.items.find(i => i.id === 'parent').calculated.tree;
    expect(result.type).toBe('OR');
    expect(result.children.map(c => c.human)).toEqual([
      'the answer to \u00ABCriterion A\u00BB equals Yes',
      'the answer to \u00ABCriterion B\u00BB equals Yes',
    ]);
  });

  it('decomposes a top-level OR/NOT in an enableWhenExpression into tree nodes', () => {
    const tree = [
      makeItem({ id: 'q1', title: 'Q1' }),
      makeItem({ id: 'q2', title: 'Q2' }),
      makeItem({
        id: 'q3',
        enableWhenExpression: "%resource.item.where(linkId='q1').answer.exists() or not(%resource.item.where(linkId='q2').answer.exists())",
      }),
    ];
    const doc = generateQuestionnaireDoc(baseDeps(tree, { fp }));
    const result = doc.items.find(i => i.id === 'q3').visibility.tree;
    expect(result).toEqual(or(
      leaf('the answer to \u00ABQ1\u00BB has an answer', "%resource.item.where(linkId='q1').answer.exists()"),
      not(leaf('the answer to \u00ABQ2\u00BB has an answer', "%resource.item.where(linkId='q2').answer.exists()")),
    ));
  });
});



describe('generateQuestionnaireDoc — nested tree walk', () => {
  it('flattens groups and children with increasing depth', () => {
    const tree = [{
      id: 'g1', type: 'group', title: 'Group 1', mandatory: false, repeats: false,
      enableWhen: [], enableBehavior: 'all', enableWhenExpression: '', constraint: [],
      children: [makeItem({ id: 'q1' }), makeItem({ id: 'q2' })],
    }];
    const doc = generateQuestionnaireDoc(baseDeps(tree));
    expect(doc.items.map(i => [i.id, i.depth])).toEqual([['g1', 0], ['q1', 1], ['q2', 1]]);
  });
});

describe('buildItemTree — reconstructing nesting from the flat depth list', () => {
  const at = (id, depth) => ({ id, depth });

  it('returns an empty tree for an empty list', () => {
    expect(buildItemTree([])).toEqual([]);
  });

  it('nests a single parent with two depth-1 children', () => {
    const result = buildItemTree([at('g1', 0), at('q1', 1), at('q2', 1)]);
    expect(result).toHaveLength(1);
    expect(result[0].item.id).toBe('g1');
    expect(result[0].children.map(c => c.item.id)).toEqual(['q1', 'q2']);
  });

  it('returns to a shallower depth for a later top-level sibling', () => {
    const result = buildItemTree([at('g1', 0), at('q1', 1), at('g2', 0), at('q2', 1)]);
    expect(result.map(n => n.item.id)).toEqual(['g1', 'g2']);
    expect(result[0].children.map(c => c.item.id)).toEqual(['q1']);
    expect(result[1].children.map(c => c.item.id)).toEqual(['q2']);
  });

  it('pops multiple levels back up correctly (deep nesting followed by a shallow sibling)', () => {
    const result = buildItemTree([at('g1', 0), at('g1a', 1), at('q1', 2), at('g2', 0)]);
    expect(result.map(n => n.item.id)).toEqual(['g1', 'g2']);
    expect(result[0].children[0].item.id).toBe('g1a');
    expect(result[0].children[0].children[0].item.id).toBe('q1');
    expect(result[1].children).toEqual([]);
  });

  it('leaves bare items (no children) with an empty children array', () => {
    const result = buildItemTree([at('q1', 0)]);
    expect(result[0].children).toEqual([]);
  });
});

describe('generateQuestionnaireDoc — answer options + translations', () => {
  it('parses options and attaches per-option translations', () => {
    const item = makeItem({ id: 'q1', options: 'y=Yes,n=No' });
    const translations = { es: { items: {}, opts: { 'q1__y': 'S\u00ED' } } };
    const doc = generateQuestionnaireDoc(baseDeps([item], { translations }));
    const opts = doc.items[0].options;
    expect(opts).toEqual([
      { code: 'y', display: 'Yes', translations: [{ lang: 'es', label: 'Spanish', text: 'S\u00ED' }] },
      { code: 'n', display: 'No', translations: [] },
    ]);
  });

  it('attaches item-text and questionnaire-title translations', () => {
    const item = makeItem({ id: 'q1', title: 'Allergies?' });
    const translations = { fr: { title: 'Questionnaire d\u00e9mo', items: { q1: 'Allergies\u00a0?' }, opts: {} } };
    const doc = generateQuestionnaireDoc(baseDeps([item], { translations }));
    expect(doc.titleTranslations).toEqual([{ lang: 'fr', label: 'French', text: 'Questionnaire d\u00e9mo' }]);
    expect(doc.items[0].translations).toEqual([{ lang: 'fr', label: 'French', text: 'Allergies\u00a0?' }]);
  });

  it('omits the translations block entirely for a single-language questionnaire', () => {
    const doc = generateQuestionnaireDoc(baseDeps([makeItem()]));
    expect(doc.items[0].translations).toEqual([]);
    expect(doc.titleTranslations).toEqual([]);
  });
});

describe('generateQuestionnaireDoc — validation & audit passthrough', () => {
  it('surfaces validateTree issues (e.g. enableWhen referencing an unknown linkId)', () => {
    const item = makeItem({ enableWhen: [{ question: 'ghost', operator: '=', answerBoolean: true }] });
    const doc = generateQuestionnaireDoc(baseDeps([item]));
    expect(doc.validation.some(v => v.nodeId === 'q1')).toBe(true);
  });

  it('surfaces auditTree issues (e.g. enableWhenExpression referencing an unknown linkId)', () => {
    const item = makeItem({ enableWhenExpression: "item.where(linkId='ghost').answer.exists()" });
    const doc = generateQuestionnaireDoc(baseDeps([item]));
    expect(doc.audit.some(a => a.nodeId === 'q1')).toBe(true);
  });
});
