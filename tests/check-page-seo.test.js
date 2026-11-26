// The Form Check page is a public landing page: searchable metadata, a sitemap entry and crawlable inbound links.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const page = read('questionnaire-check.html');
const URL_ = 'https://fhirbuilder.com/questionnaire-check.html';
const meta = (attr, name) => page.match(new RegExp(`<meta ${attr}="${name}"\\s+content="([^"]*)"`))?.[1];

describe('questionnaire-check.html SEO', () => {
  it('has a title and a description that fit a search result, without counts', () => {
    const title = page.match(/<title>([^<]*)<\/title>/)[1];
    const description = meta('name', 'description');
    expect(title.length).toBeLessThanOrEqual(75);
    expect(title).toMatch(/FHIR Questionnaire/);
    expect(description.length).toBeGreaterThanOrEqual(120);
    expect(description.length).toBeLessThanOrEqual(160);
    expect(description).not.toMatch(/\d/); // public text says "many", never a number
  });

  it('has one canonical URL, Open Graph and Twitter cards that agree with it', () => {
    expect(page).toContain(`<link rel="canonical" href="${URL_}">`);
    expect(meta('property', 'og:url')).toBe(URL_);
    expect(meta('property', 'og:title')).toBeTruthy();
    expect(meta('property', 'og:description')).toBe(meta('name', 'description'));
    expect(meta('property', 'og:image')).toMatch(/^https:\/\/fhirbuilder\.com\//);
    expect(meta('name', 'twitter:card')).toBe('summary_large_image');
  });

  it('may be indexed and has a single h1', () => {
    expect(page).not.toMatch(/name="robots"[^>]*noindex/i);
    expect(read('robots.txt')).not.toMatch(/Disallow:\s*\/(questionnaire-check|\s*$)/m);
    expect(page.match(/<h1[ >]/g)).toHaveLength(1);
  });

  it('describes itself to crawlers: structured data parses and names the page', () => {
    const ld = JSON.parse(page.match(/<script type="application\/ld\+json">\n([\s\S]*?)\n\s*<\/script>/)[1]);
    const types = ld['@graph'].map((n) => n['@type']);
    expect(types).toEqual(['WebPage', 'BreadcrumbList']);
    expect(ld['@graph'][0].url).toBe(URL_);
    expect(ld['@graph'][0].author.map((a) => a.name)).toEqual(['Sergey Mosyakov', 'Huthaifa Khan']);
    expect(meta('name', 'author')).toBe('Sergey Mosyakov, Huthaifa Khan');
  });

  it('has readable text in the HTML itself, not only after scripts run', () => {
    expect(page).toContain('What is Form Check?');
    expect(page).toMatch(/Check a questionnaire/);
    expect(page).toMatch(/Compare with a saved reference/);
  });

  it('is in the sitemap and linked from the shared site footer and the docs', () => {
    expect(read('sitemap.xml')).toContain(`<loc>${URL_}</loc>`);
    for (const file of ['help.html', 'gallery.html', 'templates.html', 'widget-demo.html', 'questionnaire-check.html']) {
      expect(read(file), file).toMatch(/<footer class="page-footer"[\s\S]*href="questionnaire-check\.html">Form Check<\/a>/);
    }
    expect(read('guide/validation.html')).toContain(`href="${URL_}"`);
  });
});
