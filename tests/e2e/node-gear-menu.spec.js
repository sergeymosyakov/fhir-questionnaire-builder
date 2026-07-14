// ── E2E: Node gear (⚙) menu ───────────────────────────────────────────────────
// The gear button in the top-right of each builder node (in place of the old ×)
// opens a menu:
//   - group: Add Group, Add Item, Delete
//   - item:  Delete
//
// Run: npx playwright test tests/e2e/node-gear-menu.spec.js
//
// data-testid registry:
//   group-add-btn    gear button on a group (kept for continuity with add flows)
//   node-gear-btn    gear button on an item
//   add-menu-group   "Add Group" menu item (group gear)
//   add-menu-item    "Add Item" menu item (group gear)
//   node-delete-btn  "Delete" menu item (both)

import { test, expect } from '@playwright/test';
import { freshStart, addRootGroup, addItemToGroup } from './helpers/builder.js';

test.describe('Node gear menu', () => {
  test('group gear exposes Add Group, Add Item and Delete', async ({ page }) => {
    await freshStart(page);
    await addRootGroup(page);
    const group = page.locator('[data-node-id="1"]');

    await expect(async () => {
      if (!(await group.getByTestId('add-menu-item').isVisible())) {
        await group.getByTestId('group-add-btn').click();
      }
      await expect(group.getByTestId('add-menu-item')).toBeVisible();
    }).toPass();

    await expect(group.getByTestId('add-menu-group')).toHaveText('Add Group');
    await expect(group.getByTestId('add-menu-item')).toHaveText('Add Item');
    await expect(group.getByTestId('node-delete-btn')).toHaveText('Delete');
  });

  test('item gear exposes Add Item, Add Group and Delete', async ({ page }) => {
    await freshStart(page);
    await addRootGroup(page);
    const itemId = await addItemToGroup(page, '1');
    const item = page.locator(`[data-node-id="${itemId}"]`);

    await expect(async () => {
      if (!(await item.getByTestId('node-delete-btn').first().isVisible())) {
        await item.getByTestId('node-gear-btn').click();
      }
      await expect(item.getByTestId('node-delete-btn').first()).toBeVisible();
    }).toPass();

    await expect(item.getByTestId('node-delete-btn').first()).toHaveText('Delete');
    // Items now support sub-items — Add Item and Add Group are present in their gear
    await expect(item.getByTestId('add-menu-item')).toHaveCount(1);
    await expect(item.getByTestId('add-menu-group')).toHaveCount(1);
  });

  test('Add Item from group gear creates a child item with correct linkId', async ({ page }) => {
    await freshStart(page);
    await addRootGroup(page);
    const group = page.locator('[data-node-id="1"]');

    // Open gear and click Add Item
    await group.getByTestId('group-add-btn').click();
    await expect(group.getByTestId('add-menu-item')).toBeVisible();
    await group.getByTestId('add-menu-item').click();

    // New item should be 1.1
    await expect(page.locator('[data-node-id="1.1"]')).toBeVisible();
    await expect(page.locator('[data-preview-id="1.1"]')).toBeVisible();
  });

  test('Add Group from group gear creates a child group with correct linkId', async ({ page }) => {
    await freshStart(page);
    await addRootGroup(page);
    const group = page.locator('[data-node-id="1"]');

    // Open gear and click Add Group
    await group.getByTestId('group-add-btn').click();
    await expect(group.getByTestId('add-menu-group')).toBeVisible();
    await group.getByTestId('add-menu-group').click();

    // New sub-group should be 1.1
    await expect(page.locator('[data-node-id="1.1"]')).toBeVisible();
  });

  test('deleting an item via gear shows confirm dialog then removes it', async ({ page }) => {
    await freshStart(page);
    await addRootGroup(page);
    await addItemToGroup(page, '1');

    const item = page.locator('[data-node-id="1.1"]');
    await item.getByTestId('node-gear-btn').click();
    await expect(item.getByTestId('node-delete-btn').first()).toBeVisible();
    await item.getByTestId('node-delete-btn').first().click();

    // Confirm dialog appears
    await expect(page.getByTestId('delete-confirm-del-btn')).toBeVisible({ timeout: 5_000 });
    await page.getByTestId('delete-confirm-del-btn').click();

    // Item is removed from tree
    await expect(page.locator('[data-node-id="1.1"]')).toHaveCount(0, { timeout: 5_000 });
    await expect(page.locator('[data-preview-id="1.1"]')).toHaveCount(0, { timeout: 5_000 });
  });

  test('cancelling delete keeps the item', async ({ page }) => {
    await freshStart(page);
    await addRootGroup(page);
    await addItemToGroup(page, '1');

    const item = page.locator('[data-node-id="1.1"]');
    await item.getByTestId('node-gear-btn').click();
    await expect(item.getByTestId('node-delete-btn').first()).toBeVisible();
    await item.getByTestId('node-delete-btn').first().click();

    await expect(page.getByTestId('delete-confirm-cancel-btn')).toBeVisible({ timeout: 5_000 });
    await page.getByTestId('delete-confirm-cancel-btn').click();

    // Item is still there
    await expect(page.locator('[data-node-id="1.1"]')).toBeVisible();
  });

  test('deleting a group with children removes the whole subtree', async ({ page }) => {
    await freshStart(page);
    await addRootGroup(page);
    await addItemToGroup(page, '1');
    // Second item
    const group = page.locator('[data-node-id="1"]');
    await group.getByTestId('group-add-btn').click();
    await page.locator('[data-testid="add-menu-item"]').first().click();
    await expect(page.locator('[data-node-id="1.2"]')).toBeVisible();

    // Delete the group — groups use group-add-btn (not node-gear-btn) to open gear
    await page.keyboard.press('Escape');
    await expect(async () => {
      if (!(await group.getByTestId('node-delete-btn').first().isVisible())) {
        await group.getByTestId('group-add-btn').first().click();
      }
      await expect(group.getByTestId('node-delete-btn').first()).toBeVisible();
    }).toPass();
    await group.getByTestId('node-delete-btn').first().click();

    await expect(page.getByTestId('delete-confirm-del-btn')).toBeVisible({ timeout: 5_000 });
    await page.getByTestId('delete-confirm-del-btn').click();

    // Group and all children are gone
    await expect(page.locator('[data-node-id="1"]')).toHaveCount(0, { timeout: 5_000 });
    await expect(page.locator('[data-node-id="1.1"]')).toHaveCount(0, { timeout: 5_000 });
    await expect(page.locator('[data-node-id="1.2"]')).toHaveCount(0, { timeout: 5_000 });
  });

  test('adding two items results in sequential linkIds 1.1 and 1.2', async ({ page }) => {
    await freshStart(page);
    await addRootGroup(page);
    await addItemToGroup(page, '1');

    const group = page.locator('[data-node-id="1"]');
    await group.getByTestId('group-add-btn').click();
    await page.locator('[data-testid="add-menu-item"]').first().click();

    await expect(page.locator('[data-node-id="1.1"]')).toBeVisible();
    await expect(page.locator('[data-node-id="1.2"]')).toBeVisible();
  });
});
