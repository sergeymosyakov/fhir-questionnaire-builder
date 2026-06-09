// ── E2E: questionnaire-displayCategory ────────────────────────────────────────
// Tests for the displayCategory visual-category feature for display items:
//   1. Fixture import  — display items get correct CSS class / icon / toggle from FHIR extension
//   2. Modal UI        — display-category-select shown for display type only
//   3. Round-trip      — set category in modal → preview row styled correctly
//   4. Help toggle     — clicking help toggle shows/hides collapsed content
//
// Fixture: tests/fixtures/display-category.fhir.json
//   dc-instructions → displayCategory: instructions  (expects .lform-item--instructions + icon)
//   dc-security     → displayCategory: security      (expects .lform-item--security + icon)
//   dc-help         → displayCategory: help          (expects .lform-item--help + help toggle)
//   dc-plain        → no extension                   (expects none of the above)
//
// Run: npx playwright test tests/e2e/display-category.spec.js
//
// ── data-testid registry ─────────────────────────────────────────────────────
//   add-root-group-btn        "+Add Root Group" toolbar button
//   group-add-btn             "+" button on a group node
//   add-menu-item             "Item" option in add-child menu
//   action-type               "Answer Type" action link on an item node
//   type-select               custom type dropdown in Answer Type modal
//   display-category-select   custom select for displayCategory (display type only)
//   display-category-icon     icon span on instructions/security items in preview
//   display-help-toggle       "? Help" button on help items in preview
//   display-help-content      collapsible content span on help items in preview
//   csel-drop                 dropdown panel of any custom select
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { test, expect } from '@playwright/test';

const FIXTURE = path.resolve('tests/fixtures/display-category.fhir.json');

// ── Helpers ───────────────────────────────────────────────────────────────────

async function waitForLoad(page) {
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
}

async function loadFixture(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await waitForLoad(page);
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(FIXTURE);
  await expect(page.locator('[data-preview-id="dc-instructions"]')).toBeVisible({ timeout: 8_000 });
}

async function freshStart(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await waitForLoad(page);
}

async function addDisplayItem(page) {
  await page.getByTestId('add-root-group-btn').click();
  await expect(page.locator('[data-node-id="1"]')).toBeVisible();
  await page.locator('[data-node-id="1"]').getByTestId('group-add-btn').click();
  await page.locator('[data-testid="add-menu-item"]').first().click();
  await expect(page.locator('[data-node-id="1.1"]').getByTestId('action-type')).toBeVisible();
  return '1.1';
}

async function openAnswerTypeModal(page, itemId) {
  const link = page.locator(`[data-node-id="${itemId}"]`).getByTestId('action-type');
  await expect(link).toBeVisible();
  await link.click();
  await expect(page.locator('[data-testid="answerTypeModal"]')).toBeVisible();
}

async function changeType(page, typeValue) {
  await page.locator('[data-testid="answerTypeModal"]').getByTestId('type-select').click();
  await page.locator(`[data-testid="csel-drop"] [data-val="${typeValue}"]`).click();
}

async function changeDisplayCategory(page, catValue) {
  await page.locator('[data-testid="answerTypeModal"]').getByTestId('display-category-select').click();
  await page.locator(`[data-testid="csel-drop"] [data-val="${catValue}"]`).click();
}

async function applyModal(page) {
  await page.locator('[data-testid="answerTypeModalApply"]').click();
  await expect(page.locator('[data-testid="answerTypeModal"]')).not.toBeVisible();
}

// ── 1. Fixture import — CSS class and elements from FHIR extension ────────────

test.describe('displayCategory — fixture import', () => {
  test('instructions item gets lform-item--instructions class', async ({ page }) => {
    await loadFixture(page);
    const row = page.locator('[data-preview-id="dc-instructions"]');
    await expect(row).toHaveClass(/lform-item--instructions/);
  });

  test('instructions item has category icon in preview', async ({ page }) => {
    await loadFixture(page);
    const icon = page.locator('[data-preview-id="dc-instructions"] [data-testid="display-category-icon"]');
    await expect(icon).toBeVisible();
    await expect(icon).toHaveText('\u2139');
  });

  test('security item gets lform-item--security class', async ({ page }) => {
    await loadFixture(page);
    const row = page.locator('[data-preview-id="dc-security"]');
    await expect(row).toHaveClass(/lform-item--security/);
  });

  test('security item has category icon with warning symbol', async ({ page }) => {
    await loadFixture(page);
    const icon = page.locator('[data-preview-id="dc-security"] [data-testid="display-category-icon"]');
    await expect(icon).toBeVisible();
    await expect(icon).toHaveText('\u26A0');
  });

  test('help item gets lform-item--help class', async ({ page }) => {
    await loadFixture(page);
    const row = page.locator('[data-preview-id="dc-help"]');
    await expect(row).toHaveClass(/lform-item--help/);
  });

  test('help item has help toggle button instead of plain label', async ({ page }) => {
    await loadFixture(page);
    const toggle = page.locator('[data-preview-id="dc-help"] [data-testid="display-help-toggle"]');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveText('? Help');
  });

  test('plain display item has none of the category classes', async ({ page }) => {
    await loadFixture(page);
    const row = page.locator('[data-preview-id="dc-plain"]');
    await expect(row).not.toHaveClass(/lform-item--instructions/);
    await expect(row).not.toHaveClass(/lform-item--security/);
    await expect(row).not.toHaveClass(/lform-item--help/);
  });

  test('plain display item has no category icon', async ({ page }) => {
    await loadFixture(page);
    const icon = page.locator('[data-preview-id="dc-plain"] [data-testid="display-category-icon"]');
    await expect(icon).not.toBeVisible();
  });
});

