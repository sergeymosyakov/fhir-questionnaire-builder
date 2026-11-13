import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderDocMarkdown, renderGuidePage, renderNavHtml } from '../js/fhir/docs-pages.js';
import { renderHelpRows, helpDataFrom, withStaticRows } from '../js/fhir/help-rows.js';
import { siteFooter } from '../js/fhir/static-page.js';
import { ensureSitemapUrls } from '../scripts/lib/sitemap.mjs';

const url = (name) => new URL(`../${name}`, import.meta.url);
const read = (name) => readFileSync(url(name), 'utf8').replace(/\r\n/g, '\n');
const manifest = JSON.parse(read('docs-site/manifest.json'));
const pages = manifest.sections.flatMap((s) => s.pages);
const fileToId = new Map(pages.map((p) => [p.file, p.id]));
const render = (page) => renderGuidePage(manifest, page, renderDocMarkdown(read(`docs-site/pages/${page.file}`), fileToId));

describe('guide pages (guide/<id>.html)', () => {
  it.each(pages.map((p) => [p.id, p]))('%s is up to date (run `npm run docs:guide`)', (id, page) => {
    expect(read(`guide/${id}.html`)).toBe(render(page));
  });

  it('has no page without a manifest entry and every page is in sitemap.xml', () => {
    expect(readdirSync(url('guide/')).map((f) => f.replace('.html', '')).sort()).toEqual(pages.map((p) => p.id).sort());
    const sitemap = read('sitemap.xml');
    expect(pages.filter((p) => !sitemap.includes(`<loc>https://fhirbuilder.com/guide/${p.id}.html</loc>`)).map((p) => p.id)).toEqual([]);
    expect(sitemap).toContain('<loc>https://fhirbuilder.com/widget-demo.html</loc>');
  });

  it('every page has a useful description and a title that fits a search result', () => {
    for (const page of pages) {
      const html = read(`guide/${page.id}.html`);
      const description = html.match(/<meta name="description" content="([^"]*)"/)[1];
      const title = html.match(/<title>([^<]*)<\/title>/)[1];
      expect(description.length, `${page.id} description`).toBeGreaterThanOrEqual(60);
      expect(title.length, `${page.id} title`).toBeLessThanOrEqual(75);
    }
  });

  it('docs.html carries crawlable links to every guide page', () => {
    const nav = read('docs.html').match(/<nav id="docSidebar"[^>]*>([\s\S]*?)<\/nav>/)[1];
    expect(nav).toBe(`\n${renderNavHtml(manifest, { hrefOf: (p) => `guide/${p.id}.html` })}\n    `);
  });
});

describe('renderDocMarkdown', () => {
  const ids = new Map([['templates.md', 'templates']]);
  it('turns in-repo .md links into guide links (keeping anchors) and opens external links safely', () => {
    const { html } = renderDocMarkdown('[a](templates.md) [b](templates.md#x) [c](https://example.org/p?a=1&b=2)', ids);
    expect(html).toContain('<a href="templates.html">a</a>');
    expect(html).toContain('<a href="templates.html#x">b</a>');
    expect(html).toContain('href="https://example.org/p?a=1&amp;b=2" target="_blank" rel="noopener noreferrer"');
  });

  it('shows raw HTML as text instead of emitting it', () => {
    const { html } = renderDocMarkdown('<script>alert(1)</script>\n\ntext <img src=x onerror=alert(1)>', ids);
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;');
  });

  it('gives h2/h3 ids, lists them in the table of contents and summarises the first paragraph', () => {
    const { html, toc, summary } = renderDocMarkdown('# Title\n\nFirst **paragraph** with `code`.\n\n## Use it\n\n### Sub part\n\n## Next', ids);
    expect(html).toContain('<h2 id="use-it">Use it</h2>');
    expect(toc).toEqual([{ depth: 2, id: 'use-it', text: 'Use it' }, { depth: 3, id: 'sub-part', text: 'Sub part' }, { depth: 2, id: 'next', text: 'Next' }]);
    expect(summary).toBe('First paragraph with code.');
  });

  it('takes heading and summary text from the tokens: entities decoded once, code and emphasis flattened', () => {
    const { toc, summary } = renderDocMarkdown('# T\n\nTom &amp; **Jerry** use `<x>` and a < b.\n\n## Tom &amp; **Jerry** `<x>`', ids);
    expect(toc).toEqual([{ depth: 2, id: 'tom-jerry-x', text: 'Tom & Jerry <x>' }]);
    expect(summary).toBe('Tom & Jerry use <x> and a < b.');
  });

  it('keeps code literal, drops inline HTML and image text, and decodes entities only in plain text', () => {
    const { toc, summary } = renderDocMarkdown('# T\n\nA `&amp;amp;` B <b>x</b> ![alt](i.png) C &amp; D.\n\n## `&lt;` &amp; <i>e</i>', ids);
    expect(summary).toBe('A &amp;amp; B x C & D.');
    expect(toc[0].text).toBe('&lt; & e');
  });

  it('refuses what would produce a broken page: duplicate heading ids, unknown or script links', () => {
    expect(() => renderDocMarkdown('## Same\n\ntext\n\n## Same', ids)).toThrow('duplicate id');
    expect(() => renderDocMarkdown('## !!!', ids)).toThrow('empty or duplicate id');
    expect(() => renderDocMarkdown('[x](missing.md)', ids)).toThrow('missing.md');
    expect(() => renderDocMarkdown('[x](javascript:alert(1))', ids)).toThrow('javascript:');
    expect(renderDocMarkdown('[x](#top) [y](mailto:a@b.c)', ids).html).toContain('href="#top"');
  });

  it('shortens a long summary on a word boundary', () => {
    const { summary } = renderDocMarkdown(`# T\n\n${'word '.repeat(80)}`, ids);
    expect(summary.length).toBeLessThanOrEqual(200);
    expect(summary.endsWith('…')).toBe(true);
  });
});

