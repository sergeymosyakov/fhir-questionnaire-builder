// ── E2E: rendering-xhtml preview rendering ────────────────────────────────────
//
// Verifies that items with a rendering-xhtml extension display XHTML markup
// in the preview, and that XSS content is sanitized by DOMPurify.
//
// Fixture: tests/fixtures/rendering-xhtml.fhir.json
//   q-bold   — rendering-xhtml: <b>Bold question</b>
//   q-mixed  — rendering-style + rendering-xhtml: <em>Styled</em> & <strong>formatted</strong>
//   q-xss    — rendering-xhtml with <script> tag (should be stripped)
//   q-plain  — no rendering-xhtml (plain text fallback)
//
// Run: npx playwright test tests/e2e/rendering-xhtml.spec.js
//
// ── data-testid registry ─────────────────────────────────────────────────────
//   (none — uses data-preview-id locators and DOM element queries)
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { test, expect } from '@playwright/test';

const FIXTURE = path.resolve('tests/fixtures/rendering-xhtml.fhir.json');

async function loadFixture(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(FIXTURE);
  await expect(page.locator('[data-preview-id="q-bold"]')).toBeVisible({ timeout: 8_000 });
}

test.describe('rendering-xhtml in preview', () => {
  test('renders <b> tag for q-bold', async ({ page }) => {
    await loadFixture(page);
    const boldTag = page.locator('[data-preview-id="q-bold"] b');
    await expect(boldTag).toBeVisible();
    await expect(boldTag).toContainText('Bold question');
  });

  test('renders <em> and <strong> for q-mixed', async ({ page }) => {
    await loadFixture(page);
    await expect(page.locator('[data-preview-id="q-mixed"] em')).toBeVisible();
    await expect(page.locator('[data-preview-id="q-mixed"] strong')).toBeVisible();
  });

  test('DOMPurify strips <script> tag from q-xss', async ({ page }) => {
    await loadFixture(page);
    // Script tag must not appear in DOM
    const scriptTag = page.locator('[data-preview-id="q-xss"] script');
    await expect(scriptTag).toHaveCount(0);
    // Global poisoned by XSS must not be set
    const xssRan = await page.evaluate(() => window.__xss);
    expect(xssRan).toBeUndefined();
    // Safe content still visible
    await expect(page.locator('[data-preview-id="q-xss"] b')).toBeVisible();
  });

  test('plain item renders as text (no extra HTML elements)', async ({ page }) => {
    await loadFixture(page);
    const row = page.locator('[data-preview-id="q-plain"]');
    await expect(row).toContainText('Plain question (no xhtml)');
    // No markup injected
    await expect(row.locator('b, em, strong')).toHaveCount(0);
  });
});

test.describe('rendering-xhtml round-trip via Appearance modal', () => {
  test('xhtml entered in modal is preserved and rendered after apply', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/');
    await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });

    // Build a minimal item
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.locator('[data-node-id="1"]')).toBeVisible();
    await page.locator('[data-node-id="1"]').getByTestId('group-add-btn').click();
    await page.locator('[data-testid="add-menu-item"]').first().click();
    await expect(page.locator('[data-node-id="1.1"]')).toBeVisible();

    // Open Appearance modal
    const appLink = page.locator('[data-node-id="1.1"]').getByTestId('action-appearance');
    await expect(appLink).toBeVisible();
    await appLink.click();
    await expect(page.locator('[data-testid="appearanceModal"]')).toBeVisible();

    // Type XHTML into the xhtml textarea
    await page.getByTestId('appearance-xhtml-input').fill('<strong>Rich text</strong>');
    await page.locator('[data-testid="appearanceModalApply"]').click();
    await expect(page.locator('[data-testid="appearanceModal"]')).not.toBeVisible();

    // Preview should render <strong>
    await expect(page.locator('[data-preview-id="1.1"] strong')).toBeVisible();
    await expect(page.locator('[data-preview-id="1.1"] strong')).toContainText('Rich text');
  });
});
