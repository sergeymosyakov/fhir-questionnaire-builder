// ── Unit tests: renderDocAsText() plain-text documentation renderer ───────────
import { describe, it, expect } from 'vitest';

const { renderDocAsText } = await import('../js/fhir/doc-render-text.js');

const baseDoc = (overrides = {}) => ({
  generatedAt: '2026-09-04T00:00:00.000Z',
  meta: { title: 'Demo Questionnaire', url: 'https://example.org/Q1', version: '1.0', status: 'active' },
  titleTranslations: [],
  legend: [{ icon: '*', label: 'Required', desc: 'Item must be answered' }],
  variables: [],
  contained: [],
  items: [],
  validation: [],
  audit: [],
  copyrightHtml: '&copy; 2026 <a href="https://x">Jane Doe</a> &middot; Free to use',
  ...overrides,
});

describe('renderDocAsText — document shell', () => {
  it('includes the uppercased title and all six section headers', () => {
    const text = renderDocAsText(baseDoc());
    expect(text).toContain('DEMO QUESTIONNAIRE');
    expect(text).toContain('1. LEGEND');
    expect(text).toContain('2. METADATA');
    expect(text).toContain('3. VARIABLES');
    expect(text).toContain('4. CONTAINED RESOURCES');
    expect(text).toContain('5. STRUCTURE');
    expect(text).toContain('6. VALIDATION & AUDIT');
  });

  it('renders the metadata fields present on questMeta', () => {
    const text = renderDocAsText(baseDoc());
    expect(text).toContain('URL: https://example.org/Q1');
    expect(text).toContain('Version: 1.0');
    expect(text).toContain('Status: active');
  });

  it('renders a plain-text copyright line without HTML tags or entities', () => {
    const text = renderDocAsText(baseDoc());
    expect(text).toContain('\u00A9 2026 Jane Doe \u00B7 Free to use');
    expect(text).not.toContain('<a');
    expect(text).not.toContain('&copy;');
  });

  it('stamps the generatedAt timestamp in the footer', () => {
    const text = renderDocAsText(baseDoc());
    expect(text).toContain('Generated on 2026-09-04T00:00:00.000Z by FHIR Questionnaire Builder');
  });
});

describe('renderDocAsText — variables & contained resources', () => {
  it('shows empty-state text for both sections when absent', () => {
    const text = renderDocAsText(baseDoc());
    expect(text).toContain('No variables defined.');
    expect(text).toContain('No contained resources.');
  });

  it('renders variables as a formatted JSON block', () => {
    const text = renderDocAsText(baseDoc({ variables: [{ name: 'age', expression: '%patient.birthDate' }] }));
    expect(text).toContain('"name": "age"');
    expect(text).toContain('"expression": "%patient.birthDate"');
  });

  it('renders each contained resource labeled by resourceType/id, as formatted JSON', () => {
    const text = renderDocAsText(baseDoc({ contained: [{ resourceType: 'ValueSet', id: 'vs1', status: 'active' }] }));
    expect(text).toContain('ValueSet/vs1:');
    expect(text).toContain('"resourceType": "ValueSet"');
    expect(text).toContain('"status": "active"');
  });
});

describe('renderDocAsText — title translations', () => {
  it('lists each language version under the title', () => {
    const text = renderDocAsText(baseDoc({ titleTranslations: [{ lang: 'es', label: 'Spanish', text: 'Cuestionario demo' }] }));
    expect(text).toContain('[es] Spanish: Cuestionario demo');
  });
});

