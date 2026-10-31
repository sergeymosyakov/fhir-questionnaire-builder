// ── E2E: checklist option whose code contains a comma ─────────────────────────
// Fixture: tests/fixtures/checklist-comma-code.fhir.json (codes "cough,dry" and "fever")
//
// ── data-testid used in this suite ───────────────────────────────────────────
//   export-btn / export-qr-item   Export menu → QuestionnaireResponse
//   qrExportModal / qrExportModalApply   QR export modal and its Apply button
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { loadFixtureFile } from './helpers/load-fixture.js';
import { openDropdownItem } from './helpers/dropdown.js';

const FIXTURE = path.join(process.cwd(), 'tests/fixtures/checklist-comma-code.fhir.json');

test('selecting a comma-containing code exports one answer with the full code', async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
  await loadFixtureFile(page, FIXTURE);
  const item = page.locator('[data-preview-id="symptoms"]');
  await expect(item).toBeVisible({ timeout: 8_000 });

  await item.getByLabel('Dry cough').check();
  await item.getByLabel('Fever').check();

  await openDropdownItem(page, 'export-btn', 'export-qr-item');
  await expect(page.getByTestId('qrExportModal')).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('qrExportModalApply').click(),
  ]);
  const qr = JSON.parse(readFileSync(await download.path(), 'utf8'));
  const answers = qr.item.find(i => i.linkId === 'symptoms').answer;
  expect(answers.map(a => a.valueCoding.code)).toEqual(['cough,dry', 'fever']);
});
