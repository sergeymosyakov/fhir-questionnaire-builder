// ── E2E: documentation portal ────────────────────────────────────────────────
// The standalone docs site (docs.html + docs-site/) renders Markdown pages from
// a manifest with a sidebar, search, and per-page "coming soon" placeholders.
//
// data-testid registry: (none — the docs portal is a separate static page)
// Selectors used: #docSidebar, .doc-nav-link, #docContent, #docSearch,
//                 .doc-placeholder, .top-panel-docs-link (app header)
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';

test.describe('documentation portal', () => {
  test('loads and renders the first page from Markdown', async ({ page }) => {
    await page.goto('/docs.html');
    await expect(page.locator('.doc-nav-section', { hasText: 'Getting Started' })).toBeVisible();
    await expect(page.locator('#docContent h1')).toHaveText('What is this?');
    // Sidebar marks the active page.
    await expect(page.locator('.doc-nav-link--active')).toHaveText('What is this?');
  });

  test('sidebar search filters pages by title', async ({ page }) => {
    await page.goto('/docs.html');
    await page.fill('#docSearch', 'translate');
    const visible = page.locator('#docSidebar li:not(.doc-hidden) .doc-nav-link');
    await expect(visible).toHaveCount(1);
    await expect(visible).toHaveText('Translate a questionnaire');
  });

  test('an unwritten page shows a placeholder', async ({ page }) => {
    await page.goto('/docs.html#/who-its-for');
    await expect(page.locator('#docContent h1')).toHaveText("Who it's for");
    await expect(page.locator('.doc-placeholder')).toBeVisible();
  });

  test('the app header links to the docs portal', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.top-panel-docs-link')).toHaveAttribute('href', 'docs.html');
  });
});
