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
//   eb-scale-item / eb-scale-remove / eb-scale-add / eb-scale-total-note              scale total operand
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

// Option `index` (0-based) of a choice question in the preview.
const pickOption = (page, id, index) => page.locator(`[data-preview-id="${id}"] .radio-label`).nth(index).click();

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

test('a scale total opens as one "Scale total" block, and applying it unchanged keeps the total', async ({ page }) => {
  await insert(page, 'phq-9');
  await openBuilder(page, 'PHQ-9 total score');
  await expect(modal(page).getByTestId('eb-raw-note')).toHaveCount(0);
  await expect(modal(page).getByTestId('eb-scale-total-note')).toBeVisible();
  await expect(modal(page).getByTestId('eb-scale-item')).toHaveCount(9);
  await expect(modal(page).getByTestId('eb-if')).toHaveCount(0); // one block, not a conditional made of two scores
  await applyAndSave(page);

  for (let i = 1; i <= 8; i++) await pickOption(page, `phq9-q${i}`, 1); // 1 point each
  await expect(result(page, 'phq9-total')).not.toContainText(/\b8\b/); // still waiting for the ninth
  await pickOption(page, 'phq9-q9', 2);
  await expect(result(page, 'phq9-total')).toContainText('10');
});

test('editing the questions of a scale total changes when the total appears', async ({ page }) => {
  await insert(page, 'gad-2');
  await openBuilder(page, 'GAD-2 total score');
  await expect(modal(page).getByTestId('eb-scale-item')).toHaveCount(2);
  await modal(page).getByTestId('eb-scale-remove').last().click(); // only the first question counts now
  await expect(modal(page).getByTestId('eb-scale-item')).toHaveCount(1);
  await applyAndSave(page);

  await pickOption(page, 'gad2-q1', 3); // 3 points; the second question is not needed any more
  await expect(result(page, 'gad2-total')).toContainText('3');
});

test('PC-PTSD-5: the follow-up total opens as a scale total inside a condition', async ({ page }) => {
  await insert(page, 'pc-ptsd-5');
  await openBuilder(page, 'PC-PTSD-5 score');
  await expect(modal(page).getByTestId('eb-raw-note')).toHaveCount(0);
  await expect(modal(page).getByTestId('eb-scale-total-note')).toBeVisible();
  await applyAndSave(page);

  await pickOption(page, 'pcptsd5-exposure', 1); // No traumatic event: the score is 0
  await expect(result(page, 'pcptsd5-total')).toContainText('0');
  await pickOption(page, 'pcptsd5-exposure', 0); // Yes
  for (let i = 1; i <= 4; i++) await pickOption(page, `pcptsd5-q${i}`, 0); // a Yes (1 point) each
  await pickOption(page, 'pcptsd5-q5', 1);
  await expect(result(page, 'pcptsd5-total')).toContainText('4');
  await expect(result(page, 'pcptsd5-result')).toContainText('Positive screen');
});
