// ── E2E: Default Value (initial) modal ────────────────────────────────────────
// Tests for the Default action link and its modal.
//
// Run: npx playwright test tests/e2e/initial-modal.spec.js
//
// ── data-testid used in this suite ───────────────────────────────────────────
//   add-root-group-btn    "+Add Root Group"
//   group-add-btn         "+" button on a group
//   add-menu-item         "Item" option in add-child menu
//   node-title-display    read-only title span
//   node-title-input      title textarea
//   action-default        "Default" action link on an item node
//
// ── element IDs ──────────────────────────────────────────────────────────────
//   initialModal          backdrop (display:flex when open)
//   initialModalTitle     <span> inside modal-header
//   initialModalBody      scrollable body
//   initialModalClose     × close button
//   initialModalCancel    Cancel button
//   initialModalApply     Apply button
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

/** Add group + text item, set item title. Returns { groupId, itemId }. */
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

  return { groupId: '1', itemId: '1.1' };
}

const initialModal      = (page) => page.locator('#initialModal');
const initialModalTitle = (page) => page.locator('#initialModalTitle');
const initialModalClose = (page) => page.locator('#initialModalClose');
const initialModalCancel = (page) => page.locator('#initialModalCancel');
const initialModalApply  = (page) => page.locator('#initialModalApply');

// ── Tests ──────────────────────────────────────────────────────────────────────

test.describe('Default Value modal — open / close', () => {
  test('clicking "Default" action link opens the modal', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    await page.locator('[data-node-id="1.1"]').getByTestId('action-default').click();
    await expect(initialModal(page)).toBeVisible();
  });

  test('modal title contains "Default Value" and item name', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page, 'Birth Date');

    await page.locator('[data-node-id="1.1"]').getByTestId('action-default').click();
    await expect(initialModalTitle(page)).toContainText('Default Value');
    await expect(initialModalTitle(page)).toContainText('Birth Date');
  });

  test('× button closes the modal', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    await page.locator('[data-node-id="1.1"]').getByTestId('action-default').click();
    await expect(initialModal(page)).toBeVisible();
    await initialModalClose(page).click();
    await expect(initialModal(page)).not.toBeVisible();
  });

  test('Cancel button closes the modal', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    await page.locator('[data-node-id="1.1"]').getByTestId('action-default').click();
    await expect(initialModal(page)).toBeVisible();
    await initialModalCancel(page).click();
    await expect(initialModal(page)).not.toBeVisible();
  });

  test('Escape closes the modal', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    await page.locator('[data-node-id="1.1"]').getByTestId('action-default').click();
    await expect(initialModal(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(initialModal(page)).not.toBeVisible();
  });

  test('clicking backdrop closes the modal', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    await page.locator('[data-node-id="1.1"]').getByTestId('action-default').click();
    await expect(initialModal(page)).toBeVisible();
    await initialModal(page).click({ position: { x: 5, y: 5 } });
    await expect(initialModal(page)).not.toBeVisible();
  });
});

test.describe('Default Value modal — draft pattern', () => {
  test('Cancel does not save the typed value', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    const item = page.locator('[data-node-id="1.1"]');
    await item.getByTestId('action-default').click();

    // Type a value and cancel
    const input = page.locator('#initialModalBody input, #initialModalBody textarea').first();
    await input.fill('hello world');
    await initialModalCancel(page).click();

    // Re-open: the value must not be persisted
    await item.getByTestId('action-default').click();
    await expect(page.locator('#initialModalBody input, #initialModalBody textarea').first()).toHaveValue('');
  });

  test('Apply saves the value and preview shows it pre-filled', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    await page.locator('[data-node-id="1.1"]').getByTestId('action-default').click();

    const input = page.locator('#initialModalBody input, #initialModalBody textarea').first();
    await input.fill('hello world');
    await initialModalApply(page).click();

    await expect(initialModal(page)).not.toBeVisible();

    // Preview input for the item must show the default value
    const previewInput = page.locator('[data-preview-id="1.1"]').locator('input, textarea').first();
    await expect(previewInput).toHaveValue('hello world');
  });

  test('Apply marks the "Default" action link as active', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    const item = page.locator('[data-node-id="1.1"]');
    const defaultLink = item.getByTestId('action-default');

    // Initially not active
    await expect(defaultLink).not.toHaveClass(/action-edit--active/);

    await defaultLink.click();
    const input = page.locator('#initialModalBody input, #initialModalBody textarea').first();
    await input.fill('pre-filled');
    await initialModalApply(page).click();

    // Now must be active
    await expect(defaultLink).toHaveClass(/action-edit--active/);
  });

  test('Applying empty value removes the default and deactivates action link', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    const item = page.locator('[data-node-id="1.1"]');
    const defaultLink = item.getByTestId('action-default');

    // Set a default first
    await defaultLink.click();
    await page.locator('#initialModalBody input, #initialModalBody textarea').first().fill('initial value');
    await initialModalApply(page).click();
    await expect(defaultLink).toHaveClass(/action-edit--active/);

    // Now clear it
    await defaultLink.click();
    await page.locator('#initialModalBody input, #initialModalBody textarea').first().fill('');
    await initialModalApply(page).click();

    // Must be deactivated
    await expect(defaultLink).not.toHaveClass(/action-edit--active/);
    // Preview must show empty value
    const previewInput = page.locator('[data-preview-id="1.1"]').locator('input, textarea').first();
    await expect(previewInput).toHaveValue('');
  });
});

test.describe('Default Value modal — not applicable types', () => {
  async function changeType(page, itemId, typeValue) {
    const node = page.locator(`[data-node-id="${itemId}"]`);
    await node.getByTestId('action-type').click();
    const modal = page.locator('#answerTypeModal');
    await expect(modal).toBeVisible();
    await modal.getByTestId('type-select').selectOption(typeValue);
    await page.locator('#answerTypeModalApply').click();
    await expect(modal).not.toBeVisible();
  }

  test('display type: modal shows "not applicable" message', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);
    await changeType(page, '1.1', 'display');

    await page.locator('[data-node-id="1.1"]').getByTestId('action-default').click();
    await expect(initialModal(page)).toBeVisible();
    await expect(page.locator('#initialModalBody')).toContainText('Not applicable');
    await initialModalApply(page).click();
    await expect(initialModal(page)).not.toBeVisible();
  });
});
