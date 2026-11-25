// Shared dropdown helpers for e2e specs (DropdownMenu menus and createCustomSelect selects).
//
// DropdownMenu toggle buttons (export-btn, tools-btn, load-btn, save-btn, …)
// FLIP the menu: clicking the toggle while the menu is open closes it again.
// Clicking the toggle then immediately clicking a menu item is therefore flaky
// — if the first click is missed (or a CLOSE_DROPDOWNS race fires) the item
// stays display:none and the test hangs to timeout.
//
// openDropdownItem() opens the menu retry-safely (clicking the toggle only when
// the target item is not yet visible) and then clicks the item; pickCustomSelect() does the same for custom selects.

import { expect } from '@playwright/test';

// Locator form (a gear menu scoped to one node, …): open retry-safely until `item` is visible; the caller clicks it.
export async function openMenu(toggle, item) {
  await expect(async () => {
    if (!(await item.isVisible())) await toggle.click();
    await expect(item).toBeVisible();
  }).toPass();
}

export async function openDropdownItem(page, toggleTestId, itemTestId) {
  await openMenu(page.getByTestId(toggleTestId), page.getByTestId(itemTestId));
  await page.getByTestId(itemTestId).click();
}

// `trigger` is a data-testid string or a Locator (e.g. modal-scoped). createCustomSelect triggers flip too: open retry-safely (click only while the option is hidden), then pick it in the same retry block.
export async function pickCustomSelect(page, trigger, value) {
  const option = page.locator(`[data-testid="csel-drop"] [data-val="${value}"]`);
  await expect(async () => {
    if (!(await option.isVisible())) {
      await (typeof trigger === 'string' ? page.getByTestId(trigger) : trigger).click();
    }
    await option.click({ timeout: 2_000 });
  }).toPass();
}
