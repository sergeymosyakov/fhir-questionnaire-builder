// ── E2E: untrusted imported FHIR — unsafe media URLs and absurd nesting ──
//
// Run: npx playwright test tests/e2e/item-media-safety.spec.js
//
// ── data-testid registry ──────────────────────────────────────────────────────
//   add-root-group-btn          builder ready marker
//   fhir-file-input             hidden file input used by loadFixtureFile
//   preview-item-media          rendered itemMedia element
//   notif-body-error            error dialog body
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadFixtureFile } from './helpers/load-fixture.js';

const FIXTURE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fixtures/item-media-unsafe.fhir.json');

test('itemMedia with a file: URL is not rendered, http(s) one is', async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
  await loadFixtureFile(page, FIXTURE);
  await expect(page.locator('[data-preview-id="ok"]')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('[data-preview-id="ok"] [data-testid="preview-item-media"]')).toHaveCount(1);
  await expect(page.locator('[data-preview-id="bad"]')).toBeVisible();
  await expect(page.locator('[data-preview-id="bad"] [data-testid="preview-item-media"]')).toHaveCount(0);
});

test('importing items nested deeper than 100 levels is refused with an error', async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
  let item = { linkId: 'leaf', type: 'string', text: 'x' };
  for (let i = 0; i < 150; i++) item = { linkId: `g${i}`, type: 'group', item: [item] };
  const buffer = Buffer.from(JSON.stringify({ resourceType: 'Questionnaire', status: 'draft', item: [item] }));
  await loadFixtureFile(page, { name: 'deep.json', mimeType: 'application/json', buffer });
  await expect(page.getByTestId('notif-body-error')).toContainText('nested deeper than 100');
});