describe('renderGuidePage', () => {
  const m = { sections: [{ label: 'S', pages: [{ id: 'a', title: 'A <1>', file: 'a.md' }, { id: 'b', title: 'B', file: 'b.md' }] }] };
  const doc = { html: '<h1>A</h1>', toc: [], summary: 'sum' };

  it('marks the current page, links previous/next, escapes titles and has a breadcrumb crumb', () => {
    const html = renderGuidePage(m, m.sections[0].pages[0], doc);
    expect(html).toContain('class="doc-nav-link doc-nav-link--active" href="a.html" aria-current="page"');
    expect(html).toContain('data-testid="guide-next"');
    expect(html).not.toContain('data-testid="guide-prev"');
    expect(html).toContain('A &lt;1&gt;');
    expect(html).not.toContain('A <1>');
    expect(html).toContain('<link rel="canonical" href="https://fhirbuilder.com/guide/a.html">');
    expect(html).toContain('href="../css/docs-portal.css"');
  });

  it('omits the table of contents when there is nothing to list', () => {
    expect(renderGuidePage(m, m.sections[0].pages[1], doc)).not.toContain('On this page');
  });
});

describe('help.html static rows', () => {
  it('are up to date with HELP_DATA (run `npm run docs:guide`)', () => {
    expect(read('help.html')).toBe(withStaticRows(read('help.html')).replace(/<!-- gen:site-footer -->[\s\S]*?<!-- \/gen:site-footer -->/, `<!-- gen:site-footer -->\n${siteFooter()}\n<!-- /gen:site-footer -->`));
  });

  it('renders a category separator once per category and escapes cells', () => {
    const rows = renderHelpRows([
      { cat: 'A', field: 'x<y', desc: 'd & e', where: 'w', how: 'h' },
      { cat: 'A', field: 'f2', desc: 'd', where: 'w', how: 'h' },
      { cat: 'B', field: 'f3', desc: 'd', where: 'w', how: 'h' },
    ]);
    expect((rows.match(/help-cat-sep/g) || []).length).toBe(2);
    expect(rows).toContain('<code>x&lt;y</code>');
    expect(rows).toContain('d &amp; e');
  });

  it('reads the HELP_DATA literal and rejects a page without it', () => {
    expect(helpDataFrom("const HELP_DATA = [\n    { cat: 'A', field: 'f', desc: 'd', where: 'w', how: 'h' },\n  ];\n")).toHaveLength(1);
    expect(() => helpDataFrom('<html></html>')).toThrow('HELP_DATA not found');
  });
});

describe('site footer and sitemap helper', () => {
  it.each(['gallery.html', 'templates.html', 'help.html', 'widget-demo.html'])('%s (a hub page) carries the site footer', (file) => {
    expect(read(file)).toContain('data-testid="page-footer"');
  });

  it.each(['templates/phq-9.html', 'guide/templates.html'])('%s (a nested page with breadcrumbs) does not', (file) => {
    expect(read(file)).not.toContain('page-footer');
  });

  it('ensureSitemapUrls appends only missing URLs, keeps the line endings and is idempotent', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'sm-')), 'sitemap.xml');
    writeFileSync(file, '<?xml version="1.0"?>\r\n<urlset>\r\n  <url>\r\n    <loc>https://x/a</loc>\r\n  </url>\r\n</urlset>\r\n');
    const opts = { priority: '0.5', lastmod: '2026-01-01' };
    ensureSitemapUrls(new URL(`file://${file}`), ['https://x/a', 'https://x/b'], opts);
    ensureSitemapUrls(new URL(`file://${file}`), ['https://x/a', 'https://x/b'], opts);
    const out = readFileSync(file, 'utf8');
    expect(out.match(/<loc>https:\/\/x\/b<\/loc>/g)).toHaveLength(1);
    expect(out.match(/<loc>https:\/\/x\/a<\/loc>/g)).toHaveLength(1);
    expect(out).not.toMatch(/[^\r]\n/);
  });
});
