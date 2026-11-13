// Regenerates docs/EXPRESSION-GALLERY.md and gallery.html (with links to the templates built on each pattern) from the gallery pattern files.
import { readFileSync, writeFileSync } from 'node:fs';
import { EXPR_GALLERY } from '../js/fhir/expr-builder/gallery/index.js';
import { renderGalleryCatalog } from '../js/fhir/expr-builder/gallery/catalog.js';
import { renderGalleryPage } from '../js/fhir/expr-builder/gallery/page.js';
import { templatesByPatternOf } from '../js/fhir/template-view.js';

writeFileSync(new URL('../docs/EXPRESSION-GALLERY.md', import.meta.url), renderGalleryCatalog(EXPR_GALLERY));

// pattern id → templates built on it (templates/library.json), linked from the gallery cards.
const templates = JSON.parse(readFileSync(new URL('../templates/library.json', import.meta.url), 'utf8'));
const templatesByPattern = templatesByPatternOf(templates);
writeFileSync(new URL('../gallery.html', import.meta.url), renderGalleryPage(EXPR_GALLERY, templatesByPattern));
