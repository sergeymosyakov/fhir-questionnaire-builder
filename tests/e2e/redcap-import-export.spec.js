// ── E2E: REDCap import & export ───────────────────────────────────────────────
// Tests for REDCap CSV import (via Load from file → format picker modal) and
// REDCap CSV export (via Save menu → REDCap CSV item).
//
// Run: npx playwright test tests/e2e/redcap-import-export.spec.js
//
// ── data-testid registry ─────────────────────────────────────────────────────
//   load-fhir-btn          "Questionnaires ▾" dropdown trigger
//   load-from-file-item    "From file…" menu item
//   loadFormatModal        format picker modal backdrop
//   loadFormatModalApply   "Choose file…" button
//   loadFormatModalCancel  Cancel button
//   load-format-select     custom select trigger inside load modal
//   fhir-file-input        hidden <input type=file> for JSON files
//   redcap-csv-input       hidden <input type=file> for CSV files
//   export-btn             "⬇ Save ▾" dropdown trigger
//   export-quest-item      "Questionnaire…" menu item (opens save format modal)
//   saveFormatModal        save format picker modal backdrop
//   saveFormatModalApply   "Export" button
//   saveFormatModalCancel  Cancel button
//   save-format-select     custom select inside save modal
//   validateModal          backdrop <div> (display:flex when open)
//   validateModalTitle     <span> in validate modal header
//   validateModalBody      scrollable body
//   validateModalClose     × close button
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_CSV  = path.resolve(__dirname, '../../sampledata/redcap-clinical-demo.csv');
const SAMPLE_FHIR = path.resolve(__dirname, '../../sampledata/redcap-clinical-demo.fhir.json');

// ── Helpers ───────────────────────────────────────────────────────────────────

async function waitForLoad(page) {
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
}

async function freshStart(page) {
  await page.goto('/');
  await waitForLoad(page);
}

/** Open "From file…" → select REDCap format in modal → choose file. */
async function loadREDCapCSV(page, filePath) {
  await page.getByTestId('load-fhir-btn').click();
  await expect(page.getByTestId('load-from-file-item')).toBeVisible();
  await page.getByTestId('load-from-file-item').click();

  // If existing questionnaire is loaded, confirm dialog appears first
  const confirmModal = page.getByTestId('loadConfirmModal');
  await confirmModal.waitFor({ state: 'visible', timeout: 2_000 }).catch(() => {});
  if (await confirmModal.isVisible()) {
    await page.getByTestId('load-confirm-proceed-btn').click();
  }

  // Format picker modal should open
  await expect(page.getByTestId('loadFormatModal')).toBeVisible();

  // Select REDCap CSV format
  await page.getByTestId('load-format-select').click();
  await page.locator('[data-testid="csel-drop"] [data-val="redcap"]').click();

  // Click "Choose file…" and supply the CSV file
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByTestId('loadFormatModalApply').click(),
  ]);
  await fileChooser.setFiles(filePath);
}

/** Open "From file…" → keep FHIR JSON format (default) → choose file. */
async function loadFHIRJSON(page, filePath) {
  await page.getByTestId('load-fhir-btn').click();
  await expect(page.getByTestId('load-from-file-item')).toBeVisible();
  await page.getByTestId('load-from-file-item').click();

  // If existing questionnaire is loaded, confirm dialog appears first
  const confirmModal2 = page.getByTestId('loadConfirmModal');
  await confirmModal2.waitFor({ state: 'visible', timeout: 2_000 }).catch(() => {});
  if (await confirmModal2.isVisible()) {
    await page.getByTestId('load-confirm-proceed-btn').click();
  }

  await expect(page.getByTestId('loadFormatModal')).toBeVisible();

  // Ensure FHIR JSON is selected (it's the default)
  await page.getByTestId('load-format-select').click();
  await page.locator('[data-testid="csel-drop"] [data-val="fhir"]').click();

  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByTestId('loadFormatModalApply').click(),
  ]);
  await fileChooser.setFiles(filePath);
}

const validateModal      = (page) => page.locator('[data-testid="validateModal"]');
const validateModalTitle = (page) => page.locator('[data-testid="validateModalTitle"]');
const validateModalBody  = (page) => page.locator('[data-testid="validateModalBody"]');
const validateModalClose = (page) => page.locator('[data-testid="validateModalClose"]');

// ── Tests: REDCap Import ──────────────────────────────────────────────────────

