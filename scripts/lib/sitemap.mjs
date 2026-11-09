// Appends a sitemap entry for every URL that has none; existing entries and their dates stay untouched.
import { readFileSync, writeFileSync } from 'node:fs';

export function ensureSitemapUrls(sitemapUrl, urls, { priority, changefreq = 'monthly', lastmod = new Date().toISOString().slice(0, 10) }) {
  let sitemap = readFileSync(sitemapUrl, 'utf8');
  const eol = sitemap.includes('\r\n') ? '\r\n' : '\n';
  const missing = urls.filter((u) => !sitemap.includes(`<loc>${u}</loc>`));
  if (!missing.length) return;
  const block = (u) => ['  <url>', `    <loc>${u}</loc>`, `    <lastmod>${lastmod}</lastmod>`, `    <changefreq>${changefreq}</changefreq>`, `    <priority>${priority}</priority>`, '  </url>'].join(eol);
  writeFileSync(sitemapUrl, sitemap.replace('</urlset>', `${missing.map(block).join(eol)}${eol}</urlset>`));
}
