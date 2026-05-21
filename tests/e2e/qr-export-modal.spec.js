// ── E2E: QR Export modal ───────────────────────────────────────────────────────
// Tests for the Export → QuestionnaireResponse modal.
//
// Run: npx playwright test tests/e2e/qr-export-modal.spec.js
//
// ── data-testid used in this suite ───────────────────────────────────────────
//   add-root-group-btn     "+Add Root Group" toolbar button
//   export-btn             "Export ▾" toolbar button
//   export-qr-item         "QuestionnaireResponse" dropdown item
//   qr-export-filename     file name input inside the modal
//   qr-export-status       status <select> inside the modal
//   qr-export-subject      subject reference input
//   qr-export-author       author reference input
//   qr-export-apply        "⬇ Export" button in modal footer
//
// ── element IDs ──────────────────────────────────────────────────────────────
//   qrExportModal          backdrop (display:flex when open)
//   qrExportModalCancel    Cancel button
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

async function waitForLoad(page) {
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
}

async function loadSampleAndOpenExportModal(page) {
  await page.goto('/');
  await waitForLoad(page);
  // Load PHQ-9 sample questionnaire so Export → QR becomes available
  await page.getByTestId('load-fhir-btn').click();
  await page.locator('[data-sample="phq-9.fhir.json"]').click();
  await page.waitForSelector('[data-testid="export-btn"]', { state: 'visible', timeout: 10_000 });
  // Open Export menu → QR item
  await page.getByTestId('export-btn').click();
  await page.getByTestId('export-qr-item').click();
  // Wait for modal
  await expect(page.locator('#qrExportModal')).toBeVisible({ timeout: 5_000 });
}

// ── modal opens ───────────────────────────────────────────────────────────────

test('QR export modal opens when Export→QR clicked', async ({ page }) => {
  await loadSampleAndOpenExportModal(page);
  await expect(page.locator('#qrExportModal')).toBeVisible();
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
  await expect(page.getByTestId('qr-export-status')).toHaveValue('in-progress');
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
  await page.getByTestId('qr-export-status').selectOption('completed');
  await expect(page.getByTestId('qr-export-status')).toHaveValue('completed');
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
  await page.locator('#qrExportModalCancel').click();
  await expect(page.locator('#qrExportModal')).toBeHidden();
  expect(downloads).toHaveLength(0);
});

test('Escape key closes the modal', async ({ page }) => {
  await loadSampleAndOpenExportModal(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('#qrExportModal')).toBeHidden();
});

// ── export triggers download ──────────────────────────────────────────────────

test('Export button triggers JSON download', async ({ page }) => {
  await loadSampleAndOpenExportModal(page);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('qr-export-apply').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.json$/);
});

test('downloaded JSON has the user-specified status', async ({ page }) => {
  await loadSampleAndOpenExportModal(page);
  await page.getByTestId('qr-export-status').selectOption('completed');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('qr-export-apply').click(),
  ]);
  const qr = JSON.parse(readFileSync(await download.path(), 'utf8'));
  expect(qr.status).toBe('completed');
});

test('downloaded JSON has subject when user enters one', async ({ page }) => {
  await loadSampleAndOpenExportModal(page);
  await page.getByTestId('qr-export-subject').fill('Patient/99');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('qr-export-apply').click(),
  ]);
  const qr = JSON.parse(readFileSync(await download.path(), 'utf8'));
  expect(qr.subject?.reference).toBe('Patient/99');
});

test('downloaded JSON has no subject when field is empty', async ({ page }) => {
  await loadSampleAndOpenExportModal(page);
  await page.getByTestId('qr-export-subject').fill('');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('qr-export-apply').click(),
  ]);
  const qr = JSON.parse(readFileSync(await download.path(), 'utf8'));
  expect(qr.subject).toBeUndefined();
});
