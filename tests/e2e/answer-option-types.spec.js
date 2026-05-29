// ── E2E: answerOption value[x] types ─────────────────────────────────────────
// Covers import, preview rendering, and export round-trip for all six FHIR
// answerOption value[x] types:
//   valueCoding, valueString, valueInteger, valueDate, valueTime, valueReference
//
// Fixture: sampledata/answer-option-types-demo.fhir.json
//
// Run: npx playwright test tests/e2e/answer-option-types.spec.js
//
// ── data-testid registry ─────────────────────────────────────────────────────
//   preview-mode-btn       mode toggle in toolbar
//   preview-mode-json      "JSON" option in mode dropdown
//   fhir-file-input        hidden file input for loading a questionnaire
//   add-root-group-btn     toolbar button (used only to confirm app has loaded)
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { test, expect } from '@playwright/test';

const FIXTURE = path.resolve('sampledata/answer-option-types-demo.fhir.json');

async function loadFixture(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(FIXTURE);
  // q-coding is the first item in the first group
  await expect(page.locator('[data-node-id="q-coding"]')).toBeVisible({ timeout: 8_000 });
}

async function getExportedJSON(page) {
  await page.getByTestId('preview-mode-btn').click();
  await page.getByTestId('preview-mode-json').click();
  await expect(page.locator('#fhirJsonView')).toBeVisible();
  await expect(page.locator('#fhirJsonView')).toContainText('resourceType', { timeout: 8_000 });
  const raw = await page.locator('#fhirJsonView').textContent();
  return JSON.parse(raw);
}

// Helper: deep-find item by linkId in a FHIR Questionnaire item tree
function findItem(items, linkId) {
  for (const it of items || []) {
    if (it.linkId === linkId) return it;
    const found = findItem(it.item, linkId);
    if (found) return found;
  }
  return null;
}

// ── 1. Import: all six item nodes render in the builder ───────────────────────

test.describe('answerOption types — import renders all nodes', () => {
  test('all six question items are visible in the builder after import', async ({ page }) => {
    await loadFixture(page);
    for (const id of ['q-coding', 'q-string', 'q-integer', 'q-date', 'q-time', 'q-reference']) {
      await expect(page.locator(`[data-node-id="${id}"]`)).toBeVisible();
    }
  });
});

// ── 2. Preview: choice items render with a select trigger ────────────────────
// We verify that each item type renders a .sc-trigger in the preview,
// confirming that options were parsed and the choice control was built.
// Dropdown open/close interaction is covered separately in answer-options-editor.spec.js.

test.describe('answerOption types — preview renders options', () => {
  for (const [id, label] of [
    ['q-coding',    'valueCoding'],
    ['q-string',    'valueString'],
    ['q-integer',   'valueInteger'],
    ['q-date',      'valueDate'],
    ['q-time',      'valueTime'],
    ['q-reference', 'valueReference'],
  ]) {
    test(`${label} item renders a select trigger in the preview`, async ({ page }) => {
      await loadFixture(page);
      const previewRow = page.locator(`[data-preview-id="${id}"]`);
      await expect(previewRow).toBeVisible({ timeout: 10_000 });
      await expect(previewRow.locator('.sc-trigger')).toBeVisible();
    });
  }
});

// ── 3. Export round-trip: original value[x] types are preserved ───────────────

test.describe('answerOption types — export round-trip', () => {
  test('valueCoding options export as valueCoding with code and display', async ({ page }) => {
    await loadFixture(page);
    const q = await getExportedJSON(page);
    const item = findItem(q.item, 'q-coding');
    expect(item).toBeTruthy();
    const opt = item.answerOption?.[0];
    expect(opt?.valueCoding?.code).toBe('LA19710-5');
    expect(opt?.valueCoding?.display).toBe('A+');
    // Note: system is not preserved through fhirOptsToStr (code+display only)
  });

  test('valueString options export as valueString (not valueCoding)', async ({ page }) => {
    await loadFixture(page);
    const q = await getExportedJSON(page);
    const item = findItem(q.item, 'q-string');
    expect(item).toBeTruthy();
    const opt = item.answerOption?.[0];
    expect(opt?.valueString).toBe('Email');
    expect(opt?.valueCoding).toBeUndefined();
  });

  test('valueInteger options export as valueInteger (not valueCoding)', async ({ page }) => {
    await loadFixture(page);
    const q = await getExportedJSON(page);
    const item = findItem(q.item, 'q-integer');
    expect(item).toBeTruthy();
    const opt = item.answerOption?.[0];
    expect(opt?.valueInteger).toBe(0);
    expect(opt?.valueCoding).toBeUndefined();
  });

  test('valueDate options export as valueDate (not valueCoding)', async ({ page }) => {
    await loadFixture(page);
    const q = await getExportedJSON(page);
    const item = findItem(q.item, 'q-date');
    expect(item).toBeTruthy();
    const opt = item.answerOption?.[0];
    expect(opt?.valueDate).toBe('2026-06-01');
    expect(opt?.valueCoding).toBeUndefined();
  });

  test('valueTime options export as valueTime (not valueCoding)', async ({ page }) => {
    await loadFixture(page);
    const q = await getExportedJSON(page);
    const item = findItem(q.item, 'q-time');
    expect(item).toBeTruthy();
    const opt = item.answerOption?.[0];
    expect(opt?.valueTime).toBe('09:00:00');
    expect(opt?.valueCoding).toBeUndefined();
  });

  test('valueReference options export as valueReference (not valueCoding)', async ({ page }) => {
    await loadFixture(page);
    const q = await getExportedJSON(page);
    const item = findItem(q.item, 'q-reference');
    expect(item).toBeTruthy();
    const opt = item.answerOption?.[0];
    expect(opt?.valueReference?.reference).toBe('Practitioner/dr-smith');
    expect(opt?.valueReference?.display).toBe('Dr. Smith');
    expect(opt?.valueCoding).toBeUndefined();
  });

  test('initialSelected is preserved on round-trip for valueString', async ({ page }) => {
    await loadFixture(page);
    const q = await getExportedJSON(page);
    const item = findItem(q.item, 'q-initialselected');
    expect(item).toBeTruthy();
    const selected = item.answerOption?.find(o => o.initialSelected);
    expect(selected?.valueString).toBe('Push notification');
  });
});

// ── 4. Answer-type modal: rows show display values for non-Coding types ────────

test.describe('answerOption types — answer-type modal pre-population', () => {
  test('valueString options appear as code rows in the editor', async ({ page }) => {
    await loadFixture(page);
    await page.locator('[data-node-id="q-string"] [data-testid="action-type"]').click();
    await expect(page.locator('[data-testid="answerTypeModal"]')).toBeVisible();
    // First row code should show the string value
    await expect(page.getByTestId('opt-code-0')).toHaveValue('Email');
    await page.locator('[data-testid="answerTypeModalCancel"]').click();
  });

  test('valueInteger options appear as code rows in the editor', async ({ page }) => {
    await loadFixture(page);
    await page.locator('[data-node-id="q-integer"] [data-testid="action-type"]').click();
    await expect(page.locator('[data-testid="answerTypeModal"]')).toBeVisible();
    await expect(page.getByTestId('opt-code-0')).toHaveValue('0');
    await page.locator('[data-testid="answerTypeModalCancel"]').click();
  });
});
