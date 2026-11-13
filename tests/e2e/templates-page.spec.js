// ── E2E: static, crawlable templates page (templates.html) ────────────────────
//
// ── data-testid registry ──────────────────────────────────────────────────────
//   tp-open-builder       "Back to Builder" link in the page header
//   tp-card-<id>          one section per template
//   tp-json-<id>          "Download the FHIR Questionnaire JSON" link of a template
//   tp-detail-<id>        card title link to the template's own page
//   doc-content / doc-nav-link   docs article / sidebar link (Templates docs page)
//   add-menu-btn          builder ready marker (after following the header link)
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';

test.describe('templates.html (SEO page)', () => {
  test('is a complete page: title, description, canonical, h1, cards with source and license', async ({ page }) => {
    await page.goto('/templates.html');
    await expect(page).toHaveTitle(/FHIR Questionnaire Templates/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /PHQ-9/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://fhirbuilder.com/templates.html');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const phq = page.getByTestId('tp-card-phq-9');
    await expect(phq).toContainText('Little interest or pleasure in doing things');
    await expect(phq).toContainText('Source:');
    await expect(phq).toContainText('No permission required to reproduce');
    await expect(page.getByTestId('tp-card-audit-c')).toContainText('No restrictions on use');
    await expect(page.getByText('This material contains content from LOINC')).toBeVisible();
  });

  test('each template links to its downloadable FHIR Questionnaire JSON', async ({ page, request }) => {
    await page.goto('/templates.html');
    const href = await page.getByTestId('tp-json-gad-7').getAttribute('href');
    expect(href).toBe('templates/gad-7.template.json');
    const res = await request.get('/' + href);
    expect(res.ok()).toBe(true);
    expect((await res.json()).resourceType).toBe('Questionnaire');
  });

  test('structured data lists the templates with links to their own pages', async ({ page, request }) => {
    await page.goto('/templates.html');
    const graph = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent())['@graph'];
    const list = graph.find((n) => n['@type'] === 'ItemList');
    expect(list.itemListElement.length).toBeGreaterThan(0);
    const url = list.itemListElement[0].url;
    expect(url).toMatch(/^https:\/\/fhirbuilder\.com\/templates\/[\w-]+\.html$/);
    expect((await request.get(new URL(url).pathname)).ok()).toBe(true);
  });

  test('templates are grouped under category headings and each card links to its page', async ({ page }) => {
    await page.goto('/templates.html');
    for (const id of ['cat-scales', 'cat-calculators', 'cat-intake']) await expect(page.locator(`#${id}`)).toHaveCount(1);
    await page.getByTestId('tp-detail-phq-9').click();
    await expect(page).toHaveURL(/\/templates\/phq-9(\.html)?$/);
  });

  test('the header link opens the Builder', async ({ page }) => {
    await page.goto('/templates.html#gad-7');
    await expect(page.getByTestId('tp-card-gad-7')).toBeInViewport();
    await page.getByTestId('tp-open-builder').click();
    await expect(page.getByTestId('add-menu-btn')).toBeVisible({ timeout: 10_000 });
  });

  test('is listed in sitemap.xml', async ({ request }) => {
    expect(await (await request.get('/sitemap.xml')).text()).toContain('https://fhirbuilder.com/templates.html');
  });

  test('the docs Templates page links to it and is in the sidebar', async ({ page }) => {
    await page.goto('/docs.html#/templates');
    await expect(page.getByTestId('doc-content').locator('h1')).toHaveText('Templates');
    await expect(page.getByTestId('doc-content').locator('a[href="https://fhirbuilder.com/templates.html"]').first()).toBeVisible();
    await expect(page.getByTestId('doc-nav-link').filter({ hasText: /^Templates$/ })).toBeVisible();
  });
});
