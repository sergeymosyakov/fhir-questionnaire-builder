// ── E2E: the delete confirmation is a real modal that resolves with the button pressed ──
// Esc, Cancel and the backdrop keep the node; Delete removes it.
//
// ── data-testid registry ──────────────────────────────────────────────────────
//   node-gear-btn / node-delete-btn         gear menu of a builder node and its Delete item
//   deleteConfirmModal                      the confirmation (backdrop)
//   delete-confirm-del-btn / delete-confirm-cancel-btn   its buttons
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import { freshStart, addRootGroup, addItemToGroup } from './helpers/builder.js';
import { openMenu } from './helpers/dropdown.js';

async function askToDelete(page, itemId) {
  const node = page.locator(`[data-node-id="${itemId}"]`);
  await openMenu(node.getByTestId('node-gear-btn'), node.getByTestId('node-delete-btn'));
  await node.getByTestId('node-delete-btn').click();
  await expect(page.getByTestId('deleteConfirmModal')).toBeVisible();
}

test.describe('delete confirmation', () => {
  test('Escape, Cancel and the backdrop keep the node, Delete removes it', async ({ page }) => {
    await freshStart(page);
    const groupId = await addRootGroup(page);
    const itemId = await addItemToGroup(page, groupId);
    const node = page.locator(`[data-node-id="${itemId}"]`);

    await askToDelete(page, itemId);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('deleteConfirmModal')).not.toBeVisible();
    await expect(node).toHaveCount(1);

    await askToDelete(page, itemId);
    await page.getByTestId('delete-confirm-cancel-btn').click();
    await expect(page.getByTestId('deleteConfirmModal')).not.toBeVisible();
    await expect(node).toHaveCount(1);

    await askToDelete(page, itemId);
    await page.getByTestId('deleteConfirmModal').click({ position: { x: 4, y: 4 } });
    await expect(page.getByTestId('deleteConfirmModal')).not.toBeVisible();
    await expect(node).toHaveCount(1);

    await askToDelete(page, itemId);
    await page.getByTestId('delete-confirm-del-btn').click();
    await expect(node).toHaveCount(0);
  });
});
