import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { templateGroupFrom, groupByCategory, TEMPLATE_CATEGORIES } from '../js/fhir/templates.js';
import { renderTemplatesPage } from '../js/fhir/templates-page.js';
import { renderTemplatePage } from '../js/fhir/template-page.js';
import { questionsOf, resultsOf, usesLoinc, templateLinks, templatesByPatternOf } from '../js/fhir/template-view.js';
import { EXPR_GALLERY } from '../js/fhir/expr-builder/gallery/index.js';

const path = (name) => new URL(`../${name}`, import.meta.url);
const read = (name) => JSON.parse(readFileSync(path(`templates/${name}`), 'utf8'));
const onDisk = (name) => readFileSync(path(name), 'utf8').replace(/\r\n/g, '\n');
const entries = read('library.json');
const groups = new Map(entries.map((e) => [e.id, templateGroupFrom(read(e.file))]));
const linksOf = (e) => templateLinks(e, entries, EXPR_GALLERY);

describe('templates.html', () => {
  it('is up to date with templates/ (run `npm run docs:templates`)', () => {
    expect(onDisk('templates.html')).toBe(renderTemplatesPage(entries, groups));
  });

  it('every catalog entry explains its scoring and has a known category', () => {
    expect(entries.filter((e) => !e.scoring).map((e) => e.id)).toEqual([]);
    const known = TEMPLATE_CATEGORIES.map((c) => c.id);
    expect(entries.filter((e) => !known.includes(e.category)).map((e) => e.id)).toEqual([]);
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

  it('groups templates under category headings and links each card to its own page', () => {
    const html = onDisk('templates.html');
    for (const { category } of groupByCategory(entries)) expect(html).toContain(`<h2 id="cat-${category.id}">${category.label}</h2>`);
    for (const e of entries) expect(html).toContain(`href="templates/${e.id}.html"`);
  });
});

describe('template detail pages', () => {
  it.each(entries.map((e) => [e.id, e]))('templates/%s.html is up to date (run `npm run docs:templates`)', (id, e) => {
    expect(onDisk(`templates/${id}.html`)).toBe(renderTemplatePage(e, groups.get(id), linksOf(e)));
  });

  it('every template page is in sitemap.xml', () => {
    const sitemap = readFileSync(path('sitemap.xml'), 'utf8');
    expect(entries.filter((e) => !sitemap.includes(`https://fhirbuilder.com/templates/${e.id}.html<`)).map((e) => e.id)).toEqual([]);
  });

  it('has no orphan page or duplicate sitemap entry', () => {
    const pages = readdirSync(path('templates/')).filter((f) => f.endsWith('.html')).map((f) => f.replace('.html', ''));
    expect(pages.sort()).toEqual(entries.map((e) => e.id).sort());
    const locs = [...readFileSync(path('sitemap.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs.filter((l, i) => locs.indexOf(l) !== i)).toEqual([]);
  });

  it('shows question options and calculated results, links relatives and escapes text', () => {
    const entry = { id: 'a', name: '<n>', description: 'd & d', scoring: 's', source: 'src', license: 'lic', file: 'a.template.json', keywords: ['k'] };
    const group = { item: [
      { type: 'choice', text: 'ask <1>', answerOption: [{ valueCoding: { display: 'Yes' } }, { valueString: 'No' }] },
      { type: 'decimal', text: 'total', readOnly: true },
    ] };
    const html = renderTemplatePage(entry, group, { more: [{ id: 'b', name: 'B' }] });
    expect(html).toContain('<li>ask &lt;1&gt;<ul><li>Yes</li><li>No</li></ul></li>');
    expect(html).toContain('<li>total</li>');
    expect(html).toContain('href="b.html"');
    expect(html).toContain('data-testid="tpd-more-b"');
    expect(html).toContain('href="a.template.json"');
    expect(html).toContain('&lt;n&gt;');
    expect(html).not.toContain('<n>');
    expect(html).toContain('href="../css/page-header.css"');
    expect(html).toContain('<span class="page-header-current" aria-current="page" data-testid="page-header-current">&lt;n&gt;</span>');
    expect(html).toContain('rel="canonical" href="https://fhirbuilder.com/templates/a.html"');
  });

  it('keeps the plain header title on pages without a crumb', () => {
    const html = onDisk('templates.html');
    expect(html).not.toContain('page-header-crumbs');
    expect(html).toContain('<a class="page-header-title" href="templates.html">Questionnaire templates</a>');
  });

  it('shows the LOINC notice only for templates that use LOINC codes', () => {
    expect(onDisk('templates/phq-9.html')).toContain('This material contains content from LOINC');
    expect(onDisk('templates/qsofa.html')).not.toContain('content from LOINC');
    expect(usesLoinc({ item: [{ type: 'group', item: [{ answerOption: [{ valueCoding: { system: 'http://loinc.org' } }] }] }] })).toBe(true);
    expect(usesLoinc({ item: [{ type: 'string', text: 'q' }] })).toBe(false);
  });

  it('omits the results and related sections when there are none', () => {
    const html = renderTemplatePage({ id: 'a', name: 'n', description: 'd', scoring: 's', source: 's', license: 'l', file: 'f' }, { item: [{ type: 'string', text: 'q' }] });
    expect(html).not.toContain('Calculated results');
    expect(html).not.toContain('More templates');
  });
});

describe('links between templates and the calculation gallery', () => {
  it('every related template and gallery pattern of the catalog exists, and relations are mutual', () => {
    const byId = new Map(entries.map((e) => [e.id, e]));
    const patternIds = new Set(EXPR_GALLERY.map((p) => p.id));
    for (const e of entries) {
      for (const id of e.galleryPatterns ?? []) expect(patternIds.has(id), `${e.id} → pattern ${id}`).toBe(true);
      for (const id of e.related ?? []) {
        expect(byId.has(id), `${e.id} → template ${id}`).toBe(true);
        expect(byId.get(id).related ?? [], `${id} should list ${e.id} back`).toContain(e.id);
      }
    }
  });

  it('every calculator template names the gallery patterns its formulas come from', () => {
    const calculators = entries.filter((e) => e.category === 'calculators');
    expect(calculators.length).toBeGreaterThan(0);
    for (const e of calculators) expect(e.galleryPatterns?.length, e.id).toBeGreaterThan(0);
  });

  it('every gallery pattern used by a template links from its gallery card', () => {
    const html = onDisk('gallery.html');
    for (const [patternId, templates] of templatesByPatternOf(entries)) {
      for (const t of templates) expect(html).toContain(`data-testid="gp-template-${patternId}-${t.id}"`);
    }
  });

  it('templateLinks keeps related templates out of the "more" list and rejects unknown references', () => {
    const list = [
      { id: 'a', name: 'A', category: 'c', related: ['b'], galleryPatterns: ['p1'] },
      { id: 'b', name: 'B', category: 'c' }, { id: 'c', name: 'C', category: 'c' }, { id: 'd', name: 'D', category: 'other' },
    ];
    const links = templateLinks(list[0], list, [{ id: 'p1', name: 'P1', extra: 1 }]);
    expect(links.related.map((e) => e.id)).toEqual(['b']);
    expect(links.more.map((e) => e.id)).toEqual(['c']);
    expect(links.patterns).toEqual([{ id: 'p1', name: 'P1' }]);
    expect(() => templateLinks({ ...list[0], related: ['zzz'] }, list, [])).toThrow('unknown related template "zzz"');
    expect(() => templateLinks({ ...list[0], galleryPatterns: ['zzz'] }, list, [])).toThrow('unknown gallery pattern "zzz"');
  });
});

describe('template-view helpers', () => {
  it('flattens nested groups and skips results and notes', () => {
    const group = { item: [
      { type: 'boolean', text: 'none' },
      { type: 'group', text: 'Row', item: [{ type: 'string', text: 'name' }, { type: 'display', text: 'hint' }] },
      { type: 'decimal', text: 'sum', readOnly: true },
    ] };
    expect(questionsOf(group).map((q) => q.text)).toEqual(['none', 'name']);
    expect(resultsOf(group)).toEqual(['sum']);
  });
});

describe('groupByCategory', () => {
  it('orders by the category list and puts unknown categories under Other', () => {
    const out = groupByCategory([{ id: '1', category: 'intake' }, { id: '2', category: 'scales' }, { id: '3', category: 'weird' }, { id: '4' }]);
    expect(out.map((g) => g.category.id)).toEqual(['scales', 'intake', 'other']);
    expect(out[2].entries.map((e) => e.id)).toEqual(['3', '4']);
  });
});
