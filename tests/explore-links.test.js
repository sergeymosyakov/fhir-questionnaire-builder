import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { EXPLORE_LINKS, exploreLinksHtml } from '../js/ui/explore-links.js';

describe('explore links', () => {
  it('point to pages that exist, each with a unique id', () => {
    expect(new Set(EXPLORE_LINKS.map(l => l.id)).size).toBe(EXPLORE_LINKS.length);
    for (const l of EXPLORE_LINKS) expect(existsSync(new URL(`../${l.href}`, import.meta.url)), l.href).toBe(true);
  });
  it('render one testid-tagged anchor per link', () => {
    const html = exploreLinksHtml();
    for (const l of EXPLORE_LINKS) expect(html).toContain(`<a href="${l.href}" data-testid="preview-placeholder-link-${l.id}">${l.label}</a>`);
  });
});
