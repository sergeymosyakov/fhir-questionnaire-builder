// ── E2E: States modal (Required / Read-only / Hidden) ─────────────────────────
// Tests for the "States" action button and combined states modal.
//
// The States button replaces the old separate Required, Read-only, and Hidden
// buttons. It opens a single modal with:
//   • Required select (null / true / false) — items and groups
//   • Read-only checkbox                    — items only (hidden for groups)
//   • Hidden checkbox                       — items and groups
//
// Run: npx playwright test tests/e2e/states-modal.spec.js
//
// ── data-testid registry ─────────────────────────────────────────────────────
//   add-root-group-btn     "+Add Root Group"
//   group-add-btn          "+" button on a group
//   add-menu-item          "Item" option in add-child menu
//   node-title-display     read-only title span
//   action-states          "States" action link on an item or group node
//   states-required-sel    custom select trigger for Required field
//   states-readonly-chk    checkbox for Read-only flag (items only)
//   states-hidden-chk      checkbox for Hidden flag
//
// ── element IDs ──────────────────────────────────────────────────────────────
//   statesModal            backdrop (display:flex when open)
//   statesModalTitle       <span> inside modal-header
//   statesModalClose       × close button
//   statesModalCancel      Cancel button
//   statesModalApply       Apply button
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';

async function waitForLoad(page) {
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
}

async function freshStart(page) {
  await page.goto('/');
  await waitForLoad(page);
}

/** Add root group + text item. Returns [groupId, itemId]. */
async function addGroupAndItem(page) {
  await page.getByTestId('add-root-group-btn').click();
  await expect(page.locator('[data-node-id="1"]')).toBeVisible();
  const group = page.locator('[data-node-id="1"]');
  await group.getByTestId('group-add-btn').click();
  await page.locator('[data-testid="add-menu-item"]').first().click();
  await expect(page.locator('[data-node-id="1.1"]')).toBeVisible();
  return ['1', '1.1'];
}

async function selectCustomOpt(page, triggerLoc, value) {
  await triggerLoc.click();
  await page.locator(`[data-testid="csel-drop"] [data-val="${value}"]`).click();
}

const modal       = (page) => page.locator('[data-testid="statesModal"]');
const modalTitle  = (page) => page.locator('[data-testid="statesModalTitle"]');
const modalClose  = (page) => page.locator('[data-testid="statesModalClose"]');
const modalCancel = (page) => page.locator('[data-testid="statesModalCancel"]');
const modalApply  = (page) => page.locator('[data-testid="statesModalApply"]');
const reqSel      = (page) => page.locator('[data-testid="states-required-sel"]');
const roChk       = (page) => page.locator('[data-testid="states-readonly-chk"]');
const hidChk      = (page) => page.locator('[data-testid="states-hidden-chk"]');

// ── open / close ──────────────────────────────────────────────────────────────

test.describe('States modal — open / close', () => {
  test('clicking "States" on an item opens the modal', async ({ page }) => {
    await freshStart(page);
    await addGroupAndItem(page);
    await page.locator('[data-node-id="1.1"]').getByTestId('action-states').click();
    await expect(modal(page)).toBeVisible();
  });

  test('modal title contains "States" and item name', async ({ page }) => {
    await freshStart(page);
    await addGroupAndItem(page);
    const item = page.locator('[data-node-id="1.1"]');
    await item.getByTestId('node-title-display').click();
    await item.getByTestId('node-title-input').fill('Blood pressure');
    await item.getByTestId('node-title-input').blur();

    await item.getByTestId('action-states').click();
    await expect(modalTitle(page)).toContainText('States');
    await expect(modalTitle(page)).toContainText('Blood pressure');
  });

  test('close via × button hides the modal', async ({ page }) => {
    await freshStart(page);
    await addGroupAndItem(page);
    await page.locator('[data-node-id="1.1"]').getByTestId('action-states').click();
    await modalClose(page).click();
    await expect(modal(page)).toBeHidden();
  });

  test('close via Cancel hides the modal', async ({ page }) => {
    await freshStart(page);
    await addGroupAndItem(page);
    await page.locator('[data-node-id="1.1"]').getByTestId('action-states').click();
    await modalCancel(page).click();
    await expect(modal(page)).toBeHidden();
  });

  test('close via Escape hides the modal', async ({ page }) => {
    await freshStart(page);
    await addGroupAndItem(page);
    await page.locator('[data-node-id="1.1"]').getByTestId('action-states').click();
    await page.keyboard.press('Escape');
    await expect(modal(page)).toBeHidden();
  });
});

// ── item layout ───────────────────────────────────────────────────────────────

test.describe('States modal — item layout', () => {
  test('shows Required select, Read-only checkbox, and Hidden checkbox for items', async ({ page }) => {
    await freshStart(page);
    await addGroupAndItem(page);
    await page.locator('[data-node-id="1.1"]').getByTestId('action-states').click();
    await expect(reqSel(page)).toBeVisible();
    await expect(roChk(page)).toBeVisible();
    await expect(hidChk(page)).toBeVisible();
  });

  test('Required select has 3 options', async ({ page }) => {
    await freshStart(page);
    await addGroupAndItem(page);
    await page.locator('[data-node-id="1.1"]').getByTestId('action-states').click();
    await reqSel(page).click();
    await expect(page.locator('[data-testid="csel-drop"] [data-val]')).toHaveCount(3);
    await page.keyboard.press('Escape');
  });
});

// ── group layout ──────────────────────────────────────────────────────────────

