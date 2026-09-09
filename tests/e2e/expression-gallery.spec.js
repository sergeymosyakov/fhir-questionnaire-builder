// ── E2E: Expression Gallery (issue #122) ──────────────────────────────────────
// Pick a named FHIRPath pattern from the gallery, fill its slots, and confirm
// the resolved expression lands in the calculatedExpression textarea.
//
// Run: npx playwright test tests/e2e/expression-gallery.spec.js
//
// ── data-testid used in this suite ───────────────────────────────────────────
//   add-root-group-btn / group-add-btn / add-menu-item / node-title-*   builder
//   action-type / answerTypeModal / type-select / answerTypeModalApply  item type
//   action-expr / expr-calc-ta / expr-calc-ta-build-btn                 value host
//   expressionBuilderModal / eb-choose-gallery                          builder entry
//   expressionGalleryModal / eg-search / eg-row-<id> / eg-slot-item-<key> /
//     eg-slot-transform-<key> / eg-preview / expressionGalleryModalApply gallery modal
//   csel-drop [data-val]                                                custom-select option
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';

async function freshStart(page) {
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
}

async function addItem(page, groupId, nodeId, title) {
  await page.locator(`[data-node-id="${groupId}"]`).getByTestId('group-add-btn').click();
  await page.locator('[data-testid="add-menu-item"]').first().click();
  const item = page.locator(`[data-node-id="${nodeId}"]`);
  await expect(item.getByTestId('action-vis')).toBeVisible();
  await expect(item.getByTestId('node-title-display')).toBeVisible();
  await expect(async () => {
    await item.getByTestId('node-title-display').click();
    await expect(item.getByTestId('node-title-input')).toBeVisible();
  }).toPass();
  await item.getByTestId('node-title-input').fill(title);
  await item.getByTestId('node-title-input').blur();
}

async function setItemType(page, nodeId, typeValue) {
  await page.locator(`[data-node-id="${nodeId}"]`).getByTestId('action-type').click();
  await expect(page.getByTestId('answerTypeModal')).toBeVisible();
  await page.getByTestId('type-select').click();
  await page.locator(`[data-testid="csel-drop"] [data-val="${typeValue}"]`).click();
  await page.getByTestId('answerTypeModalApply').click();
  await expect(page.getByTestId('answerTypeModal')).toBeHidden();
}

async function pick(scope, page, testid, value) {
  await scope.getByTestId(testid).click();
  const opt = page.locator('[data-testid="csel-drop"]').locator(`[data-val="${value}"]`);
  await expect(opt).toBeVisible();
  await opt.click();
}

async function openValueBuilder(page, nodeId) {
  const exprLink = page.locator(`[data-node-id="${nodeId}"]`).getByTestId('action-expr');
  await expect(exprLink).toBeVisible();
  await exprLink.click();
  await expect(page.getByTestId('expressionModal')).toBeVisible();
  await page.getByTestId('expr-calc-ta-build-btn').click();
  await expect(page.getByTestId('expressionBuilderModal')).toBeVisible();
}

