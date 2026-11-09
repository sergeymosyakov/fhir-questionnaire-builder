// ── E2E: crawlable public pages (guide/<id>.html, docs.html, help.html, widget-demo.html, index.html) ──
// A crawler without script execution must still see content and internal links.
//
// ── data-testid registry ──────────────────────────────────────────────────────
//   guide-sidebar / guide-content / guide-prev / guide-next   static guide page parts
//   guide-docs-link / page-header-current                     header breadcrumb link / current page
//   page-footer                                               site links at the foot of generated pages
//   help-table                                                help.html field table
//   doc-sidebar / doc-content                                 docs viewer sidebar / article
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';

test.describe('static guide pages', () => {
  test('a guide page shows the article, the active sidebar link, table of contents and breadcrumb', async ({ page }) => {
    await page.goto('/guide/templates.html');
    await expect(page).toHaveTitle('Templates — FHIR Questionnaire Builder Docs');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://fhirbuilder.com/guide/templates.html');
    await expect(page.getByTestId('guide-content').locator('h1')).toHaveText('Templates');
    await expect(page.getByTestId('guide-sidebar').locator('a[aria-current="page"]')).toHaveText('Templates');
    await expect(page.locator('.doc-toc-link').first()).toBeAttached();
    await expect(page.getByTestId('page-header-current')).toHaveText('Templates');
    await expect(page.getByTestId('guide-docs-link')).toHaveAttribute('href', '../docs.html');
  });

  test('previous / next links and in-text links stay on static pages', async ({ page }) => {
    await page.goto('/guide/templates.html');
    await expect(page.getByTestId('guide-prev')).toContainText('Calculation gallery');
    await page.getByTestId('guide-next').click();
    await expect(page.getByTestId('guide-content').locator('h1')).toHaveText('Import & round-trip');
    await page.goto('/guide/calculation-gallery.html');
    await page.getByTestId('guide-content').getByRole('link', { name: 'Templates' }).first().click();
    await expect(page.getByTestId('guide-content').locator('h1')).toHaveText('Templates');
  });

  test('external links open safely in a new tab', async ({ page }) => {
    await page.goto('/guide/templates.html');
    const external = page.getByTestId('guide-content').locator('a[href^="https://"]').first();
    await expect(external).toHaveAttribute('target', '_blank');
    await expect(external).toHaveAttribute('rel', 'noopener noreferrer');
  });

  test('the page works on a phone: article first, no horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto('/guide/calculation-gallery.html');
    const article = await page.getByTestId('guide-content').boundingBox();
    const sidebar = await page.getByTestId('guide-sidebar').boundingBox();
    expect(article.y).toBeLessThan(sidebar.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('is listed in sitemap.xml', async ({ request }) => {
    const sitemap = await (await request.get('/sitemap.xml')).text();
    for (const url of ['guide/templates.html', 'guide/what-is-this.html', 'widget-demo.html']) expect(sitemap).toContain(`https://fhirbuilder.com/${url}`);
  });
});

test.describe('without JavaScript (what a crawler reads first)', () => {
  test.use({ javaScriptEnabled: false });

  test('docs.html links to every guide page', async ({ page }) => {
    await page.goto('/docs.html');
    await expect(page.getByTestId('doc-sidebar').locator('a[href="guide/templates.html"]')).toHaveText('Templates');
    expect(await page.getByTestId('doc-sidebar').locator('a').count()).toBeGreaterThan(30);
  });

  test('help.html shows the field reference table', async ({ page }) => {
    await page.goto('/help.html');
    await expect(page.getByTestId('help-table').locator('tbody tr').nth(50)).toBeAttached();
    await expect(page.getByTestId('help-table')).toContainText('Questionnaire.title');
  });

  test('widget-demo.html explains the widget and how to install it', async ({ page }) => {
    await page.goto('/widget-demo.html');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Embed a FHIR Questionnaire in any web page');
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('main')).toContainText('QuestionnaireRenderer');
    await expect(page.locator('body')).toContainText('npm install @sergeymosyakov/questionnaire-widget');
    await expect(page.locator('body')).toContainText('dotnet add package FhirQuestionnaireWidget');
  });

  test('the home page links to the docs, the field reference and the widget demo', async ({ page }) => {
    await page.goto('/');
    for (const href of ['docs.html', 'help.html', 'widget-demo.html', 'templates.html', 'gallery.html']) {
      await expect(page.locator(`noscript main a[href="${href}"], a[href="${href}"]`).first()).toBeAttached();
    }
  });
});

test.describe('widget-demo.html page metadata', () => {
  test('has a title, description, canonical and structured data, and the live demo still renders', async ({ page }) => {
    await page.goto('/widget-demo.html');
    await expect(page).toHaveTitle(/Embed a FHIR Questionnaire in Any Web Page/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /QuestionnaireRenderer widget/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://fhirbuilder.com/widget-demo.html');
    const graph = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent())['@graph'];
    expect(graph.map((n) => n['@type']).sort()).toEqual(['BreadcrumbList', 'SoftwareSourceCode', 'WebPage']);
    await expect(page.locator('[data-mode="patient"] .lform-item').first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('site footer', () => {
  test('hub pages link to the rest of the site', async ({ page }) => {
    await page.goto('/templates.html');
    const footer = page.getByTestId('page-footer');
    for (const name of ['Builder', 'Templates', 'Calculation gallery', 'Documentation', 'FHIR field reference', 'Embeddable widget']) {
      await expect(footer.getByRole('link', { name, exact: true })).toBeVisible();
    }
    await footer.getByRole('link', { name: 'Embeddable widget' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Embed a FHIR Questionnaire in any web page');
  });

  test('nested pages rely on their breadcrumb instead', async ({ page }) => {
    await page.goto('/templates/phq-9.html');
    await expect(page.getByTestId('page-footer')).toHaveCount(0);
    await expect(page.getByTestId('page-header-current')).toBeVisible();
  });

  test('help.html hides the footer when embedded in the help modal', async ({ page }) => {
    await page.goto('/help.html#embedded');
    await expect(page.getByTestId('page-footer')).toBeHidden();
  });
});
