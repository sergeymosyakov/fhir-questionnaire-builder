// ── E2E: Show When (enableWhen) modal ─────────────────────────────────────────
// Tests for the "Show When" action link and its modal.
//
// Run: npx playwright test tests/e2e/showwhen-modal.spec.js
//
// ── data-testid used in this suite ───────────────────────────────────────────
//   add-root-group-btn    "+Add Root Group"
//   group-add-btn         "+" button on a group
//   add-menu-item         "Item" option in add-child menu
//   node-title-display    read-only title span
//   node-title-input      title textarea
//   action-vis            "Show When" action link on an item node
//
// ── element IDs ──────────────────────────────────────────────────────────────
//   showWhenModal         backdrop (display:flex when open)
//   showWhenModalTitle    <span> inside modal-header
//   showWhenModalBody     scrollable body
//   showWhenModalClose    × close button
//   showWhenModalCancel   Cancel button
//   showWhenModalApply    Apply button
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
    await item.getByTestId('node-title-display').click();
    await item.getByTestId('node-title-input').fill(title);
    await item.getByTestId('node-title-input').blur();
  }
}

const showWhenModal       = (page) => page.locator('#showWhenModal');
const showWhenModalTitle  = (page) => page.locator('#showWhenModalTitle');
const showWhenModalClose  = (page) => page.locator('#showWhenModalClose');
const showWhenModalCancel = (page) => page.locator('#showWhenModalCancel');
const showWhenModalApply  = (page) => page.locator('#showWhenModalApply');
const showWhenModalBody   = (page) => page.locator('#showWhenModalBody');

// ── Tests ──────────────────────────────────────────────────────────────────────

test.describe('Show When modal — open / close', () => {
  test('clicking "Show When" action link opens the modal', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    await page.locator('[data-node-id="1.1"]').getByTestId('action-vis').click();
    await expect(showWhenModal(page)).toBeVisible();
  });

  test('modal title contains "Show When" and item name', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page, 'Visible When');

    await page.locator('[data-node-id="1.1"]').getByTestId('action-vis').click();
    await expect(showWhenModalTitle(page)).toContainText('Show When');
    await expect(showWhenModalTitle(page)).toContainText('Visible When');
  });

  test('× button closes the modal', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    await page.locator('[data-node-id="1.1"]').getByTestId('action-vis').click();
    await expect(showWhenModal(page)).toBeVisible();
    await showWhenModalClose(page).click();
    await expect(showWhenModal(page)).not.toBeVisible();
  });

  test('Cancel button closes the modal', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    await page.locator('[data-node-id="1.1"]').getByTestId('action-vis').click();
    await expect(showWhenModal(page)).toBeVisible();
    await showWhenModalCancel(page).click();
    await expect(showWhenModal(page)).not.toBeVisible();
  });

  test('Escape closes the modal', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    await page.locator('[data-node-id="1.1"]').getByTestId('action-vis').click();
    await expect(showWhenModal(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(showWhenModal(page)).not.toBeVisible();
  });

  test('clicking backdrop closes the modal', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    await page.locator('[data-node-id="1.1"]').getByTestId('action-vis').click();
    await expect(showWhenModal(page)).toBeVisible();
    await showWhenModal(page).click({ position: { x: 5, y: 5 } });
    await expect(showWhenModal(page)).not.toBeVisible();
  });
});

test.describe('Show When modal — draft pattern', () => {
  test('modal body contains "+ Add condition" button', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    await page.locator('[data-node-id="1.1"]').getByTestId('action-vis').click();
    await expect(showWhenModalBody(page).getByText('+ Add condition')).toBeVisible();
  });

  test('Cancel after adding condition does not save', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    const item       = page.locator('[data-node-id="1.1"]');
    const actionLink = item.getByTestId('action-vis');

    await actionLink.click();
    await showWhenModalBody(page).getByText('+ Add condition').click();
    await showWhenModalCancel(page).click();

    // Action link must remain inactive
    await expect(actionLink).not.toHaveClass(/action-edit--active/);
  });

  test('Apply with a condition activates the action link', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    const item       = page.locator('[data-node-id="1.1"]');
    const actionLink = item.getByTestId('action-vis');

    await expect(actionLink).not.toHaveClass(/action-edit--active/);

    await actionLink.click();
    await showWhenModalBody(page).getByText('+ Add condition').click();
    await showWhenModalApply(page).click();

    await expect(showWhenModal(page)).not.toBeVisible();
    await expect(actionLink).toHaveClass(/action-edit--active/);
  });

  test('Apply using enableWhenExpression activates the action link', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    const item       = page.locator('[data-node-id="1.1"]');
    const actionLink = item.getByTestId('action-vis');

    await actionLink.click();
    // Fill the enableWhenExpression textarea
    const exprInput = showWhenModalBody(page).locator('textarea').last();
    await exprInput.fill('%age > 18');
    await showWhenModalApply(page).click();

    await expect(showWhenModal(page)).not.toBeVisible();
    await expect(actionLink).toHaveClass(/action-edit--active/);
  });

  test('Removing all conditions and applying deactivates action link', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    const item       = page.locator('[data-node-id="1.1"]');
    const actionLink = item.getByTestId('action-vis');

    // Add condition and apply
    await actionLink.click();
    await showWhenModalBody(page).getByText('+ Add condition').click();
    await showWhenModalApply(page).click();
    await expect(actionLink).toHaveClass(/action-edit--active/);

    // Open again and remove condition
    await actionLink.click();
    await showWhenModalBody(page).locator('.vis-cond-rm').first().click();
    await showWhenModalApply(page).click();

    await expect(actionLink).not.toHaveClass(/action-edit--active/);
  });
});
