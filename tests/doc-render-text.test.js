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
    const rich = { ...item, appearance: 'bold, color: #ff0000' };
    const text = renderDocAsText(baseDoc({ items: [rich] }));
    expect(text).toContain('\u{1F3A8} Appearance: bold, color: #ff0000');

    const plain = renderDocAsText(baseDoc({ items: [{ ...item, appearance: null }] }));
    expect(plain).not.toContain('Appearance:');
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
