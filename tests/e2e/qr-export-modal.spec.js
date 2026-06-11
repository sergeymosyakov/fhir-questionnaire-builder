// ── E2E: QR Export modal ───────────────────────────────────────────────────────
// Tests for the Export → QuestionnaireResponse modal.
//
// Run: npx playwright test tests/e2e/qr-export-modal.spec.js
//
// ── data-testid used in this suite ───────────────────────────────────────────
//   add-root-group-btn         "+Add Root Group" toolbar button
//   export-btn                 "Export ▾" toolbar button
//   export-qr-item             "QuestionnaireResponse" dropdown item
//   qr-export-filename         file name input inside the modal
//   qr-export-status           status custom-select trigger inside the modal
//   qr-export-subject          subject reference input
//   qr-export-author           author reference input
//   qr-export-id               resource id input
//   qr-export-language         language code input
//   qr-export-version-id       meta.versionId input
//   qr-export-version-id-generate  "Generate" UUID button
//   qr-export-meta-source      meta.source input
//   qr-export-profile-add      "Add profile URL" button
//   qr-export-profile-url-{n}  nth profile URL input
//   qr-export-profile-remove-{n}  remove nth profile button
//   qrExportModalApply         "Apply" button in modal footer
//   qrExportModalCancel        "Cancel" button in modal footer
//   qrExportModal              modal backdrop (display:flex when open)
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { openDropdownItem } from './helpers/dropdown.js';

async function waitForLoad(page) {
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
}

async function loadSampleAndOpenExportModal(page) {
  await page.goto('/');
  await waitForLoad(page);
  // Load PHQ-9 sample questionnaire so Export → QR becomes available
  await openDropdownItem(page, 'load-fhir-btn', 'load-library-item');
  await page.locator('[data-sample="phq-9.fhir.json"]').waitFor({ timeout: 10_000 });
  await page.locator('[data-sample="phq-9.fhir.json"]').click();
  await page.waitForSelector('[data-testid="export-btn"]', { state: 'visible', timeout: 10_000 });
  // Open Export menu → QR item
  await openDropdownItem(page, 'export-btn', 'export-qr-item');
  // Wait for modal
  await expect(page.locator('[data-testid="qrExportModal"]')).toBeVisible({ timeout: 5_000 });
}

// ── modal opens ───────────────────────────────────────────────────────────────

test('QR export modal opens when Export→QR clicked', async ({ page }) => {
  await loadSampleAndOpenExportModal(page);
  await expect(page.locator('[data-testid="qrExportModal"]')).toBeVisible();
});

// ── fields present ────────────────────────────────────────────────────────────

test('modal contains filename, status, subject, author fields', async ({ page }) => {
  await loadSampleAndOpenExportModal(page);
  await expect(page.getByTestId('qr-export-filename')).toBeVisible();
  await expect(page.getByTestId('qr-export-status')).toBeVisible();
  await expect(page.getByTestId('qr-export-subject')).toBeVisible();
  await expect(page.getByTestId('qr-export-author')).toBeVisible();
});

// ── default values ─────────────────────────────────────────────────────────────

test('status defaults to in-progress', async ({ page }) => {
  await loadSampleAndOpenExportModal(page);
  await expect(page.getByTestId('qr-export-status')).toHaveAttribute('data-value', 'in-progress');
});

test('filename is pre-filled with questionnaire name', async ({ page }) => {
  await loadSampleAndOpenExportModal(page);
  const val = await page.getByTestId('qr-export-filename').inputValue();
  expect(val.length).toBeGreaterThan(0);
  expect(val).toMatch(/-response\.json$/);
});

// ── user edits fields ─────────────────────────────────────────────────────────

test('user can change status to completed', async ({ page }) => {
  await loadSampleAndOpenExportModal(page);
  await page.getByTestId('qr-export-status').click();
  await page.locator('[data-testid="csel-drop"] [data-val="completed"]').click();
  await expect(page.getByTestId('qr-export-status')).toHaveAttribute('data-value', 'completed');
});

test('user can enter subject and author references', async ({ page }) => {
  await loadSampleAndOpenExportModal(page);
  await page.getByTestId('qr-export-subject').fill('Patient/42');
  await page.getByTestId('qr-export-author').fill('Practitioner/7');
  await expect(page.getByTestId('qr-export-subject')).toHaveValue('Patient/42');
  await expect(page.getByTestId('qr-export-author')).toHaveValue('Practitioner/7');
});

// ── cancel ────────────────────────────────────────────────────────────────────

test('Cancel closes the modal without downloading', async ({ page }) => {
  await loadSampleAndOpenExportModal(page);
  const downloads = [];
  page.on('download', d => downloads.push(d));
  await page.locator('[data-testid="qrExportModalCancel"]').click();
  await expect(page.locator('[data-testid="qrExportModal"]')).toBeHidden();
  expect(downloads).toHaveLength(0);
});

