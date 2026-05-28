// ── E2E: questionnaire-choiceOrientation ──────────────────────────────────────
// Tests for the choiceOrientation layout feature for radio items:
//   1. Fixture import  — radio wraps get correct CSS class from FHIR extension
//   2. Modal UI        — orientation-select shown for radio, hidden for other types
//   3. Round-trip      — set orientation in modal → preview wrap class updated
//
// Fixture: sampledata/example-bariatric.fhir.json
//   q-diet-type     → choiceOrientation: horizontal  (expects ctrl-wrap--horizontal)
//   q-support-group → choiceOrientation: vertical    (expects ctrl-wrap--vertical)
//   q-contact-method → no extension                  (expects neither class)
//
// Run: npx playwright test tests/e2e/choice-orientation.spec.js
//
// ── data-testid registry ─────────────────────────────────────────────────────
//   add-root-group-btn    "+Add Root Group" toolbar button
//   group-add-btn         "+" button on a group node
//   add-menu-item         "Item" option in add-child menu
//   action-type           "Answer Type" action link on an item node
//   type-select           custom type dropdown in Answer Type modal
//   orientation-select    custom select for choiceOrientation (radio type only)
//   opt-add-btn           "+ Add option" button in the Answer Type options editor
//   opt-code-{i}          Code input for row i in the options editor
//   opt-label-{i}         Label input for row i in the options editor
//   csel-drop             dropdown panel of any custom select
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { test, expect } from '@playwright/test';

const FIXTURE = path.resolve('sampledata/example-bariatric.fhir.json');

// ── Helpers ───────────────────────────────────────────────────────────────────

async function waitForLoad(page) {
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
}

async function loadFixture(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await waitForLoad(page);
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(FIXTURE);
  // Wait for a radio item from section 8 to appear in the preview
  await expect(page.locator('[data-preview-id="q-diet-type"]')).toBeVisible({ timeout: 8_000 });
}

async function freshStart(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await waitForLoad(page);
}

async function addRadioItem(page) {
  await page.getByTestId('add-root-group-btn').click();
  await expect(page.locator('[data-node-id="1"]')).toBeVisible();
  await page.locator('[data-node-id="1"]').getByTestId('group-add-btn').click();
  await page.locator('[data-testid="add-menu-item"]').first().click();
  await expect(page.locator('[data-node-id="1.1"]')).toBeVisible();
  return '1.1';
}

async function openAnswerTypeModal(page, itemId) {
  await page.locator(`[data-node-id="${itemId}"]`).getByTestId('action-type').click();
  await expect(page.locator('[data-testid="answerTypeModal"]')).toBeVisible();
}

async function changeType(page, typeValue) {
  await page.locator('[data-testid="answerTypeModal"]').getByTestId('type-select').click();
  await page.locator(`[data-testid="csel-drop"] [data-val="${typeValue}"]`).click();
}

async function changeOrientation(page, orientValue) {
  await page.locator('[data-testid="answerTypeModal"]').getByTestId('orientation-select').click();
  await page.locator(`[data-testid="csel-drop"] [data-val="${orientValue}"]`).click();
}

async function applyModal(page) {
  await page.locator('[data-testid="answerTypeModalApply"]').click();
  await expect(page.locator('[data-testid="answerTypeModal"]')).not.toBeVisible();
}

// Add two options via the row-based options editor (Code / Label)
async function addTwoOptions(page) {
  await page.getByTestId('opt-add-btn').click();
  await page.getByTestId('opt-code-0').fill('a');
  await page.getByTestId('opt-label-0').fill('Option A');
  await page.getByTestId('opt-add-btn').click();
  await page.getByTestId('opt-code-1').fill('b');
  await page.getByTestId('opt-label-1').fill('Option B');
}

// ── 1. Fixture import — CSS class from FHIR extension ────────────────────────

test.describe('choiceOrientation — fixture import', () => {
  test('horizontal item gets ctrl-wrap--horizontal class in preview', async ({ page }) => {
    await loadFixture(page);
    const wrap = page.locator('[data-preview-id="q-diet-type"] .ctrl-wrap');
    await expect(wrap).toBeVisible();
    await expect(wrap).toHaveClass(/ctrl-wrap--horizontal/);
  });

  test('vertical item gets ctrl-wrap--vertical class in preview', async ({ page }) => {
    await loadFixture(page);
    const wrap = page.locator('[data-preview-id="q-support-group"] .ctrl-wrap');
    await expect(wrap).toBeVisible();
    await expect(wrap).toHaveClass(/ctrl-wrap--vertical/);
  });

  test('item without choiceOrientation extension has no orientation class', async ({ page }) => {
    await loadFixture(page);
    const wrap = page.locator('[data-preview-id="q-contact-method"] .ctrl-wrap');
    await expect(wrap).toBeVisible();
    await expect(wrap).not.toHaveClass(/ctrl-wrap--horizontal/);
    await expect(wrap).not.toHaveClass(/ctrl-wrap--vertical/);
  });
});

