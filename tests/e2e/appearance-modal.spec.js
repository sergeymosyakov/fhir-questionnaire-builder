// ── E2E: Appearance (rendering-style) modal ───────────────────────────────────
// Tests for the Appearance action link and its modal.
//
// Run: npx playwright test tests/e2e/appearance-modal.spec.js
//
// ── data-testid used in this suite ───────────────────────────────────────────
//   add-root-group-btn   "+Add Root Group"
//   group-add-btn        "+" button on a group
//   add-menu-item        "Item" option in add-child menu
//   node-title-display   read-only title span
//   node-title-input     title textarea
//   action-appearance    "Appearance" action link on an item node
//   appearance-raw-input raw CSS textarea inside the modal body
//
// ── element IDs ──────────────────────────────────────────────────────────────
//   appearanceModal        backdrop (display:flex when open)
//   appearanceModalTitle   <span> inside modal-header
//   appearanceModalBody    scrollable body
//   appearanceModalClose   × close button
//   appearanceModalCancel  Cancel button
//   appearanceModalApply   Apply button
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
    await expect(item.getByTestId('node-title-display')).toBeVisible();
    await expect(async () => {
      await item.getByTestId('node-title-display').click();
      await expect(item.getByTestId('node-title-input')).toBeVisible();
    }).toPass();
    await item.getByTestId('node-title-input').fill(title);
    await item.getByTestId('node-title-input').blur();
  }
  return { groupId: '1', itemId: '1.1' };
}

const appearanceModal       = (page) => page.locator('[data-testid="appearanceModal"]');
const appearanceModalTitle  = (page) => page.locator('[data-testid="appearanceModalTitle"]');
const appearanceModalClose  = (page) => page.locator('[data-testid="appearanceModalClose"]');
const appearanceModalCancel = (page) => page.locator('[data-testid="appearanceModalCancel"]');
const appearanceModalApply  = (page) => page.locator('[data-testid="appearanceModalApply"]');
const rawInput              = (page) => page.getByTestId('appearance-raw-input');

async function openAppearanceModal(page, nodeId = '1.1') {
  const link = page.locator(`[data-node-id="${nodeId}"]`).getByTestId('action-appearance');
  await expect(link).toBeVisible();
  await link.click();
  await expect(appearanceModal(page)).toBeVisible();
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test.describe('Appearance modal — open / close', () => {
  test('clicking "Appearance" opens the modal', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    await openAppearanceModal(page);
    await expect(appearanceModal(page)).toBeVisible();
  });

  test('modal title contains "Appearance" and item name', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page, 'Question Title');

    await openAppearanceModal(page);
    await expect(appearanceModalTitle(page)).toContainText('Appearance');
    await expect(appearanceModalTitle(page)).toContainText('Question Title');
  });

  test('× button closes the modal', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);
    await openAppearanceModal(page);
    await appearanceModalClose(page).click();
    await expect(appearanceModal(page)).not.toBeVisible();
  });

  test('Cancel closes the modal', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);
    await openAppearanceModal(page);
    await appearanceModalCancel(page).click();
    await expect(appearanceModal(page)).not.toBeVisible();
  });

  test('Escape closes the modal', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);
    await openAppearanceModal(page);
    await page.keyboard.press('Escape');
    await expect(appearanceModal(page)).not.toBeVisible();
  });

  test('backdrop click closes the modal', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);
    await openAppearanceModal(page);
    await appearanceModal(page).click({ position: { x: 5, y: 5 } });
    await expect(appearanceModal(page)).not.toBeVisible();
  });
});

test.describe('Appearance modal — raw CSS textarea', () => {
  test('raw CSS textarea is rendered as <textarea>', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);
    await openAppearanceModal(page);

    const el = rawInput(page);
    await expect(el).toBeVisible();
    // Must be a textarea, not an input
    const tag = await el.evaluate(n => n.tagName.toLowerCase());
    expect(tag).toBe('textarea');
  });

  test('raw CSS textarea has rows=1 by default', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);
    await openAppearanceModal(page);

    const rows = await rawInput(page).evaluate(n => n.rows);
    expect(rows).toBe(1);
  });

  test('raw CSS textarea is resizable', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);
    await openAppearanceModal(page);

    const resize = await rawInput(page).evaluate(n => getComputedStyle(n).resize);
    expect(resize).not.toBe('none');
  });
});

test.describe('Appearance modal — draft pattern', () => {
  test('Cancel does not apply the typed CSS', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    const link = page.locator('[data-node-id="1.1"]').getByTestId('action-appearance');
    await expect(link).toBeVisible();
    await link.click();
    await expect(appearanceModal(page)).toBeVisible();
    await rawInput(page).fill('font-weight: bold');
    await appearanceModalCancel(page).click();

    // Re-open: raw input must be empty (no draft persisted)
    await link.click();
    await expect(rawInput(page)).toHaveValue('');
  });

  test('Apply marks action link as active', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    const link = page.locator('[data-node-id="1.1"]').getByTestId('action-appearance');
    await expect(link).toBeVisible();
    await expect(link).not.toHaveClass(/action-edit--active/);

    await link.click();
    await rawInput(page).fill('font-weight: bold');
    await appearanceModalApply(page).click();
    await expect(appearanceModal(page)).not.toBeVisible();
    await expect(link).toHaveClass(/action-edit--active/);
  });

  test('Apply with Bold checkbox updates raw CSS field', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    await openAppearanceModal(page);

    // Click the Bold checkbox (use click to trigger DOM change event)
    const boldCb = page.locator('[data-testid="appearanceModalBody"] input[type="checkbox"]').first();
    await boldCb.click();

    // Raw CSS textarea .value must reflect bold — use toHaveValue, not toContainText
    await expect(rawInput(page)).toHaveValue(/bold/);
    await appearanceModalApply(page).click();
    await expect(appearanceModal(page)).not.toBeVisible();

    // Verify action link became active
    await expect(page.locator('[data-node-id="1.1"]').getByTestId('action-appearance'))
      .toHaveClass(/action-edit--active/);
  });

  test('Apply with empty raw CSS deactivates action link', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);

    const link = page.locator('[data-node-id="1.1"]').getByTestId('action-appearance');
    await expect(link).toBeVisible();

    // Set a style first
    await link.click();
    await rawInput(page).fill('font-style: italic');
    await appearanceModalApply(page).click();
    await expect(appearanceModal(page)).not.toBeVisible();
    await expect(link).toHaveClass(/action-edit--active/);

    // Now clear it
    await link.click();
    await rawInput(page).fill('');
    await appearanceModalApply(page).click();
    await expect(appearanceModal(page)).not.toBeVisible();
    await expect(link).not.toHaveClass(/action-edit--active/);
  });
});
