// ── E2E: default picked for a choice item is exported as answerOption.initialSelected ──
// Fixture: tests/fixtures/answer-options-editor.fhir.json (choice "q-opts": low / moderate / high)
//
// ── data-testid used in this suite ───────────────────────────────────────────
//   action-default          "Default" action link on an item node
//   initialModal            Default Value modal backdrop
//   initial-option-select   option picker inside the modal
//   initialModalApply       Apply button
//   export-btn / export-quest-item / saveFormatModalApply / prompt-save   export flow
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import path from 'node:path';
import { loadFixtureFile } from './helpers/load-fixture.js';
import { openDropdownItem } from './helpers/dropdown.js';

const FIXTURE = path.join(process.cwd(), 'tests/fixtures/answer-options-editor.fhir.json');

async function freshLoad(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
  await loadFixtureFile(page, FIXTURE);
  await expect(page.locator('[data-preview-id="q-opts"]')).toBeVisible({ timeout: 8_000 });
}

async function exportQuestionnaire(page) {
  await openDropdownItem(page, 'export-btn', 'export-quest-item');
  await expect(page.getByTestId('saveFormatModal')).toBeVisible();
  await page.getByTestId('saveFormatModalApply').click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('prompt-save').click(),
  ]);
  const chunks = await (await download.createReadStream()).toArray();
  return JSON.parse(Buffer.concat(chunks).toString());
}

async function setDefault(page, code) {
  await page.locator('[data-node-id="q-opts"]').getByTestId('action-default').click();
  await expect(page.getByTestId('initialModal')).toBeVisible();
  await page.getByTestId('initial-option-select').click();
  await page.locator(`[data-testid="csel-drop"] [data-val="${code}"]`).click();
  await page.getByTestId('initialModalApply').click();
  await expect(page.getByTestId('initialModal')).not.toBeVisible();
}

const marked = item => item.answerOption.filter(o => o.initialSelected).map(o => o.valueCoding.code);

test.describe('Default value — choice export', () => {
  test('default picked in the builder is exported as initialSelected', async ({ page }) => {
    await freshLoad(page);
    await setDefault(page, 'moderate');
    const json = await exportQuestionnaire(page);
    const item = json.item.find(i => i.linkId === 'q-opts');
    expect(marked(item)).toEqual(['moderate']);
    expect(item.initial).toBeUndefined();
  });

  test('changing the default moves the mark instead of keeping the old one', async ({ page }) => {
    await freshLoad(page);
    await setDefault(page, 'low');
    await setDefault(page, 'high');
    const json = await exportQuestionnaire(page);
    expect(marked(json.item.find(i => i.linkId === 'q-opts'))).toEqual(['high']);
  });
});
