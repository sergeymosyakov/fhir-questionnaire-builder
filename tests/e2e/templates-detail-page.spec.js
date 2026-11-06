// ── E2E: one crawlable page per template (templates/<id>.html) ───────────────
//
// ── data-testid registry ──────────────────────────────────────────────────────
//   tpd-title / tpd-questions / tpd-results   h1 / question list / calculated results
//   tpd-source / tpd-license / tpd-json       source and license lines / JSON download link
//   tpd-related-<id> / tpd-all                links to other templates / header breadcrumb link to the list
//   page-header-current                       current template name in the header breadcrumb
//   tpd-open-builder                          "Back to Builder" link in the header
//   add-menu-btn                              builder ready marker (after following the header link)
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';

test.describe('templates/<id>.html (SEO pages)', () => {
  test('a scale page shows its questions with answers, source, license and a working JSON link', async ({ page, request }) => {
    await page.goto('/templates/phq-9.html');
    await expect(page).toHaveTitle(/PHQ-9 Depression Screening FHIR Questionnaire Template/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://fhirbuilder.com/templates/phq-9.html');
    await expect(page.getByTestId('tpd-title')).toContainText('PHQ-9');
    await expect(page.getByTestId('tpd-all')).toHaveText('Questionnaire templates');
    await expect(page.getByTestId('page-header-current')).toHaveText('PHQ-9 Depression Screening');
    await expect(page.getByTestId('tpd-questions')).toContainText('Little interest or pleasure in doing things');
    await expect(page.getByTestId('tpd-questions')).toContainText('Nearly every day');
    await expect(page.getByTestId('tpd-results')).toContainText('PHQ-9 total score');
    await expect(page.getByTestId('tpd-source')).toContainText('Kroenke');
    await expect(page.getByTestId('tpd-license')).toContainText('No permission required to reproduce');
    const href = await page.getByTestId('tpd-json').getAttribute('href');
    const res = await request.get(new URL(href, page.url()).pathname);
    expect(res.ok()).toBe(true);
    expect((await res.json()).resourceType).toBe('Questionnaire');
  });

  test('structured data has a breadcrumb ending at the template', async ({ page }) => {
    await page.goto('/templates/gad-7.html');
    const graph = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent())['@graph'];
    const crumbs = graph.find((n) => n['@type'] === 'BreadcrumbList').itemListElement;
    expect(crumbs.map((c) => c.position)).toEqual([1, 2, 3]);
    expect(crumbs[2].item).toBe('https://fhirbuilder.com/templates/gad-7.html');
  });

  test('links to other templates of the same kind and back to the list', async ({ page }) => {
    await page.goto('/templates/phq-9.html');
    await expect(page.getByTestId('tpd-related-gad-7')).toBeVisible();
    await expect(page.getByTestId('tpd-related-phq-9')).toHaveCount(0);
    await page.getByTestId('tpd-related-gad-7').click();
    await expect(page).toHaveURL(/\/templates\/gad-7(\.html)?$/);
    await page.getByTestId('tpd-all').click();
    await expect(page).toHaveURL(/\/templates(\.html)?$/);
    await expect(page.getByTestId('tp-card-phq-9')).toBeVisible();
  });

  test('the header link opens the Builder', async ({ page }) => {
    await page.goto('/templates/kidney-function.html');
    await page.getByTestId('tpd-open-builder').click();
    await expect(page.getByTestId('add-menu-btn')).toBeVisible({ timeout: 10_000 });
  });

  test('is listed in sitemap.xml', async ({ request }) => {
    expect(await (await request.get('/sitemap.xml')).text()).toContain('https://fhirbuilder.com/templates/kidney-function.html');
  });
});
