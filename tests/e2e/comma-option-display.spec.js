// ── E2E: comma inside a choice-option display must not split ──────────────────
// A procedure-code answerOption whose display contains commas (real HCPCS/CPT
// descriptions) must render as ONE option in the preview and survive the export
// round-trip — not fragment into several options on each comma.
//
// Fixture: tests/fixtures/comma-option-display.fhir.json
//   q-radio-comma — radio choice, 2 answerOptions (one display has commas)
//
// Run: npx playwright test tests/e2e/comma-option-display.spec.js
//
// ── data-testid registry ─────────────────────────────────────────────────────
//   add-root-group-btn     toolbar button (confirms app loaded)
//   fhir-file-input        hidden file input for loading a questionnaire
//   preview-mode-btn       mode toggle in toolbar
//   preview-mode-json      "JSON" option in mode dropdown
// Preview control classes (sanctioned non-testid exception): .radio-label
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { test, expect } from '@playwright/test';

const FIXTURE = path.resolve('tests/fixtures/comma-option-display.fhir.json');
const COMMA_DISPLAY = 'E1220 - Wheelchair, adult size, heavy duty, elevating legrests';

async function loadFixture(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(FIXTURE);
  await expect(page.locator('[data-node-id="q-radio-comma"]')).toBeVisible({ timeout: 8_000 });
}

async function getExportedJSON(page) {
  await page.getByTestId('preview-mode-btn').click();
  await page.getByTestId('preview-mode-json').click();
  await expect(page.locator('#fhirJsonView')).toBeVisible();
  await expect(page.locator('#fhirJsonView')).toContainText('resourceType', { timeout: 8_000 });
  return JSON.parse(await page.locator('#fhirJsonView').textContent());
}

function findItem(items, linkId) {
  for (const it of items || []) {
    if (it.linkId === linkId) return it;
    const found = findItem(it.item, linkId);
    if (found) return found;
  }
  return null;
}

test.describe('comma in option display — preview', () => {
  test('renders exactly one option per answerOption (comma display not split)', async ({ page }) => {
    await loadFixture(page);
    const row = page.locator('[data-preview-id="q-radio-comma"]');
    await expect(row).toBeVisible({ timeout: 10_000 });

    const labels = row.locator('.radio-label');
    await expect(labels).toHaveCount(2);
    await expect(labels.filter({ hasText: COMMA_DISPLAY })).toHaveCount(1);
  });
});

test.describe('comma in option display — export round-trip', () => {
  test('answerOption is preserved as a single option with the full display', async ({ page }) => {
    await loadFixture(page);
    const q = await getExportedJSON(page);
    const item = findItem(q.item, 'q-radio-comma');
    expect(item).toBeTruthy();
    expect(item.answerOption).toHaveLength(2);
    expect(item.answerOption[0].valueCoding.code).toBe('E1220');
    expect(item.answerOption[0].valueCoding.display).toBe(COMMA_DISPLAY);
  });
});
