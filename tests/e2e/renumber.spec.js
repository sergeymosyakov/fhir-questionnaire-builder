// ── E2E: Renumber — prefix assignment and preview reactivity ──────────────────
// Verifies that clicking "Renumber" assigns item.prefix values and the preview
// immediately reflects the new prefixes without any extra action.
//
// data-testid registry:
//   add-root-group-btn     "+Add Root Group" toolbar button
//   renumber-btn           "↺ Renumber" button in the builder toolbar
//   renumber-format        custom-select for prefix format (numbers/roman/letters)
//   node-title-display     read-only title span on a builder node
//   node-title-input       inline textarea editor for node title
//   csel-drop              custom-select dropdown panel

import { test, expect } from '@playwright/test';
import { freshStart, addRootGroup, addItemToGroup } from './helpers/builder.js';

async function addTwoItems(page) {
  await addRootGroup(page);
  await addItemToGroup(page, '1');
  // Add second item
  const group = page.locator('[data-node-id="1"]');
  await group.getByTestId('group-add-btn').click();
  // Wait for the add menu to open before clicking to avoid a click-before-open race.
  await expect(page.locator('[data-testid="add-menu-item"]').first()).toBeVisible();
  await page.locator('[data-testid="add-menu-item"]').first().click();
  await expect(page.locator('[data-node-id="1.2"]')).toBeVisible();
}

test.describe('Renumber — prefix assignment', () => {
  test('renumber assigns numeric prefixes to items', async ({ page }) => {
    await freshStart(page);
    await addTwoItems(page);

    await page.getByTestId('renumber-btn').click();

    // Wait for renumber to complete (button re-enables)
    await expect(page.getByTestId('renumber-btn')).toBeEnabled({ timeout: 8000 });

    // Builder shows prefix in the prefix input
    const item1 = page.locator('[data-node-id="1.1"]');
    const item2 = page.locator('[data-node-id="1.2"]');
    await expect(item1.locator('[data-testid="node-prefix-input"]')).toHaveValue('1.1');
    await expect(item2.locator('[data-testid="node-prefix-input"]')).toHaveValue('1.2');
  });

  test('preview shows updated prefixes after renumber', async ({ page }) => {
    await freshStart(page);
    await addTwoItems(page);

    // Set titles so we can identify items in preview
    await expect(async () => {
      await page.locator('[data-node-id="1.1"]').getByTestId('node-title-display').click();
      await expect(page.locator('[data-node-id="1.1"]').getByTestId('node-title-input')).toBeVisible();
    }).toPass();
    await page.locator('[data-node-id="1.1"]').getByTestId('node-title-input').fill('First');
    await page.locator('[data-node-id="1.1"]').getByTestId('node-title-input').blur();

    await page.getByTestId('renumber-btn').click();
    await expect(page.getByTestId('renumber-btn')).toBeEnabled({ timeout: 8000 });

    // Preview row for item 1.1 should show prefix "1.1"
    const previewRow = page.locator('[data-preview-id="1.1"]');
    await expect(previewRow.locator('.preview-prefix')).toHaveText('1.1');
  });

  test('roman numerals format produces correct prefixes', async ({ page }) => {
    await freshStart(page);
    await addTwoItems(page);

    // Select roman format
    await expect(async () => {
      if (!(await page.locator('[data-testid="csel-drop"]').isVisible())) {
        await page.getByTestId('renumber-format').click();
      }
      await expect(page.locator('[data-testid="csel-drop"]')).toBeVisible();
    }).toPass();
    await page.locator('[data-testid="csel-drop"] [data-val="roman"]').click();

    await page.getByTestId('renumber-btn').click();
    await expect(page.getByTestId('renumber-btn')).toBeEnabled({ timeout: 8000 });

    const item1 = page.locator('[data-node-id="1.1"]');
    await expect(item1.locator('[data-testid="node-prefix-input"]')).toHaveValue('I.I');
  });
});
