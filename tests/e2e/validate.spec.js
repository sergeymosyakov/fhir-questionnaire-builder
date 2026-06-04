// ── E2E: Validate modal ────────────────────────────────────────────────────────
// Tests for the Validate button and validate modal behaviour.
//
// Run: npx playwright test tests/e2e/validate.spec.js
//
// ── data-testid used in this suite ───────────────────────────────────────────
//   tools-btn           "🛠️ Tools ▾" dropdown trigger button
//   validate-item       "Validate" item in the Tools dropdown
//   export-btn          "⬇ Export ▾" dropdown trigger button
//   export-fhir-item    "Questionnaire (FHIR R4)" item in the export dropdown
//
// ── element IDs used in this suite ───────────────────────────────────────────
//   validateModal       backdrop <div>  (display:flex when open)
//   validateModalTitle  <span> inside modal-header
//   validateModalBody   scrollable body
//   validateModalClose  × close button
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

/**
 * Add a root group and an item child, give both a title.
 * Returns { groupId, itemId }.
 */
async function addValidItem(page) {
  await page.getByTestId('add-root-group-btn').click();
  await expect(page.locator('[data-node-id="1"]')).toBeVisible();

  const group = page.locator('[data-node-id="1"]');
  await group.getByTestId('group-add-btn').click();
  await page.locator('[data-testid="add-menu-item"]').first().click();
  await expect(page.locator('[data-node-id="1.1"]')).toBeVisible();

  // Title the group
  await group.getByTestId('node-title-display').first().click();
  await expect(group.getByTestId('node-title-input').first()).toBeVisible({ timeout: 10_000 });
  await group.getByTestId('node-title-input').first().fill('My Section');
  await group.getByTestId('node-title-input').first().blur();

  // Title the item
  const item = page.locator('[data-node-id="1.1"]');
  await expect(item.getByTestId('node-title-display')).toBeVisible();
  await item.getByTestId('node-title-display').click();
  await expect(item.getByTestId('node-title-input')).toBeVisible({ timeout: 10_000 });
  await item.getByTestId('node-title-input').fill('My Question');
  await item.getByTestId('node-title-input').blur();

  return { groupId: '1', itemId: '1.1' };
}

// ── Helpers: modal state ───────────────────────────────────────────────────────

const validateModal      = (page) => page.locator('[data-testid="validateModal"]');
const validateModalTitle = (page) => page.locator('[data-testid="validateModalTitle"]');
const validateModalClose = (page) => page.locator('[data-testid="validateModalClose"]');
const validateModalBody  = (page) => page.locator('[data-testid="validateModalBody"]');
const toolsMenuBtn       = (page) => page.getByTestId('tools-btn');
const validateMenuItem   = (page) => page.getByTestId('validate-item');

async function openValidateModal(page) {
  await toolsMenuBtn(page).click();
  await validateMenuItem(page).click();
  await expect(validateModal(page)).toBeVisible();
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test.describe('Tools menu visibility', () => {
  test('hidden on empty questionnaire', async ({ page }) => {
    await freshStart(page);
    await expect(toolsMenuBtn(page)).not.toBeVisible();
  });

  test('appears after adding a node', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.locator('[data-node-id="1"]')).toBeVisible();
    await expect(toolsMenuBtn(page)).toBeVisible();
  });
});

test.describe('Validate modal — all good', () => {
  test('shows "All good" title and ✅ message when questionnaire is valid', async ({ page }) => {
    await freshStart(page);
    await addValidItem(page);

    await openValidateModal(page);

    await expect(validateModalTitle(page)).toHaveText('Validate — All good', { timeout: 10_000 });
    await expect(validateModalBody(page).locator('.validate-ok')).toBeVisible();
  });

  test('"Great!" button closes the modal', async ({ page }) => {
    await freshStart(page);
    await addValidItem(page);

    await openValidateModal(page);

    const greatBtn = page.locator('[data-testid="validateModal"] .btn-fhir');
    await expect(greatBtn).toBeVisible({ timeout: 10_000 });
    await greatBtn.click();
    await expect(validateModal(page)).not.toBeVisible();
  });
});

