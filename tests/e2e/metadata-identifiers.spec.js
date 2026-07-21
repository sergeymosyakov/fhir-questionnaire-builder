// ── E2E: Metadata modal — Identifiers section ────────────────────────────────
// Tests for the Questionnaire.identifier[] collapsible section.
//
// Run: npx playwright test tests/e2e/metadata-identifiers.spec.js
//
// ── data-testid registry ──────────────────────────────────────────────────────
//   meta-identifiers-toggle      Identifiers section toggle button
//   meta-identifier-use-{i}      use custom-select for identifier at index i
//   meta-identifier-system-{i}   system input for identifier at index i
//   meta-identifier-value-{i}    value input for identifier at index i
//   meta-identifier-remove-{i}   remove button for identifier at index i
//   meta-identifier-add-btn      Add Identifier button
//   metadataModalApply           (id) Apply button
//   metadataModalCancel          (id) Cancel button
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import { freshStart, loadFixture, openModal, exportFHIR } from './helpers/metadata.js';

test.describe('metadata modal — Identifiers section', () => {

  test('toggle button is visible when modal is open', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-identifiers-toggle')).toBeVisible();
    await page.locator('[data-testid="metadataModalCancel"]').click();
  });

  test('section is auto-expanded when fixture has identifiers', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-identifier-system-0')).toBeVisible();
    await page.locator('[data-testid="metadataModalCancel"]').click();
  });

  test('section is collapsed by default on a fresh questionnaire', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    await openModal(page);
    await expect(page.getByTestId('meta-identifier-add-btn')).not.toBeVisible();
    await page.locator('[data-testid="metadataModalCancel"]').click();
  });

  test('clicking toggle expands the section', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    await openModal(page);
    await page.getByTestId('meta-identifiers-toggle').click();
    await expect(page.getByTestId('meta-identifier-add-btn')).toBeVisible();
    await page.locator('[data-testid="metadataModalCancel"]').click();
  });

  test('toggle badge shows count of non-empty identifiers', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-identifiers-toggle')).toContainText('(1)');
    await page.locator('[data-testid="metadataModalCancel"]').click();
  });

  test('imported identifier row has correct system, value and use', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-identifier-use-0')).toHaveAttribute('data-value', 'official');
    await expect(page.getByTestId('meta-identifier-system-0')).toHaveValue('https://example.org/questionnaire-ids');
    await expect(page.getByTestId('meta-identifier-value-0')).toHaveValue('Q-2024-001');
    await page.locator('[data-testid="metadataModalCancel"]').click();
  });

  test('Add Identifier button appends a new empty row', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-identifier-add-btn').click();
    await expect(page.getByTestId('meta-identifier-system-1')).toBeVisible();
    await page.locator('[data-testid="metadataModalCancel"]').click();
  });

  test('remove button deletes the identifier row', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-identifier-remove-0').click();
    await expect(page.getByTestId('meta-identifier-system-0')).not.toBeVisible();
    await page.locator('[data-testid="metadataModalCancel"]').click();
  });

  test('identifier[] round-trips through export', async ({ page }) => {
    await loadFixture(page);
    const q = await exportFHIR(page);
    expect(q.identifier).toEqual([
      { use: 'official', system: 'https://example.org/questionnaire-ids', value: 'Q-2024-001' },
    ]);
  });

  test('edited identifier value is committed on Apply and written to export', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-identifier-value-0').fill('Q-2025-999');
    await page.locator('[data-testid="metadataModalApply"]').click();
    const q = await exportFHIR(page);
    expect(q.identifier[0].value).toBe('Q-2025-999');
  });

  test('edited identifier system is committed on Apply and written to export', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-identifier-system-0').fill('https://new.example.org/ids');
    await page.locator('[data-testid="metadataModalApply"]').click();
    const q = await exportFHIR(page);
    expect(q.identifier[0].system).toBe('https://new.example.org/ids');
  });

  test('Cancel discards identifier edits', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-identifier-value-0').fill('CHANGED');
    await page.locator('[data-testid="metadataModalCancel"]').click();
    await openModal(page);
    await expect(page.getByTestId('meta-identifier-value-0')).toHaveValue('Q-2024-001');
    await page.locator('[data-testid="metadataModalCancel"]').click();
  });

  test('added identifier is written to export JSON', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-identifier-add-btn').click();
    await page.getByTestId('meta-identifier-system-1').fill('https://acme.org/ids');
    await page.getByTestId('meta-identifier-value-1').fill('ACME-007');
    await page.locator('[data-testid="metadataModalApply"]').click();
    const q = await exportFHIR(page);
    expect(q.identifier).toHaveLength(2);
    expect(q.identifier[1]).toMatchObject({ system: 'https://acme.org/ids', value: 'ACME-007' });
  });

  test('removing all identifiers omits identifier[] from export', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-identifier-remove-0').click();
    await page.locator('[data-testid="metadataModalApply"]').click();
    const q = await exportFHIR(page);
    expect(q.identifier).toBeUndefined();
  });

  test('new questionnaire without identifiers has no identifier[] in export', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    // Add a child item so the group is not empty (avoids que-1 warning on export
    // which would open validateModal instead of triggering the download directly)
    await page.locator('[data-node-id="1"]').getByTestId('group-add-btn').click();
    await page.locator('[data-testid="add-menu-item"]').first().click();
    await expect(page.locator('[data-node-id="1.1"]')).toBeVisible();
    const q = await exportFHIR(page);
    expect(q.identifier).toBeUndefined();
  });
});