test.describe('Expression Gallery', () => {
  test('BMI pattern with unit conversion resolves into the calculatedExpression field', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.locator('[data-node-id="1"]')).toBeVisible();
    await addItem(page, '1', '1.1', 'Weight');
    await setItemType(page, '1.1', 'decimal');
    await addItem(page, '1', '1.2', 'Height');
    await setItemType(page, '1.2', 'decimal');
    await addItem(page, '1', '1.3', 'BMI');
    await setItemType(page, '1.3', 'decimal');

    await openValueBuilder(page, '1.3');
    await page.getByTestId('eb-choose-gallery').click();
    await expect(page.getByTestId('expressionGalleryModal')).toBeVisible();
    await page.getByTestId('eg-row-bmi').click();

    await pick(page, page, 'eg-slot-item-weight', '1.1');
    await pick(page, page, 'eg-slot-transform-weight', 'lb');
    await pick(page, page, 'eg-slot-item-height', '1.2');
    await pick(page, page, 'eg-slot-transform-height', 'cm');

    await expect(page.getByTestId('eg-preview')).toContainText('0.453592');
    await expect(page.getByTestId('eg-preview')).toContainText('round(1)');

    await page.getByTestId('expressionGalleryModalApply').click();
    await expect(page.getByTestId('expressionGalleryModal')).toBeHidden();
    await expect(page.getByTestId('expressionBuilderModal')).toBeVisible();
    await expect(page.getByTestId('eb-raw-input')).toContainText("linkId='1.1'");
    await expect(page.getByTestId('eb-raw-input')).toContainText("linkId='1.2'");

    await page.getByTestId('expressionBuilderModalApply').click();
    await expect(page.getByTestId('expressionBuilderModal')).toBeHidden();
    await expect(page.getByTestId('expr-calc-ta')).toHaveValue(/round\(1\)/);
  });

  test('bmi-imperial pattern resolves without unit conversion (already lb/in)', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.locator('[data-node-id="1"]')).toBeVisible();
    await addItem(page, '1', '1.1', 'Weight');
    await setItemType(page, '1.1', 'decimal');
    await addItem(page, '1', '1.2', 'Height');
    await setItemType(page, '1.2', 'decimal');
    await addItem(page, '1', '1.3', 'BMI');
    await setItemType(page, '1.3', 'decimal');

    await openValueBuilder(page, '1.3');
    await page.getByTestId('eb-choose-gallery').click();
    await expect(page.getByTestId('expressionGalleryModal')).toBeVisible();
    await page.getByTestId('eg-row-bmi-imperial').click();

    await pick(page, page, 'eg-slot-item-weight', '1.1');
    await pick(page, page, 'eg-slot-item-height', '1.2');

    await expect(page.getByTestId('eg-preview')).toContainText('703');
    await expect(page.getByTestId('eg-preview')).not.toContainText('0.453592');

    await page.getByTestId('expressionGalleryModalApply').click();
    await page.getByTestId('expressionBuilderModalApply').click();
    await expect(page.getByTestId('expr-calc-ta')).toHaveValue(/703/);
  });

  test('gallery Cancel returns to the builder chooser without inserting anything', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.locator('[data-node-id="1"]')).toBeVisible();
    await addItem(page, '1', '1.1', 'Score');
    await setItemType(page, '1.1', 'decimal');

    await openValueBuilder(page, '1.1');
    await page.getByTestId('eb-choose-gallery').click();
    await expect(page.getByTestId('expressionGalleryModal')).toBeVisible();
    await page.getByTestId('expressionGalleryModalCancel').click();
    await expect(page.getByTestId('expressionGalleryModal')).toBeHidden();
    await expect(page.getByTestId('expressionBuilderModal')).toBeVisible();
    await expect(page.getByTestId('expr-calc-ta')).toHaveValue('');
  });

  test('search filters the pattern list by name/description', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.locator('[data-node-id="1"]')).toBeVisible();
    await addItem(page, '1', '1.1', 'Score');
    await setItemType(page, '1.1', 'decimal');

    await openValueBuilder(page, '1.1');
    await page.getByTestId('eb-choose-gallery').click();
    await expect(page.getByTestId('expressionGalleryModal')).toBeVisible();

    await expect(page.getByTestId('eg-row-bmi')).toBeVisible();
    await expect(page.getByTestId('eg-row-age-from-birthdate')).toBeVisible();

    await page.getByTestId('eg-search').fill('body mass');
    await expect(page.getByTestId('eg-row-bmi')).toBeVisible();
    await expect(page.getByTestId('eg-row-age-from-birthdate')).toBeHidden();

    await page.getByTestId('eg-search').fill('nonexistent pattern xyz');
    await expect(page.getByTestId('eg-search-empty')).toBeVisible();
  });
});
