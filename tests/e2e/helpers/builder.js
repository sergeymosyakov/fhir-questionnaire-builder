// Shared page helpers for builder e2e specs.
// Imported by: builder-core, builder-enable-when, builder-patient.

import { fileURLToPath } from 'url';
import path from 'path';
import { expect } from '@playwright/test';

export const FIXTURES = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)), '../../fixtures'
);

/** Wait until the app has fully initialized (toolbar button is rendered). */
export async function waitForLoad(page) {
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
}

/** Click a boolean segmented control option. Accepts page or a scoped locator. */
export async function clickBoolOption(pageOrLocator, previewId, option) {
  await pageOrLocator.locator(`[data-preview-id="${previewId}"] .bool-seg__btn`)
    .filter({ hasText: new RegExp(`^${option}$`) })
    .click();
}

/** Assert the active segment of a boolean control equals the expected label. */
export async function expectBoolValue(pageOrLocator, previewId, expected, opts = {}) {
  await expect(
    pageOrLocator.locator(`[data-preview-id="${previewId}"] .bool-seg__btn--active`)
  ).toHaveText(expected, { timeout: 8_000, ...opts });
}

/** Start from a clean empty state: navigate and wait for the app to boot. */
export async function freshStart(page) {
  await page.goto('/');
  await waitForLoad(page);
}

/**
 * Add one root group and return its linkId (always "1" on a fresh tree).
 */
export async function addRootGroup(page) {
  await page.getByTestId('add-root-group-btn').click();
  await expect(page.locator('[data-node-id="1"]')).toBeVisible();
  return '1';
}

/**
 * Add an item child to the group with the given nodeId.
 * Returns the new item's expected linkId (groupId + ".1" for first child).
 */
export async function addItemToGroup(page, groupNodeId) {
  const group = page.locator(`[data-node-id="${groupNodeId}"]`);
  await group.getByTestId('group-add-btn').click();
  await page.locator('[data-testid="add-menu-item"]').first().click();
  const itemId = groupNodeId + '.1';
  await expect(page.locator(`[data-node-id="${itemId}"]`)).toBeVisible();
  await expect(page.locator(`[data-preview-id="${itemId}"]`)).toBeVisible();
  return itemId;
}