// ── 2. Modal UI — display-category-select visibility ─────────────────────────

test.describe('displayCategory — Answer Type modal UI', () => {
  test('display-category-select is hidden for text type', async ({ page }) => {
    await freshStart(page);
    const itemId = await addDisplayItem(page);
    await openAnswerTypeModal(page, itemId);
    // Default type is text — category select must be hidden
    await expect(page.locator('[data-testid="answerTypeModal"]').getByTestId('display-category-select')).not.toBeVisible();
  });

  test('display-category-select is visible when type is display', async ({ page }) => {
    await freshStart(page);
    const itemId = await addDisplayItem(page);
    await openAnswerTypeModal(page, itemId);
    await changeType(page, 'display');
    await expect(page.locator('[data-testid="answerTypeModal"]').getByTestId('display-category-select')).toBeVisible();
  });

  test('display-category-select is hidden for radio type', async ({ page }) => {
    await freshStart(page);
    const itemId = await addDisplayItem(page);
    await openAnswerTypeModal(page, itemId);
    await changeType(page, 'radio');
    await expect(page.locator('[data-testid="answerTypeModal"]').getByTestId('display-category-select')).not.toBeVisible();
  });

  test('display-category-select hides when switching from display to integer', async ({ page }) => {
    await freshStart(page);
    const itemId = await addDisplayItem(page);
    await openAnswerTypeModal(page, itemId);
    await changeType(page, 'display');
    await expect(page.locator('[data-testid="answerTypeModal"]').getByTestId('display-category-select')).toBeVisible();
    await changeType(page, 'integer');
    await expect(page.locator('[data-testid="answerTypeModal"]').getByTestId('display-category-select')).not.toBeVisible();
  });
});

// ── 3. Builder to preview round-trip ─────────────────────────────────────────

test.describe('displayCategory — builder to preview round-trip', () => {
  test('set instructions in modal → row gets lform-item--instructions', async ({ page }) => {
    await freshStart(page);
    const itemId = await addDisplayItem(page);
    await openAnswerTypeModal(page, itemId);
    await changeType(page, 'display');
    await changeDisplayCategory(page, 'instructions');
    await applyModal(page);
    await expect(page.locator(`[data-preview-id="${itemId}"]`)).toHaveClass(/lform-item--instructions/);
  });

  test('set instructions → category icon with ℹ appears', async ({ page }) => {
    await freshStart(page);
    const itemId = await addDisplayItem(page);
    await openAnswerTypeModal(page, itemId);
    await changeType(page, 'display');
    await changeDisplayCategory(page, 'instructions');
    await applyModal(page);
    const icon = page.locator(`[data-preview-id="${itemId}"] [data-testid="display-category-icon"]`);
    await expect(icon).toBeVisible();
    await expect(icon).toHaveText('\u2139');
  });

  test('set security in modal → row gets lform-item--security', async ({ page }) => {
    await freshStart(page);
    const itemId = await addDisplayItem(page);
    await openAnswerTypeModal(page, itemId);
    await changeType(page, 'display');
    await changeDisplayCategory(page, 'security');
    await applyModal(page);
    await expect(page.locator(`[data-preview-id="${itemId}"]`)).toHaveClass(/lform-item--security/);
  });

  test('set help in modal → row gets lform-item--help + toggle button', async ({ page }) => {
    await freshStart(page);
    const itemId = await addDisplayItem(page);
    await openAnswerTypeModal(page, itemId);
    await changeType(page, 'display');
    await changeDisplayCategory(page, 'help');
    await applyModal(page);
    await expect(page.locator(`[data-preview-id="${itemId}"]`)).toHaveClass(/lform-item--help/);
    await expect(page.locator(`[data-preview-id="${itemId}"] [data-testid="display-help-toggle"]`)).toBeVisible();
  });

  test('clear category (none) removes all category classes', async ({ page }) => {
    await freshStart(page);
    const itemId = await addDisplayItem(page);
    // Set instructions first
    await openAnswerTypeModal(page, itemId);
    await changeType(page, 'display');
    await changeDisplayCategory(page, 'instructions');
    await applyModal(page);
    await expect(page.locator(`[data-preview-id="${itemId}"]`)).toHaveClass(/lform-item--instructions/);

    // Re-open and clear category
    await openAnswerTypeModal(page, itemId);
    await changeDisplayCategory(page, '');
    await applyModal(page);
    const row = page.locator(`[data-preview-id="${itemId}"]`);
    await expect(row).not.toHaveClass(/lform-item--instructions/);
    await expect(row).not.toHaveClass(/lform-item--security/);
    await expect(row).not.toHaveClass(/lform-item--help/);
  });
});