test.describe('REDCap CSV import', () => {
  test('format picker modal opens on "From file…" click', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('load-fhir-btn').click();
    await page.getByTestId('load-from-file-item').click();
    await expect(page.getByTestId('loadFormatModal')).toBeVisible();
    await expect(page.getByTestId('load-format-select')).toBeVisible();
    await page.getByTestId('loadFormatModalCancel').click();
    await expect(page.getByTestId('loadFormatModal')).not.toBeVisible();
  });

  test('importing the demo CSV loads the questionnaire tree', async ({ page }) => {
    await freshStart(page);
    await loadREDCapCSV(page, SAMPLE_CSV);

    // First form should be "demographics" — wait generously for the new tree to replace the default
    const firstGroup = page.locator('[data-node-id="1"]');
    await expect(firstGroup).toBeVisible({ timeout: 15_000 });
    const title = await firstGroup.getByTestId('node-title-display').first().innerText();
    expect(title.toLowerCase()).toContain('demo');
  });

  test('imported questionnaire shows expected number of groups', async ({ page }) => {
    await freshStart(page);
    await loadREDCapCSV(page, SAMPLE_CSV);
    await expect(page.locator('[data-node-id]').first()).toBeVisible({ timeout: 10_000 });

    // The demo CSV has 7 forms → 7 root groups
    const rootGroups = page.locator('[data-node-depth="0"]');
    await expect(rootGroups).toHaveCount(7, { timeout: 10_000 });
  });

  test('importing REDCap-originated FHIR JSON round-trips cleanly', async ({ page }) => {
    await freshStart(page);
    await loadFHIRJSON(page, SAMPLE_FHIR);
    await expect(page.locator('[data-node-id]').first()).toBeVisible({ timeout: 10_000 });
    // Should have the same 7 groups as the CSV import
    const rootGroups = page.locator('[data-node-depth="0"]');
    await expect(rootGroups).toHaveCount(7, { timeout: 10_000 });
  });
});

// ── Tests: REDCap Export ──────────────────────────────────────────────────────

test.describe('REDCap CSV export', () => {
  test('save format modal opens on "Questionnaire…" click', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('export-btn').click();
    await expect(page.getByTestId('export-quest-item')).toBeVisible();
    await page.getByTestId('export-quest-item').click();
    await expect(page.getByTestId('saveFormatModal')).toBeVisible();
    await expect(page.getByTestId('save-format-select')).toBeVisible();
    await page.getByTestId('saveFormatModalCancel').click();
    await expect(page.getByTestId('saveFormatModal')).not.toBeVisible();
  });

  test('exporting REDCap-originated FHIR triggers download (no compat modal)', async ({ page }) => {
    await freshStart(page);
    await loadFHIRJSON(page, SAMPLE_FHIR);
    await expect(page.locator('[data-node-id]').first()).toBeVisible({ timeout: 10_000 });

    // Open Save → Questionnaire… → select REDCap format → Export
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 12_000 }),
      (async () => {
        await page.getByTestId('export-btn').click();
        await expect(page.getByTestId('export-quest-item')).toBeVisible();
        await page.getByTestId('export-quest-item').click();
        await expect(page.getByTestId('saveFormatModal')).toBeVisible();
        await page.getByTestId('save-format-select').click();
        await page.locator('[data-testid="csel-drop"] [data-val="redcap"]').click();
        await page.getByTestId('saveFormatModalApply').click();
      })(),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.csv$/i);
  });

  test('exporting non-REDCap FHIR shows compat modal', async ({ page }) => {
    await freshStart(page);

    const answerExprPath = path.resolve(__dirname, '../../sampledata/answer-expression-demo.fhir.json');
    await loadFHIRJSON(page, answerExprPath);
    await expect(page.locator('[data-node-id]').first()).toBeVisible({ timeout: 10_000 });

    await page.getByTestId('export-btn').click();
    await expect(page.getByTestId('export-quest-item')).toBeVisible();
    await page.getByTestId('export-quest-item').click();
    await expect(page.getByTestId('saveFormatModal')).toBeVisible();
    await page.getByTestId('save-format-select').click();
    await page.locator('[data-testid="csel-drop"] [data-val="redcap"]').click();
    await page.getByTestId('saveFormatModalApply').click();
    await expect(validateModal(page)).toBeVisible({ timeout: 10_000 });
    await expect(validateModalTitle(page)).toContainText('REDCap Export');
    await expect(validateModalBody(page)).toContainText('REDCap');

    // Close the modal
    await validateModalClose(page).click();
    await expect(validateModal(page)).not.toBeVisible();
  });
});
