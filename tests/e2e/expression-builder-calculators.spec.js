// ── E2E: the calculators of the shipped templates open as blocks in the Expression Builder ──────────────
// Real templates, nothing mocked. Each one is opened in the builder, must show as blocks (not text), and applying it
// unchanged must leave the calculation giving the same result. One test also edits a block and sees it take effect.
//
// ── data-testid used ──────────────────────────────────────────────────────────
//   add-menu-btn / add-template-btn / tpl-row-<id> / templatesModal(+Apply)  templates
//   node-title-display / action-expr / expressionModal(+Apply) / expr-calc-ta-build-btn   open a field's expression
//   expressionBuilderModal(+Apply) / eb-raw-note / eb-preview-str            builder modal
//   eb-group / eb-if / eb-operand-text / eb-wrap-fn / eb-wrap-arg            blocks the calculators use
//   preview-search-input                                                    real input used to commit preview inputs
// Preview inputs ([data-preview-id]) and the builder's node containers ([data-node-id], which carry no testid) are the
// sanctioned non-testid exceptions.
//   eb-body / eb-if / eb-calc-text / eb-calc-value / eb-calc-mode / eb-operand-text   modal body and the blocks asserted on
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import { freshStart } from './helpers/builder.js';
import { openDropdownItem } from './helpers/dropdown.js';

async function insert(page, id) {
  await openDropdownItem(page, 'add-menu-btn', 'add-template-btn');
  await page.getByTestId('tpl-row-' + id).click();
  await page.getByTestId('templatesModalApply').click();
  await expect(page.getByTestId('templatesModal')).toBeHidden();
}

async function type(page, previewId, value) {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.locator(`[data-preview-id="${previewId}"] input`).fill(String(value));
  await page.getByTestId('preview-search-input').click();
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

const result = (page, id) => page.locator(`[data-preview-id="${id}"]`);
const modal = (page) => page.getByTestId('expressionBuilderModal');

// The field whose title is `title` (the deepest node carrying it).
async function openBuilder(page, title) {
  const node = page.locator('[data-node-id]').filter({ has: page.getByTestId('node-title-display').filter({ hasText: title }) }).last();
  await node.getByTestId('action-expr').click();
  await expect(page.getByTestId('expressionModal')).toBeVisible();
  await page.getByTestId('expr-calc-ta-build-btn').click();
  await expect(modal(page)).toBeVisible();
}

async function applyAndSave(page) {
  await page.getByTestId('expressionBuilderModalApply').click();
  await page.getByTestId('expressionModalApply').click();
  await expect(page.getByTestId('expressionModal')).toBeHidden();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await freshStart(page);
});

test('BMI: rounding and nested brackets open as blocks; applying unchanged keeps the result', async ({ page }) => {
  await insert(page, 'body-measurements');
  await openBuilder(page, 'Body mass index');
  await expect(modal(page).getByTestId('eb-raw-note')).toHaveCount(0);
  await expect(modal(page).getByTestId('eb-group').first()).toBeVisible();
  await expect(modal(page).getByTestId('eb-wrap-fn')).toHaveAttribute('data-value', 'round');
  await applyAndSave(page);

  await type(page, 'body-height', 175);
  await type(page, 'body-weight', 70);
  await expect(result(page, 'body-bmi')).toContainText('22.9');
});

test('BMI category: the text results open as blocks, and editing one changes the result', async ({ page }) => {
  await insert(page, 'body-measurements');
  await openBuilder(page, 'BMI category');
  await expect(modal(page).getByTestId('eb-raw-note')).toHaveCount(0);
  expect(await modal(page).getByTestId('eb-operand-text').count()).toBeGreaterThanOrEqual(4);

  const labels = await modal(page).getByTestId('eb-operand-text').evaluateAll((els) => els.map((e) => e.value));
  const at = labels.indexOf('Normal weight');
  expect(at).toBeGreaterThanOrEqual(0);
  await modal(page).getByTestId('eb-operand-text').nth(at).fill('Healthy weight');
  await applyAndSave(page);

  await type(page, 'body-height', 175);
  await type(page, 'body-weight', 70);
  await expect(result(page, 'body-bmi-category')).toContainText('Healthy weight');
});

test('BMI category: exactly on a threshold goes to the next band', async ({ page }) => {
  await insert(page, 'body-measurements');
  await openBuilder(page, 'BMI category');
  await applyAndSave(page); // opened as blocks and applied unchanged
  await type(page, 'body-height', 200);
  await type(page, 'body-weight', 100); // BMI exactly 25.0
  await expect(result(page, 'body-bmi-category')).toContainText('Overweight');
});

test('BMI category: the bands read as formulas, and a threshold can be edited', async ({ page }) => {
  await insert(page, 'body-measurements');
  await openBuilder(page, 'BMI category');
  await expect(modal(page).getByTestId('eb-calc-text').first()).toContainText('Weight (kg)'); // the condition reads as a formula
  await expect(modal(page).getByTestId('eb-calc-mode').first()).toHaveAttribute('data-value', 'can'); // "can be calculated"
  const limits = await modal(page).getByTestId('eb-calc-value').evaluateAll((els) => els.map((e) => e.value));
  expect(limits).toEqual(['18.5', '25', '30']);
  await modal(page).getByTestId('eb-calc-value').nth(1).fill('22'); // BMI under 22 is "Normal weight"
  await applyAndSave(page);

  await type(page, 'body-height', 175);
  await type(page, 'body-weight', 70); // BMI 22.9
  await expect(result(page, 'body-bmi-category')).toContainText('Overweight');
});

test('BMI category fits a phone-width screen without sideways scrolling', async ({ page }) => {
  await insert(page, 'body-measurements');
  await openBuilder(page, 'BMI category');
  await page.setViewportSize({ width: 390, height: 800 });
  await expect(modal(page).getByTestId('eb-calc-text').first()).toBeVisible();
  const overflow = await modal(page).getByTestId('eb-body').evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  // each block row stays inside the screen too
  const right = await modal(page).getByTestId('eb-if').first().evaluate((el) => el.getBoundingClientRect().right);
  expect(right).toBeLessThanOrEqual(390);
});

test('LDL: the condition and the rounding open as blocks; applying unchanged keeps the result', async ({ page }) => {
  await insert(page, 'lipid-panel');
  await openBuilder(page, 'LDL cholesterol');
  await expect(modal(page).getByTestId('eb-raw-note')).toHaveCount(0);
  await expect(modal(page).getByTestId('eb-if').first()).toBeVisible();
  await applyAndSave(page);

  await type(page, 'lipid-tc', 200);
  await type(page, 'lipid-hdl', 50);
  await type(page, 'lipid-tg', 150);
  await expect(result(page, 'lipid-ldl')).toContainText('120');
  await type(page, 'lipid-tg', 100);
  await expect(result(page, 'lipid-ldl')).toContainText('130'); // 200 - 50 - 100/5: the new triglycerides are used
  await type(page, 'lipid-tg', 400);
  await expect(result(page, 'lipid-ldl')).not.toContainText('120');
  await expect(result(page, 'lipid-ldl')).not.toContainText('130'); // blank at 400 or more
});