// ── 4. Help toggle — show/hide collapsible content ───────────────────────────

test.describe('displayCategory — help toggle interaction', () => {
  test('help content is hidden by default', async ({ page }) => {
    await loadFixture(page);
    const content = page.locator('[data-preview-id="dc-help"] [data-testid="display-help-content"]');
    await expect(content).not.toBeVisible();
  });

  test('clicking help toggle shows the content', async ({ page }) => {
    await loadFixture(page);
    const toggle = page.locator('[data-preview-id="dc-help"] [data-testid="display-help-toggle"]');
    const content = page.locator('[data-preview-id="dc-help"] [data-testid="display-help-content"]');
    await toggle.click();
    await expect(content).toBeVisible();
  });

  test('clicking help toggle twice hides the content again', async ({ page }) => {
    await loadFixture(page);
    const toggle = page.locator('[data-preview-id="dc-help"] [data-testid="display-help-toggle"]');
    const content = page.locator('[data-preview-id="dc-help"] [data-testid="display-help-content"]');
    await toggle.click();
    await expect(content).toBeVisible();
    await toggle.click();
    await expect(content).not.toBeVisible();
  });

  test('help content text matches item title', async ({ page }) => {
    await loadFixture(page);
    const toggle = page.locator('[data-preview-id="dc-help"] [data-testid="display-help-toggle"]');
    const content = page.locator('[data-preview-id="dc-help"] [data-testid="display-help-content"]');
    await toggle.click();
    await expect(content).toHaveText('Enter your date of birth in YYYY-MM-DD format.');
  });
});

// ── 5. R4 export suppression on display items ─────────────────────────────────
// Fixture has display items (dc-instructions etc.) with displayCategory set.
// R4 only allows displayCategory on group items — export must suppress it on display items.
// Fixture also has dc-group-instructions (group) — extension must be present in export.
//
// Note: loading the fixture generates validator warnings (displayCategory on display items
// is R4-invalid). Those warnings are non-blocking on import (import modal only shows errors).
// On export the validate modal does open due to warnings — exportAndDownload() handles it.

const DC_URL = 'http://hl7.org/fhir/StructureDefinition/questionnaire-displayCategory';

function findItemRecursive(items, linkId) {
  for (const item of items) {
    if (item.linkId === linkId) return item;
    if (item.item) {
      const found = findItemRecursive(item.item, linkId);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Export FHIR JSON, handling the optional validate modal that opens when
 * there are warnings (e.g. displayCategory on display items).
 */
async function exportAndDownload(page) {
  await page.getByTestId('export-btn').click();
  await page.getByTestId('export-quest-item').click();
  await expect(page.locator('[data-testid="saveFormatModal"]')).toBeVisible();
  await page.getByTestId('saveFormatModalApply').click();
  // Validate modal opens when questionnaire has warnings/errors
  const modal = page.locator('[data-testid="validateModal"]');
  await modal.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
  if (await modal.isVisible()) {
    await page.locator('[data-testid="validateModal"] .btn-fhir-export').click();
  }
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('prompt-save').click(),
  ]);
  return download;
}

test.describe('displayCategory — R4 export suppression on display items', () => {
  test('displayCategory is NOT exported for display-type items', async ({ page }) => {
    await loadFixture(page);
    const download = await exportAndDownload(page);
    const { readFileSync } = await import('node:fs');
    const q = JSON.parse(readFileSync(await download.path(), 'utf8'));
    const item = findItemRecursive(q.item, 'dc-instructions');
    const ext = (item.extension || []).find(e => e.url === DC_URL);
    expect(ext).toBeUndefined();
  });

  test('displayCategory IS exported for group-type items', async ({ page }) => {
    await loadFixture(page);
    const download = await exportAndDownload(page);
    const { readFileSync } = await import('node:fs');
    const q = JSON.parse(readFileSync(await download.path(), 'utf8'));
    const item = findItemRecursive(q.item, 'dc-group-instructions');
    const ext = (item.extension || []).find(e => e.url === DC_URL);
    expect(ext).toBeDefined();
    expect(ext?.valueCodeableConcept?.coding?.[0]?.code).toBe('instructions');
  });

  test('displayCategory on display item triggers validator warning', async ({ page }) => {
    await loadFixture(page);
    await page.getByTestId('tools-btn').click();
    await page.getByTestId('validate-item').click();
    await expect(page.locator('[data-testid="validateModal"]')).toBeVisible();
    const body = page.locator('[data-testid="validateModalBody"]');
    await expect(body).toContainText('displayCategory');
    await expect(body).toContainText('group');
    await page.keyboard.press('Escape');
  });
});
