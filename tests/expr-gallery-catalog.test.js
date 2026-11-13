import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { EXPR_GALLERY } from '../js/fhir/expr-builder/gallery/index.js';
import { renderGalleryCatalog } from '../js/fhir/expr-builder/gallery/catalog.js';
import { renderGalleryPage } from '../js/fhir/expr-builder/gallery/page.js';
import { templatesByPatternOf } from '../js/fhir/template-view.js';

describe('docs/EXPRESSION-GALLERY.md', () => {
  it('is up to date with the gallery patterns (run `npm run docs:gallery`)', () => {
    const file = readFileSync(new URL('../docs/EXPRESSION-GALLERY.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    expect(file).toBe(renderGalleryCatalog(EXPR_GALLERY));
  });

  it('gallery.html is up to date with the gallery patterns (run `npm run docs:gallery`)', () => {
    const file = readFileSync(new URL('../gallery.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    const library = JSON.parse(readFileSync(new URL('../templates/library.json', import.meta.url), 'utf8'));
    expect(file).toBe(renderGalleryPage(EXPR_GALLERY, templatesByPatternOf(library)));
  });

  it('gallery page escapes HTML in pattern text and keeps the JSON-LD inside its script tag', () => {
    const p = { id: 'x"y', name: '<b>n</b>', description: 'a & b', source: "it's", slots: [] };
    const html = renderGalleryPage([p]);
    expect(html).toContain('&lt;b&gt;n&lt;/b&gt;');
    expect(html).toContain('a &amp; b');
    expect(html).toContain('id="x&quot;y"');
    const ld = html.slice(html.indexOf('application/ld+json'), html.indexOf('</script>'));
    expect(ld).not.toContain('<b>');
  });

  it('links a pattern card to the templates built on it and escapes their names', () => {
    const p = { id: 'x', name: 'n', description: 'd', source: 's', slots: [] };
    const html = renderGalleryPage([p, { ...p, id: 'y' }], new Map([['x', [{ id: 't1', name: '<T>' }, { id: 't2', name: 'T2' }]]]));
    expect(html).toContain('<a href="templates/t1.html" data-testid="gp-template-x-t1">&lt;T&gt;</a>, <a href="templates/t2.html"');
    expect(html.match(/Ready-made template:/g)).toHaveLength(1);
  });

  it('escapes backslashes and pipes in table cells', () => {
    const p = { id: 'x', name: 'a\\b | c', description: 'd', source: 's', slots: [] };
    expect(renderGalleryCatalog([p])).toContain('| **a\\\\b \\| c** |');
  });

  it('every pattern names its source', () => {
    expect(EXPR_GALLERY.filter((p) => !p.source).map((p) => p.id)).toEqual([]);
  });
});
