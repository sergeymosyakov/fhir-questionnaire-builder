// ── E2E: Ctrl+Z keyboard scoping ─────────────────────────────────────────────
// Ctrl+Z must leave native text undo to editable fields, do nothing while a
// modal is open, and still undo the last builder change from the page body.
//
// Run: npx playwright test tests/e2e/undo-keyboard.spec.js
//
// ── data-testid registry ─────────────────────────────────────────────────────
//   add-root-group-btn   "+Add Root Group"
//   group-add-btn / add-menu-item   "+" on a group / "Item" option
//   undo-btn             undo item in the More menu (enabled once history has a step)
//   tree-container       wraps all builder nodes
//   preview-search-input preview search <input>
//   action-type / answerTypeModal / answerTypeModalCancel   Answer Type modal
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import { freshStart, addRootGroup, addItemToGroup } from './helpers/builder.js';

// History debounces 400 ms then waits for requestIdleCallback.
const HISTORY_TIMEOUT = 3_000;

const nodes = page => page.locator('[data-testid="tree-container"] [data-node-id]');

async function settle(page) {
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}

test.describe('Ctrl+Z scoping', () => {
  test('Ctrl+Z inside a text input does not undo the questionnaire', async ({ page }) => {
    await freshStart(page);
    await addRootGroup(page);
    await expect(page.getByTestId('undo-btn')).toBeEnabled({ timeout: HISTORY_TIMEOUT });

    const search = page.getByTestId('preview-search-input');
    await search.click();
    await search.pressSequentially('abc');
    await page.keyboard.press('Control+z');
    await settle(page);

    await expect(nodes(page)).toHaveCount(1);
    await expect(page.getByTestId('undo-btn')).toBeEnabled();
  });

  test('Ctrl+Z inside the inline title textarea does not undo the questionnaire', async ({ page }) => {
    await freshStart(page);
    await addRootGroup(page);
    await expect(page.getByTestId('undo-btn')).toBeEnabled({ timeout: HISTORY_TIMEOUT });

    const group = page.locator('[data-node-id="1"]');
    await expect(group.getByTestId('node-title-display').first()).toBeVisible();
    await expect(async () => {
      await group.getByTestId('node-title-display').first().click();
      await expect(group.getByTestId('node-title-input').first()).toBeVisible();
    }).toPass();
    await group.getByTestId('node-title-input').first().pressSequentially('Typed');
    await page.keyboard.press('Control+z');
    await settle(page);

    await expect(nodes(page)).toHaveCount(1);
  });

  test('Ctrl+Z on the page body still undoes the last builder change', async ({ page }) => {
    await freshStart(page);
    await addRootGroup(page);
    await expect(page.getByTestId('undo-btn')).toBeEnabled({ timeout: HISTORY_TIMEOUT });

    await page.keyboard.press('Control+z');
    await expect(nodes(page)).toHaveCount(0);
  });

  test('Ctrl+Z does nothing while a modal is open, and works after it closes', async ({ page }) => {
    await freshStart(page);
    await addRootGroup(page);
    const itemId = await addItemToGroup(page, '1');
    await expect(page.getByTestId('undo-btn')).toBeEnabled({ timeout: HISTORY_TIMEOUT });
    await expect(nodes(page)).toHaveCount(2);

    const link = page.locator(`[data-node-id="${itemId}"]`).getByTestId('action-type');
    await expect(async () => {
      await link.click();
      await expect(page.getByTestId('answerTypeModal')).toBeVisible();
    }).toPass();

    await page.keyboard.press('Control+z');
    await settle(page);
    await expect(nodes(page)).toHaveCount(2);

    await page.getByTestId('answerTypeModalCancel').click();
    await expect(page.getByTestId('answerTypeModal')).not.toBeVisible();
    await page.keyboard.press('Control+z');
    // Group + item may share one debounced history step, so only assert that something was undone.
    await expect(nodes(page)).not.toHaveCount(2);
  });
});
