// ── E2E: Escape closes one layer at a time ────────────────────────────────────
// With a dropdown/picker open inside a modal, Escape must close only the
// dropdown/picker; a second Escape then closes the modal.
//
// Run: npx playwright test tests/e2e/escape-layers.spec.js
//
// ── data-testid registry ─────────────────────────────────────────────────────
//   add-root-group-btn   "+Add Root Group"
//   group-add-btn / add-menu-item   "+" on a group / "Item" option
//   action-type          "Answer Type" action link
//   answerTypeModal      Answer Type modal backdrop
//   type-select          custom type dropdown inside the Answer Type modal
//   csel-drop            open custom-select dropdown list
//   answerTypeModalApply Apply button of the Answer Type modal
//   action-default       "Default" action link
//   initialModal         Default Value modal backdrop
//   initial-date-input   date-picker trigger inside the Default Value modal
//   dp-cal               open date-picker calendar popup
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import { freshStart, addRootGroup, addItemToGroup } from './helpers/builder.js';

async function openAnswerTypeModal(page, itemId) {
  const link = page.locator(`[data-node-id="${itemId}"]`).getByTestId('action-type');
  await expect(async () => {
    await link.click();
    await expect(page.getByTestId('answerTypeModal')).toBeVisible();
  }).toPass();
}

test.describe('Escape layering', () => {
  test('Escape closes the custom-select first, the modal on the second press', async ({ page }) => {
    await freshStart(page);
    await addRootGroup(page);
    const itemId = await addItemToGroup(page, '1');
    await openAnswerTypeModal(page, itemId);

    await page.getByTestId('type-select').click();
    await expect(page.getByTestId('csel-drop')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('csel-drop')).not.toBeVisible();
    await expect(page.getByTestId('answerTypeModal')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('answerTypeModal')).not.toBeVisible();
  });

  test('Escape closes the date-picker first, the modal on the second press', async ({ page }) => {
    await freshStart(page);
    await addRootGroup(page);
    const itemId = await addItemToGroup(page, '1');
    await openAnswerTypeModal(page, itemId);
    await page.getByTestId('type-select').click();
    await page.locator('[data-testid="csel-drop"] [data-val="date"]').click();
    await page.getByTestId('answerTypeModalApply').click();
    await expect(page.getByTestId('answerTypeModal')).not.toBeVisible();

    const dflt = page.locator(`[data-node-id="${itemId}"]`).getByTestId('action-default');
    await expect(async () => {
      await dflt.click();
      await expect(page.getByTestId('initialModal')).toBeVisible();
    }).toPass();

    await page.getByTestId('initial-date-input').click();
    await expect(page.getByTestId('dp-cal')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('dp-cal')).not.toBeVisible();
    await expect(page.getByTestId('initialModal')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('initialModal')).not.toBeVisible();
  });

  test('Escape with no dropdown open closes the modal in one press', async ({ page }) => {
    await freshStart(page);
    await addRootGroup(page);
    const itemId = await addItemToGroup(page, '1');
    await openAnswerTypeModal(page, itemId);

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('answerTypeModal')).not.toBeVisible();
  });
});
