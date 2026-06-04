// ── E2E: Metadata modal — core fields, apply, Advanced section, effectivePeriod
// Open/close, field pre-population, applying changes, and the Advanced
// collapsible section including effectivePeriod.
//
// Run: npx playwright test tests/e2e/metadata-core.spec.js
//
// ── data-testid registry ──────────────────────────────────────────────────────
//   properties-btn         "Edit" button that opens the modal
//   metadataModal          (id) modal backdrop
//   metadataModalApply     (id) Apply button
//   metadataModalCancel    (id) Cancel button
//   metadataModalClose     (id) × close button
//   meta-id                id input
//   meta-url               url input
//   meta-version           version input
//   meta-name              name input
//   meta-title             title input
//   meta-status            status custom-select
//   meta-publisher         publisher input
//   meta-advanced-toggle   Advanced section toggle button
//   meta-subject-type-toggle Subject Type section toggle button
//   subject-type-chip-0    first chip in subject type section
//   subject-type-sel       custom-select trigger to add a type
//   subject-type-remove-0  × button on first chip
//   subject-type-custom-inp custom type text input
//   subject-type-custom-add custom type Add button
//   meta-date              date input (Advanced)
//   meta-purpose           purpose textarea (Advanced)
//   meta-effective-start   effectivePeriod.start input (Advanced)
//   meta-effective-end     effectivePeriod.end input (Advanced)
//   export-btn             toolbar export button
//   export-fhir-item       FHIR export menu item
//   clear-form-btn         clear/reset button
//   clear-confirm-clear-btn confirm clear button
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import { loadFixture, freshStart, openModal, exportFHIR } from './helpers/metadata.js';

// ── Modal open / close ────────────────────────────────────────────────────────

test.describe('metadata modal — open/close', () => {
  test('Edit button opens the modal', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.locator('[data-testid="metadataModal"]')).toBeVisible();
  });

  test('× button closes the modal', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.locator('[data-testid="metadataModalClose"]').click();
    await expect(page.locator('[data-testid="metadataModal"]')).not.toBeVisible();
  });

  test('Cancel button closes the modal', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.locator('[data-testid="metadataModalCancel"]').click();
    await expect(page.locator('[data-testid="metadataModal"]')).not.toBeVisible();
  });
});

// ── Fields pre-populated from loaded questionnaire ────────────────────────────

test.describe('metadata modal — fields populated on open', () => {
  test('id field shows the questionnaire id', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-id')).toHaveValue('meta-test-id');
  });

  test('url field shows the questionnaire url', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-url')).toHaveValue('http://example.org/fhir/Questionnaire/meta-test');
  });

  test('version field shows the questionnaire version', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-version')).toHaveValue('2.0');
  });

  test('title field shows the questionnaire title', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-title')).toHaveValue('Meta Test Questionnaire');
  });

  test('status select shows the questionnaire status', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-status')).toHaveAttribute('data-value', 'active');
  });

  test('publisher field shows the questionnaire publisher', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-publisher')).toHaveValue('Test Publisher');
  });

  test('name field shows the questionnaire name', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-name')).toHaveValue('MetaTestQuestionnaire');
  });
});

// ── Apply commits changes ─────────────────────────────────────────────────────

test.describe('metadata modal — apply', () => {
  test('changing status and applying updates the card badge', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-status').click();
    await page.locator('.oc-opt[data-val="retired"]').click();
    await page.locator('[data-testid="metadataModalApply"]').click();
    await expect(page.locator('[data-testid="metadataModal"]')).not.toBeVisible();
    await expect(page.getByTestId('quest-meta-status')).toHaveText('retired');
  });

  test('Cancel does not commit status change', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-status').click();
    await page.locator('.oc-opt[data-val="retired"]').click();
    await page.locator('[data-testid="metadataModalCancel"]').click();
    await expect(page.getByTestId('quest-meta-status')).toHaveText('active');
  });

  test('changed title is written back to export JSON', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-title').fill('Updated Title');
    await page.locator('[data-testid="metadataModalApply"]').click();
    const q = await exportFHIR(page);
    expect(q.title).toBe('Updated Title');
  });
});

// ── Advanced section ──────────────────────────────────────────────────────────

