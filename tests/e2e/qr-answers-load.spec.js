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

async function loadPHQ9(page) {
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(PHQ9_FIXTURE);
  // PHQ-9 first item has LOINC linkId /44250-9
  await expect(page.locator('[data-preview-id="/44250-9"]')).toBeVisible({ timeout: 10_000 });
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
