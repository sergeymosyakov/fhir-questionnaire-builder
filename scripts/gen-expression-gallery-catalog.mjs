// Regenerates docs/EXPRESSION-GALLERY.md from the gallery pattern files.
import { writeFileSync } from 'node:fs';
import { EXPR_GALLERY } from '../js/fhir/expr-builder/gallery/index.js';
import { renderGalleryCatalog } from '../js/fhir/expr-builder/gallery/catalog.js';

writeFileSync(new URL('../docs/EXPRESSION-GALLERY.md', import.meta.url), renderGalleryCatalog(EXPR_GALLERY));