test.describe('metadata modal — Advanced section', () => {
  test('Advanced section is collapsed by default', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-date')).not.toBeVisible();
  });

  test('clicking Advanced toggle expands the section', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-advanced-toggle').click();
    await expect(page.getByTestId('meta-date')).toBeVisible();
  });

  test('date field shows questionnaire date after expanding', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-advanced-toggle').click();
    await expect(page.getByTestId('meta-date')).toHaveValue('2024-03-15');
  });

  test('Subject Type section shows chips for imported types', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    // Section auto-opens because fixture has subjectType
    await expect(page.getByTestId('subject-type-chip-0')).toBeVisible();
    await expect(page.getByTestId('subject-type-chip-0')).toHaveAttribute('data-value', 'Patient');
    await expect(page.getByTestId('subject-type-chip-1')).toHaveAttribute('data-value', 'Practitioner');
    await page.locator('[data-testid="metadataModalCancel"]').click();
  });

  test('purpose field shows questionnaire purpose after expanding', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-advanced-toggle').click();
    await expect(page.getByTestId('meta-purpose')).toHaveValue('Used for E2E testing.');
  });

  test('Advanced fields round-trip through export', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    // Remove Practitioner chip, add RelatedPerson via dropdown
    await page.getByTestId('subject-type-remove-1').click();
    await page.getByTestId('subject-type-sel').click();
    await page.locator('[data-testid="csel-drop"] [data-val="RelatedPerson"]').click();
    await page.locator('[data-testid="metadataModalApply"]').click();
    const q = await exportFHIR(page);
    expect(q.subjectType).toEqual(['Patient', 'RelatedPerson']);
  });

  test('empty subjectType is omitted from export', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    await page.locator('[data-node-id="1"]').getByTestId('group-add-btn').click();
    await page.locator('[data-testid="add-menu-item"]').first().click();
    await expect(page.locator('[data-node-id="1.1"]')).toBeVisible();
    const q = await exportFHIR(page);
    expect(q.subjectType).toBeUndefined();
  });

  test('date is preserved in export round-trip', async ({ page }) => {
    await loadFixture(page);
    const q = await exportFHIR(page);
    expect(q.date).toBe('2024-03-15');
  });

  test('contact[] is preserved in export pass-through', async ({ page }) => {
    await loadFixture(page);
    const q = await exportFHIR(page);
    expect(q.contact).toEqual([{ name: 'Test Contact' }]);
  });
});

// ── effectivePeriod fields ────────────────────────────────────────────────────

test.describe('metadata modal — effectivePeriod', () => {
  test('effectivePeriod start and end shown in Advanced section', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-advanced-toggle').click();
    await expect(page.getByTestId('meta-effective-start')).toHaveValue('2024-01-01');
    await expect(page.getByTestId('meta-effective-end')).toHaveValue('2025-12-31');
    await page.locator('[data-testid="metadataModalCancel"]').click();
  });

  test('effectivePeriod round-trips through export', async ({ page }) => {
    await loadFixture(page);
    const q = await exportFHIR(page);
    expect(q.effectivePeriod).toEqual({ start: '2024-01-01', end: '2025-12-31' });
  });

  test('effectivePeriod can be edited and applied', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-advanced-toggle').click();
    await page.getByTestId('meta-effective-start').fill('2025-03-01');
    await page.locator('[data-testid="metadataModalApply"]').click();
    await openModal(page);
    await page.getByTestId('meta-advanced-toggle').click();
    await expect(page.getByTestId('meta-effective-start')).toHaveValue('2025-03-01');
    await page.locator('[data-testid="metadataModalCancel"]').click();
  });

  test('effectivePeriod cleared when form is cleared', async ({ page }) => {
    await loadFixture(page);
    await page.getByTestId('clear-form-btn').click();
    await page.waitForSelector('.clear-confirm-backdrop');
    await page.getByTestId('clear-confirm-clear-btn').click();
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.getByTestId('quest-meta-card')).toBeVisible();
    await openModal(page);
    await page.getByTestId('meta-advanced-toggle').click();
    await expect(page.getByTestId('meta-effective-start')).toHaveValue('');
    await expect(page.getByTestId('meta-effective-end')).toHaveValue('');
    await page.locator('[data-testid="metadataModalCancel"]').click();
  });
});
