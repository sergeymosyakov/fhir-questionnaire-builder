// ── E2E: Expression Builder — "repeat over answers" conditions and operand ────
// Conditions written with repeat(item) (the ASQ, PHQ and GAD templates) open as controls, not text, and
// writing them back keeps the exact expression. The parse/emit round-trips live in tests/repeat-operand.test.js.
//
// Run: npx playwright test tests/e2e/expression-builder-repeat.spec.js
//
// ── data-testid registry ──────────────────────────────────────────────────────
//   add-menu-btn                              app ready
//   action-expr / expr-calc-ta / expr-calc-ta-build-btn   value expression host
//   expressionModal(+Apply)                   expression modal
//   expressionBuilderModal(+Apply)            builder modal
//   eb-if / eb-leaf / eb-leaf-text            conditional, condition rows, a row left as text
//   eb-pipe-source / eb-pipe-reduce / eb-repeat-op / eb-repeat-value   repeat controls
//   eb-chain / eb-operand / eb-operand-kind    value chain, "Repeat over answers" in its operand list
//   action-vis / showWhenModal / enablewhen-build-btn   Show When host
//   eb-leaf-kind-repeat                       "repeat over answers" kind link of an empty condition row
//   eb-preview-str                            live expression text
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { test, expect } from '@playwright/test';
import { loadFixtureFile } from './helpers/load-fixture.js';
import { modal, makeForm, openBuilder, topChain, operandOf, pickKind } from './helpers/expr-builder.js';
import { pickCustomSelect } from './helpers/dropdown.js';

const ASQ = path.resolve('templates/asq.template.json');
const RESULT = 'asq-result'; // the calculated outcome

async function loadAsq(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-menu-btn"]', { timeout: 10_000 });
  await loadFixtureFile(page, ASQ);
  await expect(page.locator(`[data-node-id="${RESULT}"]`)).toBeVisible({ timeout: 10_000 });
}

async function openResultInBuilder(page) {
  await page.locator(`[data-node-id="${RESULT}"]`).getByTestId('action-expr').click();
  await expect(page.getByTestId('expressionModal')).toBeVisible();
  await page.getByTestId('expr-calc-ta-build-btn').click();
  await expect(modal(page)).toBeVisible();
}

test('ASQ outcome: every repeat(item) condition opens as controls, none as text', async ({ page }) => {
  await loadAsq(page);
  await openResultInBuilder(page);
  await expect(page.getByTestId('eb-if').first()).toBeVisible();
  await expect(page.getByTestId('eb-pipe-source').first()).toBeVisible();
  await expect(page.getByTestId('eb-leaf-text')).toHaveCount(0);
  expect(await page.getByTestId('eb-leaf').count()).toBeGreaterThanOrEqual(5);
  await expect(page.getByTestId('eb-preview-str')).toContainText("repeat(item).where(linkId='asq-q1')");
});

test('ASQ outcome: applying without edits keeps the expression exactly', async ({ page }) => {
  await loadAsq(page);
  await page.locator(`[data-node-id="${RESULT}"]`).getByTestId('action-expr').click();
  await expect(page.getByTestId('expressionModal')).toBeVisible();
  const before = await page.getByTestId('expr-calc-ta').inputValue();
  await page.getByTestId('expr-calc-ta-build-btn').click();
  await expect(modal(page)).toBeVisible();
  await expect(page.getByTestId('eb-leaf-text')).toHaveCount(0);
  await page.getByTestId('expressionBuilderModalApply').click();
  await expect(modal(page)).toBeHidden();
  expect(await page.getByTestId('expr-calc-ta').inputValue()).toBe(before);
});

test('a repeat condition can be edited: change the compared value and the text follows', async ({ page }) => {
  await loadAsq(page);
  await openResultInBuilder(page);
  const value = page.getByTestId('eb-repeat-value').first();
  await expect(value).toBeVisible();
  await value.fill('LA32-8');
  await expect(page.getByTestId('eb-preview-str')).toContainText("= 'LA32-8'");
});

test('a repeat condition can be built from the condition kinds', async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-menu-btn"]', { timeout: 10_000 });
  await makeForm(page, [{ title: 'Mood', type: 'select' }, { title: 'Follow-up', type: 'integer' }]);
  await page.locator('[data-node-id="1.2"]').getByTestId('action-vis').click();
  await expect(page.getByTestId('showWhenModal')).toBeVisible();
  await page.getByTestId('enablewhen-build-btn').click();
  await expect(modal(page)).toBeVisible();
  await page.getByTestId('eb-leaf-kind-repeat').click(); // the one empty condition row offers the kind
  await expect(page.getByTestId('eb-pipe-source')).toBeVisible();
  await expect(page.getByTestId('eb-pipe-reduce')).toHaveAttribute('data-value', 'exists'); // a condition asks yes/no
  await expect(page.getByTestId('eb-preview-str')).toContainText('.exists()');
  await pickCustomSelect(page, 'eb-pipe-reduce', 'count');
  await pickCustomSelect(page, 'eb-repeat-op', '>');
  await page.getByTestId('eb-repeat-value').fill('1');
  await expect(page.getByTestId('eb-preview-str')).toContainText('.count() > 1');
});

test('Repeat over answers is an operand of a value chain', async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-menu-btn"]', { timeout: 10_000 });
  await makeForm(page, [{ title: 'Mood', type: 'select' }, { title: 'Total', type: 'integer' }]);
  await openBuilder(page, '1.2');
  await pickKind(page, operandOf(topChain(page), 0), 'repeat');
  await expect(modal(page).getByTestId('eb-pipe-source')).toBeVisible();
  await pickCustomSelect(page, 'eb-pipe-reduce', 'count');
  await expect(page.getByTestId('eb-preview-str')).toContainText('.count()');
  await expect(page.getByTestId('eb-preview-str')).toContainText('repeat(item).where(linkId=');
});
