// ── E2E: FHIR Version Compat Warnings ────────────────────────────────────────
// Tests that cover the version-compat-registry warning system:
//   1. No warning when switching version with no applicable compat issue
//   2. open-choice specific warning when switching R4 → R5 with open-choice item
//   3. answerConstraint downgrade warning when switching R5 → R4
//   4. No warning when tree is empty
//   5. No warning when auto-import switches version (source !== 'user')
//
// Fixtures:
//   sampledata/r5-demo.fhir.json  — R5 file with answerConstraint items
//
// Run: npx playwright test tests/e2e/fhir-version-compat.spec.js
//
// ── data-testid registry ─────────────────────────────────────────────────────
//   fhir-version-select          custom-select trigger for version
//   csel-drop                    open custom-select dropdown (shared)
//   add-root-group-btn           add root group button
//   fhir-file-input              hidden file input for loading FHIR JSON
//   type-select                  item type select inside Answer Type modal
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { test, expect } from '@playwright/test';

const R5_FIXTURE = path.resolve('sampledata/r5-demo.fhir.json');

// ── Helpers ───────────────────────────────────────────────────────────────────

async function freshStart(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
}

async function selectVersion(page, versionId) {
  await page.getByTestId('fhir-version-select').click();
  await page.locator(`[data-testid="csel-drop"] [data-val="${versionId}"]`).click();
}

/** Returns the visible warning toast backdrop (notif--warn). */
function warnToast(page) {
  return page.locator('.notif-backdrop .notif--warn');
}

/** Returns the body text of the visible warning toast. */
function warnToastBody(page) {
  return page.locator('.notif-backdrop .notif--warn .modal-body');
}

/** Dismiss the warning toast by pressing Enter. */
async function dismissWarn(page) {
  await page.keyboard.press('Enter');
  await expect(warnToast(page)).not.toBeVisible({ timeout: 3_000 });
}

/** Add a root group + one item. Returns the nodeId of the item. */
async function addGroupAndItem(page) {
  await page.getByTestId('add-root-group-btn').click();
  const group = page.locator('[data-node-id="1"]');
  await expect(group).toBeVisible();
  await group.getByTestId('group-add-btn').click();
  await page.locator('[data-testid="add-menu-item"]').first().click();
  await expect(page.locator('[data-node-id="1.1"]')).toBeVisible();
  return '1.1';
}

/** Set an item's type to open-choice via Answer Type modal. */
async function setTypeOpenChoice(page, nodeId) {
  const typeLink = page.locator(`[data-node-id="${nodeId}"]`).getByTestId('action-type');
  await expect(typeLink).toBeVisible();
  await expect(async () => {
    await typeLink.click();
    await expect(page.locator('[data-testid="answerTypeModal"]')).toBeVisible();
  }).toPass();
  await page.locator('[data-testid="answerTypeModal"]').getByTestId('type-select').click();
  await page.locator('[data-testid="csel-drop"] [data-val="open-choice"]').click();
  await page.getByTestId('answerTypeModalApply').click();
  await expect(page.locator('[data-testid="answerTypeModal"]')).not.toBeVisible({ timeout: 3_000 });
}

// ── 1. No warning on empty tree ───────────────────────────────────────────────

test.describe('no warning when tree is empty', () => {
  test('switching version on empty tree shows no warning', async ({ page }) => {
    await freshStart(page);
    await selectVersion(page, 'R5');
    await expect(page.getByTestId('fhir-version-select')).toHaveAttribute('data-value', 'R5');
    // No toast should appear
    await expect(warnToast(page)).not.toBeVisible();
  });
});

// ── 2. No warning when no compat-specific messages apply ──────────────────────

test.describe('no warning without specific compat issues', () => {
  test('switching R4 → R4B with a plain text item shows no warning', async ({ page }) => {
    await freshStart(page);
    await addGroupAndItem(page);

    await selectVersion(page, 'R4B');
    await expect(page.getByTestId('fhir-version-select')).toHaveAttribute('data-value', 'R4B');
    // No compat issue applies → no warning toast
    await expect(warnToast(page)).not.toBeVisible();
  });
});

// ── 3. open-choice specific warning on R4 → R5 ───────────────────────────────

test.describe('open-choice warning on upgrade to R5', () => {
  test('switching R4 → R5 with an open-choice item shows specific warning', async ({ page }) => {
    await freshStart(page);
    const nodeId = await addGroupAndItem(page);
    await setTypeOpenChoice(page, nodeId);

    await selectVersion(page, 'R5');
    await expect(warnToast(page)).toBeVisible({ timeout: 3_000 });
    await expect(warnToastBody(page)).toContainText('open-choice');
    await expect(warnToastBody(page)).toContainText('answerConstraint');
    await dismissWarn(page);
  });

  test('switching R4 → R5 with a plain item shows no warning', async ({ page }) => {
    await freshStart(page);
    await addGroupAndItem(page);
    // item is default 'text' type — no open-choice

    await selectVersion(page, 'R5');
    await expect(page.getByTestId('fhir-version-select')).toHaveAttribute('data-value', 'R5');
    // No open-choice item → no warning
    await expect(warnToast(page)).not.toBeVisible();
  });
});

// ── 4. answerConstraint downgrade warning on R5 → R4 ─────────────────────────

test.describe('answerConstraint downgrade warning', () => {
  test('loading R5 file then switching to R4 shows answerConstraint warning', async ({ page }) => {
    await freshStart(page);
    // Load R5 fixture — auto-detected as R5
    await page.locator('[data-testid="fhir-file-input"]').setInputFiles(R5_FIXTURE);
    await expect(page.locator('[data-preview-id="preferred-drink"]')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByTestId('fhir-version-select')).toHaveAttribute('data-value', 'R5');

    // Switch back to R4
    await selectVersion(page, 'R4');
    await expect(warnToast(page)).toBeVisible({ timeout: 3_000 });
    await expect(warnToastBody(page)).toContainText('answerConstraint');
    await expect(warnToastBody(page)).toContainText('backport extension');
    await dismissWarn(page);
  });

  test('loading R5 file then switching to R4B shows R4B-specific downgrade warning', async ({ page }) => {
    await freshStart(page);
    await page.locator('[data-testid="fhir-file-input"]').setInputFiles(R5_FIXTURE);
    await expect(page.locator('[data-preview-id="preferred-drink"]')).toBeVisible({ timeout: 8_000 });

    await selectVersion(page, 'R4B');
    await expect(warnToast(page)).toBeVisible({ timeout: 3_000 });
    await expect(warnToastBody(page)).toContainText('answerConstraint');
    await expect(warnToastBody(page)).toContainText('R4B native field');
    await dismissWarn(page);
  });
});

// ── 5. No warning on auto-import version switch ───────────────────────────────

test.describe('no warning on auto-detected import', () => {
  test('loading R5 file auto-switches version without showing a warning', async ({ page }) => {
    await freshStart(page);
    await page.locator('[data-testid="fhir-file-input"]').setInputFiles(R5_FIXTURE);
    await expect(page.locator('[data-preview-id="preferred-drink"]')).toBeVisible({ timeout: 8_000 });
    // Auto-detect should NOT show a warning toast
    await expect(warnToast(page)).not.toBeVisible();
    // Selector must have switched
    await expect(page.getByTestId('fhir-version-select')).toHaveAttribute('data-value', 'R5');
  });
});
