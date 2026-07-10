// ── E2E: Repeatable QR round-trip ─────────────────────────────────────────────
// Loads a fixture with 4 repeatable field types (text, number, date, select),
// fills 3 rows for each, exports as QuestionnaireResponse, reloads the page,
// re-loads the fixture, imports the QR, and verifies every value round-trips.
//
// Run: npx playwright test tests/e2e/repeats-roundtrip.spec.js
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { test, expect } from '@playwright/test';
import { openDropdownItem } from './helpers/dropdown.js';

const FIXTURE = path.resolve('tests/fixtures/all-types-repeatable.fhir.json');

async function loadFixture(page) {
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(FIXTURE);
  await expect(page.locator('[data-preview-id="text-item"]')).toBeVisible({ timeout: 8_000 });
}

// Fill N rows for an item: fill row 0, then click "+ Add another" and fill row 1, 2, ...
async function fillTextRows(page, linkId, values) {
  const wrap = page.locator(`[data-preview-id="${linkId}"]`);
  await wrap.locator('.repeat-row').nth(0).locator('textarea').fill(values[0]);
  for (let i = 1; i < values.length; i++) {
    await wrap.locator('[data-testid="repeat-add-btn"]').click();
    await expect(wrap.locator('.repeat-row')).toHaveCount(i + 1);
    await wrap.locator('.repeat-row').nth(i).locator('textarea').fill(values[i]);
  }
}

async function fillNumberRows(page, linkId, values) {
  const wrap = page.locator(`[data-preview-id="${linkId}"]`);
  await wrap.locator('.repeat-row').nth(0).locator('input[type="number"]').fill(values[0]);
  for (let i = 1; i < values.length; i++) {
    await wrap.locator('[data-testid="repeat-add-btn"]').click();
    await expect(wrap.locator('.repeat-row')).toHaveCount(i + 1);
    await wrap.locator('.repeat-row').nth(i).locator('input[type="number"]').fill(values[i]);
  }
}

async function fillDateRows(page, linkId, values) {
  const wrap = page.locator(`[data-preview-id="${linkId}"]`);
  await wrap.locator('.repeat-row').nth(0).locator('[data-testid="date-input"]').evaluate((el, v) => el._dpSetValue(v), values[0]);
  for (let i = 1; i < values.length; i++) {
    await wrap.locator('[data-testid="repeat-add-btn"]').click();
    await expect(wrap.locator('.repeat-row')).toHaveCount(i + 1);
    await wrap.locator('.repeat-row').nth(i).locator('[data-testid="date-input"]').evaluate((el, v) => el._dpSetValue(v), values[i]);
  }
}

async function fillSelectRows(page, linkId, values) {
  const wrap = page.locator(`[data-preview-id="${linkId}"]`);
  // Row 0: click trigger (the only sc-trigger at this point), pick option
  await wrap.locator('.sc-trigger').nth(0).click();
  await page.locator('.oc-opt').filter({ hasText: values[0] }).first().click();
  for (let i = 1; i < values.length; i++) {
    await wrap.locator('[data-testid="repeat-add-btn"]').click();
    await expect(wrap.locator('.repeat-row')).toHaveCount(i + 1);
    await wrap.locator('.sc-trigger').nth(i).click();
    await page.locator('.oc-opt').filter({ hasText: values[i] }).first().click();
  }
}

// ─────────────────────────────────────────────────────────────────────────────

