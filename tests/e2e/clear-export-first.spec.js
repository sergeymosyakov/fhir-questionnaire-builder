// ── E2E: Clear → "Export first" flow ─────────────────────────────────────────
// Clearing a loaded questionnaire and choosing "Export first" must complete:
// the export dialog is shown, a file is downloaded, then the questionnaire is
// cleared and the builder stays usable. Cancelling the export prompt must not
// hang the flow either.
//
// Fixture: tests/fixtures/short-text.fhir.json
//
// Run: npx playwright test tests/e2e/clear-export-first.spec.js
//
// ── data-testid registry ─────────────────────────────────────────────────────
//   fhir-file-input          hidden file <input> for Open → FHIR JSON
//   clear-form-btn           × clear questionnaire button
//   clearConfirmModal        clear-confirm dialog backdrop
//   clear-confirm-export-btn "Export first" button
//   clear-confirm-cancel-btn "Cancel" button
//   saveFormatModal / saveFormatModalApply   export format dialog / its Export button
//   prompt-save / prompt-cancel   "Save as:" prompt buttons
//   tree-container           wraps all builder nodes
//   add-root-group-btn       "+Add Root Group"
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { test, expect } from '@playwright/test';
import { freshStart } from './helpers/builder.js';

const FIXTURE = path.resolve('tests/fixtures/short-text.fhir.json');

const nodes = page => page.locator('[data-testid="tree-container"] [data-node-id]');

async function loadFixture(page) {
  await freshStart(page);
  await page.getByTestId('fhir-file-input').setInputFiles(FIXTURE);
  await expect(page.locator('[data-preview-id="q-no-short"]')).toBeVisible({ timeout: 8_000 });
}

async function chooseExportFirst(page) {
  await page.getByTestId('clear-form-btn').click();
  await expect(page.getByTestId('clearConfirmModal')).toBeVisible();
  await page.getByTestId('clear-confirm-export-btn').click();
  await expect(page.getByTestId('saveFormatModal')).toBeVisible();
}

async function expectClearedAndUsable(page) {
  await expect(nodes(page)).toHaveCount(0);
  await expect(page.locator('[data-preview-id="q-no-short"]')).toHaveCount(0);
  await page.getByTestId('add-root-group-btn').click();
  await expect(page.locator('[data-node-id="1"]')).toBeVisible();
}

test.describe('Clear → Export first', () => {
  test('exports a file, then clears the questionnaire and the app stays usable', async ({ page }) => {
    await loadFixture(page);
    await expect(nodes(page).first()).toBeVisible();
    await chooseExportFirst(page);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('saveFormatModalApply').click().then(() => page.getByTestId('prompt-save').click()),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.json$/);

    await expectClearedAndUsable(page);
  });

  test('cancelling the Save-as prompt does not hang: the questionnaire is cleared', async ({ page }) => {
    await loadFixture(page);
    await chooseExportFirst(page);

    const downloads = [];
    page.on('download', d => downloads.push(d));
    await page.getByTestId('saveFormatModalApply').click();
    await page.getByTestId('prompt-cancel').click();

    await expectClearedAndUsable(page);
    expect(downloads).toHaveLength(0);
  });

  test('Cancel in the clear dialog keeps the questionnaire', async ({ page }) => {
    await loadFixture(page);
    await page.getByTestId('clear-form-btn').click();
    await expect(page.getByTestId('clearConfirmModal')).toBeVisible();
    await page.getByTestId('clear-confirm-cancel-btn').click();
    await expect(page.getByTestId('clearConfirmModal')).not.toBeVisible();
    await expect(page.locator('[data-preview-id="q-no-short"]')).toBeVisible();
    await expect(nodes(page).first()).toBeVisible();
  });
});
