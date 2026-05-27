// ── E2E: Required (mandatory) modal ──────────────────────────────────────────
// Tests for the Required action link and its modal.
//
// Run: npx playwright test tests/e2e/required-modal.spec.js
//
// ── data-testid used in this suite ───────────────────────────────────────────
//   add-root-group-btn    "+Add Root Group"
//   group-add-btn         "+" button on a group
//   add-menu-item         "Item" option in add-child menu
//   node-title-display    read-only title span
//   node-title-input      title textarea
//   action-states           "Required" action link on an item node
//   required-sel          custom select trigger inside the modal body
//
// ── element IDs ──────────────────────────────────────────────────────────────
//   statesModal         backdrop (display:flex when open)
//   statesModalTitle    <span> inside modal-header
//   statesModalBody     scrollable body
//   statesModalClose    × close button
//   statesModalCancel   Cancel button
//   statesModalApply    Apply button
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';

/** Pick an option from an open custom-select portal. */
async function selectCustomOpt(page, triggerLoc, value) {
  await triggerLoc.click();
  await page.locator(`[data-testid="csel-drop"] [data-val="${value}"]`).click();
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

async function waitForLoad(page) {
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
}

async function freshStart(page) {
  await page.goto('/');
  await waitForLoad(page);
}

/** Add group + text item, set item title. */
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

const modal       = (page) => page.locator('[data-testid="statesModal"]');
const modalTitle  = (page) => page.locator('[data-testid="statesModalTitle"]');
const modalClose  = (page) => page.locator('[data-testid="statesModalClose"]');
const modalCancel = (page) => page.locator('[data-testid="statesModalCancel"]');
const modalApply  = (page) => page.locator('[data-testid="statesModalApply"]');
const requiredSel = (page) => page.locator('[data-testid="states-required-sel"]');

// ── Open / close ──────────────────────────────────────────────────────────────

test.describe('Required modal — open / close', () => {
  test('clicking "Required" action link opens the modal', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    await page.locator('[data-node-id="1.1"]').getByTestId('action-states').click();
    await expect(modal(page)).toBeVisible();
  });

  test('modal title contains "Required" and item name', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page, 'Smoking status');

    await page.locator('[data-node-id="1.1"]').getByTestId('action-states').click();
    await expect(modalTitle(page)).toContainText('States');
    await expect(modalTitle(page)).toContainText('Smoking status');
  });

  test('modal body contains a custom select with 2 options', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    await page.locator('[data-node-id="1.1"]').getByTestId('action-states').click();
    await expect(requiredSel(page)).toBeVisible();
    await requiredSel(page).click();
    await expect(page.locator('[data-testid="csel-drop"] [data-val]')).toHaveCount(2);
    await page.keyboard.press('Escape');
  });

  test('close via × button hides the modal', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    await page.locator('[data-node-id="1.1"]').getByTestId('action-states').click();
    await modalClose(page).click();
    await expect(modal(page)).toBeHidden();
  });

  test('close via Cancel button hides the modal', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    await page.locator('[data-node-id="1.1"]').getByTestId('action-states').click();
    await modalCancel(page).click();
    await expect(modal(page)).toBeHidden();
  });

  test('close via Escape key hides the modal', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    await page.locator('[data-node-id="1.1"]').getByTestId('action-states').click();
    await page.keyboard.press('Escape');
    await expect(modal(page)).toBeHidden();
  });

  test('close via backdrop click hides the modal', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    await page.locator('[data-node-id="1.1"]').getByTestId('action-states').click();
    await modal(page).click({ position: { x: 5, y: 400 } });
    await expect(modal(page)).toBeHidden();
  });
});

// ── Draft pattern ─────────────────────────────────────────────────────────────

test.describe('Required modal — draft pattern', () => {
  test('Cancel does not save selection change', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    const actionLink = page.locator('[data-node-id="1.1"]').getByTestId('action-states');
    await actionLink.click();

    // Change to "Yes — required"
    await selectCustomOpt(page, requiredSel(page), 'true');
    await modalCancel(page).click();

    // Link should NOT be active (no save happened)
    await expect(actionLink).not.toHaveClass(/action-edit--active/);
  });

  test('Apply saves "Yes — required" and marks link active', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    const actionLink = page.locator('[data-node-id="1.1"]').getByTestId('action-states');
    await actionLink.click();

    await selectCustomOpt(page, requiredSel(page), 'true');
    await modalApply(page).click();

    await expect(modal(page)).toBeHidden();
    await expect(actionLink).toHaveClass(/action-edit--active/);
  });

  test('Apply "No — optional" does not mark link active', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    const actionLink = page.locator('[data-node-id="1.1"]').getByTestId('action-states');
    await actionLink.click();

    await selectCustomOpt(page, requiredSel(page), 'false');
    await modalApply(page).click();

    await expect(actionLink).not.toHaveClass(/action-edit--active/);
  });

  test('re-opening the modal reflects previously saved value', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    const actionLink = page.locator('[data-node-id="1.1"]').getByTestId('action-states');

    // Save "Yes — required"
    await actionLink.click();
    await selectCustomOpt(page, requiredSel(page), 'true');
    await modalApply(page).click();

    // Re-open — select should reflect 'true'
    await actionLink.click();
    await expect(requiredSel(page)).toHaveAttribute('data-value', 'true');
    await modalCancel(page).click();
  });

  test('setting Yes then back to No deactivates link', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    const actionLink = page.locator('[data-node-id="1.1"]').getByTestId('action-states');

    // First: set to Yes — required
    await actionLink.click();
    await selectCustomOpt(page, requiredSel(page), 'true');
    await modalApply(page).click();
    await expect(actionLink).toHaveClass(/action-edit--active/);

    // Then: set back to No — optional
    await actionLink.click();
    await selectCustomOpt(page, requiredSel(page), 'false');
    await modalApply(page).click();
    await expect(actionLink).not.toHaveClass(/action-edit--active/);
  });
});


