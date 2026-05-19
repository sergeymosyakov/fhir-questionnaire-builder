// ── E2E: Validate modal ────────────────────────────────────────────────────────
// Tests for the Validate button and validate modal behaviour.
//
// Run: npx playwright test tests/e2e/validate.spec.js
//
// ── data-testid used in this suite ───────────────────────────────────────────
//   validate-btn        "Validate" button in the builder toolbar
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
  await group.getByTestId('node-title-input').first().fill('My Section');
  await group.getByTestId('node-title-input').first().blur();

  // Title the item
  const item = page.locator('[data-node-id="1.1"]');
  await item.getByTestId('node-title-display').click();
  await item.getByTestId('node-title-input').fill('My Question');
  await item.getByTestId('node-title-input').blur();

  return { groupId: '1', itemId: '1.1' };
}

// ── Helpers: modal state ───────────────────────────────────────────────────────

const validateModal      = (page) => page.locator('#validateModal');
const validateModalTitle = (page) => page.locator('#validateModalTitle');
const validateModalClose = (page) => page.locator('#validateModalClose');
const validateModalBody  = (page) => page.locator('#validateModalBody');
const validateBtn        = (page) => page.getByTestId('validate-btn');

async function openValidateModal(page) {
  await validateBtn(page).click();
  await expect(validateModal(page)).toBeVisible();
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test.describe('Validate button visibility', () => {
  test('hidden on empty questionnaire', async ({ page }) => {
    await freshStart(page);
    await expect(validateBtn(page)).not.toBeVisible();
  });

  test('appears after adding a node', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.locator('[data-node-id="1"]')).toBeVisible();
    await expect(validateBtn(page)).toBeVisible();
  });
});

test.describe('Validate modal — all good', () => {
  test('shows "All good" title and ✅ message when questionnaire is valid', async ({ page }) => {
    await freshStart(page);
    await addValidItem(page);

    await openValidateModal(page);

    await expect(validateModalTitle(page)).toHaveText('Validate — All good');
    await expect(validateModalBody(page).locator('.validate-ok')).toBeVisible();
  });

  test('"Great!" button closes the modal', async ({ page }) => {
    await freshStart(page);
    await addValidItem(page);

    await openValidateModal(page);

    await page.locator('#validateModal .btn-fhir').click();
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
    await group.getByTestId('node-title-input').first().fill('');
    await group.getByTestId('node-title-input').first().blur();

    await openValidateModal(page);

    await page.locator('#validateModal .btn-fhir').click();
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
    await group.getByTestId('node-title-input').first().fill('My Section');
    await group.getByTestId('node-title-input').first().blur();

    const item = page.locator('[data-node-id="1.1"]');
    await item.getByTestId('node-title-display').click();
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
    await group.getByTestId('node-title-input').first().fill('');
    await group.getByTestId('node-title-input').first().blur();
    // Wait for UI to reflect cleared title before clicking export.
    await expect(group.getByTestId('node-title-display').first()).toHaveText('(no title)');

    await page.getByTestId('export-btn').click();
    await page.getByTestId('export-fhir-item').click();

    // Validate modal opens in export mode.
    await expect(validateModal(page)).toBeVisible();
    await expect(validateModalTitle(page)).toContainText('Export');

    const buttons = page.locator('#validateModal .btn-fhir');
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
    await group.getByTestId('node-title-input').first().fill('');
    await group.getByTestId('node-title-input').first().blur();

    await page.getByTestId('export-btn').click();
    await page.getByTestId('export-fhir-item').click();
    await expect(validateModal(page)).toBeVisible();

    await page.locator('#validateModal').getByText('Fix first').click();
    await expect(validateModal(page)).not.toBeVisible();
  });

  test('"Export anyway" triggers file download despite issues', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.locator('[data-node-id="1"]')).toBeVisible();

    const group = page.locator('[data-node-id="1"]');
    await group.getByTestId('node-title-display').first().click();
    await group.getByTestId('node-title-input').first().fill('');
    await group.getByTestId('node-title-input').first().blur();

    // Handle the filename prompt that appears on export.
    page.once('dialog', d => d.accept());

    await page.getByTestId('export-btn').click();
    await page.getByTestId('export-fhir-item').click();
    await expect(validateModal(page)).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#validateModal').getByText('Export anyway').click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.json$/);
    await expect(validateModal(page)).not.toBeVisible();
  });
});