// ── 2. Modal UI — orientation-select visibility ───────────────────────────────

test.describe('choiceOrientation — Answer Type modal UI', () => {
  test('orientation-select is hidden for text type', async ({ page }) => {
    await freshStart(page);
    const itemId = await addRadioItem(page);
    await openAnswerTypeModal(page, itemId);
    // Default type is text — orientation section must be hidden
    await expect(page.locator('[data-testid="answerTypeModal"]').getByTestId('orientation-select')).not.toBeVisible();
  });

  test('orientation-select is visible for radio type', async ({ page }) => {
    await freshStart(page);
    const itemId = await addRadioItem(page);
    await openAnswerTypeModal(page, itemId);
    await changeType(page, 'radio');
    await expect(page.locator('[data-testid="answerTypeModal"]').getByTestId('orientation-select')).toBeVisible();
  });

  test('orientation-select is hidden for select type', async ({ page }) => {
    await freshStart(page);
    const itemId = await addRadioItem(page);
    await openAnswerTypeModal(page, itemId);
    await changeType(page, 'select');
    await expect(page.locator('[data-testid="answerTypeModal"]').getByTestId('orientation-select')).not.toBeVisible();
  });

  test('orientation-select hides when switching from radio to integer', async ({ page }) => {
    await freshStart(page);
    const itemId = await addRadioItem(page);
    await openAnswerTypeModal(page, itemId);
    await changeType(page, 'radio');
    await expect(page.locator('[data-testid="answerTypeModal"]').getByTestId('orientation-select')).toBeVisible();
    await changeType(page, 'integer');
    await expect(page.locator('[data-testid="answerTypeModal"]').getByTestId('orientation-select')).not.toBeVisible();
  });
});

// ── 3. Builder to preview round-trip ─────────────────────────────────────────

test.describe('choiceOrientation — builder to preview round-trip', () => {
  test('set vertical in modal → preview wrap gets ctrl-wrap--vertical', async ({ page }) => {
    await freshStart(page);
    const itemId = await addRadioItem(page);
    await openAnswerTypeModal(page, itemId);
    await changeType(page, 'radio');
    await addTwoOptions(page);
    await changeOrientation(page, 'vertical');
    await applyModal(page);
    await expect(page.locator(`[data-preview-id="${itemId}"] .ctrl-wrap`)).toHaveClass(/ctrl-wrap--vertical/);
  });

  test('set horizontal in modal → preview wrap gets ctrl-wrap--horizontal', async ({ page }) => {
    await freshStart(page);
    const itemId = await addRadioItem(page);
    await openAnswerTypeModal(page, itemId);
    await changeType(page, 'radio');
    await addTwoOptions(page);
    await changeOrientation(page, 'horizontal');
    await applyModal(page);
    await expect(page.locator(`[data-preview-id="${itemId}"] .ctrl-wrap`)).toHaveClass(/ctrl-wrap--horizontal/);
  });

  test('clear orientation (default) → preview wrap has no orientation class', async ({ page }) => {
    await freshStart(page);
    const itemId = await addRadioItem(page);
    await openAnswerTypeModal(page, itemId);
    await changeType(page, 'radio');
    await addTwoOptions(page);
    // Set vertical first, then clear it
    await changeOrientation(page, 'vertical');
    await applyModal(page);
    await expect(page.locator(`[data-preview-id="${itemId}"] .ctrl-wrap`)).toHaveClass(/ctrl-wrap--vertical/);

    // Re-open and clear orientation
    await openAnswerTypeModal(page, itemId);
    await changeOrientation(page, '');
    await applyModal(page);
    const wrap = page.locator(`[data-preview-id="${itemId}"] .ctrl-wrap`);
    await expect(wrap).not.toHaveClass(/ctrl-wrap--vertical/);
    await expect(wrap).not.toHaveClass(/ctrl-wrap--horizontal/);
  });
});
