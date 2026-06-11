// Shared dropdown-menu helper for e2e specs.
//
// DropdownMenu toggle buttons (export-btn, tools-btn, load-btn, save-btn, …)
// FLIP the menu: clicking the toggle while the menu is open closes it again.
// Clicking the toggle then immediately clicking a menu item is therefore flaky
// — if the first click is missed (or a CLOSE_DROPDOWNS race fires) the item
// stays display:none and the test hangs to timeout.
//
// openDropdownItem() opens the menu retry-safely (clicking the toggle only when
// the target item is not yet visible) and then clicks the item.

import { expect } from '@playwright/test';

export async function openDropdownItem(page, toggleTestId, itemTestId) {
  await expect(async () => {
    if (!(await page.getByTestId(itemTestId).isVisible())) {
      await page.getByTestId(toggleTestId).click();
    }
    await expect(page.getByTestId(itemTestId)).toBeVisible();
  }).toPass();
  await page.getByTestId(itemTestId).click();
}
