// ── E2E (IH-5563): repeating select must not allow the same code twice ────────
// A code picked in one repeat row is removed from the OTHER rows' dropdowns;
// removing/changing a row frees the code again (derived-on-render).
//
// Fixture: tests/fixtures/repeat-select-dedup.fhir.json (q-sel: repeats choice A/B/C)
//
// Run: npx playwright test tests/e2e/repeat-select-dedup.spec.js
//
// ── data-testid registry ─────────────────────────────────────────────────────
//   add-root-group-btn   toolbar button (confirms app loaded)
//   fhir-file-input      hidden file input for loading a questionnaire
//   repeat-add-btn       "Add another" button
//   repeat-remove-btn    "×" remove-row button
// Preview control classes (sanctioned exception): .repeat-row, .sc-trigger, .oc-drop, .oc-opt
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { test, expect } from '@playwright/test';

const FIXTURE = path.resolve('tests/fixtures/repeat-select-dedup.fhir.json');

async function loadFixture(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(FIXTURE);
  await expect(page.locator('[data-node-id="q-sel"]')).toBeVisible({ timeout: 8_000 });
}

const row = (page, i) => page.locator('[data-preview-id="q-sel"] .repeat-row').nth(i);

async function openRow(page, i) {
  await row(page, i).locator('.sc-trigger').click();
  await expect(page.locator('.oc-drop')).toBeVisible();
}

async function pick(page, code) {
  await page.locator(`.oc-drop .oc-opt[data-code="${code}"]`).click();
}

test.describe('repeating select — no duplicate code across rows', () => {
  test('picked code leaves sibling dropdowns and returns after row removal', async ({ page }) => {
    await loadFixture(page);

    // Row 0 → pick A.
    await openRow(page, 0);
    await pick(page, 'A');
    await expect(row(page, 0).locator('.sc-trigger-text')).toHaveText('Alpha');

    // Add row 1 → its dropdown must not offer A anymore.
    await page.locator('[data-preview-id="q-sel"] [data-testid="repeat-add-btn"]').click();
    await expect(page.locator('[data-preview-id="q-sel"] .repeat-row')).toHaveCount(2);
    await openRow(page, 1);
    await expect(page.locator('.oc-drop .oc-opt[data-code="A"]')).toHaveCount(0);
    await expect(page.locator('.oc-drop .oc-opt[data-code="B"]')).toHaveCount(1);
    await pick(page, 'B');
    await expect(row(page, 1).locator('.sc-trigger-text')).toHaveText('Beta');

    // Remove the row holding A → A frees up → remaining row offers A again.
    await row(page, 0).locator('[data-testid="repeat-remove-btn"]').click();
    await expect(page.locator('[data-preview-id="q-sel"] .repeat-row')).toHaveCount(1);
    await openRow(page, 0);
    await expect(page.locator('.oc-drop .oc-opt[data-code="A"]')).toHaveCount(1);
  });
});
