import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { EXPR_GALLERY } from '../js/fhir/expr-builder/gallery/index.js';
import { renderGalleryCatalog } from '../js/fhir/expr-builder/gallery/catalog.js';

describe('docs/EXPRESSION-GALLERY.md', () => {
  it('is up to date with the gallery patterns (run `npm run docs:gallery`)', () => {
    const file = readFileSync(new URL('../docs/EXPRESSION-GALLERY.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    expect(file).toBe(renderGalleryCatalog(EXPR_GALLERY));
  });

  it('every pattern names its source', () => {
    expect(EXPR_GALLERY.filter((p) => !p.source).map((p) => p.id)).toEqual([]);
  });
});