test.describe('States modal — group layout', () => {
  test('shows Required select and Hidden checkbox for groups (no Read-only)', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.locator('[data-node-id="1"]')).toBeVisible();

    await page.locator('[data-node-id="1"]').getByTestId('action-states').click();
    await expect(modal(page)).toBeVisible();
    await expect(reqSel(page)).toBeVisible();
    await expect(hidChk(page)).toBeVisible();
    await expect(roChk(page)).toBeHidden();
  });
});

// ── Read-only toggle ──────────────────────────────────────────────────────────

test.describe('States modal — Read-only', () => {
  test('checking Read-only and applying marks States link active', async ({ page }) => {
    await freshStart(page);
    await addGroupAndItem(page);
    const actionLink = page.locator('[data-node-id="1.1"]').getByTestId('action-states');
    await actionLink.click();
    await roChk(page).check();
    await modalApply(page).click();
    await expect(modal(page)).toBeHidden();
    await expect(actionLink).toHaveClass(/action-edit--active/);
  });

  test('Cancel does not save Read-only change', async ({ page }) => {
    await freshStart(page);
    await addGroupAndItem(page);
    const actionLink = page.locator('[data-node-id="1.1"]').getByTestId('action-states');
    await actionLink.click();
    await roChk(page).check();
    await modalCancel(page).click();
    await expect(actionLink).not.toHaveClass(/action-edit--active/);
  });

  test('re-opening reflects saved Read-only state', async ({ page }) => {
    await freshStart(page);
    await addGroupAndItem(page);
    const actionLink = page.locator('[data-node-id="1.1"]').getByTestId('action-states');

    await actionLink.click();
    await roChk(page).check();
    await modalApply(page).click();

    await actionLink.click();
    await expect(roChk(page)).toBeChecked();
    await modalCancel(page).click();
  });

  test('unchecking Read-only and applying deactivates link when no other state set', async ({ page }) => {
    await freshStart(page);
    await addGroupAndItem(page);
    const actionLink = page.locator('[data-node-id="1.1"]').getByTestId('action-states');

    // First: set Read-only
    await actionLink.click();
    await roChk(page).check();
    await modalApply(page).click();
    await expect(actionLink).toHaveClass(/action-edit--active/);

    // Then: uncheck Read-only
    await actionLink.click();
    await roChk(page).uncheck();
    await modalApply(page).click();
    await expect(actionLink).not.toHaveClass(/action-edit--active/);
  });
});

// ── Hidden toggle ─────────────────────────────────────────────────────────────

test.describe('States modal — Hidden', () => {
  test('checking Hidden and applying marks States link active', async ({ page }) => {
    await freshStart(page);
    await addGroupAndItem(page);
    const actionLink = page.locator('[data-node-id="1.1"]').getByTestId('action-states');
    await actionLink.click();
    await hidChk(page).check();
    await modalApply(page).click();
    await expect(modal(page)).toBeHidden();
    await expect(actionLink).toHaveClass(/action-edit--active/);
  });

  test('Cancel does not save Hidden change', async ({ page }) => {
    await freshStart(page);
    await addGroupAndItem(page);
    const actionLink = page.locator('[data-node-id="1.1"]').getByTestId('action-states');
    await actionLink.click();
    await hidChk(page).check();
    await modalCancel(page).click();
    await expect(actionLink).not.toHaveClass(/action-edit--active/);
  });

  test('re-opening reflects saved Hidden state', async ({ page }) => {
    await freshStart(page);
    await addGroupAndItem(page);
    const actionLink = page.locator('[data-node-id="1.1"]').getByTestId('action-states');

    await actionLink.click();
    await hidChk(page).check();
    await modalApply(page).click();

    await actionLink.click();
    await expect(hidChk(page)).toBeChecked();
    await modalCancel(page).click();
  });

  test('hidden item shows dimmed in preview', async ({ page }) => {
    await freshStart(page);
    await addGroupAndItem(page);
    const actionLink = page.locator('[data-node-id="1.1"]').getByTestId('action-states');
    await actionLink.click();
    await hidChk(page).check();
    await modalApply(page).click();
    await expect(page.locator('[data-preview-id="1.1"]')).toHaveClass(/lform-item--hidden/);
  });
});

// ── Combined states ───────────────────────────────────────────────────────────

test.describe('States modal — combined states', () => {
  test('link active when Required=true AND Hidden (both set)', async ({ page }) => {
    await freshStart(page);
    await addGroupAndItem(page);
    const actionLink = page.locator('[data-node-id="1.1"]').getByTestId('action-states');
    await actionLink.click();
    await selectCustomOpt(page, reqSel(page), 'true');
    await hidChk(page).check();
    await modalApply(page).click();
    await expect(actionLink).toHaveClass(/action-edit--active/);
  });

  test('link inactive when all states cleared', async ({ page }) => {
    await freshStart(page);
    await addGroupAndItem(page);
    const actionLink = page.locator('[data-node-id="1.1"]').getByTestId('action-states');

    // Set Required=true and Hidden
    await actionLink.click();
    await selectCustomOpt(page, reqSel(page), 'true');
    await hidChk(page).check();
    await modalApply(page).click();
    await expect(actionLink).toHaveClass(/action-edit--active/);

    // Clear both
    await actionLink.click();
    await selectCustomOpt(page, reqSel(page), 'null');
    await hidChk(page).uncheck();
    await modalApply(page).click();
    await expect(actionLink).not.toHaveClass(/action-edit--active/);
  });
});
