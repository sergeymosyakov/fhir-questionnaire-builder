// ── E2E: questionnaire-itemControl (atable) ───────────────────────────────────
// Tests for the "Answer table" layout on radio/checklist items — one row for
// the question, permitted answers as table columns (HL7 atable itemControl).
//
// Run: npx playwright test tests/e2e/atable-item-control.spec.js
//
// ── data-testid registry ──────────────────────────────────────────────────────
//   add-root-group-btn   "+Add Root Group" toolbar button
//   group-add-btn        "+" button on a group node
//   add-menu-item         "Item" option in add-child menu
//   action-type           "Answer Type" action link on an item node
//   type-select           custom type dropdown in Answer Type modal
//   atable-toggle         "Answer table (options as columns)" checkbox
//   opt-add-btn           "+ Add option" button in the options editor
//   opt-code-{i}          Code input for row i
//   opt-label-{i}         Label input for row i
//   answerTypeModalApply  Apply button in the Answer Type modal
//   atable-item           the rendered <table> (dataset.testid, see choice-node.js)
//   export-btn, export-quest-item, saveFormatModalApply, prompt-save — export flow
//   fhir-file-input       hidden file input used to load a FHIR JSON
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { openDropdownItem } from './helpers/dropdown.js';

async function waitForLoad(page) {
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
}

async function freshStart(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await waitForLoad(page);
}

async function addItem(page) {
  await page.getByTestId('add-root-group-btn').click();
  await expect(page.locator('[data-node-id="1"]')).toBeVisible();
  await page.locator('[data-node-id="1"]').getByTestId('group-add-btn').click();
  await page.locator('[data-testid="add-menu-item"]').first().click();
  await expect(page.locator('[data-node-id="1.1"]')).toBeVisible();
  return '1.1';
}

async function openAnswerTypeModal(page, itemId) {
  const link = page.locator(`[data-node-id="${itemId}"]`).getByTestId('action-type');
  await expect(async () => {
    await link.click();
    await expect(page.locator('[data-testid="answerTypeModal"]')).toBeVisible();
  }).toPass();
}

async function changeType(page, typeValue) {
  await page.locator('[data-testid="answerTypeModal"]').getByTestId('type-select').click();
  await page.locator(`[data-testid="csel-drop"] [data-val="${typeValue}"]`).click();
}

async function addOptions(page, pairs) {
  for (let i = 0; i < pairs.length; i++) {
    await page.getByTestId('opt-add-btn').click();
    await page.getByTestId(`opt-code-${i}`).fill(pairs[i][0]);
    await page.getByTestId(`opt-label-${i}`).fill(pairs[i][1]);
  }
}

async function applyModal(page) {
  await page.locator('[data-testid="answerTypeModalApply"]').click();
  await expect(page.locator('[data-testid="answerTypeModal"]')).not.toBeVisible();
}

const atableToggle = (page) => page.locator('[data-testid="answerTypeModal"]').getByTestId('atable-toggle');

test.describe('atable itemControl — builder toggle visibility', () => {
  test('toggle is hidden for select, visible for radio and checklist', async ({ page }) => {
    await freshStart(page);
    const id = await addItem(page);
    await openAnswerTypeModal(page, id);
    await changeType(page, 'select');
    await expect(atableToggle(page)).toBeHidden();

    await changeType(page, 'radio');
    await expect(atableToggle(page)).toBeVisible();

    await changeType(page, 'checklist');
    await expect(atableToggle(page)).toBeVisible();
  });
});

