// ── E2E: an optional quantity filled in part is flagged, and exports nothing ──
// A value without a unit (or the reverse) shows its message and a failed check icon; the export leaves it out.
//
// ── data-testid used in this suite ───────────────────────────────────────────
//   qty-num-input   number field of the quantity control in the preview
//   preview-mode-btn / preview-mode-json / preview-mode-preview   switch the preview and back (rebuilds it)
//   status-badge-btn   PASS/FAIL pill in the preview header
//   export-btn / export-qr-item, qrExportModal / qrExportModalApply   QuestionnaireResponse export
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { loadFixtureFile } from './helpers/load-fixture.js';
import { openDropdownItem } from './helpers/dropdown.js';

test('a value without a unit fails an optional quantity and is not exported', async ({ page }, testInfo) => {
  const file = testInfo.outputPath('qty.json');
  fs.writeFileSync(file, JSON.stringify({ resourceType: 'Questionnaire', status: 'draft', item: [{ linkId: 'dose', text: 'Dose', type: 'quantity' }] }));
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-menu-btn"]', { timeout: 10_000 });
  await loadFixtureFile(page, file);
  const row = page.locator('[data-preview-id="dose"]');
  await expect(row).toBeVisible({ timeout: 8_000 });
  await expect(row.locator('.icon-ok')).toBeVisible(); // optional and empty: passes

  await row.getByTestId('qty-num-input').fill('5');
  await row.getByTestId('qty-num-input').blur();
  await expect(row).toContainText('unit is required');
  await expect(row.locator('.icon-fail')).toBeVisible();
  await expect(page.getByTestId('status-badge-btn')).toBeVisible(); // the part-filled quantity is a criterion of its own
  await expect(page.getByTestId('status-badge-btn')).toContainText(/fail/i);

  // a rebuilt preview shows what was typed and the message again
  await page.getByTestId('preview-mode-btn').click();
  await page.getByTestId('preview-mode-json').click();
  await page.getByTestId('preview-mode-btn').click();
  await page.getByTestId('preview-mode-preview').click();
  await expect(row.getByTestId('qty-num-input')).toHaveValue('5');
  await expect(row).toContainText('unit is required');

  await openDropdownItem(page, 'export-btn', 'export-qr-item');
  await expect(page.getByTestId('qrExportModal')).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('qrExportModalApply').click()]);
  const qr = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  expect(qr.item?.some((i) => i.linkId === 'dose' && i.answer) ?? false).toBe(false);
});