test.describe('Validate modal — issues', () => {
  test('shows warning badge when nodes have empty titles', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.locator('[data-node-id="1"]')).toBeVisible();

    const group = page.locator('[data-node-id="1"]');
    await group.getByTestId('group-add-btn').click();
    await page.locator('[data-testid="add-menu-item"]').first().click();
    await expect(page.locator('[data-node-id="1.1"]')).toBeVisible();

    // Clear the group title to produce an empty-title warning.
    await group.getByTestId('node-title-display').first().click();
    await expect(group.getByTestId('node-title-input').first()).toBeVisible({ timeout: 10_000 });
    await group.getByTestId('node-title-input').first().fill('');
    await group.getByTestId('node-title-input').first().blur();

    await openValidateModal(page);

    await expect(validateModalTitle(page)).toContainText('Validate');
    // At least one issue row must appear.
    await expect(validateModalBody(page).locator('.validate-issue').first()).toBeVisible();
    // At least one badge must be present.
    await expect(validateModalBody(page).locator('.validate-issue-badge').first()).toBeVisible();
  });

  test('"OK" button closes modal when in standalone validate mode', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.locator('[data-node-id="1"]')).toBeVisible();

    const group = page.locator('[data-node-id="1"]');
    await group.getByTestId('group-add-btn').click();
    await page.locator('[data-testid="add-menu-item"]').first().click();
    await expect(page.locator('[data-node-id="1.1"]')).toBeVisible();

    // Clear the group title to produce a warning, so footer renders the "OK" button.
    await group.getByTestId('node-title-display').first().click();
    await expect(group.getByTestId('node-title-input').first()).toBeVisible({ timeout: 10_000 });
    await group.getByTestId('node-title-input').first().fill('');
    await group.getByTestId('node-title-input').first().blur();

    await openValidateModal(page);

    const okBtn = page.locator('[data-testid="validateModal"] .btn-fhir');
    await expect(okBtn).toBeVisible({ timeout: 10_000 });
    await okBtn.click();
    await expect(validateModal(page)).not.toBeVisible();
  });
});

test.describe('Validate modal — close gestures', () => {
  test('× button closes the modal', async ({ page }) => {
    await freshStart(page);
    await addValidItem(page);
    await openValidateModal(page);

    await validateModalClose(page).click();
    await expect(validateModal(page)).not.toBeVisible();
  });

  test('Escape key closes the modal', async ({ page }) => {
    await freshStart(page);
    await addValidItem(page);
    await openValidateModal(page);

    await page.keyboard.press('Escape');
    await expect(validateModal(page)).not.toBeVisible();
  });

  test('clicking backdrop closes the modal', async ({ page }) => {
    await freshStart(page);
    await addValidItem(page);
    await openValidateModal(page);

    // Click the backdrop area outside the modal-box.
    await validateModal(page).click({ position: { x: 5, y: 5 } });
    await expect(validateModal(page)).not.toBeVisible();
  });
});

test.describe('Validate modal — navigate to node', () => {
  test('↗ button closes modal and flashes the builder node', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.locator('[data-node-id="1"]')).toBeVisible();

    // Add item without a title to trigger a warning with a navigate button.
    const group = page.locator('[data-node-id="1"]');
    await group.getByTestId('group-add-btn').click();
    await page.locator('[data-testid="add-menu-item"]').first().click();
    await expect(page.locator('[data-node-id="1.1"]')).toBeVisible();

    // Give group a title; clear the item title so only item has a warning.
    await group.getByTestId('node-title-display').first().click();
    await expect(group.getByTestId('node-title-input').first()).toBeVisible({ timeout: 10_000 });
    await group.getByTestId('node-title-input').first().fill('My Section');
    await group.getByTestId('node-title-input').first().blur();

    const item = page.locator('[data-node-id="1.1"]');
    await expect(item.getByTestId('node-title-display')).toBeVisible();
    await item.getByTestId('node-title-display').click();
    await expect(item.getByTestId('node-title-input')).toBeVisible({ timeout: 10_000 });
    await item.getByTestId('node-title-input').fill('');
    await item.getByTestId('node-title-input').blur();

    await openValidateModal(page);

    // Click the ↗ nav button on the first issue row.
    const navBtn = validateModalBody(page).locator('.validate-nav-btn').first();
    await expect(navBtn).toBeVisible();
    await navBtn.click();

    // Modal must close.
    await expect(validateModal(page)).not.toBeVisible();

    // The flashed builder node must have node-flash class.
    await expect(page.locator('[data-node-id="1.1"]'))
      .toHaveClass(/node-flash/, { timeout: 1500 });
  });
});

