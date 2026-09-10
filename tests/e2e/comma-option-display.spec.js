// ── E2E: comma inside a choice-option display must not split ──────────────────
// A procedure-code answerOption whose display contains commas (real HCPCS/CPT
// descriptions) must render as ONE option in the preview and survive the export
// round-trip — not fragment into several options on each comma.
//
// Fixture: tests/fixtures/comma-option-display.fhir.json
//   q-radio-comma — radio choice, 2 answerOptions (one display has commas)
//
// Also covers the same bug entered live through the builder's Answer Type
// modal (reported by a real user — a checklist option label containing a
// comma got split into two separate options on Apply).
//
// Run: npx playwright test tests/e2e/comma-option-display.spec.js
//
// ── data-testid registry ─────────────────────────────────────────────────────
//   add-root-group-btn     toolbar button (confirms app loaded)
//   fhir-file-input        hidden file input for loading a questionnaire
//   preview-mode-btn       mode toggle in toolbar
//   preview-mode-json      "JSON" option in mode dropdown
//   action-type / answerTypeModal / type-select / answerTypeModalApply
//   opt-add-btn / opt-code-<i> / opt-label-<i>       answer options editor
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

test.describe('comma typed into an option label via the Answer Type modal', () => {
  const LABEL_WITH_COMMA = 'Wound Care (Must include current measurements, drainage and orders)';

  test('Apply keeps it as one option, not split at the comma', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/');
    await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.locator('[data-node-id="1"]')).toBeVisible();

    await page.locator('[data-node-id="1"]').getByTestId('group-add-btn').click();
    await page.locator('[data-testid="add-menu-item"]').first().click();
    const item = page.locator('[data-node-id="1.1"]');
    await expect(item.getByTestId('node-title-display')).toBeVisible();

    await item.getByTestId('action-type').click();
    await expect(page.getByTestId('answerTypeModal')).toBeVisible();
    await page.getByTestId('type-select').click();
    await page.locator('[data-testid="csel-drop"] [data-val="checklist"]').click();

    await page.getByTestId('opt-add-btn').click();
    await page.getByTestId('opt-code-0').fill('woundcare');
    await page.getByTestId('opt-label-0').fill(LABEL_WITH_COMMA);
    await page.getByTestId('opt-add-btn').click();
    await page.getByTestId('opt-code-1').fill('oth');
    await page.getByTestId('opt-label-1').fill('Other (Please Describe)');

    await page.getByTestId('answerTypeModalApply').click();
    await expect(page.getByTestId('answerTypeModal')).toBeHidden();

    const row = page.locator('[data-preview-id="1.1"]');
    await expect(row).toBeVisible();
    const labels = row.locator('.radio-label');
    await expect(labels).toHaveCount(2);
    await expect(labels.filter({ hasText: LABEL_WITH_COMMA })).toHaveCount(1);

    const q = await getExportedJSON(page);
    const exported = findItem(q.item, '1.1');
    expect(exported.answerOption).toHaveLength(2);
    expect(exported.answerOption[0].valueCoding.code).toBe('woundcare');
    expect(exported.answerOption[0].valueCoding.display).toBe(LABEL_WITH_COMMA);
  });
});