test.describe('atable itemControl — radio', () => {
  test('enabling atable renders a table with one column per option', async ({ page }) => {
    await freshStart(page);
    const id = await addItem(page);
    await openAnswerTypeModal(page, id);
    await changeType(page, 'radio');
    await addOptions(page, [['poor', 'Poor'], ['good', 'Good'], ['great', 'Great']]);
    await atableToggle(page).check();
    await applyModal(page);

    const table = page.locator(`[data-preview-id="${id}"] table.atable-item`);
    await expect(table).toBeVisible();
    await expect(table.locator('th')).toHaveCount(3);
    await expect(table.locator('th').nth(1)).toContainText('Good');
    await expect(table.locator('td input[type="radio"]')).toHaveCount(3);
  });

  test('selecting a radio cell records the answer (single-select)', async ({ page }) => {
    await freshStart(page);
    const id = await addItem(page);
    await openAnswerTypeModal(page, id);
    await changeType(page, 'radio');
    await addOptions(page, [['a', 'A'], ['b', 'B']]);
    await atableToggle(page).check();
    await applyModal(page);

    const table = page.locator(`[data-preview-id="${id}"] table.atable-item`);
    const radios = table.locator('td input[type="radio"]');
    await radios.nth(1).check();
    await expect(radios.nth(1)).toBeChecked();
    await expect(radios.nth(0)).not.toBeChecked();
    await radios.nth(0).check();
    await expect(radios.nth(0)).toBeChecked();
    await expect(radios.nth(1)).not.toBeChecked();
  });

  test('disabling atable reverts to the vertical radio-label list', async ({ page }) => {
    await freshStart(page);
    const id = await addItem(page);
    await openAnswerTypeModal(page, id);
    await changeType(page, 'radio');
    await addOptions(page, [['a', 'A'], ['b', 'B']]);
    await atableToggle(page).check();
    await applyModal(page);
    await expect(page.locator(`[data-preview-id="${id}"] table.atable-item`)).toBeVisible();

    await openAnswerTypeModal(page, id);
    await atableToggle(page).uncheck();
    await applyModal(page);
    await expect(page.locator(`[data-preview-id="${id}"] table.atable-item`)).toHaveCount(0);
    await expect(page.locator(`[data-preview-id="${id}"] .radio-label`)).toHaveCount(2);
  });
});

test.describe('atable itemControl — checklist', () => {
  test('enabling atable renders a table with one checkbox column per option', async ({ page }) => {
    await freshStart(page);
    const id = await addItem(page);
    await openAnswerTypeModal(page, id);
    await changeType(page, 'checklist');
    await addOptions(page, [['headache', 'Headache'], ['fatigue', 'Fatigue']]);
    await atableToggle(page).check();
    await applyModal(page);

    const table = page.locator(`[data-preview-id="${id}"] table.atable-item`);
    await expect(table).toBeVisible();
    await expect(table.locator('th')).toHaveCount(2);
    await expect(table.locator('td input[type="checkbox"]')).toHaveCount(2);
  });
});

test.describe('atable itemControl — round-trip', () => {
  test('export → reload preserves the atable toggle and its rendering', async ({ page }) => {
    await freshStart(page);
    const id = await addItem(page);
    await openAnswerTypeModal(page, id);
    await changeType(page, 'radio');
    await addOptions(page, [['a', 'A'], ['b', 'B']]);
    await atableToggle(page).check();
    await applyModal(page);

    await openDropdownItem(page, 'export-btn', 'export-quest-item');
    await expect(page.locator('[data-testid="saveFormatModal"]')).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('saveFormatModalApply').click().then(() => page.getByTestId('prompt-save').click()),
    ]);
    const downloaded = await download.path();
    const q = JSON.parse(readFileSync(downloaded, 'utf8'));
    const item = q.item[0].item[0];
    const ic = (item.extension || []).find(e => e.url.includes('questionnaire-itemControl'));
    expect(ic.valueCodeableConcept.coding[0].code).toBe('atable');

    // Reload the exported JSON fresh and confirm the table still renders.
    const tmpFile = path.join(os.tmpdir(), `atable-roundtrip-${Date.now()}.json`);
    writeFileSync(tmpFile, JSON.stringify(q));
    try {
      await freshStart(page);
      await page.locator('[data-testid="fhir-file-input"]').setInputFiles(tmpFile);
      await expect(page.locator(`[data-preview-id="${item.linkId}"] table.atable-item`)).toBeVisible({ timeout: 8_000 });

      await openAnswerTypeModal(page, '1.1');
      await expect(atableToggle(page)).toBeChecked();
    } finally {
      unlinkSync(tmpFile);
    }
  });
});
