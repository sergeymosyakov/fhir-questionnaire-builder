// ── E2E: documentation portal ────────────────────────────────────────────────
// The standalone docs site (docs.html + docs-site/) renders Markdown pages from
// a manifest with a sidebar, search, and per-page "coming soon" placeholders.
//
// data-testid registry: preview-placeholder-docs-link (Quick tour link in the
//                        empty-preview placeholder)
// Opens docs via ⋯ More → Docs (docs-page-btn).
//   doc-sidebar / doc-content / doc-search   sidebar nav, article, search input
//   doc-nav-section      docs sidebar section heading
//   doc-nav-link         docs sidebar page link
//   doc-placeholder      docs page placeholder/not-found paragraph
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';

test.describe('documentation portal', () => {
  test('loads and renders the first page from Markdown', async ({ page }) => {
    await page.goto('/docs.html');
    await expect(page.getByTestId('doc-nav-section').filter({ hasText: 'Getting Started' })).toBeVisible();
    await expect(page.getByTestId('doc-content').locator('h1')).toHaveText('What is this?');
    // Sidebar marks the active page.
    await expect(page.getByTestId('doc-nav-link').filter({ hasText: 'What is this?' })).toHaveText('What is this?');
  });

  test('sidebar search filters pages by title', async ({ page }) => {
    await page.goto('/docs.html');
    await page.fill('[data-testid="doc-search"]', 'translate');
    const visible = page.getByTestId('doc-sidebar').getByTestId('doc-nav-link').and(page.locator(':visible'));
    await expect(visible).toHaveCount(1);
    await expect(visible).toHaveText('Translate a questionnaire');
  });

  test('an unknown page id shows a not-found placeholder', async ({ page }) => {
    await page.goto('/docs.html#/no-such-page');
    await expect(page.getByTestId('doc-content').locator('h1')).toHaveText('Page not found');
    await expect(page.getByTestId('doc-placeholder')).toBeVisible();
  });

  test('the ⋯ More menu links to the docs portal', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="add-root-group-btn"]');
    await page.getByTestId('more-btn').click();
    const docsItem = page.getByTestId('docs-page-btn');
    await expect(docsItem).toBeVisible();
    await expect(docsItem).toHaveAttribute('href', 'docs.html');
  });

  test('the empty-preview placeholder links to the Quick tour page', async ({ page }) => {
    await page.goto('/');
    const link = page.getByTestId('preview-placeholder-docs-link');
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', 'docs.html#/quick-tour');
  });
});
