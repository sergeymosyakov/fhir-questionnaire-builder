// ── E2E: Metadata modal — Questionnaire.code[] section ───────────────────────
// Tests for the Codes collapsible section inside the metadata modal.
//
// Run: npx playwright test tests/e2e/metadata-codes.spec.js
//
// ── data-testid registry ──────────────────────────────────────────────────────
//   meta-codes-toggle    Codes section toggle button
//   meta-code-code-{i}   code input for row i
//   meta-code-system-{i} system input for row i
//   meta-code-display-{i}display input for row i
//   meta-code-remove-{i} remove button for row i
//   meta-codes-add-btn   Add code button
//   metadataModalApply   (id) Apply button
//   metadataModalCancel  (id) Cancel button
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import { loadFixture, openModal, exportFHIR } from './helpers/metadata.js';

test.describe('metadata modal — Questionnaire codes', () => {
  test('Codes toggle visible, collapsed by default', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-codes-toggle')).toBeVisible();
    await expect(page.getByTestId('meta-code-code-0')).not.toBeVisible();
    await page.locator('#metadataModalCancel').click();
  });

  test('Codes toggle shows count badge when codes are present', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-codes-toggle')).toContainText('(1)');
    await page.locator('#metadataModalCancel').click();
  });

  test('expanding Codes section shows imported code row', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-codes-toggle').click();
    await expect(page.getByTestId('meta-code-code-0')).toHaveValue('44249-1');
    await expect(page.getByTestId('meta-code-system-0')).toHaveValue('http://loinc.org');
    await expect(page.getByTestId('meta-code-display-0')).toHaveValue('PHQ-9 total score');
    await page.locator('#metadataModalCancel').click();
  });

  test('Add code button appends a new empty row', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-codes-toggle').click();
    await page.getByTestId('meta-codes-add-btn').click();
    await expect(page.getByTestId('meta-code-code-1')).toBeVisible();
    await page.locator('#metadataModalCancel').click();
  });

  test('edited codes are committed on Apply and round-trip through export', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-codes-toggle').click();
    await page.getByTestId('meta-codes-add-btn').click();
    await page.getByTestId('meta-code-system-1').fill('http://snomed.info/sct');
    await page.getByTestId('meta-code-code-1').fill('44054006');
    await page.getByTestId('meta-code-display-1').fill('Type 2 diabetes');
    await page.locator('#metadataModalApply').click();
    const q = await exportFHIR(page);
    expect(q.code).toHaveLength(2);
    expect(q.code[1].code).toBe('44054006');
  });

  test('Cancel discards code changes', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-codes-toggle').click();
    await page.getByTestId('meta-code-remove-0').click();
    await page.locator('#metadataModalCancel').click();
    await openModal(page);
    await page.getByTestId('meta-codes-toggle').click();
    await expect(page.getByTestId('meta-code-code-0')).toHaveValue('44249-1');
    await page.locator('#metadataModalCancel').click();
  });

  test('removing all codes omits code[] from export', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-codes-toggle').click();
    await page.getByTestId('meta-code-remove-0').click();
    await page.locator('#metadataModalApply').click();
    const q = await exportFHIR(page);
    expect(q.code).toBeUndefined();
  });
});
