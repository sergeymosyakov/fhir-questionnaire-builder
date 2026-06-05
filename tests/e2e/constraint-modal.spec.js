// ── E2E: Constraint modal ─────────────────────────────────────────────────────
// Tests for the Constraint action link and its modal.
//
// Run: npx playwright test tests/e2e/constraint-modal.spec.js
//
// ── data-testid used in this suite ───────────────────────────────────────────
//   add-root-group-btn    "+Add Root Group"
//   group-add-btn         "+" button on a group
//   add-menu-item         "Item" option in add-child menu
//   node-title-display    read-only title span
//   node-title-input      title textarea
//   action-constraint     "Constraint" action link on an item node
//
// ── element IDs ──────────────────────────────────────────────────────────────
//   constraintModal       backdrop (display:flex when open)
//   constraintModalTitle  <span> inside modal-header
//   constraintModalBody   scrollable body
//   constraintModalClose  × close button
//   constraintModalCancel Cancel button
//   constraintModalApply  Apply button
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';

// ── Shared helpers ─────────────────────────────────────────────────────────────

async function waitForLoad(page) {
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
}

async function freshStart(page) {
  await page.goto('/');
  await waitForLoad(page);
}

async function addTextItem(page, title = 'My Question') {
  await page.getByTestId('add-root-group-btn').click();
  await expect(page.locator('[data-node-id="1"]')).toBeVisible();

  const group = page.locator('[data-node-id="1"]');
  await group.getByTestId('group-add-btn').click();
  await page.locator('[data-testid="add-menu-item"]').first().click();
  await expect(page.locator('[data-node-id="1.1"]')).toBeVisible();

  if (title) {
    const item = page.locator('[data-node-id="1.1"]');
    // Wait for add-menu to fully close before clicking title
    await expect(item.getByTestId('node-title-display')).toBeVisible();
    await item.getByTestId('node-title-display').click();
    await expect(item.getByTestId('node-title-input')).toBeVisible({ timeout: 10_000 });
    await item.getByTestId('node-title-input').fill(title);
    await item.getByTestId('node-title-input').blur();
  }
}

const constraintModal       = (page) => page.locator('[data-testid="constraintModal"]');
const constraintModalTitle  = (page) => page.locator('[data-testid="constraintModalTitle"]');
const constraintModalClose  = (page) => page.locator('[data-testid="constraintModalClose"]');
const constraintModalCancel = (page) => page.locator('[data-testid="constraintModalCancel"]');
const constraintModalApply  = (page) => page.locator('[data-testid="constraintModalApply"]');
const constraintModalBody   = (page) => page.locator('[data-testid="constraintModalBody"]');

// ── Tests ──────────────────────────────────────────────────────────────────────

test.describe('Constraint modal — open / close', () => {
  test('clicking "Constraint" action link opens the modal', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page, null);

    await page.locator('[data-node-id="1.1"]').getByTestId('action-constraint').click();
    await expect(constraintModal(page)).toBeVisible();
  });

  test('modal title contains "Constraints" and item name', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page, 'Allergy Check');

    await page.locator('[data-node-id="1.1"]').getByTestId('action-constraint').click();
    await expect(constraintModalTitle(page)).toContainText('Constraints');
    await expect(constraintModalTitle(page)).toContainText('Allergy Check');
  });

  test('empty state shows "No constraints" message', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    await page.locator('[data-node-id="1.1"]').getByTestId('action-constraint').click();
    await expect(constraintModalBody(page)).toContainText('No constraints');
  });

  test('× button closes the modal', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    await page.locator('[data-node-id="1.1"]').getByTestId('action-constraint').click();
    await expect(constraintModal(page)).toBeVisible();
    await constraintModalClose(page).click();
    await expect(constraintModal(page)).not.toBeVisible();
  });

  test('Cancel button closes the modal', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    await page.locator('[data-node-id="1.1"]').getByTestId('action-constraint').click();
    await expect(constraintModal(page)).toBeVisible();
    await constraintModalCancel(page).click();
    await expect(constraintModal(page)).not.toBeVisible();
  });

  test('Escape closes the modal', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    await page.locator('[data-node-id="1.1"]').getByTestId('action-constraint').click();
    await expect(constraintModal(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(constraintModal(page)).not.toBeVisible();
  });

  test('clicking backdrop closes the modal', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    await page.locator('[data-node-id="1.1"]').getByTestId('action-constraint').click();
    await expect(constraintModal(page)).toBeVisible();
    await constraintModal(page).click({ position: { x: 5, y: 5 } });
    await expect(constraintModal(page)).not.toBeVisible();
  });
});

test.describe('Constraint modal — draft pattern', () => {
  test('clicking "+ Add constraint" adds a constraint card', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    await page.locator('[data-node-id="1.1"]').getByTestId('action-constraint').click();
    await constraintModalBody(page).getByText('+ Add constraint').click();
    await expect(constraintModalBody(page).locator('.constraint-card')).toHaveCount(1);
  });

  test('Cancel after adding does not save the constraint', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    const item = page.locator('[data-node-id="1.1"]');
    await item.getByTestId('action-constraint').click();
    await constraintModalBody(page).getByText('+ Add constraint').click();
    await constraintModalCancel(page).click();

    // Re-open: still empty
    await item.getByTestId('action-constraint').click();
    await expect(constraintModalBody(page)).toContainText('No constraints');
  });

  test('Apply saves the constraint and activates action link', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    const item       = page.locator('[data-node-id="1.1"]');
    const actionLink = item.getByTestId('action-constraint');

    await expect(actionLink).not.toHaveClass(/action-edit--active/);

    await actionLink.click();
    await constraintModalBody(page).getByText('+ Add constraint').click();

    // Fill key and message
    const keyInp = constraintModalBody(page).locator('input[placeholder*="key"]').first();
    await keyInp.fill('my-rule');
    const msgInp = constraintModalBody(page).locator('input[placeholder*="message"]').first();
    await msgInp.fill('Must satisfy rule');

    await constraintModalApply(page).click();
    await expect(constraintModal(page)).not.toBeVisible();
    await expect(actionLink).toHaveClass(/action-edit--active/);
  });

  test('Removing all constraints and applying deactivates action link', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    const item       = page.locator('[data-node-id="1.1"]');
    const actionLink = item.getByTestId('action-constraint');

    // Add one constraint first
    await actionLink.click();
    await constraintModalBody(page).getByText('+ Add constraint').click();
    await constraintModalApply(page).click();
    await expect(actionLink).toHaveClass(/action-edit--active/);

    // Open again and remove the card
    await actionLink.click();
    await constraintModalBody(page).locator('.vis-cond-rm').first().click();
    await constraintModalApply(page).click();

    await expect(actionLink).not.toHaveClass(/action-edit--active/);
  });
});