test('QR repeat round-trip: fill 3 rows per field, export, reload, import, verify', async ({ page }) => {
  // ── Setup ──
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });

  // ── 1. Load fixture ──
  await loadFixture(page);

  // Verify all 4 items are repeatable (add button visible)
  await expect(page.locator('[data-preview-id="text-item"]   [data-testid="repeat-add-btn"]')).toBeVisible();
  await expect(page.locator('[data-preview-id="number-item"] [data-testid="repeat-add-btn"]')).toBeVisible();
  await expect(page.locator('[data-preview-id="date-item"]   [data-testid="repeat-add-btn"]')).toBeVisible();
  await expect(page.locator('[data-preview-id="select-item"] [data-testid="repeat-add-btn"]')).toBeVisible();

  // ── 2. Fill 3 rows per field ──
  await fillTextRows(page,   'text-item',   ['Hello', 'World', 'Foo']);
  await fillNumberRows(page, 'number-item', ['10', '20', '30']);
  await fillDateRows(page,   'date-item',   ['2024-01-01', '2024-02-15', '2024-03-31']);
  await fillSelectRows(page, 'select-item', ['Option A', 'Option B', 'Option C']);

  // ── 3. Export QR (via modal) ──
  await openDropdownItem(page, 'export-btn', 'export-qr-item');
  await expect(page.locator('[data-testid="qrExportModal"]')).toBeVisible({ timeout: 5_000 });
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('qrExportModalApply').click(),
  ]);
  const qrPath = await download.path();
  expect(qrPath).toBeTruthy();

  // ── 4. Reload page to clear state ──
  await page.addInitScript(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });

  // ── 5. Re-load fixture ──
  await loadFixture(page);

  // All rows should start at 1 (only row 0, no extras)
  await expect(page.locator('[data-preview-id="text-item"] .repeat-row')).toHaveCount(1);

  // ── 6. Import QR ──
  await page.locator('[data-testid="qr-file-input"]').setInputFiles(qrPath);

  // Wait for re-render: text-item should now show 3 rows
  await expect(page.locator('[data-preview-id="text-item"] .repeat-row')).toHaveCount(3, { timeout: 8_000 });

  // ── 7. Verify text-item ──
  await expect(page.locator('[data-preview-id="text-item"] .repeat-row').nth(0).locator('textarea')).toHaveValue('Hello');
  await expect(page.locator('[data-preview-id="text-item"] .repeat-row').nth(1).locator('textarea')).toHaveValue('World');
  await expect(page.locator('[data-preview-id="text-item"] .repeat-row').nth(2).locator('textarea')).toHaveValue('Foo');

  // ── 8. Verify number-item ──
  await expect(page.locator('[data-preview-id="number-item"] .repeat-row')).toHaveCount(3);
  await expect(page.locator('[data-preview-id="number-item"] .repeat-row').nth(0).locator('input[type="number"]')).toHaveValue('10');
  await expect(page.locator('[data-preview-id="number-item"] .repeat-row').nth(1).locator('input[type="number"]')).toHaveValue('20');
  await expect(page.locator('[data-preview-id="number-item"] .repeat-row').nth(2).locator('input[type="number"]')).toHaveValue('30');

  // ── 9. Verify date-item ──
  await expect(page.locator('[data-preview-id="date-item"] .repeat-row')).toHaveCount(3);
  await expect(page.locator('[data-preview-id="date-item"] .repeat-row').nth(0).locator('[data-testid="date-input"]')).toHaveAttribute('data-value', '2024-01-01');
  await expect(page.locator('[data-preview-id="date-item"] .repeat-row').nth(1).locator('[data-testid="date-input"]')).toHaveAttribute('data-value', '2024-02-15');
  await expect(page.locator('[data-preview-id="date-item"] .repeat-row').nth(2).locator('[data-testid="date-input"]')).toHaveAttribute('data-value', '2024-03-31');

  // ── 10. Verify select-item ──
  await expect(page.locator('[data-preview-id="select-item"] .repeat-row')).toHaveCount(3);
  await expect(page.locator('[data-preview-id="select-item"] .repeat-row').nth(0).locator('.sc-trigger-text')).toHaveText('Option A');
  await expect(page.locator('[data-preview-id="select-item"] .repeat-row').nth(1).locator('.sc-trigger-text')).toHaveText('Option B');
  await expect(page.locator('[data-preview-id="select-item"] .repeat-row').nth(2).locator('.sc-trigger-text')).toHaveText('Option C');
});

// ── Focused unit-level repeats tests ─────────────────────────────────────────

// ── Focused unit-level repeats tests ───────────────────────────────────────

async function loadRepeatable(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
  await loadFixture(page);
}

