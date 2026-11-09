// Regenerates guide/<id>.html (crawlable twins of the docs-viewer pages), the static sidebar links in docs.html and the static rows of help.html, the shared site footer of help.html and widget-demo.html; adds missing sitemap entries.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { renderDocMarkdown, renderGuidePage, renderNavHtml } from '../js/fhir/docs-pages.js';
import { siteFooter } from '../js/fhir/static-page.js';
import { withStaticRows } from '../js/fhir/help-rows.js';
import { ensureSitemapUrls } from './lib/sitemap.mjs';

const path = (name) => new URL(`../${name}`, import.meta.url);
const fullManifest = JSON.parse(readFileSync(path('docs-site/manifest.json'), 'utf8'));
// Pages whose Markdown is not written yet (the viewer shows "being written") get no static page and no link.
const manifest = { ...fullManifest, sections: fullManifest.sections.map((s) => ({ ...s, pages: s.pages.filter((p) => existsSync(path(`docs-site/pages/${p.file}`))) })).filter((s) => s.pages.length) };
const pages = manifest.sections.flatMap((s) => s.pages);
const fileToId = new Map(pages.map((p) => [p.file, p.id]));

mkdirSync(path('guide/'), { recursive: true });
for (const page of pages) {
  writeFileSync(path(`guide/${page.id}.html`), renderGuidePage(manifest, page, renderDocMarkdown(readFileSync(path(`docs-site/pages/${page.file}`), 'utf8'), fileToId)));
}

// docs.html: crawlable sidebar links that the viewer replaces once its script runs.
const docs = readFileSync(path('docs.html'), 'utf8');
const nav = renderNavHtml(manifest, { hrefOf: (p) => `guide/${p.id}.html` });
writeFileSync(path('docs.html'), docs.replace(/(<nav id="docSidebar"[^>]*>)[\s\S]*?(<\/nav>)/, `$1\n${nav}\n    $2`));

// Hand-authored pages (help.html, widget-demo.html) get the shared site footer between markers.
const FOOTER_RE = /<!-- gen:site-footer -->[\s\S]*?<!-- \/gen:site-footer -->/;
const withFooter = (html) => html.replace(FOOTER_RE, `<!-- gen:site-footer -->\n${siteFooter()}\n<!-- /gen:site-footer -->`);
writeFileSync(path('widget-demo.html'), withFooter(readFileSync(path('widget-demo.html'), 'utf8')));

// help.html: the field reference rows, pre-rendered (the page script re-renders them for search).
writeFileSync(path('help.html'), withFooter(withStaticRows(readFileSync(path('help.html'), 'utf8'))));

ensureSitemapUrls(path('sitemap.xml'), pages.map((p) => `https://fhirbuilder.com/guide/${p.id}.html`), { priority: '0.7' });
ensureSitemapUrls(path('sitemap.xml'), ['https://fhirbuilder.com/widget-demo.html'], { priority: '0.7' });
