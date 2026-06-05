// ── E2E: rendering-markdown preview rendering ─────────────────────────────────
//
// Verifies that items with a rendering-markdown extension display parsed HTML
// in the preview (via marked.js + DOMPurify), that XSS content is sanitized,
// that rendering-xhtml takes priority when both are present, and that the
// Appearance modal textarea round-trips the value correctly.
//
// Fixture: tests/fixtures/rendering-markdown.fhir.json
//   q-bold       — rendering-markdown: **Bold question** → <strong>
//   q-italic     — rendering-markdown: _Italic question_ → <em>
//   q-xss        — rendering-markdown with <script> tag (should be stripped)
//   q-xhtml-wins — both rendering-xhtml and rendering-markdown (xhtml wins)
//   q-plain      — no rendering-markdown (plain text fallback)
//
// Run: npx playwright test tests/e2e/rendering-markdown.spec.js
//
// ── data-testid registry ──────────────────────────────────────────────────────
//   add-root-group-btn         "+Add Root Group"
//   group-add-btn              "+" button on a group
//   add-menu-item              "Item" option in add-child menu
//   action-appearance          "Appearance" action link on an item node
//   appearanceModal            modal backdrop
//   appearanceModalApply       Apply button
//   appearance-markdown-input  Markdown textarea inside the modal
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { test, expect } from '@playwright/test';

const FIXTURE = path.resolve('tests/fixtures/rendering-markdown.fhir.json');

async function loadFixture(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(FIXTURE);
  await expect(page.locator('[data-preview-id="q-bold"]')).toBeVisible({ timeout: 8_000 });
}

// ── Preview rendering from fixture ───────────────────────────────────────────

test.describe('rendering-markdown in preview', () => {
  test('renders <strong> for **bold** markdown', async ({ page }) => {
    await loadFixture(page);
    const strong = page.locator('[data-preview-id="q-bold"] strong');
    await expect(strong).toBeVisible();
    await expect(strong).toContainText('Bold question');
  });

  test('renders <em> for _italic_ markdown', async ({ page }) => {
    await loadFixture(page);
    const em = page.locator('[data-preview-id="q-italic"] em');
    await expect(em).toBeVisible();
    await expect(em).toContainText('Italic question');
  });

  test('DOMPurify strips <script> tag from markdown XSS payload', async ({ page }) => {
    await loadFixture(page);
    await expect(page.locator('[data-preview-id="q-xss"] script')).toHaveCount(0);
    const xssRan = await page.evaluate(() => window.__mdxss);
    expect(xssRan).toBeUndefined();
    // Safe bold content still renders
    await expect(page.locator('[data-preview-id="q-xss"] strong')).toBeVisible();
  });

  test('rendering-xhtml takes priority over rendering-markdown when both present', async ({ page }) => {
    await loadFixture(page);
    // xhtml <b> must be present
    await expect(page.locator('[data-preview-id="q-xhtml-wins"] b')).toBeVisible();
    await expect(page.locator('[data-preview-id="q-xhtml-wins"] b')).toContainText('XHTML wins');
    // markdown text must NOT appear
    await expect(page.locator('[data-preview-id="q-xhtml-wins"]')).not.toContainText('Markdown loses');
  });

  test('plain item renders as text when no markdown extension present', async ({ page }) => {
    await loadFixture(page);
    await expect(page.locator('[data-preview-id="q-plain"]')).toContainText('Plain question (no markdown)');
    await expect(page.locator('[data-preview-id="q-plain"] strong, [data-preview-id="q-plain"] em')).toHaveCount(0);
  });
});

// ── Appearance modal round-trip ───────────────────────────────────────────────

test.describe('rendering-markdown round-trip via Appearance modal', () => {
  test('markdown entered in modal is rendered in preview after apply', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/');
    await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });

    await page.getByTestId('add-root-group-btn').click();
    await expect(page.locator('[data-node-id="1"]')).toBeVisible();
    await page.locator('[data-node-id="1"]').getByTestId('group-add-btn').click();
    await page.locator('[data-testid="add-menu-item"]').first().click();
    await expect(page.locator('[data-node-id="1.1"]').getByTestId('action-type')).toBeVisible();

    // Open Appearance modal
    const appLink = page.locator('[data-node-id="1.1"]').getByTestId('action-appearance');
    await expect(appLink).toBeVisible();
    await appLink.click();
    await expect(page.locator('[data-testid="appearanceModal"]')).toBeVisible();

    // Fill markdown textarea
    await page.getByTestId('appearance-markdown-input').fill('**Markdown title**');
    await page.locator('[data-testid="appearanceModalApply"]').click();
    await expect(page.locator('[data-testid="appearanceModal"]')).not.toBeVisible();

    // Preview must render <strong>
    await expect(page.locator('[data-preview-id="1.1"] strong')).toBeVisible();
    await expect(page.locator('[data-preview-id="1.1"] strong')).toContainText('Markdown title');
  });

  test('fixture markdown value is pre-filled in the modal textarea', async ({ page }) => {
    await loadFixture(page);

    await page.locator('[data-node-id]').filter({ hasText: 'q-bold' }).first();
    // Find the item row by preview id and navigate to builder node
    await page.locator('[data-preview-id="q-bold"]').click();
    await expect(page.locator('[data-node-id]').filter({ has: page.locator('[data-testid="action-appearance"]') }).first()).toBeVisible();

    const itemRow = page.locator('[data-node-id]').filter({ has: page.locator('[data-testid="action-appearance"]') }).first();
    await itemRow.getByTestId('action-appearance').click();
    await expect(page.locator('[data-testid="appearanceModal"]')).toBeVisible();

    const mdInput = page.getByTestId('appearance-markdown-input');
    await expect(mdInput).toHaveValue('**Bold question**');
    await page.locator('[data-testid="appearanceModalCancel"]').click();
  });

  test('clearing markdown textarea removes rendered markup from preview', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/');
    await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });

    await page.getByTestId('add-root-group-btn').click();
    await page.locator('[data-node-id="1"]').getByTestId('group-add-btn').click();
    await page.locator('[data-testid="add-menu-item"]').first().click();
    await expect(page.locator('[data-node-id="1.1"]')).toBeVisible();

    // Set markdown
    const appLink = page.locator('[data-node-id="1.1"]').getByTestId('action-appearance');
    await expect(appLink).toBeVisible();
    await appLink.click();
    await page.getByTestId('appearance-markdown-input').fill('**Will be removed**');
    await page.locator('[data-testid="appearanceModalApply"]').click();
    await expect(page.locator('[data-preview-id="1.1"] strong')).toBeVisible();

    // Clear markdown
    const appLink2 = page.locator('[data-node-id="1.1"]').getByTestId('action-appearance');
    await expect(appLink2).toBeVisible();
    await appLink2.click();
    await page.getByTestId('appearance-markdown-input').fill('');
    await page.locator('[data-testid="appearanceModalApply"]').click();
    await expect(page.locator('[data-preview-id="1.1"] strong')).toHaveCount(0);
  });
});
