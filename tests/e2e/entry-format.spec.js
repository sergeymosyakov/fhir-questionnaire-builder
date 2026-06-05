// ── E2E: sdc-questionnaire-entryFormat ────────────────────────────────────────
// Tests for the entryFormat placeholder hint feature:
//   1. Fixture load — placeholder attribute set on controls from FHIR extension
//   2. Builder UI  — entry-format-input visible for text-like types, hidden for choice
//   3. Builder UI  — set format in modal → placeholder appears in preview control
//
// Fixture: tests/fixtures/entry-format.fhir.json
//
// Run: npx playwright test tests/e2e/entry-format.spec.js
//
// ── data-testid registry ─────────────────────────────────────────────────────
//   add-root-group-btn      "+Add Root Group" toolbar button
//   group-add-btn           "+" button on a group node
//   add-menu-item           "Item" option in add-child menu
//   action-type             "Answer Type" action link on an item node
//   type-select             custom type dropdown inside Answer Type modal
//   csel-drop               dropdown panel of any custom select
//   entry-format-input      text input for placeholder hint (answer-type-modal.js)
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { test, expect } from '@playwright/test';

const FIXTURE = path.resolve('tests/fixtures/entry-format.fhir.json');

// ── Helpers ───────────────────────────────────────────────────────────────────

async function waitForLoad(page) {
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
}

async function loadFixture(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await waitForLoad(page);
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(FIXTURE);
  await expect(page.locator('[data-preview-id="text-with-format"]')).toBeVisible({ timeout: 8_000 });
}

async function freshStart(page) {
  await page.goto('/');
  await waitForLoad(page);
}

async function addTextItem(page) {
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

async function applyModal(page) {
  await page.locator('[data-testid="answerTypeModalApply"]').click();
  await expect(page.locator('[data-testid="answerTypeModal"]')).not.toBeVisible();
}

// ── 1. Fixture load — placeholder from FHIR extension ────────────────────────

test.describe('entryFormat — fixture import', () => {
  test('text item gets placeholder from entryFormat extension', async ({ page }) => {
    await loadFixture(page);
    const textarea = page.locator('[data-preview-id="text-with-format"] textarea');
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveAttribute('placeholder', 'Last, First Middle');
  });

  test('integer item gets placeholder from entryFormat extension', async ({ page }) => {
    await loadFixture(page);
    const input = page.locator('[data-preview-id="int-with-format"] input[type="number"]');
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('placeholder', '(###) ###-####');
  });

  test('url item gets placeholder from entryFormat extension', async ({ page }) => {
    await loadFixture(page);
    const textarea = page.locator('[data-preview-id="url-with-format"] textarea');
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveAttribute('placeholder', 'https://example.com');
  });

  test('item without entryFormat has no custom placeholder on text field', async ({ page }) => {
    await loadFixture(page);
    const textarea = page.locator('[data-preview-id="text-no-format"] textarea');
    await expect(textarea).toBeVisible();
    // Default placeholder is empty for text items (no _entryFormat set)
    await expect(textarea).not.toHaveAttribute('placeholder', expect.stringContaining('Last'));
  });
});

// ── 2. Builder UI — entry-format-input visibility in Answer Type modal ────────

test.describe('entryFormat — Answer Type modal UI', () => {
  test('entry-format-input is visible for text type', async ({ page }) => {
    await freshStart(page);
    const itemId = await addTextItem(page);
    await openAnswerTypeModal(page, itemId);

    // Default type is text — placeholder section must be visible
    const efInput = page.locator('[data-testid="answerTypeModal"]').getByTestId('entry-format-input');
    await expect(efInput).toBeVisible();
  });

  test('entry-format-input is hidden when type changes to select', async ({ page }) => {
    await freshStart(page);
    const itemId = await addTextItem(page);
    await openAnswerTypeModal(page, itemId);

    // Visible for text initially
    await expect(page.locator('[data-testid="answerTypeModal"]').getByTestId('entry-format-input')).toBeVisible();

    // Change to select — placeholder section should hide
    await changeType(page, 'select');
    await expect(page.locator('[data-testid="answerTypeModal"]').getByTestId('entry-format-input')).not.toBeVisible();
  });

  test('entry-format-input is visible for integer type', async ({ page }) => {
    await freshStart(page);
    const itemId = await addTextItem(page);
    await openAnswerTypeModal(page, itemId);
    await changeType(page, 'integer');
    await expect(page.locator('[data-testid="answerTypeModal"]').getByTestId('entry-format-input')).toBeVisible();
  });

  test('entry-format-input is hidden for display type', async ({ page }) => {
    await freshStart(page);
    const itemId = await addTextItem(page);
    await openAnswerTypeModal(page, itemId);
    await changeType(page, 'display');
    await expect(page.locator('[data-testid="answerTypeModal"]').getByTestId('entry-format-input')).not.toBeVisible();
  });
});

// ── 3. Builder UI — set format → preview control gets placeholder ─────────────

test.describe('entryFormat — builder to preview round-trip', () => {
  test('set format in modal → preview textarea gets that placeholder', async ({ page }) => {
    await freshStart(page);
    const itemId = await addTextItem(page);
    await openAnswerTypeModal(page, itemId);

    const efInput = page.locator('[data-testid="answerTypeModal"]').getByTestId('entry-format-input');
    await efInput.fill('MM/DD/YYYY');
    await applyModal(page);

    const textarea = page.locator(`[data-preview-id="${itemId}"] textarea`);
    await expect(textarea).toHaveAttribute('placeholder', 'MM/DD/YYYY');
  });

  test('clear format in modal → preview textarea loses custom placeholder', async ({ page }) => {
    await freshStart(page);
    const itemId = await addTextItem(page);

    // Set a format first
    await openAnswerTypeModal(page, itemId);
    await page.locator('[data-testid="answerTypeModal"]').getByTestId('entry-format-input').fill('MM/DD/YYYY');
    await applyModal(page);
    await expect(page.locator(`[data-preview-id="${itemId}"] textarea`)).toHaveAttribute('placeholder', 'MM/DD/YYYY');

    // Now clear it
    await openAnswerTypeModal(page, itemId);
    await page.locator('[data-testid="answerTypeModal"]').getByTestId('entry-format-input').clear();
    await applyModal(page);
    // Placeholder should revert to empty (no format set)
    await expect(page.locator(`[data-preview-id="${itemId}"] textarea`)).not.toHaveAttribute('placeholder', 'MM/DD/YYYY');
  });
});
