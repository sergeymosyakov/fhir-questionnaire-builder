// ── E2E: calculator templates (real templates/ files, nothing mocked) ─────────
// Inserts each calculator from the Add menu, types inputs in the preview and
// checks the calculated results; a second insert must calculate independently.
//
// data-testid registry:
//   add-menu-btn / add-template-btn        Add menu trigger / "From template…"
//   tpl-row-<id>, templatesModalApply      templates modal
//   preview-search-input                   real input used to commit preview inputs
//   date-input / dp-cal / dp-day           date-picker trigger / popup / day cell (preview)
// Preview inputs/radios ([data-preview-id], .radio-label) are the sanctioned non-testid exception.
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

async function commitInput(page) {
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.getByTestId('preview-search-input').click();
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}

async function type(page, previewId, value) {
  await page.locator(`[data-preview-id="${previewId}"] input`).fill(String(value));
  await commitInput(page);
}

const result = (page, id) => page.locator(`[data-preview-id="${id}"]`);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await freshStart(page);
});

test('library lists the calculator templates', async ({ page }) => {
  await openDropdownItem(page, 'add-menu-btn', 'add-template-btn');
  for (const id of ['body-measurements', 'kidney-function', 'cardiac-measurements', 'lipid-panel', 'chemistry-calculations', 'fib4', 'pregnancy-dating']) {
    await expect(page.getByTestId('tpl-row-' + id)).toBeVisible();
  }
});

test('Body Measurements: BMI, category and ideal body weight', async ({ page }) => {
  await insert(page, 'body-measurements');
  await type(page, 'body-height', 175);
  await type(page, 'body-weight', 70);
  await expect(result(page, 'body-bmi')).toContainText('22.9');
  await expect(result(page, 'body-bmi-category')).toContainText('Normal weight');
  await expect(result(page, 'body-ibw')).not.toContainText('70');
  await page.locator('[data-preview-id="body-sex"] .radio-label').nth(1).click(); // Male
  await expect(result(page, 'body-ibw')).toContainText('70.5');
});

test('Kidney Function: eGFR and creatinine clearance', async ({ page }) => {
  await insert(page, 'kidney-function');
  await type(page, 'kidney-age', 50);
  await type(page, 'kidney-weight', 72);
  await type(page, 'kidney-creatinine', 1);
  await page.locator('[data-preview-id="kidney-sex"] .radio-label').nth(1).click();
  await expect(result(page, 'kidney-egfr')).toContainText('92');
  await expect(result(page, 'kidney-crcl')).toContainText('90');
});

test('Cardiac Measurements: mean arterial pressure', async ({ page }) => {
  await insert(page, 'cardiac-measurements');
  await type(page, 'cardiac-sbp', 120);
  await type(page, 'cardiac-dbp', 80);
  await expect(result(page, 'cardiac-map')).toContainText('93.3');
});

test('Lipid Panel: LDL is blank at triglycerides of 400 or more', async ({ page }) => {
  await insert(page, 'lipid-panel');
  await type(page, 'lipid-tc', 200);
  await type(page, 'lipid-hdl', 50);
  await type(page, 'lipid-tg', 150);
  await expect(result(page, 'lipid-ldl')).toContainText('120');
  await type(page, 'lipid-tg', 400);
  await expect(result(page, 'lipid-ldl')).not.toContainText('120');
});

test('FIB-4 gives the index and its category', async ({ page }) => {
  await insert(page, 'fib4');
  for (const [id, v] of [['fib4-age', 50], ['fib4-ast', 40], ['fib4-alt', 40], ['fib4-plt', 200]]) await type(page, id, v);
  await expect(result(page, 'fib4-index')).toContainText('1.58');
  await expect(result(page, 'fib4-category')).toContainText('Indeterminate');
});

test('Cardiac Measurements: QTc differs between Bazett and Fridericia', async ({ page }) => {
  await insert(page, 'cardiac-measurements');
  await type(page, 'cardiac-qt', 400);
  await type(page, 'cardiac-hr', 75);
  await expect(result(page, 'cardiac-qtc-bazett')).toContainText('447');
  await expect(result(page, 'cardiac-qtc-fridericia')).toContainText('431');
});

test('Chemistry Calculations: anion gap and corrected calcium', async ({ page }) => {
  await insert(page, 'chemistry-calculations');
  for (const [id, v] of [['chem-na', 140], ['chem-cl', 104], ['chem-hco3', 24], ['chem-ca', 8], ['chem-alb', 3]]) await type(page, id, v);
  await expect(result(page, 'chem-anion-gap')).toContainText('12');
  await expect(result(page, 'chem-corrected-ca')).toContainText('8.8');
});

async function pickDay(page, previewId, day) {
  await page.locator(`[data-preview-id="${previewId}"]`).getByTestId('date-input').click();
  await page.getByTestId('dp-cal').getByTestId('dp-day').filter({ hasText: new RegExp(`^${day}$`) }).first().click();
  return page.locator(`[data-preview-id="${previewId}"]`).getByTestId('date-input').getAttribute('data-value');
}

test('Pregnancy Dating: expected delivery date and gestational age', async ({ page }) => {
  await insert(page, 'pregnancy-dating');
  const lmp = await pickDay(page, 'preg-lmp', 1);
  await pickDay(page, 'preg-visit', 15);
  const due = new Date(Date.parse(`${lmp}T00:00:00Z`) + 280 * 86400000).toISOString().slice(0, 10);
  await expect(result(page, 'preg-edd')).toContainText(due);
  await expect(result(page, 'preg-ga')).toContainText('2');
});

test('a second Body Measurements calculates from its own inputs', async ({ page }) => {
  await insert(page, 'body-measurements');
  await insert(page, 'body-measurements');
  const heights = page.locator('[data-preview-id^="body-height"]');
  await expect(heights).toHaveCount(2);
  const ids = await heights.evaluateAll(els => els.map(e => e.dataset.previewId));
  const suffix = ids.find(id => id !== 'body-height').slice('body-height'.length);
  await type(page, 'body-height', 175);
  await type(page, 'body-weight', 70);
  await type(page, `body-height${suffix}`, 200);
  await type(page, `body-weight${suffix}`, 100);
  await expect(result(page, 'body-bmi')).toContainText('22.9');
  await expect(result(page, `body-bmi${suffix}`)).toContainText('25');
});
