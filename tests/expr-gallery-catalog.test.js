import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { EXPR_GALLERY } from '../js/fhir/expr-builder/gallery/index.js';
import { renderGalleryCatalog } from '../js/fhir/expr-builder/gallery/catalog.js';
import { renderGalleryPage } from '../js/fhir/expr-builder/gallery/page.js';

describe('docs/EXPRESSION-GALLERY.md', () => {
  it('is up to date with the gallery patterns (run `npm run docs:gallery`)', () => {
    const file = readFileSync(new URL('../docs/EXPRESSION-GALLERY.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    expect(file).toBe(renderGalleryCatalog(EXPR_GALLERY));
  });

  it('gallery.html is up to date with the gallery patterns (run `npm run docs:gallery`)', () => {
    const file = readFileSync(new URL('../gallery.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    expect(file).toBe(renderGalleryPage(EXPR_GALLERY));
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

  it('escapes backslashes and pipes in table cells', () => {
    const p = { id: 'x', name: 'a\\b | c', description: 'd', source: 's', slots: [] };
    expect(renderGalleryCatalog([p])).toContain('| **a\\\\b \\| c** |');
  });

  it('every pattern names its source', () => {
    expect(EXPR_GALLERY.filter((p) => !p.source).map((p) => p.id)).toEqual([]);
  });
});
