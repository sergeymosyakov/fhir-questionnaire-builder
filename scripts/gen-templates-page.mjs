// Regenerates templates.html and templates/<id>.html from templates/library.json and the template files; adds missing sitemap entries.
import { readFileSync, writeFileSync } from 'node:fs';
import { templateGroupFrom } from '../js/fhir/templates.js';
import { renderTemplatesPage } from '../js/fhir/templates-page.js';
import { renderTemplatePage } from '../js/fhir/template-page.js';

const path = (name) => new URL(`../${name}`, import.meta.url);
const read = (name) => JSON.parse(readFileSync(path(`templates/${name}`), 'utf8'));
const entries = read('library.json');
const groups = new Map(entries.map((e) => [e.id, templateGroupFrom(read(e.file))]));

writeFileSync(path('templates.html'), renderTemplatesPage(entries, groups));
for (const e of entries) {
  const related = entries.filter((o) => o.id !== e.id && o.category === e.category);
  writeFileSync(path(`templates/${e.id}.html`), renderTemplatePage(e, groups.get(e.id), related));
}

// Append a sitemap entry for every template page that has none (existing entries and their dates stay untouched).
let sitemap = readFileSync(path('sitemap.xml'), 'utf8');
const eol = sitemap.includes('\r\n') ? '\r\n' : '\n';
const today = new Date().toISOString().slice(0, 10);
const block = (id) => ['  <url>', `    <loc>https://fhirbuilder.com/templates/${id}.html</loc>`, `    <lastmod>${today}</lastmod>`, '    <changefreq>monthly</changefreq>', '    <priority>0.6</priority>', '  </url>'].join(eol);
const missing = entries.filter((e) => !sitemap.includes(`/templates/${e.id}.html<`));
if (missing.length) {
  sitemap = sitemap.replace(`</urlset>`, `${missing.map((e) => block(e.id)).join(eol)}${eol}</urlset>`);
  writeFileSync(path('sitemap.xml'), sitemap);
}
