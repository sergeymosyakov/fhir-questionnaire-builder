// ── E2E: Help Modal (FHIR Field Reference) ───────────────────────────────────
// Tests for the ? help button and the help modal that embeds help.html
// in an iframe.
//
// Run: npx playwright test tests/e2e/help-modal.spec.js
//
// ── data-testid registry ──────────────────────────────────────────────────────
//   help-btn        ? button in the left panel header toolbar
//   helpModal       help modal backdrop
//   helpModalClose  × close button
//   helpModalCancel Close button in footer
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';

async function freshPage(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
}

// ── Open / close ──────────────────────────────────────────────────────────────

test.describe('help modal — open / close', () => {
  test('? button is accessible via \u22ef More menu', async ({ page }) => {
    await freshPage(page);
    await page.getByTestId('more-btn').click();
    await expect(page.getByTestId('help-btn')).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('clicking ? button opens the help modal', async ({ page }) => {
    await freshPage(page);
    await page.getByTestId('more-btn').click();
    await page.getByTestId('help-btn').click();
    await expect(page.locator('[data-testid="helpModal"]')).toBeVisible();
  });

  test('× button closes the help modal', async ({ page }) => {
    await freshPage(page);
    await page.getByTestId('more-btn').click();
    await page.getByTestId('help-btn').click();
    await expect(page.locator('[data-testid="helpModal"]')).toBeVisible();
    await page.getByTestId('helpModalClose').click();
    await expect(page.locator('[data-testid="helpModal"]')).not.toBeVisible();
  });

  test('Close button closes the help modal', async ({ page }) => {
    await freshPage(page);
    await page.getByTestId('more-btn').click();
    await page.getByTestId('help-btn').click();
    await expect(page.locator('[data-testid="helpModal"]')).toBeVisible();
    await page.getByTestId('helpModalCancel').click();
    await expect(page.locator('[data-testid="helpModal"]')).not.toBeVisible();
  });

  test('Escape key closes the help modal', async ({ page }) => {
    await freshPage(page);
    await page.getByTestId('more-btn').click();
    await page.getByTestId('help-btn').click();
    await expect(page.locator('[data-testid="helpModal"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="helpModal"]')).not.toBeVisible();
  });

  test('clicking backdrop closes the help modal', async ({ page }) => {
    await freshPage(page);
    await page.getByTestId('more-btn').click();
    await page.getByTestId('help-btn').click();
    await expect(page.locator('[data-testid="helpModal"]')).toBeVisible();
    await page.locator('[data-testid="helpModal"]').click({ position: { x: 5, y: 5 } });
    await expect(page.locator('[data-testid="helpModal"]')).not.toBeVisible();
  });
});

// ── iframe content ────────────────────────────────────────────────────────────

test.describe('help modal — iframe content', () => {
  test('iframe with help.html is present inside the modal', async ({ page }) => {
    await freshPage(page);
    await page.getByTestId('more-btn').click();
    await page.getByTestId('help-btn').click();
    await expect(page.locator('[data-testid="helpModalBody"] iframe.help-iframe')).toBeVisible();
  });

  test('iframe loads the help page (title visible inside frame)', async ({ page }) => {
    await freshPage(page);
    await page.getByTestId('more-btn').click();
    await page.getByTestId('help-btn').click();
    const frame = page.frameLocator('[data-testid="helpModalBody"] iframe.help-iframe');
    await expect(frame.locator('h1')).toBeVisible({ timeout: 8_000 });
    await expect(frame.locator('h1')).toContainText('FHIR Field Reference');
  });

  test('help page search input is functional', async ({ page }) => {
    await freshPage(page);
    await page.getByTestId('more-btn').click();
    await page.getByTestId('help-btn').click();
    const frame = page.frameLocator('[data-testid="helpModalBody"] iframe.help-iframe');
    await frame.locator('#helpSearch').fill('linkId');
    await expect(frame.locator('#helpTable tbody tr:not(.help-cat-sep)')).toHaveCount(1);
  });

  test('help page table has rows for known fields', async ({ page }) => {
    await freshPage(page);
    await page.getByTestId('more-btn').click();
    await page.getByTestId('help-btn').click();
    const frame = page.frameLocator('[data-testid="helpModalBody"] iframe.help-iframe');
    await expect(frame.locator('#helpTable tbody')).toBeVisible({ timeout: 8_000 });
    const rows = frame.locator('#helpTable tbody tr:not(.help-cat-sep)');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(30);
  });

  test('"Back to Builder" link is hidden when embedded in the modal', async ({ page }) => {
    await freshPage(page);
    await page.getByTestId('more-btn').click();
    await page.getByTestId('help-btn').click();
    const frame = page.frameLocator('[data-testid="helpModalBody"] iframe.help-iframe');
    // Wait for the embedded page to render, then confirm the back link is hidden.
    await expect(frame.locator('h1')).toBeVisible({ timeout: 8_000 });
    await expect(frame.locator('[data-back-link]')).toBeHidden();
  });

  test('"Back to Builder" link is shown when help.html is opened standalone', async ({ page }) => {
    await page.goto('/help.html');
    await expect(page.locator('[data-back-link]')).toBeVisible();
    await expect(page.locator('[data-back-link]')).toHaveAttribute('href', 'index.html');
  });
});
