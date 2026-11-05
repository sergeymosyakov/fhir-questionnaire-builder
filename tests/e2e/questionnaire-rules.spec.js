// ── E2E: Questionnaire export follows the FHIR rules ─────────────────────────
// Fixture: tests/fixtures/questionnaire-rules.fhir.json
//   smoker (coded, system set) → advice (display, condition without a system)
// The empty group and the item without text are loaded from an inline questionnaire.
//
// Run: npx playwright test tests/e2e/questionnaire-rules.spec.js
//
// ── data-testid registry ─────────────────────────────────────────────────────
//   fhir-file-input / export-btn / export-quest-item / saveFormatModalApply / prompt-save — load + export
//   action-vis            "Show When" action link
//   showWhenModal / showWhenModalBody / showWhenModalApply
//   vis-cond-val-sel-0    value drop-down of the first condition
//   validateModal / validate-export-btn — export validation report
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openDropdownItem } from './helpers/dropdown.js';
import { loadFixtureFile } from './helpers/load-fixture.js';

const FIXTURE = path.resolve('tests/fixtures/questionnaire-rules.fhir.json');

async function load(page, file = FIXTURE) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-menu-btn"]', { timeout: 10_000 });
  await loadFixtureFile(page, file);
  await expect(page.locator('[data-preview-id]').first()).toBeVisible({ timeout: 8_000 });
}

async function exportQuestionnaire(page) {
  await openDropdownItem(page, 'export-btn', 'export-quest-item');
  await expect(page.getByTestId('saveFormatModal')).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('saveFormatModalApply').click().then(() => page.getByTestId('prompt-save').click()),
  ]);
  return JSON.parse(readFileSync(await download.path(), 'utf8'));
}

test.describe('Questionnaire rules', () => {
  test('an empty group has no item list and an item without text has no text', async ({ page }) => {
    const questionnaire = {
      resourceType: 'Questionnaire', status: 'draft', title: 'Empty things',
      item: [{ linkId: 'no-text', type: 'string' }, { linkId: 'empty-group', type: 'group', text: 'Nothing here' }],
    };
    await load(page, { name: 'empty-things.fhir.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(questionnaire)) });
    await openDropdownItem(page, 'export-btn', 'export-quest-item');
    await expect(page.getByTestId('saveFormatModal')).toBeVisible();
    await page.getByTestId('saveFormatModalApply').click();
    const report = page.getByTestId('validateModal');
    await expect(report).toContainText('Item has no text');
    await expect(report).toContainText('Group has no items');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('validate-export-btn').click().then(() => page.getByTestId('prompt-save').click()),
    ]);
    const q = JSON.parse(readFileSync(await download.path(), 'utf8'));
    expect(q.item.find(i => i.linkId === 'empty-group')).not.toHaveProperty('item');
    expect(q.item.find(i => i.linkId === 'no-text')).not.toHaveProperty('text');
  });

  test('a condition on a coded answer keeps the code system of the picked option', async ({ page }) => {
    await load(page);
    await page.locator('[data-node-id="advice"]').getByTestId('action-vis').click();
    await expect(page.getByTestId('showWhenModal')).toBeVisible();
    await page.getByTestId('showWhenModalBody').getByTestId('vis-cond-val-sel-0').click();
    await page.locator('[data-testid="csel-drop"] [data-val="yes"]').click();
    await page.getByTestId('showWhenModalApply').click();
    const q = await exportQuestionnaire(page);
    const ew = q.item.find(i => i.linkId === 'advice').enableWhen[0];
    expect(ew.answerCoding).toEqual({ system: 'http://example.org/yn', code: 'yes', display: 'Yes' });
  });
});
