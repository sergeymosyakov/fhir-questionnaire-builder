// Regenerates templates.html and templates/<id>.html from templates/library.json and the template files.
import { readFileSync, writeFileSync } from 'node:fs';
import { templateGroupFrom } from '../js/fhir/templates.js';
import { renderTemplatesPage } from '../js/fhir/templates-page.js';
import { renderTemplatePage } from '../js/fhir/template-page.js';
import { ensureSitemapUrls } from './lib/sitemap.mjs';

const path = (name) => new URL(`../${name}`, import.meta.url);
const read = (name) => JSON.parse(readFileSync(path(`templates/${name}`), 'utf8'));
const entries = read('library.json');
const groups = new Map(entries.map((e) => [e.id, templateGroupFrom(read(e.file))]));

writeFileSync(path('templates.html'), renderTemplatesPage(entries, groups));
for (const e of entries) {
  const related = entries.filter((o) => o.id !== e.id && o.category === e.category);
  writeFileSync(path(`templates/${e.id}.html`), renderTemplatePage(e, groups.get(e.id), related));
}

ensureSitemapUrls(path('sitemap.xml'), entries.map((e) => `https://fhirbuilder.com/templates/${e.id}.html`), { priority: '0.6' });