test.describe('Validate modal — export mode', () => {
  test('export with issues shows "Fix first" and "Export anyway" buttons', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.locator('[data-node-id="1"]')).toBeVisible();

    // Clear the group title so validation has issues.
    const group = page.locator('[data-node-id="1"]');
    await group.getByTestId('node-title-display').first().click();
    await expect(group.getByTestId('node-title-input').first()).toBeVisible({ timeout: 10_000 });
    await group.getByTestId('node-title-input').first().fill('');
    await group.getByTestId('node-title-input').first().blur();
    // Wait for UI to reflect cleared title before clicking export.
    await expect(group.getByTestId('node-title-display').first()).toHaveText('(no title)');

    await page.getByTestId('export-btn').click();
    await page.getByTestId('export-fhir-item').click();

    // Validate modal opens in export mode.
    await expect(validateModal(page)).toBeVisible();
    await expect(validateModalTitle(page)).toContainText('Export');

    // Wait for validators to finish (footer replaces "Validating…" with buttons)
    const fixBtn = page.locator('[data-testid="validateModal"]').getByText('Fix first');
    await expect(fixBtn).toBeVisible({ timeout: 10_000 });

    const buttons = page.locator('[data-testid="validateModal"] .btn-fhir');
    const texts = await buttons.allInnerTexts();
    expect(texts).toContain('Fix first');
    expect(texts).toContain('Export anyway');
  });

  test('"Fix first" button in export mode closes the modal without exporting', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.locator('[data-node-id="1"]')).toBeVisible();

    const group = page.locator('[data-node-id="1"]');
    await group.getByTestId('node-title-display').first().click();
    await expect(group.getByTestId('node-title-input').first()).toBeVisible({ timeout: 10_000 });
    await group.getByTestId('node-title-input').first().fill('');
    await group.getByTestId('node-title-input').first().blur();

    await page.getByTestId('export-btn').click();
    await page.getByTestId('export-fhir-item').click();
    await expect(validateModal(page)).toBeVisible();

    const fixFirstBtn = page.locator('[data-testid="validateModal"]').getByText('Fix first');
    await expect(fixFirstBtn).toBeVisible({ timeout: 10_000 });
    await fixFirstBtn.click();
    await expect(validateModal(page)).not.toBeVisible();
  });

  test('"Export anyway" triggers file download despite issues', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.locator('[data-node-id="1"]')).toBeVisible();

    const group = page.locator('[data-node-id="1"]');
    await group.getByTestId('node-title-display').first().click();
    await expect(group.getByTestId('node-title-input').first()).toBeVisible({ timeout: 10_000 });
    await group.getByTestId('node-title-input').first().fill('');
    await group.getByTestId('node-title-input').first().blur();

    await page.getByTestId('export-btn').click();
    await page.getByTestId('export-fhir-item').click();
    await expect(validateModal(page)).toBeVisible();

    const exportAnywayBtn = page.locator('[data-testid="validateModal"]').getByText('Export anyway');
    await expect(exportAnywayBtn).toBeVisible({ timeout: 10_000 });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportAnywayBtn.click().then(() =>
        page.getByTestId('prompt-save').click()
      ),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.json$/);
    await expect(validateModal(page)).not.toBeVisible();
  });
});
