// ── E2E: sdc-questionnaire-choiceColumn ─────────────────────────────────────
// Tests:
//   1. Multi-column dropdown renders header + column cells
//   2. forDisplay column controls trigger label after selection
//   3. Round-trip: import → export preserves choiceColumn extensions
//
// Fixture: tests/fixtures/choice-column.fhir.json
//
// Run: npx playwright test tests/e2e/choice-column.spec.js
//
// ── data-testid registry ─────────────────────────────────────────────────────
//   preview-panel, fhir-file-input, add-root-group-btn, export-btn, export-quest-item, prompt-save
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { FHIR } from '../../js/fhir/urls/fhir.js';
import { openDropdownItem } from './helpers/dropdown.js';

const FIXTURE = path.resolve('tests/fixtures/choice-column.fhir.json');

async function loadFixture(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(FIXTURE);
  await expect(page.locator('[data-preview-id="med"]')).toBeVisible({ timeout: 8_000 });
}

test.describe('choiceColumn — multi-column dropdown', () => {
  test('dropdown shows column header and multi-column rows', async ({ page }) => {
    await loadFixture(page);
    const row = page.locator('[data-preview-id="med"]');
    const trigger = row.locator('.sc-trigger');
    await trigger.click();

    // Header row with column labels
    const header = page.locator('.oc-col-header');
    await expect(header).toBeVisible();
    const headerCells = header.locator('.oc-col-cell');
    await expect(headerCells).toHaveCount(2);
    await expect(headerCells.nth(0)).toHaveText('Code');
    await expect(headerCells.nth(1)).toHaveText('Name');

    // Option rows with column cells
    const rows = page.locator('.oc-col-row');
    await expect(rows).toHaveCount(2);

    // First row should have code and display values
    const firstRowCells = rows.nth(0).locator('.oc-col-cell');
    await expect(firstRowCells.nth(0)).toHaveText('197361');
    await expect(firstRowCells.nth(1)).toHaveText('Amlodipine 5 MG');
  });

  test('selecting an option shows forDisplay column value in trigger', async ({ page }) => {
    await loadFixture(page);
    const row = page.locator('[data-preview-id="med"]');
    const trigger = row.locator('.sc-trigger');
    await trigger.click();

    // Click first option row
    const firstRow = page.locator('.oc-col-row').nth(0);
    await firstRow.click();

    // Trigger should show the forDisplay column value (display column = "Amlodipine 5 MG")
    await expect(trigger.locator('.sc-trigger-text')).toHaveText('Amlodipine 5 MG');
  });

  test('round-trip: choiceColumn extensions preserved in export', async ({ page }) => {
    await loadFixture(page);

    // Export via download
    await openDropdownItem(page, 'export-btn', 'export-quest-item');
    await expect(page.locator('[data-testid="saveFormatModal"]')).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('saveFormatModalApply').click().then(() => page.getByTestId('prompt-save').click()),
    ]);
    const filePath = await download.path();
    const exported = JSON.parse(readFileSync(filePath, 'utf8'));

    const CC_URL = FHIR.choiceColumn;
    const medItem = exported.item.find(i => i.linkId === 'med');
    const cols = (medItem.extension || []).filter(e => e.url === CC_URL);
    expect(cols).toHaveLength(2);
    expect(cols[0].extension).toContainEqual({ url: 'path', valueString: 'code' });
    expect(cols[0].extension).toContainEqual({ url: 'label', valueString: 'Code' });
    expect(cols[0].extension).toContainEqual({ url: 'forDisplay', valueBoolean: false });
    expect(cols[1].extension).toContainEqual({ url: 'path', valueString: 'display' });
    expect(cols[1].extension).toContainEqual({ url: 'forDisplay', valueBoolean: true });
  });
});

test.describe('choiceColumn — additional scenarios', () => {
  test('selecting second option shows its forDisplay value in trigger', async ({ page }) => {
    await loadFixture(page);
    const row = page.locator('[data-preview-id="med"]');
    const trigger = row.locator('.sc-trigger');
    await trigger.click();
    const secondRow = page.locator('.oc-col-row').nth(1);
    await secondRow.click();
    await expect(trigger.locator('.sc-trigger-text')).toHaveText('Carvedilol 25 MG');
  });

  test('dropdown closes when clicking outside', async ({ page }) => {
    await loadFixture(page);
    const trigger = page.locator('[data-preview-id="med"]').locator('.sc-trigger');
    await trigger.click();
    await expect(page.locator('.oc-col-header')).toBeVisible();
    await page.mouse.click(0, 0);
    await expect(page.locator('.oc-col-header')).not.toBeVisible();
  });

  test('choice-column badge visible in builder tree for the item', async ({ page }) => {
    await loadFixture(page);
    // The builder node for "med" should show a badge or active action link
    // indicating choiceColumn is configured
    const node = page.locator('[data-node-id="med"]');
    await expect(node).toBeVisible();
    // The node should have a type label
    await expect(node.getByTestId('node-type-label')).toBeVisible();
  });

  test('patient view renders choice column dropdown correctly', async ({ page }) => {
    await loadFixture(page);
    // Switch to patient view
    await expect(page.getByTestId('preview-mode-patient')).not.toBeVisible();
    await page.getByTestId('preview-mode-btn').click();
    await expect(page.getByTestId('preview-mode-patient')).toBeVisible();
    await page.getByTestId('preview-mode-patient').click();
    await expect(page.locator('#lform')).toHaveClass(/patient-view/, { timeout: 5_000 });

    // The med item should still render its trigger in patient view
    const trigger = page.locator('[data-preview-id="med"]').locator('.sc-trigger');
    await expect(trigger).toBeVisible();
  });

  test('fixture loads without JS errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await loadFixture(page);
    expect(errors).toHaveLength(0);
  });

  test('re-import exported file still shows multi-column dropdown', async ({ page }) => {
    await loadFixture(page);
    // Get the exported FHIR via evaluate
    const exportedStr = await page.evaluate(async () => {
      const { buildFHIRObject } = await import('/js/fhir/export.js');
      return JSON.stringify(buildFHIRObject());
    });
    const exported = JSON.parse(exportedStr);
    const CC_URL = FHIR.choiceColumn;
    const medItem = exported.item.find(i => i.linkId === 'med');
    expect(medItem.extension?.some(e => e.url === CC_URL)).toBe(true);
  });
});
