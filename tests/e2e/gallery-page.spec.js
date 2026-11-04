// ── E2E: static, crawlable calculation gallery page (gallery.html) ──────────────
//
// Run: npx playwright test tests/e2e/gallery-page.spec.js
//
// ── data-testid registry ──────────────────────────────────────────────────────
//   gp-open-builder       "Open the Builder" link in the page header
//   gp-card-<id>          one section per gallery pattern
//   add-root-group-btn    builder ready marker (after following the link)
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';

test.describe('gallery.html (SEO page)', () => {
  test('is a complete page: title, description, canonical, h1, pattern cards with sources', async ({ page }) => {
    await page.goto('/gallery.html');
    await expect(page).toHaveTitle(/FHIRPath Calculation Gallery/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /FHIRPath calculatedExpression/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://fhirbuilder.com/gallery.html');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const bmi = page.getByTestId('gp-card-bmi');
    await expect(bmi).toBeVisible();
    await expect(bmi).toContainText('Source:');
    await expect(page.getByTestId('gp-card-egfr-ckd-epi-2021')).toContainText('Answer code for Female');
  });

  test('structured data parses and lists the calculations with anchors that exist on the page', async ({ page }) => {
    await page.goto('/gallery.html');
    const raw = await page.locator('script[type="application/ld+json"]').textContent();
    const graph = JSON.parse(raw)['@graph'];
    const list = graph.find((n) => n['@type'] === 'ItemList');
    expect(list.itemListElement.length).toBeGreaterThan(0);
    const anchor = list.itemListElement[0].url.split('#')[1];
    await expect(page.locator(`#${anchor}`)).toHaveCount(1);
  });

  test('a pattern link jumps to its card and the header link opens the Builder', async ({ page }) => {
    await page.goto('/gallery.html#glasgow-coma-scale');
    await expect(page.getByTestId('gp-card-glasgow-coma-scale')).toBeInViewport();
    await page.getByTestId('gp-open-builder').click();
    await expect(page.getByTestId('add-root-group-btn')).toBeVisible({ timeout: 10_000 });
  });

  test('is listed in sitemap.xml and the home page points to it', async ({ page, request }) => {
    const sitemap = await request.get('/sitemap.xml');
    expect(await sitemap.text()).toContain('https://fhirbuilder.com/gallery.html');
    const home = await request.get('/index.html');
    expect(await home.text()).toContain('href="gallery.html"');
  });
});
