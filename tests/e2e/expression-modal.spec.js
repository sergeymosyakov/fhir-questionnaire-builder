// ── E2E: Expression modal (Calculated & Initial Expression) ───────────────────
// Tests for the "Expression" and "Init Expr" action links and their shared modal.
//
// Run: npx playwright test tests/e2e/expression-modal.spec.js
//
// ── data-testid used in this suite ───────────────────────────────────────────
//   add-root-group-btn    "+Add Root Group"
//   group-add-btn         "+" button on a group
//   add-menu-item         "Item" option in add-child menu
//   node-title-display    read-only title span
//   node-title-input      title textarea
//   action-calcexpr       "Expression" action link (calculatedExpression)
//   action-initexpr       "Init Expr" action link (initialExpression)
//
// ── element IDs ──────────────────────────────────────────────────────────────
//   expressionModal       backdrop (display:flex when open)
//   exprModalTitle        <span> inside modal-header
//   exprModalBody         scrollable body
//   exprModalClose        × close button
//   exprModalCancel       Cancel button
//   exprModalApply        Apply button
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

const exprModal       = (page) => page.locator('#expressionModal');
const exprModalTitle  = (page) => page.locator('#exprModalTitle');
const exprModalClose  = (page) => page.locator('#exprModalClose');
const exprModalCancel = (page) => page.locator('#exprModalCancel');
const exprModalApply  = (page) => page.locator('#exprModalApply');
const exprModalBody   = (page) => page.locator('#exprModalBody');

// ── Calculated Expression ──────────────────────────────────────────────────────

test.describe('Expression modal — Calculated Expression', () => {
  test('clicking "Expression" action link opens the modal', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    await page.locator('[data-node-id="1.1"]').getByTestId('action-calcexpr').click();
    await expect(exprModal(page)).toBeVisible();
  });

  test('modal title contains "Calculated Expression" and item name', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page, 'Score');

    await page.locator('[data-node-id="1.1"]').getByTestId('action-calcexpr').click();
    await expect(exprModalTitle(page)).toContainText('Calculated Expression');
    await expect(exprModalTitle(page)).toContainText('Score');
  });

  test('× button closes the modal', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    await page.locator('[data-node-id="1.1"]').getByTestId('action-calcexpr').click();
    await expect(exprModal(page)).toBeVisible();
    await exprModalClose(page).click();
    await expect(exprModal(page)).not.toBeVisible();
  });

  test('Cancel button closes the modal', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    await page.locator('[data-node-id="1.1"]').getByTestId('action-calcexpr').click();
    await expect(exprModal(page)).toBeVisible();
    await exprModalCancel(page).click();
    await expect(exprModal(page)).not.toBeVisible();
  });

  test('Escape closes the modal', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    await page.locator('[data-node-id="1.1"]').getByTestId('action-calcexpr').click();
    await expect(exprModal(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(exprModal(page)).not.toBeVisible();
  });

  test('clicking backdrop closes the modal', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    await page.locator('[data-node-id="1.1"]').getByTestId('action-calcexpr').click();
    await expect(exprModal(page)).toBeVisible();
    await exprModal(page).click({ position: { x: 5, y: 5 } });
    await expect(exprModal(page)).not.toBeVisible();
  });

  test('Cancel does not save the typed expression', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    const item = page.locator('[data-node-id="1.1"]');
    await item.getByTestId('action-calcexpr').click();

    await exprModalBody(page).locator('textarea').fill('%score * 2');
    await exprModalCancel(page).click();

    // Re-open: must be empty
    await item.getByTestId('action-calcexpr').click();
    await expect(exprModalBody(page).locator('textarea')).toHaveValue('');
  });

  test('Apply saves expression and activates the action link', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    const item       = page.locator('[data-node-id="1.1"]');
    const actionLink = item.getByTestId('action-calcexpr');

    await expect(actionLink).not.toHaveClass(/action-edit--active/);

    await actionLink.click();
    await exprModalBody(page).locator('textarea').fill('%score * 2');
    await exprModalApply(page).click();

    await expect(exprModal(page)).not.toBeVisible();
    await expect(actionLink).toHaveClass(/action-edit--active/);
  });

  test('Applying empty expression deactivates action link', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    const item       = page.locator('[data-node-id="1.1"]');
    const actionLink = item.getByTestId('action-calcexpr');

    // Set an expression first
    await actionLink.click();
    await exprModalBody(page).locator('textarea').fill('%score * 2');
    await exprModalApply(page).click();
    await expect(actionLink).toHaveClass(/action-edit--active/);

    // Clear it
    await actionLink.click();
    await exprModalBody(page).locator('textarea').fill('');
    await exprModalApply(page).click();

    await expect(actionLink).not.toHaveClass(/action-edit--active/);
  });
});

// ── Initial Expression ─────────────────────────────────────────────────────────

test.describe('Expression modal — Initial Expression', () => {
  test('clicking "Init Expr" action link opens the modal', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    await page.locator('[data-node-id="1.1"]').getByTestId('action-initexpr').click();
    await expect(exprModal(page)).toBeVisible();
  });

  test('modal title contains "Initial Expression"', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page, 'Age');

    await page.locator('[data-node-id="1.1"]').getByTestId('action-initexpr').click();
    await expect(exprModalTitle(page)).toContainText('Initial Expression');
    await expect(exprModalTitle(page)).toContainText('Age');
  });

  test('Apply saves expression and activates the action link', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    const item       = page.locator('[data-node-id="1.1"]');
    const actionLink = item.getByTestId('action-initexpr');

    await expect(actionLink).not.toHaveClass(/action-edit--active/);

    await actionLink.click();
    await exprModalBody(page).locator('textarea').fill('%age');
    await exprModalApply(page).click();

    await expect(exprModal(page)).not.toBeVisible();
    await expect(actionLink).toHaveClass(/action-edit--active/);
  });

  test('Cancel does not save the typed expression', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    const item = page.locator('[data-node-id="1.1"]');
    await item.getByTestId('action-initexpr').click();
    await exprModalBody(page).locator('textarea').fill('%age');
    await exprModalCancel(page).click();

    await expect(item.getByTestId('action-initexpr')).not.toHaveClass(/action-edit--active/);
  });
});
