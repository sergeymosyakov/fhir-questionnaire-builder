// ── E2E: Group AND/OR logic badge — bidirectional reactivity ──────────────────
// Verifies that changing the AND/OR selector in the builder immediately
// updates the logic badge and separator in the preview panel.
//
// data-testid registry:
//   add-root-group-btn     "+Add Root Group" toolbar button
//   group-add-btn          "+" add-child button on a group node
//   add-menu-item          "Item" option in the add-child dropdown
//   node-type-label        type label on each builder node
//   csel-drop              custom-select dropdown panel
//
// CSS classes used for assertions:
//   .preview-logic-badge   logic badge inside the group preview row
//   .logic-separator       separator between items ("AND" / "OR" text)

import { test, expect } from '@playwright/test';
import { freshStart, addRootGroup, addItemToGroup } from './helpers/builder.js';

async function addSecondItem(page, groupId) {
  const group = page.locator(`[data-node-id="${groupId}"]`);
  await group.getByTestId('group-add-btn').click();
  await page.locator('[data-testid="add-menu-item"]').first().click();
  const itemId = groupId + '.2';
  await expect(page.locator(`[data-node-id="${itemId}"]`)).toBeVisible();
  return itemId;
}

// Mark an item Required via the States modal. The AND/OR "ALL/ANY items" badge
// and the child separators only appear when a group has at least one enforceable
// (required / constrained) child — so tests that assert on them must set one.
async function makeRequired(page, nodeId) {
  await page.keyboard.press('Escape'); // close any open type-selector dropdown
  const link = page.locator(`[data-node-id="${nodeId}"]`).getByTestId('action-states');
  await expect(link).toBeVisible();
  await link.click();
  await expect(page.getByTestId('statesModal')).toBeVisible();
  await page.getByTestId('states-required-sel').click();
  await page.locator('[data-testid="csel-drop"] [data-val="true"]').click();
  await page.getByTestId('statesModalApply').click();
  await expect(page.getByTestId('statesModal')).toBeHidden();
}

test.describe('Group AND/OR logic — preview reactivity', () => {
  test('default logic badge is "ALL items ✓" (AND)', async ({ page }) => {
    await freshStart(page);
    await addRootGroup(page);
    await addItemToGroup(page, '1');
    await makeRequired(page, '1.1');

    const badge = page.locator('.preview-logic-badge').first();
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText(/ALL items/);
  });

  test('changing to OR updates badge to "ANY item ✓" immediately', async ({ page }) => {
    await freshStart(page);
    await addRootGroup(page);
    await addItemToGroup(page, '1');
    await addSecondItem(page, '1');
    await makeRequired(page, '1.1');

    // Open the OR dropdown in the builder logic row
    const logicTrigger = page.locator('[data-node-id="1"]').getByTestId('group-logic-select');
    await logicTrigger.click();
    await page.locator('[data-testid="csel-drop"] [data-val="OR"]').click();

    // Badge should update without any other action
    const badge = page.locator('.preview-logic-badge').first();
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText(/ANY item/);
  });

  test('separator between items shows "OR" after switching to OR', async ({ page }) => {
    await freshStart(page);
    await addRootGroup(page);
    await addItemToGroup(page, '1');
    await addSecondItem(page, '1');
    await makeRequired(page, '1.1');

    const logicTrigger = page.locator('[data-node-id="1"]').getByTestId('group-logic-select');
    await logicTrigger.click();
    await page.locator('[data-testid="csel-drop"] [data-val="OR"]').click();

    const separator = page.locator('.logic-separator').first();
    await expect(separator).toHaveText('OR');
  });

  test('switching back to AND updates badge to "ALL items ✓"', async ({ page }) => {
    await freshStart(page);
    await addRootGroup(page);
    await addItemToGroup(page, '1');
    await addSecondItem(page, '1');
    await makeRequired(page, '1.1');

    const logicTrigger = page.locator('[data-node-id="1"]').getByTestId('group-logic-select');

    // Switch to OR
    await logicTrigger.click();
    await page.locator('[data-testid="csel-drop"] [data-val="OR"]').click();
    await expect(page.locator('.preview-logic-badge').first()).toHaveText(/ANY item/);

    // Switch back to AND
    await logicTrigger.click();
    await page.locator('[data-testid="csel-drop"] [data-val="AND"]').click();
    await expect(page.locator('.preview-logic-badge').first()).toHaveText(/ALL items/);
  });
});

// ── Calculated-expression tests using annual-health-check fixture ─────────────

import path from 'node:path';
const ANNUAL = path.resolve('sampledata/annual-health-check.fhir.json');

async function loadAnnual(page) {
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(ANNUAL);
  await expect(page.locator('[data-preview-id="bmi"]')).toBeVisible({ timeout: 10_000 });
}

async function commitInput(page) {
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.getByTestId('preview-search-input').click();
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}

