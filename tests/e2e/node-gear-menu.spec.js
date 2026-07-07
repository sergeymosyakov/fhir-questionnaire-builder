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

  test('item gear exposes only Delete (no add options)', async ({ page }) => {
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
    await expect(item.getByTestId('add-menu-item')).toHaveCount(0);
    await expect(item.getByTestId('add-menu-group')).toHaveCount(0);
  });
});
