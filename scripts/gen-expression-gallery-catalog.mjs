// Regenerates docs/EXPRESSION-GALLERY.md and gallery.html from the gallery pattern files.
import { writeFileSync } from 'node:fs';
import { EXPR_GALLERY } from '../js/fhir/expr-builder/gallery/index.js';
import { renderGalleryCatalog } from '../js/fhir/expr-builder/gallery/catalog.js';
import { renderGalleryPage } from '../js/fhir/expr-builder/gallery/page.js';

writeFileSync(new URL('../docs/EXPRESSION-GALLERY.md', import.meta.url), renderGalleryCatalog(EXPR_GALLERY));
writeFileSync(new URL('../gallery.html', import.meta.url), renderGalleryPage(EXPR_GALLERY));
