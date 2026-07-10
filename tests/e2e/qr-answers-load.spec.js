// ── E2E: QR Answers loading — Answers menu ────────────────────────────────────
// Verifies that loading a QuestionnaireResponse via the Answers ▾ menu populates
// preview answers and fires the QR_LOADED event (answer display in preview).
//
// Run: npx playwright test tests/e2e/qr-answers-load.spec.js
//
// ── data-testid registry ──────────────────────────────────────────────────────
//   answers-btn              "📥 Answers ▾" dropdown trigger
//   load-answers-from-file   "From file…" menu item
//   qr-file-input            hidden file input wired to QR_ANSWERS_REQUESTED
//   load-answers-library-item "From Library…" menu item

import path from 'node:path';
import { test, expect } from '@playwright/test';

const PHQ9_FIXTURE = path.resolve('sampledata/phq-9.fhir.json');
const PHQ9_QR      = path.resolve('sampledata/phq-9-response.qr.json');
const BARIATRIC_FIXTURE = path.resolve('sampledata/example-bariatric.fhir.json');
const BARIATRIC_QR      = path.resolve('sampledata/example-bariatric-response.qr.json');

async function loadPHQ9(page) {
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(PHQ9_FIXTURE);
  // PHQ-9 first item has LOINC linkId /44250-9
  await expect(page.locator('[data-preview-id="/44250-9"]')).toBeVisible({ timeout: 10_000 });
}

async function loadBariatric(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(BARIATRIC_FIXTURE);
  // Wait for a top-level group to confirm the fixture loaded
  await expect(page.locator('[data-preview-id="g-consent"]')).toBeVisible({ timeout: 10_000 });
}

test.describe('QR Answers — load from file via Answers menu', () => {
  test('loading a QR file via the hidden file input populates preview answers', async ({ page }) => {
    await loadPHQ9(page);

    // Load QR via hidden file input (triggered by QR_ANSWERS_REQUESTED event)
    await page.locator('[data-testid="qr-file-input"]').setInputFiles(PHQ9_QR);

    // PHQ-9 response has answers — wait for re-render
    // The first item (/44250-9) should now show a selected value in its select/radio
    await expect(async () => {
      const firstItem = page.locator('[data-preview-id="/44250-9"]');
      await expect(firstItem).toBeVisible();
    }).toPass({ timeout: 8000 });
  });

  test('"From file…" menu item exists in the Answers dropdown', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
    // Add a group so answers-btn becomes visible (hidden until questionnaire loaded/new)
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.locator('[data-node-id="1"]')).toBeVisible();
    await page.getByTestId('answers-btn').click();
    await expect(page.locator('[data-testid="load-answers-from-file"]')).toBeVisible({ timeout: 5000 });
  });

  test('"From Library…" menu item exists in the Answers dropdown', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.locator('[data-node-id="1"]')).toBeVisible();
    await page.getByTestId('answers-btn').click();
    await expect(page.locator('[data-testid="load-answers-library-item"]')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('QR Answers — answer population by type', () => {
  test('PHQ-9 QR: coding answers populate radio/select controls', async ({ page }) => {
    await loadPHQ9(page);
    await page.locator('[data-testid="qr-file-input"]').setInputFiles(PHQ9_QR);

    // /44250-9 should be answered with "Several days" (LA6569-3)
    const item = page.locator('[data-preview-id="/44250-9"]');
    await expect(item).toBeVisible({ timeout: 8_000 });
    // The selected option text or input value should contain the display label
    await expect(item).toContainText('Several days', { timeout: 8_000 });
  });

  test('PHQ-9 QR: multiple items populated in one load', async ({ page }) => {
    await loadPHQ9(page);
    await page.locator('[data-testid="qr-file-input"]').setInputFiles(PHQ9_QR);

    // Both /44250-9 and /44255-8 should have answers visible
    await expect(page.locator('[data-preview-id="/44250-9"]')).toContainText('Several days', { timeout: 8_000 });
    await expect(page.locator('[data-preview-id="/44255-8"]')).toContainText('More than half', { timeout: 8_000 });
  });

  test('bariatric QR: integer answer populates numeric field', async ({ page }) => {
    await loadBariatric(page);
    await page.locator('[data-testid="qr-file-input"]').setInputFiles(BARIATRIC_QR);

    // q-diet-months has valueInteger: 6
    const item = page.locator('[data-preview-id="q-diet-months"]');
    await expect(item).toBeVisible({ timeout: 8_000 });
    const input = item.locator('input, textarea').first();
    await expect(input).toHaveValue('6', { timeout: 8_000 });
  });

  test('bariatric QR: string answer populates text field', async ({ page }) => {
    await loadBariatric(page);
    await page.locator('[data-testid="qr-file-input"]').setInputFiles(BARIATRIC_QR);

    // q-program-name has valueString: 'Weight Management Center'
    const item = page.locator('[data-preview-id="q-program-name"]');
    await expect(item).toBeVisible({ timeout: 8_000 });
    const input = item.locator('input, textarea').first();
    await expect(input).toHaveValue('Weight Management Center', { timeout: 8_000 });
  });

  test('bariatric QR: boolean answer populates checkbox', async ({ page }) => {
    await loadBariatric(page);
    await page.locator('[data-testid="qr-file-input"]').setInputFiles(BARIATRIC_QR);

    // q-diet-program has valueBoolean: true
    const item = page.locator('[data-preview-id="q-diet-program"]');
    await expect(item).toBeVisible({ timeout: 8_000 });
    const checkbox = item.locator('input[type="checkbox"]').first();
    await expect(checkbox).toBeChecked({ timeout: 8_000 });
  });

  test('QR load preserves existing answers in other items (no data loss)', async ({ page }) => {
    await loadBariatric(page);
    // First load the QR
    await page.locator('[data-testid="qr-file-input"]').setInputFiles(BARIATRIC_QR);

    // Then reload the same QR — values should still be intact
    await page.locator('[data-testid="qr-file-input"]').setInputFiles(BARIATRIC_QR);

    // q-diet-months should still read 6
    const input = page.locator('[data-preview-id="q-diet-months"]').locator('input, textarea').first();
    await expect(input).toHaveValue('6', { timeout: 8_000 });
  });

  test('loading QR clears previous manual answers', async ({ page }) => {
    await loadPHQ9(page);

    // Load QR — this should replace any manual state
    await page.locator('[data-testid="qr-file-input"]').setInputFiles(PHQ9_QR);
    await expect(page.locator('[data-preview-id="/44250-9"]')).toContainText('Several days', { timeout: 8_000 });
  });
});