test.describe('Repeatable item — focused tests', () => {
  test('repeatable item shows +Add button in preview', async ({ page }) => {
    await loadRepeatable(page);
    await expect(page.locator('[data-preview-id="text-item"] [data-testid="repeat-add-btn"]')).toBeVisible();
    await expect(page.locator('[data-preview-id="number-item"] [data-testid="repeat-add-btn"]')).toBeVisible();
  });

  test('clicking +Add creates a second row', async ({ page }) => {
    await loadRepeatable(page);
    const wrap = page.locator('[data-preview-id="text-item"]');
    await expect(wrap.locator('.repeat-row')).toHaveCount(1);
    await wrap.locator('[data-testid="repeat-add-btn"]').click();
    await expect(wrap.locator('.repeat-row')).toHaveCount(2);
  });

  test('typing into first row saves value independently from second row', async ({ page }) => {
    await loadRepeatable(page);
    const wrap = page.locator('[data-preview-id="text-item"]');
    await wrap.locator('[data-testid="repeat-add-btn"]').click();
    await expect(wrap.locator('.repeat-row')).toHaveCount(2);

    await wrap.locator('.repeat-row').nth(0).locator('textarea').fill('Alpha');
    await wrap.locator('.repeat-row').nth(1).locator('textarea').fill('Beta');

    await expect(wrap.locator('.repeat-row').nth(0).locator('textarea')).toHaveValue('Alpha');
    await expect(wrap.locator('.repeat-row').nth(1).locator('textarea')).toHaveValue('Beta');
  });

  test('removing a row decreases row count', async ({ page }) => {
    await loadRepeatable(page);
    const wrap = page.locator('[data-preview-id="text-item"]');
    await wrap.locator('[data-testid="repeat-add-btn"]').click();
    await expect(wrap.locator('.repeat-row')).toHaveCount(2);
    await wrap.locator('[data-testid="repeat-add-btn"]').click();
    await expect(wrap.locator('.repeat-row')).toHaveCount(3);

    // Remove button on last row
    await wrap.locator('.repeat-row').nth(2).locator('[data-testid="repeat-remove-btn"]').click();
    await expect(wrap.locator('.repeat-row')).toHaveCount(2);
  });

  test('exported QR contains multiple answer entries for a repeatable item', async ({ page }) => {
    await loadRepeatable(page);
    const wrap = page.locator('[data-preview-id="text-item"]');
    await wrap.locator('.repeat-row').nth(0).locator('textarea').fill('First');
    await wrap.locator('[data-testid="repeat-add-btn"]').click();
    await wrap.locator('.repeat-row').nth(1).locator('textarea').fill('Second');

    const qrJson = await page.evaluate(async () => {
      const { buildQR } = await import('/js/fhir/qr-builder.js');
      const { buildFHIRObject } = await import('/js/fhir/export.js');
      const { answerStore } = await import('/js/answer-store.js');
      return JSON.stringify(buildQR(buildFHIRObject(), answerStore.toValueMap()));
    });
    const qr = JSON.parse(qrJson);
    function findItem(items, id) {
      for (const it of items ?? []) {
        if (it.linkId === id) return it;
        const found = findItem(it.item ?? [], id);
        if (found) return found;
      }
    }
    const item = findItem(qr.item, 'text-item');
    expect(item?.answer?.length).toBeGreaterThanOrEqual(2);
    const texts = item.answer.map(a => a.valueString);
    expect(texts).toContain('First');
    expect(texts).toContain('Second');
  });

  test('number item: two rows export two integer answers', async ({ page }) => {
    await loadRepeatable(page);
    const wrap = page.locator('[data-preview-id="number-item"]');
    await wrap.locator('.repeat-row').nth(0).locator('input[type="number"]').fill('7');
    await wrap.locator('[data-testid="repeat-add-btn"]').click();
    await wrap.locator('.repeat-row').nth(1).locator('input[type="number"]').fill('13');

    const qrJson = await page.evaluate(async () => {
      const { buildQR } = await import('/js/fhir/qr-builder.js');
      const { buildFHIRObject } = await import('/js/fhir/export.js');
      const { answerStore } = await import('/js/answer-store.js');
      return JSON.stringify(buildQR(buildFHIRObject(), answerStore.toValueMap()));
    });
    const qr = JSON.parse(qrJson);
    function findItem(items, id) {
      for (const it of items ?? []) {
        if (it.linkId === id) return it;
        const found = findItem(it.item ?? [], id);
        if (found) return found;
      }
    }
    const item = findItem(qr.item, 'number-item');
    const values = item?.answer?.map(a => a.valueInteger ?? a.valueDecimal);
    expect(values).toContain(7);
    expect(values).toContain(13);
  });
});