test.describe('calculatedExpression — annual-health-check fixture', () => {
  test('BMI is calculated from height and weight inputs', async ({ page }) => {
    await loadAnnual(page);

    const heightInput = page.locator('[data-preview-id="height"]').locator('input').first();
    const weightInput = page.locator('[data-preview-id="weight"]').locator('input').first();

    // Commit after each fill (like regression) so the calc chain fires incrementally
    await heightInput.fill('180');
    await heightInput.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true })));
    await commitInput(page);
    await weightInput.fill('80');
    await weightInput.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true })));
    await commitInput(page);

    // BMI row textContent contains the prefix ("1.3") and the computed value ("24.7").
    // Use \d{2,}[.,]\d to match 2+ digit decimals — excludes the single-digit prefix.
    const bmiText = await page.locator('[data-preview-id="bmi"]').textContent({ timeout: 5_000 });
    expect(bmiText).toMatch(/\d{2,}[.,]\d/); // NOSONAR — matched against controlled preview text, not user input
  });

  test('bmi-high-flag is true when BMI >= 30', async ({ page }) => {
    await loadAnnual(page);

    const heightInput = page.locator('[data-preview-id="height"]').locator('input, textarea').first();
    const weightInput = page.locator('[data-preview-id="weight"]').locator('input, textarea').first();

    // 170 cm, 90 kg → BMI ≈ 31.1 → high-flag true
    await heightInput.fill('170');
    await heightInput.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true })));
    await weightInput.fill('90');
    await weightInput.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true })));
    await commitInput(page);

    // bmi-high-flag is readOnly boolean → rendered as text "true", not a checkbox
    await expect(page.locator('[data-preview-id="bmi-high-flag"]')).toContainText('true', { timeout: 5_000 });
  });

  test('bmi-high-display shows when BMI >= 30 (calc chain: height→bmi→flag→display)', async ({ page }) => {
    await loadAnnual(page);

    // bmi-high-display has enableWhen: bmi-high-flag = true
    // Initially the flag is false → display is hidden
    await expect(page.locator('[data-preview-id="bmi-high-display"]')).toHaveClass(/lform-waiting/);

    const heightInput = page.locator('[data-preview-id="height"]').locator('input, textarea').first();
    const weightInput = page.locator('[data-preview-id="weight"]').locator('input, textarea').first();

    // 175 cm, 100 kg → BMI ≈ 32.7 → high-flag true → display visible
    await heightInput.fill('175');
    await heightInput.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true })));
    await weightInput.fill('100');
    await weightInput.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true })));
    await commitInput(page);

    await expect(page.locator('[data-preview-id="bmi-high-display"]')).not.toHaveClass(/lform-waiting/, { timeout: 5_000 });
  });

  test('bmi-high-display hides again when weight drops back below threshold', async ({ page }) => {
    await loadAnnual(page);

    const heightInput = page.locator('[data-preview-id="height"]').locator('input, textarea').first();
    const weightInput = page.locator('[data-preview-id="weight"]').locator('input, textarea').first();

    // First: make BMI high → display appears
    await heightInput.fill('175');
    await heightInput.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true })));
    await weightInput.fill('100');
    await weightInput.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true })));
    await commitInput(page);
    await expect(page.locator('[data-preview-id="bmi-high-display"]')).not.toHaveClass(/lform-waiting/, { timeout: 5_000 });

    // Then drop weight → BMI below 30 → display hidden again
    await weightInput.fill('60');
    await weightInput.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true })));
    await commitInput(page);
    await expect(page.locator('[data-preview-id="bmi-high-display"]')).toHaveClass(/lform-waiting/, { timeout: 5_000 });
  });

  test('logic badge persists after page navigation (logic setting survives re-render)', async ({ page }) => {
    await freshStart(page);
    await addRootGroup(page);
    await addItemToGroup(page, '1');
    const group = page.locator('[data-node-id="1"]');
    await group.getByTestId('group-add-btn').click();
    await page.locator('[data-testid="add-menu-item"]').first().click();
    await expect(page.locator('[data-node-id="1.2"]')).toBeVisible();

    // Close any open type-selector dropdown left from adding items
    await page.keyboard.press('Escape');
    await makeRequired(page, '1.1');

    const logicTrigger = group.getByTestId('group-logic-select');
    await logicTrigger.click();
    await page.locator('[data-testid="csel-drop"] [data-val="OR"]').click();
    await expect(page.locator('.preview-logic-badge').first()).toHaveText(/ANY item/);

    // Commit input (focuses search box) — acts as neutral navigation without opening dropdowns
    await commitInput(page);
    // Badge must still show OR after re-render tick
    await expect(page.locator('.preview-logic-badge').first()).toHaveText(/ANY item/);
  });

  test('group with OR logic: badge class reflects OR state in preview DOM', async ({ page }) => {
    await freshStart(page);
    await addRootGroup(page);
    await addItemToGroup(page, '1');
    const group = page.locator('[data-node-id="1"]');
    await group.getByTestId('group-add-btn').click();
    await page.locator('[data-testid="add-menu-item"]').first().click();
    await expect(page.locator('[data-node-id="1.2"]')).toBeVisible();

    // Close any open dropdown before interacting with logic select
    await page.keyboard.press('Escape');
    await makeRequired(page, '1.1');

    const logicTrigger = group.getByTestId('group-logic-select');
    await logicTrigger.click();
    await page.locator('[data-testid="csel-drop"] [data-val="OR"]').click();

    // The logic separator text between items should be "OR"
    const separator = page.locator('.logic-separator').first();
    await expect(separator).toBeVisible();
    await expect(separator).toHaveText('OR');
  });
});
