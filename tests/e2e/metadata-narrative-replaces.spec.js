// ── E2E: Metadata modal — Narrative and Replaces sections ────────────────────
// Tests for Questionnaire.text (Narrative read-only indicator) and the
// Replaces collapsible section (replaces extension URLs).
//
// Run: npx playwright test tests/e2e/metadata-narrative-replaces.spec.js
//
// ── data-testid registry ──────────────────────────────────────────────────────
//   meta-narrative-status    read-only Narrative status span
//   meta-replaces-toggle     Replaces section toggle button
//   meta-replaces-url-{i}    replaces URL input at index i
//   meta-replaces-remove-{i} remove button for replaces URL at index i
//   meta-replaces-add-btn    Add URL button
//   metadataModalApply       (id) Apply button
//   metadataModalCancel      (id) Cancel button
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import { freshStart, loadFixture, openModal, exportFHIR } from './helpers/metadata.js';

const REPLACES_URL = 'http://hl7.org/fhir/StructureDefinition/replaces';

// ── Narrative (Questionnaire.text) ───────────────────────────────────────────

test.describe('metadata modal — Narrative (Questionnaire.text)', () => {
  test('narrative status row is visible when questionnaire has text', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-narrative-status')).toBeVisible();
    await page.locator('[data-testid="metadataModalCancel"]').click();
  });

  test('narrative status row shows correct status value', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-narrative-status')).toHaveText('preserved · status: generated');
    await page.locator('[data-testid="metadataModalCancel"]').click();
  });

  test('narrative div block is visible below the status row', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    const pre = page.locator('.meta-modal-narrative');
    await expect(pre).toBeVisible();
    await expect(pre).toContainText('<div xmlns');
    await page.locator('[data-testid="metadataModalCancel"]').click();
  });

  test('narrative row is visible even when questionnaire has no imported text', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    await openModal(page);
    await expect(page.getByTestId('meta-narrative-status')).toBeVisible();
    await expect(page.getByTestId('meta-narrative-status')).toContainText('generated on export');
    await page.locator('[data-testid="metadataModalCancel"]').click();
  });

  test('text field round-trips through export unchanged', async ({ page }) => {
    await loadFixture(page);
    const q = await exportFHIR(page);
    expect(q.text).toEqual({
      status: 'generated',
      div: '<div xmlns="http://www.w3.org/1999/xhtml"><p>Test narrative content</p></div>',
    });
  });

  test('text field is auto-generated in export when questionnaire had no imported text', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    const q = await exportFHIR(page);
    expect(q.text).toBeDefined();
    expect(q.text.status).toBe('generated');
    expect(q.text.div).toContain('<div xmlns');
  });

  test('text field is auto-generated (not absent) in export after form clear', async ({ page }) => {
    await loadFixture(page);
    await page.getByTestId('clear-form-btn').click();
    await page.waitForSelector('.clear-confirm-backdrop');
    await page.getByTestId('clear-confirm-clear-btn').click();
    await page.getByTestId('add-root-group-btn').click();
    const q = await exportFHIR(page);
    expect(q.text).toBeDefined();
    expect(q.text.status).toBe('generated');
  });
});

// ── Replaces section ──────────────────────────────────────────────────────────

test.describe('metadata modal — Replaces section', () => {
  test('Replaces toggle is visible in modal', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-replaces-toggle')).toBeVisible();
    await page.locator('[data-testid="metadataModalCancel"]').click();
  });

  test('Replaces section is expanded when questionnaire has replaces extensions', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-replaces-url-0')).toBeVisible();
    await page.locator('[data-testid="metadataModalCancel"]').click();
  });

  test('Replaces inputs are pre-populated from imported extensions', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-replaces-url-0')).toHaveValue('http://example.org/fhir/Questionnaire/meta-test|1.0');
    await expect(page.getByTestId('meta-replaces-url-1')).toHaveValue('http://example.org/fhir/Questionnaire/meta-test|0.9');
    await page.locator('[data-testid="metadataModalCancel"]').click();
  });

  test('toggle label shows count of replaces URLs', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-replaces-toggle')).toContainText('(2)');
    await page.locator('[data-testid="metadataModalCancel"]').click();
  });

  test('Add URL button appends a new empty input', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    await openModal(page);
    await page.getByTestId('meta-replaces-toggle').click();
    await page.getByTestId('meta-replaces-add-btn').click();
    await expect(page.getByTestId('meta-replaces-url-0')).toBeVisible();
    await page.locator('[data-testid="metadataModalCancel"]').click();
  });

  test('remove button deletes a replaces URL row', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-replaces-remove-1').click();
    await expect(page.getByTestId('meta-replaces-url-1')).not.toBeVisible();
    await page.locator('[data-testid="metadataModalCancel"]').click();
  });

  test('replaces URLs round-trip through export as extension entries', async ({ page }) => {
    await loadFixture(page);
    const q = await exportFHIR(page);
    const entries = (q.extension || []).filter(e => e.url === REPLACES_URL);
    expect(entries).toHaveLength(2);
    expect(entries[0].valueCanonical).toBe('http://example.org/fhir/Questionnaire/meta-test|1.0');
    expect(entries[1].valueCanonical).toBe('http://example.org/fhir/Questionnaire/meta-test|0.9');
  });

  test('edited replaces URL is reflected in export', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-replaces-url-0').fill('http://example.org/fhir/Questionnaire/updated|2.0');
    await page.locator('[data-testid="metadataModalApply"]').click();
    const q = await exportFHIR(page);
    const entries = (q.extension || []).filter(e => e.url === REPLACES_URL);
    expect(entries[0].valueCanonical).toBe('http://example.org/fhir/Questionnaire/updated|2.0');
  });
});
