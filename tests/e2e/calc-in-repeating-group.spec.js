// ── E2E: a calculated value inside a repeating group is computed per entry ────────────────────────────
// ── data-testid used ──────────────────────────────────────────────────────────
//   rg-add-btn / rg-remove-btn / gtable-add-btn / preview-search-input         repeating group entries and table rows
//   action-repeatable / repeat-modal-toggle / repeatableModalApply            making the group repeat
//   expressionBuilderModal / eb-chain / eb-operand / eb-arith-op / eb-add-operand   building the calculation (helpers)
//   fhir-file-input / qr-file-input / export-btn / export-qr-item / qrExportModal(+Apply)   loading the fixture, QR round trip
// Entries ([data-rg-group] / .rg-inst) and preview answers ([data-preview-id]) are the sanctioned non-testid exceptions.
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { freshStart } from './helpers/builder.js';
import { loadFixtureFile } from './helpers/load-fixture.js';
import { openDropdownItem, pickCustomSelect } from './helpers/dropdown.js';
import {
  modal, makeForm, openBuilder, applyAndSave, topChain, operandOf, operatorOf, pickKind, pickQuestion, setNumber,
  makeRepeatable,
} from './helpers/expr-builder.js';

const entry = (page, i) => page.locator('[data-rg-group="1"] > .rg-inst').nth(i);
const field = (page, i, id) => entry(page, i).locator(`[data-preview-id="${id}"]`);

// A commit re-renders the form shortly after (debounced); typing into the next field before that render lands
// loses the typed value, so wait for the render to finish before returning.
async function commit(page) {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const rendered = page.evaluate(() => new Promise((r) => document.addEventListener('preview:render-done', r, { once: true })));
  await page.getByTestId('preview-search-input').click();
  await rendered;
}
const enter = async (page, i, id, value) => {
  await field(page, i, id).locator('input').fill(String(value));
  await commit(page);
};
const addEntry = async (page) => {
  const before = await page.locator('[data-rg-group="1"] > .rg-inst').count();
  await page.getByTestId('rg-add-btn').click();
  await expect(page.locator('[data-rg-group="1"] > .rg-inst')).toHaveCount(before + 1);
};

// node `target` = <question> × <factor>
async function buildProduct(page, target, question, factor) {
  await openBuilder(page, target);
  const top = topChain(page);
  await pickQuestion(page, operandOf(top, 0), question);
  await modal(page).getByTestId('eb-add-operand').click();
  await pickCustomSelect(page, operatorOf(top, 0), '*');
  await pickKind(page, operandOf(top, 1), 'num');
  await setNumber(operandOf(top, 1), factor);
  await applyAndSave(page);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await freshStart(page);
});

test('each entry of a repeating group shows its own calculated value', async ({ page }) => {
  await makeForm(page, [{ title: 'Qty', type: 'integer' }, { title: 'Double', type: 'decimal' }]);
  await buildProduct(page, '1.2', '1.1', 2);
  await makeRepeatable(page, '1');
  await addEntry(page);

  await enter(page, 0, '1.1', 2);
  await enter(page, 1, '1.1', 5);
  await expect(field(page, 0, '1.2').locator('input')).toHaveValue('4');
  await expect(field(page, 1, '1.2').locator('input')).toHaveValue('10');
});

// ── The same behaviour on a loaded questionnaire: outside fields, nested repeats, totals, tables ──────────
const FIXTURE = path.resolve('tests/fixtures/calc-in-repeating-group.fhir.json');
const lines = (page) => page.locator('[data-rg-group="lines"] > .rg-inst');
const line = (page, i) => lines(page).nth(i);
const inLine = (page, i, id) => line(page, i).locator(`[data-preview-id="${id}"]`);
const total = (page, i) => inLine(page, i, 'total').locator('input');
const grand = (page) => page.locator('[data-calc-id="grand"]');
const kind = (page, i) => line(page, i).locator('[data-calc-id="kind"]');
const addLine = async (page) => {
  const before = await lines(page).count();
  await page.locator('[data-rg-group="lines"] > .repeat-add-btn').click();
  await expect(lines(page)).toHaveCount(before + 1);
};
const fillIn = async (page, locator, value) => { await locator.fill(String(value)); await commit(page); };

async function loadOrder(page) {
  await loadFixtureFile(page, FIXTURE);
  await expect(page.locator('[data-preview-id="rate"]')).toBeVisible();
  await fillIn(page, page.locator('[data-preview-id="rate"] input'), 2);
  await addLine(page);
  await fillIn(page, inLine(page, 0, 'qty').locator('input'), 3);
  await fillIn(page, inLine(page, 0, 'price').locator('input'), 10);
  await fillIn(page, inLine(page, 1, 'qty').locator('input'), 8);
  await fillIn(page, inLine(page, 1, 'price').locator('input'), 5);
}

test('every entry multiplies its own quantity and price by the rate from outside the group', async ({ page }) => {
  await loadOrder(page);
  await expect(total(page, 0)).toHaveValue('60');   // 3 x 10 x 2
  await expect(total(page, 1)).toHaveValue('80');   // 8 x 5 x 2
});

test('an entry can use a value that another calculation outside the group computed', async ({ page }) => {
  await loadOrder(page);
  await expect(inLine(page, 0, 'viaRate2').locator('input')).toHaveValue('12'); // quantity 3 x (rate 2 x 2)
  await expect(inLine(page, 1, 'viaRate2').locator('input')).toHaveValue('32'); // quantity 8 x 4
  await fillIn(page, page.locator('[data-preview-id="rate"] input'), 1);
  await expect(inLine(page, 0, 'viaRate2').locator('input')).toHaveValue('6');
  await expect(inLine(page, 1, 'viaRate2').locator('input')).toHaveValue('16');
});