test('Escape key closes the modal', async ({ page }) => {
  await loadSampleAndOpenExportModal(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-testid="qrExportModal"]')).toBeHidden();
});

// ── export triggers download ──────────────────────────────────────────────────

test('Export button triggers JSON download', async ({ page }) => {
  await loadSampleAndOpenExportModal(page);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('qrExportModalApply').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.json$/);
});

test('downloaded JSON has the user-specified status', async ({ page }) => {
  await loadSampleAndOpenExportModal(page);
  await page.getByTestId('qr-export-status').click();
  await page.locator('[data-testid="csel-drop"] [data-val="completed"]').click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('qrExportModalApply').click(),
  ]);
  const qr = JSON.parse(readFileSync(await download.path(), 'utf8'));
  expect(qr.status).toBe('completed');
});

test('downloaded JSON has subject when user enters one', async ({ page }) => {
  await loadSampleAndOpenExportModal(page);
  await page.getByTestId('qr-export-subject').fill('Patient/99');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('qrExportModalApply').click(),
  ]);
  const qr = JSON.parse(readFileSync(await download.path(), 'utf8'));
  expect(qr.subject?.reference).toBe('Patient/99');
});

test('downloaded JSON has no subject when field is empty', async ({ page }) => {
  await loadSampleAndOpenExportModal(page);
  await page.getByTestId('qr-export-subject').fill('');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('qrExportModalApply').click(),
  ]);
  const qr = JSON.parse(readFileSync(await download.path(), 'utf8'));
  expect(qr.subject).toBeUndefined();
});

// ── new fields: id, language, meta ────────────────────────────────────────────

test('modal contains id, language, versionId, source and profile-add fields', async ({ page }) => {
  await loadSampleAndOpenExportModal(page);
  await expect(page.getByTestId('qr-export-id')).toBeVisible();
  await expect(page.getByTestId('qr-export-language')).toBeVisible();
  await expect(page.getByTestId('qr-export-version-id')).toBeVisible();
  await expect(page.getByTestId('qr-export-meta-source')).toBeVisible();
  await expect(page.getByTestId('qr-export-profile-add')).toBeVisible();
});

test('downloaded JSON contains user-specified resource id', async ({ page }) => {
  await loadSampleAndOpenExportModal(page);
  await page.getByTestId('qr-export-id').fill('my-resp-001');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('qrExportModalApply').click(),
  ]);
  const qr = JSON.parse(readFileSync(await download.path(), 'utf8'));
  expect(qr.id).toBe('my-resp-001');
});

test('downloaded JSON contains user-specified language', async ({ page }) => {
  await loadSampleAndOpenExportModal(page);
  await page.getByTestId('qr-export-language').fill('de');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('qrExportModalApply').click(),
  ]);
  const qr = JSON.parse(readFileSync(await download.path(), 'utf8'));
  expect(qr.language).toBe('de');
});

test('downloaded JSON meta contains versionId', async ({ page }) => {
  await loadSampleAndOpenExportModal(page);
  await page.getByTestId('qr-export-version-id').fill('5');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('qrExportModalApply').click(),
  ]);
  const qr = JSON.parse(readFileSync(await download.path(), 'utf8'));
  expect(qr.meta?.versionId).toBe('5');
});

test('Generate button fills versionId with a UUID', async ({ page }) => {
  await loadSampleAndOpenExportModal(page);
  const before = await page.getByTestId('qr-export-version-id').inputValue();
  await page.getByTestId('qr-export-version-id-generate').click();
  const after = await page.getByTestId('qr-export-version-id').inputValue();
  expect(after).toMatch(/^[0-9a-f-]{36}$/i);
  expect(after).not.toBe(before);
});

test('user can add a profile URL and it appears in download', async ({ page }) => {
  await loadSampleAndOpenExportModal(page);
  await page.getByTestId('qr-export-profile-add').click();
  await page.getByTestId('qr-export-profile-url-0').fill('http://hl7.org/fhir/StructureDefinition/MyProfile');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('qrExportModalApply').click(),
  ]);
  const qr = JSON.parse(readFileSync(await download.path(), 'utf8'));
  expect(qr.meta?.profile).toContain('http://hl7.org/fhir/StructureDefinition/MyProfile');
});

test('downloaded JSON always has meta.lastUpdated', async ({ page }) => {
  await loadSampleAndOpenExportModal(page);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('qrExportModalApply').click(),
  ]);
  const qr = JSON.parse(readFileSync(await download.path(), 'utf8'));
  expect(qr.meta?.lastUpdated).toBeDefined();
  expect(new Date(qr.meta.lastUpdated).toISOString()).toBe(qr.meta.lastUpdated);
});
