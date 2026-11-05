import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { templateGroupFrom } from '../js/fhir/templates.js';
import { renderTemplatesPage } from '../js/fhir/templates-page.js';

const read = (name) => JSON.parse(readFileSync(new URL(`../templates/${name}`, import.meta.url), 'utf8'));

describe('templates.html', () => {
  it('is up to date with templates/ (run `npm run docs:templates`)', () => {
    const entries = read('library.json');
    const groups = new Map(entries.map((e) => [e.id, templateGroupFrom(read(e.file))]));
    const file = readFileSync(new URL('../templates.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    expect(file).toBe(renderTemplatesPage(entries, groups));
  });

  it('every catalog entry explains its scoring', () => {
    expect(read('library.json').filter((e) => !e.scoring).map((e) => e.id)).toEqual([]);
  });

  it('escapes HTML in entry text and never lets JSON-LD close its script tag', () => {
    const entry = { id: 'x"y', name: '<b>n</b>', description: 'a & b', scoring: 's', source: "it's", license: 'l', file: 'f.json' };
    const html = renderTemplatesPage([entry], new Map([['x"y', { item: [{ type: 'string', text: '<i>q</i>' }] }]]));
    expect(html).toContain('&lt;b&gt;n&lt;/b&gt;');
    expect(html).toContain('&lt;i&gt;q&lt;/i&gt;');
    expect(html).toContain('id="x&quot;y"');
    const ld = html.slice(html.indexOf('application/ld+json'), html.indexOf('</script>'));
    expect(ld).not.toContain('<b>');
  });

  it('lists only questions a respondent answers (no results, no display notes)', () => {
    const group = { item: [{ type: 'display', text: 'note' }, { type: 'choice', text: 'ask' }, { type: 'decimal', text: 'total', readOnly: true }] };
    const html = renderTemplatesPage([{ id: 'a', name: 'n', description: 'd', scoring: 's', source: 's', license: 'l', file: 'f' }], new Map([['a', group]]));
    expect(html).toContain('<li>ask</li>');
    expect(html).not.toContain('<li>note</li>');
    expect(html).not.toContain('<li>total</li>');
  });
});
