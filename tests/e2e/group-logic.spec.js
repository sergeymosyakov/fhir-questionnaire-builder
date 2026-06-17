// ── E2E: Group AND/OR logic badge — bidirectional reactivity ──────────────────
// Verifies that changing the AND/OR selector in the builder immediately
// updates the logic badge and separator in the preview panel.
//
// data-testid registry:
//   add-root-group-btn     "+Add Root Group" toolbar button
//   group-add-btn          "+" add-child button on a group node
//   add-menu-item          "Item" option in the add-child dropdown
//   node-type-label        type label on each builder node
//   csel-drop              custom-select dropdown panel
//
// CSS classes used for assertions:
//   .preview-logic-badge   logic badge inside the group preview row
//   .logic-separator       separator between items ("AND" / "OR" text)

import { test, expect } from '@playwright/test';
import { freshStart, addRootGroup, addItemToGroup } from './helpers/builder.js';

async function addSecondItem(page, groupId) {
  const group = page.locator(`[data-node-id="${groupId}"]`);
  await group.getByTestId('group-add-btn').click();
  await page.locator('[data-testid="add-menu-item"]').first().click();
  const itemId = groupId + '.2';
  await expect(page.locator(`[data-node-id="${itemId}"]`)).toBeVisible();
  return itemId;
}

test.describe('Group AND/OR logic — preview reactivity', () => {
  test('default logic badge is "ALL items ✓" (AND)', async ({ page }) => {
    await freshStart(page);
    await addRootGroup(page);
    await addItemToGroup(page, '1');

    const badge = page.locator('.preview-logic-badge').first();
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText(/ALL items/);
  });

  test('changing to OR updates badge to "ANY item ✓" immediately', async ({ page }) => {
    await freshStart(page);
    await addRootGroup(page);
    await addItemToGroup(page, '1');
    await addSecondItem(page, '1');

    // Open the OR dropdown in the builder logic row
    const logicTrigger = page.locator('[data-node-id="1"]').getByTestId('group-logic-select');
    await logicTrigger.click();
    await page.locator('[data-testid="csel-drop"] [data-val="OR"]').click();

    // Badge should update without any other action
    const badge = page.locator('.preview-logic-badge').first();
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText(/ANY item/);
  });

  test('separator between items shows "OR" after switching to OR', async ({ page }) => {
    await freshStart(page);
    await addRootGroup(page);
    await addItemToGroup(page, '1');
    await addSecondItem(page, '1');

    const logicTrigger = page.locator('[data-node-id="1"]').getByTestId('group-logic-select');
    await logicTrigger.click();
    await page.locator('[data-testid="csel-drop"] [data-val="OR"]').click();

    const separator = page.locator('.logic-separator').first();
    await expect(separator).toHaveText('OR');
  });

  test('switching back to AND updates badge to "ALL items ✓"', async ({ page }) => {
    await freshStart(page);
    await addRootGroup(page);
    await addItemToGroup(page, '1');
    await addSecondItem(page, '1');

    const logicTrigger = page.locator('[data-node-id="1"]').getByTestId('group-logic-select');

    // Switch to OR
    await logicTrigger.click();
    await page.locator('[data-testid="csel-drop"] [data-val="OR"]').click();
    await expect(page.locator('.preview-logic-badge').first()).toHaveText(/ANY item/);

    // Switch back to AND
    await logicTrigger.click();
    await page.locator('[data-testid="csel-drop"] [data-val="AND"]').click();
    await expect(page.locator('.preview-logic-badge').first()).toHaveText(/ALL items/);
  });
});
