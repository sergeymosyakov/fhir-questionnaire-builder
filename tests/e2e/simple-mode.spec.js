// ── E2E: Simple / Advanced builder view mode ──────────────────────────────────
// The More ▾ menu offers Simple / Advanced view. Advanced (default) shows every
// per-item action link; Simple hides them (data-role="advanced-ctrl") while
// keeping the Add ▾ menu and delete button. The choice persists in localStorage.
//
// Run: npx playwright test tests/e2e/simple-mode.spec.js
//
// data-testid registry:
//   more-btn            More ▾ menu toggle
//   view-simple-item    "Simple" menu item
//   view-advanced-item  "Advanced" menu item
//   expand-all-btn      "Expand all" menu item (builder tree)
//   collapse-all-btn    "Collapse all" menu item (builder tree)
//   action-states       "States" action link on an item (advanced-ctrl, hidden in Simple)
//   group-add-btn       "+" Add child button on a group (stays visible)

import { test, expect } from '@playwright/test';
import { freshStart, addRootGroup, addItemToGroup } from './helpers/builder.js';
import { openDropdownItem } from './helpers/dropdown.js';

async function seedTree(page) {
  await freshStart(page);
  await addRootGroup(page);
  return addItemToGroup(page, '1'); // → "1.1"
}

test.describe('Simple / Advanced view mode', () => {
  test('advanced is the default — action links are visible', async ({ page }) => {
    const itemId = await seedTree(page);
    await expect(page.locator(`[data-node-id="${itemId}"]`).getByTestId('action-states')).toBeVisible();
  });

  test('switching to Simple hides action links but keeps Add ▾', async ({ page }) => {
    const itemId = await seedTree(page);
    await openDropdownItem(page, 'more-btn', 'view-simple-item');

    await expect(page.locator(`[data-node-id="${itemId}"]`).getByTestId('action-states')).toBeHidden();
    // Add ▾ on the group remains available so items/groups can still be added.
    await expect(page.locator('[data-node-id="1"]').getByTestId('group-add-btn')).toBeVisible();
  });

  test('switching back to Advanced re-shows action links', async ({ page }) => {
    const itemId = await seedTree(page);
    await openDropdownItem(page, 'more-btn', 'view-simple-item');
    await expect(page.locator(`[data-node-id="${itemId}"]`).getByTestId('action-states')).toBeHidden();

    await openDropdownItem(page, 'more-btn', 'view-advanced-item');
    await expect(page.locator(`[data-node-id="${itemId}"]`).getByTestId('action-states')).toBeVisible();
  });

  test('the active mode shows a checkmark in the menu', async ({ page }) => {
    await seedTree(page);
    await openDropdownItem(page, 'more-btn', 'view-simple-item');
    // Reopen the menu and verify Simple is checked, Advanced is not.
    await expect(async () => {
      if (!(await page.getByTestId('view-simple-item').isVisible())) {
        await page.getByTestId('more-btn').click();
      }
      await expect(page.getByTestId('view-simple-item')).toBeVisible();
    }).toPass();
    await expect(page.getByTestId('view-simple-item')).toHaveClass(/load-menu-item--checked/);
    await expect(page.getByTestId('view-advanced-item')).not.toHaveClass(/load-menu-item--checked/);
  });

  test('the Simple choice persists across reload', async ({ page }) => {
    const itemId = await seedTree(page);
    await openDropdownItem(page, 'more-btn', 'view-simple-item');
    await expect(page.locator(`[data-node-id="${itemId}"]`).getByTestId('action-states')).toBeHidden();

    await page.reload();
    await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
    await expect(page.locator(`[data-node-id="${itemId}"]`).getByTestId('action-states')).toBeHidden();
  });
});

test.describe('More menu — tree controls', () => {
  test('Collapse all then Expand all toggle group children visibility', async ({ page }) => {
    const itemId = await seedTree(page);
    await expect(page.locator(`[data-node-id="${itemId}"]`)).toBeVisible();

    await openDropdownItem(page, 'more-btn', 'collapse-all-btn');
    await expect(page.locator(`[data-node-id="${itemId}"]`)).toBeHidden();

    await openDropdownItem(page, 'more-btn', 'expand-all-btn');
    await expect(page.locator(`[data-node-id="${itemId}"]`)).toBeVisible();
  });
});
