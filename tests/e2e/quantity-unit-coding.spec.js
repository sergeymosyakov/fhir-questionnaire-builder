// ── E2E: exported quantity answer carries the unit's UCUM system and code ─────
// Fixture: tests/fixtures/enable-when-quantity.fhir.json (quantity "weight", default unit kg)
//
// ── data-testid used in this suite ───────────────────────────────────────────
//   qty-num-input          numeric input of a quantity control in the preview
//   export-btn / export-qr-item   Export menu → QuestionnaireResponse
//   qrExportModal / qrExportModalApply   QR export modal and its Apply button
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { loadFixtureFile } from './helpers/load-fixture.js';
import { openDropdownItem } from './helpers/dropdown.js';

const FIXTURE = path.join(process.cwd(), 'tests/fixtures/enable-when-quantity.fhir.json');

test('exported quantity answer has the UCUM system and code of the unit', async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
  await loadFixtureFile(page, FIXTURE);
  const weight = page.locator('[data-preview-id="weight"]');
  await expect(weight).toBeVisible({ timeout: 8_000 });

  const num = weight.getByTestId('qty-num-input');
  await num.fill('70');
  await num.blur();

  await openDropdownItem(page, 'export-btn', 'export-qr-item');
  await expect(page.getByTestId('qrExportModal')).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('qrExportModalApply').click(),
  ]);
  const qr = JSON.parse(readFileSync(await download.path(), 'utf8'));
  const item = qr.item.find(i => i.linkId === 'weight');
  expect(item.answer[0].valueQuantity).toMatchObject({ value: 70, unit: 'kg', system: 'http://unitsofmeasure.org', code: 'kg' });
});