test('changing one entry recalculates only that entry', async ({ page }) => {
  await loadOrder(page);
  await fillIn(page, inLine(page, 0, 'qty').locator('input'), 4);
  await expect(total(page, 0)).toHaveValue('80');
  await expect(total(page, 1)).toHaveValue('80');
  await fillIn(page, inLine(page, 1, 'price').locator('input'), 1);
  await expect(total(page, 0)).toHaveValue('80');
  await expect(total(page, 1)).toHaveValue('16');
});

test('changing the outside rate recalculates every entry', async ({ page }) => {
  await loadOrder(page);
  await fillIn(page, page.locator('[data-preview-id="rate"] input'), 3);
  await expect(total(page, 0)).toHaveValue('90');
  await expect(total(page, 1)).toHaveValue('120');
});

test('a read-only calculated text shows each entry\'s own result', async ({ page }) => {
  await loadOrder(page);
  await expect(kind(page, 0)).toHaveText('single'); // quantity 3
  await expect(kind(page, 1)).toHaveText('bulk');   // quantity 8
});

test('removing the first entry leaves the other entry with its own values', async ({ page }) => {
  await loadOrder(page);
  await line(page, 0).getByTestId('rg-remove-btn').click();
  await expect(lines(page)).toHaveCount(1);
  await expect(total(page, 0)).toHaveValue('80');
  await expect(kind(page, 0)).toHaveText('bulk');
});

test('a new entry starts blank and calculates from its own answers', async ({ page }) => {
  await loadOrder(page);
  await addLine(page);
  await expect(total(page, 2)).toHaveValue('');
  await fillIn(page, inLine(page, 2, 'qty').locator('input'), 1);
  await fillIn(page, inLine(page, 2, 'price').locator('input'), 7);
  await expect(total(page, 2)).toHaveValue('14');
  await expect(total(page, 0)).toHaveValue('60');
});

test('a total outside the group adds up the entries and follows additions and removals', async ({ page }) => {
  await loadOrder(page);
  await expect(grand(page)).toHaveText('140');
  await fillIn(page, inLine(page, 0, 'qty').locator('input'), 1);
  await expect(grand(page)).toHaveText('100');
  await line(page, 1).getByTestId('rg-remove-btn').click();
  await expect(grand(page)).toHaveText('20');
});

test('a nested repeating group uses its own answer and the answer of the entry it sits in', async ({ page }) => {
  await loadOrder(page);
  const tag = (i, j) => line(page, i).locator('[data-rg-group="tags"] > .rg-inst').nth(j);
  await line(page, 1).locator('[data-rg-group="tags"] > .repeat-add-btn').click();
  await expect(line(page, 1).locator('[data-rg-group="tags"] > .rg-inst')).toHaveCount(2);
  await fillIn(page, tag(0, 0).locator('[data-preview-id="w"] input'), 2);
  await fillIn(page, tag(1, 0).locator('[data-preview-id="w"] input'), 2);
  await fillIn(page, tag(1, 1).locator('[data-preview-id="w"] input'), 5);
  await expect(tag(0, 0).locator('[data-preview-id="w2"] input')).toHaveValue('6');   // 2 x quantity 3
  await expect(tag(1, 0).locator('[data-preview-id="w2"] input')).toHaveValue('16');  // 2 x quantity 8
  await expect(tag(1, 1).locator('[data-preview-id="w2"] input')).toHaveValue('40');  // 5 x quantity 8
});

test('rows of a repeating table each calculate from their own cells', async ({ page }) => {
  await loadFixtureFile(page, FIXTURE);
  const table = page.locator('table[data-gtable-id="rows"]');
  const rows = table.locator('tbody tr');
  await expect(rows).toHaveCount(1);
  await table.getByTestId('gtable-add-btn').click();
  await expect(rows).toHaveCount(2);
  await fillIn(page, rows.nth(0).locator('[data-preview-id="a"] input'), 2);
  await fillIn(page, rows.nth(1).locator('[data-preview-id="a"] input'), 7);
  await expect(rows.nth(0).locator('[data-preview-id="b"] input')).toHaveValue('20');
  await expect(rows.nth(1).locator('[data-preview-id="b"] input')).toHaveValue('70');
});

test('the exported response keeps each entry\'s calculated answer and loads back the same', async ({ page }) => {
  await loadOrder(page);
  await openDropdownItem(page, 'export-btn', 'export-qr-item');
  await expect(page.getByTestId('qrExportModal')).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('qrExportModalApply').click()]);
  const qrPath = await download.path();
  const qr = JSON.parse(fs.readFileSync(qrPath, 'utf8'));
  const order = qr.item.find((i) => i.linkId === 'order');
  const totals = order.item.filter((i) => i.linkId === 'lines')
    .map((l) => l.item.find((c) => c.linkId === 'total')?.answer?.[0]?.valueDecimal);
  expect(totals).toEqual([60, 80]);

  await page.addInitScript(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('[data-testid="add-menu-btn"]', { timeout: 10_000 });
  await loadFixtureFile(page, FIXTURE);
  await page.getByTestId('qr-file-input').setInputFiles(qrPath);
  await expect(lines(page)).toHaveCount(2);
  await expect(total(page, 0)).toHaveValue('60');
  await expect(total(page, 1)).toHaveValue('80');
});
