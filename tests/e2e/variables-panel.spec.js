// ── E2E: Variables panel ───────────────────────────────────────────────────────
// Tests for the questionnaire-level Variables card and its edit modal.
//
// Run: npx playwright test tests/e2e/variables-panel.spec.js
//
// ── element IDs ──────────────────────────────────────────────────────────────
//   variables-card        collapsible card (data-testid, shown when any variable exists)
//   variables-edit-btn    "Edit" button (data-testid) that opens the modal
//   variablesModal        backdrop (display:flex when open)
//   variablesModalBody    scrollable body
//   variablesModalClose   × close button
//   variablesModalCancel  Cancel button
//   variablesModalApply   Apply button
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';

// ── Shared helpers ─────────────────────────────────────────────────────────────

async function waitForLoad(page) {
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
}

async function freshStart(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await waitForLoad(page);
}

/** Add a root group so the variables card becomes visible. */
async function freshStartWithGroup(page) {
  await freshStart(page);
  await page.getByTestId('add-root-group-btn').click();
  await expect(page.locator('[data-node-id="1"]')).toBeVisible();
  await expect(page.getByTestId('variables-card')).toBeVisible();
}

const variablesCard   = (page) => page.getByTestId('variables-card');
const variablesEditBtn = (page) => page.getByTestId('variables-edit-btn');
const variablesModal  = (page) => page.locator('[data-testid="variablesModal"]');
const variablesModalBody   = (page) => page.locator('[data-testid="variablesModalBody"]');
const variablesModalClose  = (page) => page.locator('[data-testid="variablesModalClose"]');
const variablesModalCancel = (page) => page.locator('[data-testid="variablesModalCancel"]');
const variablesModalApply  = (page) => page.locator('[data-testid="variablesModalApply"]');

// ── Tests ──────────────────────────────────────────────────────────────────────

test.describe('Variables panel — card visibility', () => {
  test('variables card is hidden on fresh load (no nodes in tree)', async ({ page }) => {
    await freshStart(page);
    await expect(variablesCard(page)).not.toBeVisible();
  });

  test('variables card appears after adding a group', async ({ page }) => {
    await freshStartWithGroup(page);
    await expect(variablesCard(page)).toBeVisible();
  });

  test('"Edit" button opens the variables modal', async ({ page }) => {
    await freshStartWithGroup(page);

    await variablesEditBtn(page).click();
    await expect(variablesModal(page)).toBeVisible();
  });
});

