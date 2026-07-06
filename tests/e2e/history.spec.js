// ── E2E: Undo / Redo (history) ────────────────────────────────────────────────
// Tests for the history module: undo/redo buttons in the panel header and the
// matching keyboard shortcuts (Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z).
//
// Run: npx playwright test tests/e2e/history.spec.js
//
// ── data-testid registry ──────────────────────────────────────────────────────
//   undo-btn            "↶" undo button in the left-panel header
//   redo-btn            "↷" redo button in the left-panel header
//   add-root-group-btn  toolbar button that creates a root group
//   tree-container      wraps all builder nodes
//   clear-form-btn      clears the questionnaire
//   clear-confirm-clear-btn  "Clear anyway" in clear-confirm dialog
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import { freshStart, addRootGroup } from './helpers/builder.js';

// The history module debounces 400 ms then waits for requestIdleCallback.
// Allow up to 3 s for the snapshot to be taken and buttons to update.
const HISTORY_TIMEOUT = 3_000;

const undoBtn = (page) => page.getByTestId('undo-btn');
const redoBtn = (page) => page.getByTestId('redo-btn');
const nodes   = (page) => page.locator('[data-testid="tree-container"] [data-node-id]');

// ── Initial state ─────────────────────────────────────────────────────────────

test.describe('Initial state', () => {
  test('undo button is disabled on fresh start', async ({ page }) => {
    await freshStart(page);
    await expect(undoBtn(page)).toBeDisabled();
  });

  test('redo button is disabled on fresh start', async ({ page }) => {
    await freshStart(page);
    await expect(redoBtn(page)).toBeDisabled();
  });
});

// ── Undo ──────────────────────────────────────────────────────────────────────

test.describe('Undo', () => {
  test('undo button becomes enabled after adding a root group', async ({ page }) => {
    await freshStart(page);
    await addRootGroup(page);
    await expect(undoBtn(page)).toBeEnabled({ timeout: HISTORY_TIMEOUT });
  });

  test('clicking undo removes the added group', async ({ page }) => {
    await freshStart(page);
    await addRootGroup(page);
    await expect(nodes(page)).toHaveCount(1);
    await expect(undoBtn(page)).toBeEnabled({ timeout: HISTORY_TIMEOUT });

    await page.keyboard.press('Control+z');
    await expect(nodes(page)).toHaveCount(0);
  });

  test('undo button is disabled again after undoing to initial state', async ({ page }) => {
    await freshStart(page);
    await addRootGroup(page);
    await expect(undoBtn(page)).toBeEnabled({ timeout: HISTORY_TIMEOUT });

    await page.keyboard.press('Control+z');
    await expect(undoBtn(page)).toBeDisabled();
  });

  test('Ctrl+Z undoes the last change', async ({ page }) => {
    await freshStart(page);
    await addRootGroup(page);
    await expect(nodes(page)).toHaveCount(1);
    await expect(undoBtn(page)).toBeEnabled({ timeout: HISTORY_TIMEOUT });

    await page.keyboard.press('Control+z');
    await expect(nodes(page)).toHaveCount(0);
  });
});

// ── Redo ──────────────────────────────────────────────────────────────────────

test.describe('Redo', () => {
  test('redo button becomes enabled after undo', async ({ page }) => {
    await freshStart(page);
    await addRootGroup(page);
    await expect(undoBtn(page)).toBeEnabled({ timeout: HISTORY_TIMEOUT });

    await page.keyboard.press('Control+z');
    await expect(redoBtn(page)).toBeEnabled();
  });

  test('clicking redo restores the undone group', async ({ page }) => {
    await freshStart(page);
    await addRootGroup(page);
    await expect(undoBtn(page)).toBeEnabled({ timeout: HISTORY_TIMEOUT });

    await page.keyboard.press('Control+z');
    await expect(nodes(page)).toHaveCount(0);

    await page.keyboard.press('Control+y');
    await expect(nodes(page)).toHaveCount(1);
  });

  test('redo button is disabled again after redoing', async ({ page }) => {
    await freshStart(page);
    await addRootGroup(page);
    await expect(undoBtn(page)).toBeEnabled({ timeout: HISTORY_TIMEOUT });

    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+y');
    await expect(redoBtn(page)).toBeDisabled();
  });

  test('Ctrl+Y redoes the last undone change', async ({ page }) => {
    await freshStart(page);
    await addRootGroup(page);
    await expect(undoBtn(page)).toBeEnabled({ timeout: HISTORY_TIMEOUT });

    await page.keyboard.press('Control+z');
    await expect(nodes(page)).toHaveCount(0);

    await page.keyboard.press('Control+y');
    await expect(nodes(page)).toHaveCount(1);
  });

  test('Ctrl+Shift+Z redoes the last undone change', async ({ page }) => {
    await freshStart(page);
    await addRootGroup(page);
    await expect(undoBtn(page)).toBeEnabled({ timeout: HISTORY_TIMEOUT });

    await page.keyboard.press('Control+z');
    await expect(nodes(page)).toHaveCount(0);

    await page.keyboard.press('Control+Shift+z');
    await expect(nodes(page)).toHaveCount(1);
  });
});

// ── Clear resets history ──────────────────────────────────────────────────────

test.describe('History reset on clear', () => {
  test('undo and redo are both disabled after clearing the form', async ({ page }) => {
    await freshStart(page);
    await addRootGroup(page);
    await expect(undoBtn(page)).toBeEnabled({ timeout: HISTORY_TIMEOUT });

    await page.getByTestId('clear-form-btn').click();
    await page.getByTestId('clear-confirm-clear-btn').click();
    await expect(nodes(page)).toHaveCount(0);

    await expect(undoBtn(page)).toBeDisabled();
    await expect(redoBtn(page)).toBeDisabled();
  });
});

// ── Undo/redo with side-panel cards subscribed (regression: detail-less event) ─
// Contained / Answer-ValueSet / Variables cards subscribe to QUESTIONNAIRE_LOADED
// in their constructors (active from app start) and read e.detail.questDoc.
// undo()/redo() dispatch that event WITHOUT detail, which used to throw
// "Cannot read properties of null (reading 'questDoc')".

test.describe('History — undo/redo raises no page error (detail-less event)', () => {
  test('undo then redo does not throw a TypeError', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await freshStart(page);
    await addRootGroup(page);
    await expect(undoBtn(page)).toBeEnabled({ timeout: HISTORY_TIMEOUT });

    await page.keyboard.press('Control+z');
    await expect(nodes(page)).toHaveCount(0);
    await page.keyboard.press('Control+y');
    await expect(nodes(page)).toHaveCount(1);

    expect(errors, errors.join('\n')).toEqual([]);
  });
});