describe('renderDocAsText — structure items', () => {
  const item = {
    depth: 0, id: 'q1', type: 'item', itemType: 'text', title: 'Do you smoke?',
    translations: [], cardinality: '0..1', flags: '*', visibility: null, calculated: null,
    initial: null, constraints: [], options: [],
    answerSource: { valueSet: null, expression: null, candidate: null },
    itemMedia: null, shortText: null, entryFormat: null, columnCount: null, choiceColumns: null,
    collapsible: null, openLabel: null, isSubject: false, observationExtract: null,
    maxLength: null, maxDecimalPlaces: null, answerConstraint: null, codes: null,
  };

  it('renders linkId, kind, cardinality, flags, and title with a tree connector', () => {
    const text = renderDocAsText(baseDoc({ items: [item] }));
    expect(text).toContain('\u2514\u2500 [q1] (text, 0..1, *) Do you smoke?');
  });

  it('renders the prefix tag right after linkId when present, omits it otherwise', () => {
    const text = renderDocAsText(baseDoc({ items: [{ ...item, prefix: '9.4' }] }));
    expect(text).toContain('\u2514\u2500 [q1] [9.4] (text, 0..1, *) Do you smoke?');
    expect(renderDocAsText(baseDoc({ items: [item] }))).not.toContain('[9.4]');
  });

  it('nests a depth-1 child under its parent with its own connector and indent', () => {
    const child = { ...item, depth: 1, id: 'q2' };
    const text = renderDocAsText(baseDoc({ items: [item, child] }));
    expect(text).toContain('\u2514\u2500 [q1] (text, 0..1, *) Do you smoke?\n    \u2514\u2500 [q2] (text, 0..1, *) Do you smoke?');
  });

  it('branches two top-level siblings with mid (\u251C\u2500) and last (\u2514\u2500) connectors', () => {
    const second = { ...item, id: 'q2' };
    const text = renderDocAsText(baseDoc({ items: [item, second] }));
    expect(text).toContain('\u251C\u2500 [q1]');
    expect(text).toContain('\u2514\u2500 [q2]');
  });

  it('renders a bare leaf visibility/calculated/initial expression with its human interpretation', () => {
    const rich = {
      ...item,
      visibility: { tree: { type: 'LEAF', human: 'the value selected for \u00ABQ0\u00BB equals Yes', code: null }, code: null },
      calculated: { tree: { type: 'LEAF', human: 'the count of all items in the questionnaire', code: '%resource.count()' }, code: '%resource.count()' },
      initial: { tree: { type: 'LEAF', human: '5', code: '5' }, code: '5' },
    };
    const text = renderDocAsText(baseDoc({ items: [rich] }));
    expect(text).toContain('This item is shown only when this condition is true:');
    expect(text).toMatch(/- the value selected for «Q0» equals Yes/);
    expect(text).toContain('Calculated:');
    expect(text).toMatch(/- the count of all items in the questionnaire/);
    expect(text).toContain('FHIRPath: %resource.count()');
    expect(text).toContain('Initial value:');
    expect(text).toMatch(/- 5/);
  });

  it('renders a NOT-recognized leaf inline with its own code, no fabricated text', () => {
    const rich = { ...item, calculated: { tree: { type: 'LEAF', human: null, code: 'today().foo-bar()' }, code: 'today().foo-bar()' } };
    const text = renderDocAsText(baseDoc({ items: [rich] }));
    expect(text).toMatch(/- \[not recognized\] today\(\)\.foo-bar\(\)/);
  });

  it('renders a malformed/missing condition node as a fallback note instead of throwing', () => {
    const rich = { ...item, calculated: { tree: undefined, code: 'some-bad-expr()' } };
    expect(() => renderDocAsText(baseDoc({ items: [rich] }))).not.toThrow();
    const text = renderDocAsText(baseDoc({ items: [rich] }));
    expect(text).toContain('[malformed condition, unable to parse]');
  });

  it('renders AND between siblings (not as a header) and NOT as a prefix label', () => {
    const rich = {
      ...item,
      calculated: {
        code: null,
        tree: {
          type: 'AND',
          children: [
            { type: 'LEAF', human: 'the answer to \u00ABA\u00BB equals Yes', code: null },
            { type: 'NOT', child: { type: 'LEAF', human: 'the answer to \u00ABB\u00BB has an answer', code: null } },
          ],
        },
      },
    };
    const text = renderDocAsText(baseDoc({ items: [rich] }));
    expect(text).toMatch(/- the answer to «A» equals Yes\n\s+AND\n\s+NOT:\n\s+- the answer to «B» has an answer/);
  });

  it('renders constraints and answer options with nested translations', () => {
    const rich = {
      ...item,
      constraints: [{ key: 'c1', severity: 'error', human: 'must be positive', expression: 'value > 0' }],
      options: [{ code: 'y', display: 'Yes', translations: [{ lang: 'es', label: 'Spanish', text: 'S\u00ED' }] }],
    };
    const text = renderDocAsText(baseDoc({ items: [rich] }));
    expect(text).toContain('Constraint [error] must be positive: value > 0');
    expect(text).toContain('Option: y = Yes');
    expect(text).toContain('\u{1F310} [es] Spanish: S\u00ED');
  });

  it('renders the Appearance note when present, omits it otherwise', () => {
    const rich = { ...item, appearance: { summary: 'bold, color: #ff0000', xhtml: null, markdown: null } };
    const text = renderDocAsText(baseDoc({ items: [rich] }));
    expect(text).toContain('\u{1F3A8} Appearance: bold, color: #ff0000');

    const plain = renderDocAsText(baseDoc({ items: [{ ...item, appearance: null }] }));
    expect(plain).not.toContain('Appearance:');
  });

  it('renders the raw xhtml/markdown source verbatim (not reflowed) right after the Appearance note', () => {
    const rich = { ...item, appearance: { summary: 'custom XHTML formatting', xhtml: '<div>\n  <b>Hi</b>\n</div>', markdown: null } };
    const text = renderDocAsText(baseDoc({ items: [rich] }));
    expect(text).toContain('\u{1F3A8} Appearance: custom XHTML formatting');
    expect(text).toContain('<div>');
    expect(text).toContain('<b>Hi</b>');
    expect(text).toContain('</div>');
  });

  it('renders a design note when present, omits it otherwise', () => {
    const rich = { ...item, designNote: 'Ask gently \u2014 sensitive topic' };
    const text = renderDocAsText(baseDoc({ items: [rich] }));
    expect(text).toContain('\u{1F4DD} Design note: Ask gently \u2014 sensitive topic');
    expect(renderDocAsText(baseDoc({ items: [item] }))).not.toContain('Design note:');
  });

  it('renders a fixed (non-expression) initial value, joining multiple values', () => {
    const single = renderDocAsText(baseDoc({ items: [{ ...item, initialValue: ['Yes'] }] }));
    expect(single).toContain('Initial value (fixed): Yes');
    const multi = renderDocAsText(baseDoc({ items: [{ ...item, initialValue: ['a', 'b'] }] }));
    expect(multi).toContain('Initial value (fixed): a, b');
  });

  it('renders itemControl and disabledDisplay in the extended properties block', () => {
    const rich = { ...item, itemControl: 'autocomplete', disabledDisplay: 'protected' };
    const text = renderDocAsText(baseDoc({ items: [rich] }));
    expect(text).toContain('Item control: autocomplete');
    expect(text).toContain('Disabled display: protected');
  });

  it('appends ordinal/prefix/exclusive/weight to an option label when present', () => {
    const rich = { ...item, options: [{ code: 'y', display: 'Yes', translations: [], answerMedia: null, ordinal: 1, prefix: 'A.', exclusive: true, weight: 2.5 }] };
    const text = renderDocAsText(baseDoc({ items: [rich] }));
    expect(text).toContain('Option: y = Yes (A., ordinal 1, weight 2.5, exclusive)');
  });

  it('renders item media with content type, title, and url', () => {
    const rich = { ...item, itemMedia: { contentType: 'image/png', url: 'https://example.org/x.png', title: 'Diagram' } };
    const text = renderDocAsText(baseDoc({ items: [rich] }));
    expect(text).toContain('\u{1F5BC} Item media: image/png - Diagram (https://example.org/x.png)');
  });

  it('renders an external answerValueSet as a bare reference', () => {
    const rich = { ...item, answerSource: { valueSet: { ref: 'http://example.org/vs', local: false }, expression: null, candidate: null } };
    const text = renderDocAsText(baseDoc({ items: [rich] }));
    expect(text).toContain('Answer options from ValueSet: http://example.org/vs');
  });

  it('renders a local #contained answerValueSet by name with a Contained Resources pointer', () => {
    const rich = { ...item, answerSource: { valueSet: { ref: '#vs1', local: true, id: 'vs1', name: 'USSG Family Health History', found: true }, expression: null, candidate: null } };
    const text = renderDocAsText(baseDoc({ items: [rich] }));
    expect(text).toContain('Answer options from ValueSet: USSG Family Health History (see Contained Resources: vs1)');
  });

  it('renders answerExpression/candidateExpression using the same condition-tree shape as calculated/initial', () => {
    const rich = {
      ...item,
      answerSource: {
        valueSet: null,
        expression: { tree: { type: 'LEAF', human: null, code: '%resource.descendants()' }, code: '%resource.descendants()' },
        candidate: { tree: { type: 'LEAF', human: null, code: '%context.repeat(item)' }, code: '%context.repeat(item)' },
      },
    };
    const text = renderDocAsText(baseDoc({ items: [rich] }));
    expect(text).toContain('Answer options (computed dynamically via answerExpression):');
    expect(text).toContain('Candidate options (computed dynamically via candidateExpression):');
    expect(text).toContain('FHIRPath: %resource.descendants()');
    expect(text).toContain('FHIRPath: %context.repeat(item)');
  });

  it('tags an option with its answerMedia inline', () => {
    const rich = { ...item, options: [{ code: 'y', display: 'Yes', translations: [], answerMedia: { contentType: 'image/png', title: 'Yes icon' } }] };
    const text = renderDocAsText(baseDoc({ items: [rich] }));
    expect(text).toContain('Option: y = Yes [Yes icon]');
  });

  it('renders the extended properties block only for properties that are present', () => {
    const rich = {
      ...item,
      shortText: 'BMI', entryFormat: 'MM/DD/YYYY', columnCount: 2,
      choiceColumns: [{ label: 'Code' }, { path: 'display' }],
      collapsible: 'default-closed', openLabel: 'Other', isSubject: true,
      observationExtract: false, maxLength: 100, maxDecimalPlaces: 2,
      answerConstraint: 'optionsOrString', codes: [{ system: 'http://loinc.org', code: '12345-6', display: 'Test' }],
    };
    const text = renderDocAsText(baseDoc({ items: [rich] }));
    expect(text).toContain('Short text: BMI');
    expect(text).toContain('Entry format: MM/DD/YYYY');
    expect(text).toContain('Column count: 2');
    expect(text).toContain('Choice columns: Code, display');
    expect(text).toContain('Collapsible: default-closed');
    expect(text).toContain('Open label: Other');
    expect(text).toContain('Subject item: Yes');
    expect(text).toContain('Observation extract: No');
    expect(text).toContain('Max length: 100');
    expect(text).toContain('Max decimal places: 2');
    expect(text).toContain('Answer constraint: optionsOrString');
    expect(text).toContain('Codes: http://loinc.org|12345-6');

    expect(renderDocAsText(baseDoc({ items: [item] }))).not.toContain('Short text:');
  });
});

describe('renderDocAsText — validation & audit', () => {
  it('shows "No issues found." when both are empty', () => {
    const text = renderDocAsText(baseDoc());
    const matches = text.match(/No issues found\./g);
    expect(matches).toHaveLength(2);
  });

  it('lists validation and audit issues with severity and nodeId', () => {
    const text = renderDocAsText(baseDoc({
      validation: [{ severity: 'error', nodeId: 'q1', message: 'Missing title' }],
      audit: [{ severity: 'warning', nodeId: 'q2', message: 'Unreachable item' }],
    }));
    expect(text).toContain('[error] q1: Missing title');
    expect(text).toContain('[warning] q2: Unreachable item');
  });
});