test.describe('Variables modal — open / close', () => {
  test('× button closes the modal', async ({ page }) => {
    await freshStartWithGroup(page);
    await variablesEditBtn(page).click();
    await expect(variablesModal(page)).toBeVisible();
    await variablesModalClose(page).click();
    await expect(variablesModal(page)).not.toBeVisible();
  });

  test('Cancel button closes the modal', async ({ page }) => {
    await freshStartWithGroup(page);
    await variablesEditBtn(page).click();
    await expect(variablesModal(page)).toBeVisible();
    await variablesModalCancel(page).click();
    await expect(variablesModal(page)).not.toBeVisible();
  });

  test('Escape closes the modal', async ({ page }) => {
    await freshStartWithGroup(page);
    await variablesEditBtn(page).click();
    await expect(variablesModal(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(variablesModal(page)).not.toBeVisible();
  });

  test('clicking backdrop closes the modal', async ({ page }) => {
    await freshStartWithGroup(page);
    await variablesEditBtn(page).click();
    await expect(variablesModal(page)).toBeVisible();
    await variablesModal(page).click({ position: { x: 5, y: 5 } });
    await expect(variablesModal(page)).not.toBeVisible();
  });

  test('modal opens empty on a fresh questionnaire (no auto-seeded variables)', async ({ page }) => {
    // Patient variables are no longer auto-seeded — a fresh questionnaire has zero
    // questionnaire-level variables until the user adds one or picks a patient preset.
    await freshStartWithGroup(page);
    await variablesEditBtn(page).click();
    await expect(variablesModalBody(page)).toBeVisible();
    await expect(variablesModalBody(page).getByText('+ Add Variable')).toBeVisible();
    // No variable rows on a fresh questionnaire
    await expect(variablesModalBody(page).locator('input.variables-name-input')).toHaveCount(0);
  });
});

test.describe('Variables modal — draft pattern', () => {
  test('clicking "+ Add Variable" adds a variable row', async ({ page }) => {
    await freshStartWithGroup(page);
    await variablesEditBtn(page).click();
    await variablesModalBody(page).getByText('+ Add Variable').click();
    // Row should have name and expression inputs
    await expect(variablesModalBody(page).locator('input').first()).toBeVisible();
  });

  test('Cancel after adding variable does not increase the chip count', async ({ page }) => {
    await freshStartWithGroup(page);

    // Fresh questionnaire has no variables — baseline row count is 0.
    await variablesEditBtn(page).click();
    const rowsBefore = await variablesModalBody(page).locator('input.variables-name-input').count();
    await variablesModalCancel(page).click();

    // Open again and add a new named variable, then cancel
    await variablesEditBtn(page).click();
    await variablesModalBody(page).getByText('+ Add Variable').click();
    await variablesModalBody(page).locator('input.variables-name-input').last().fill('tempVar');
    await variablesModalCancel(page).click();

    // Re-open: row count must be unchanged
    await variablesEditBtn(page).click();
    const rowsAfter = await variablesModalBody(page).locator('input.variables-name-input').count();
    expect(rowsAfter).toBe(rowsBefore);
  });

  test('Apply with name and expression shows chip in card', async ({ page }) => {
    await freshStartWithGroup(page);
    await variablesEditBtn(page).click();
    await variablesModalBody(page).getByText('+ Add Variable').click();

    // Fill the last row (the newly added one)
    const nameInput = variablesModalBody(page).locator('input.variables-name-input').last();
    await nameInput.fill('myVar');
    const exprInput = variablesModalBody(page).locator('textarea.variables-expr-input').last();
    await exprInput.fill('%resource.id');

    await variablesModalApply(page).click();
    await expect(variablesModal(page)).not.toBeVisible();

    // Chip for the new variable must appear
    await expect(page.locator('[data-testid="variables-card-chips"]')).toContainText('%myVar');
  });

  test('count badge increases after adding named variables', async ({ page }) => {
    // Fresh questionnaire has no variables; add 2 named ones.
    // After Apply, refresh() is called → count badge shows the total (rowsBefore + 2).
    await freshStartWithGroup(page);
    await variablesEditBtn(page).click();

    const rowsBefore = await variablesModalBody(page).locator('input.variables-name-input').count();

    await variablesModalBody(page).getByText('+ Add Variable').click();
    await variablesModalBody(page).locator('input.variables-name-input').last().fill('varA');
    await variablesModalBody(page).getByText('+ Add Variable').click();
    await variablesModalBody(page).locator('input.variables-name-input').last().fill('varB');

    await variablesModalApply(page).click();
    // count badge = total named vars (pre-seeded + 2 new)
    await expect(page.locator('[data-testid="variables-card-count"]')).toHaveText(String(rowsBefore + 2));
  });

  test('Cancel does not persist the typed variable name', async ({ page }) => {
    await freshStartWithGroup(page);
    await variablesEditBtn(page).click();
    const rowsBefore = await variablesModalBody(page).locator('input.variables-name-input').count();
    await variablesModalCancel(page).click();

    // Open, add a row, type a name, then cancel
    await variablesEditBtn(page).click();
    await variablesModalBody(page).getByText('+ Add Variable').click();
    await variablesModalBody(page).locator('input.variables-name-input').last().fill('tempVar');
    await variablesModalCancel(page).click();

    // Re-open — row count must be unchanged (draft discarded)
    await variablesEditBtn(page).click();
    const rowsAfter = await variablesModalBody(page).locator('input.variables-name-input').count();
    expect(rowsAfter).toBe(rowsBefore);
    // 'tempVar' chip must not appear
    await expect(page.locator('[data-testid="variables-card-chips"]')).not.toContainText('%tempVar');
  });
});

test.describe('Variables panel — card collapse/expand', () => {
  async function addVariable(page, name) {
    await variablesEditBtn(page).click();
    await variablesModalBody(page).getByText('+ Add Variable').click();
    await variablesModalBody(page).locator('input.variables-name-input').first().fill(name);
    await variablesModalApply(page).click();
  }

  test('toggle button collapses and expands the chip list', async ({ page }) => {
    await freshStartWithGroup(page);
    await addVariable(page, 'testVar');

    const chipList = page.locator('[data-testid="variables-card-chips"]');
    await expect(chipList).toBeVisible();

    await page.locator('[data-testid="variables-card-toggle"]').click();
    await expect(chipList).not.toBeVisible();

    await page.locator('[data-testid="variables-card-toggle"]').click();
    await expect(chipList).toBeVisible();
  });
});
