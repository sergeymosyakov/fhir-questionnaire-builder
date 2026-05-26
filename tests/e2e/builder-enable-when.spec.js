// ── E2E: Builder — enableWhen (standard conditions) ──────────────────────────
// Tests that enableWhen conditions are applied correctly:
// items are dimmed when conditions are not met and become visible when
// the trigger answer matches the condition.
//
// Run: npx playwright test tests/e2e/builder-enable-when.spec.js
//
// ── data-testid registry ──────────────────────────────────────────────────────
//   add-root-group-btn   "+Add Root Group" button
//   add-menu-item        "Item" option in the add-child menu
//   group-add-btn        "+" button on a group
//   node-title-display   read-only title span
//   node-title-input     inline textarea editor
//   action-vis           "Show When" action link
//   showWhenModal        (id) Show When modal backdrop
//   showWhenModalBody    (id) modal body
//   showWhenModalApply   (id) Apply button
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import { freshStart } from './helpers/builder.js';

test.describe('enableWhen (standard)', () => {
  test('set condition on item → preview shows dimmed; fill trigger answer → item becomes visible', async ({ page }) => {
    await freshStart(page);

    // Add group "1" with two text items: trigger "1.1" and dependent "1.2"
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.locator('[data-node-id="1"]')).toBeVisible();

    const group = page.locator('[data-node-id="1"]');

    // Add trigger item → id "1.1"
    await group.getByTestId('group-add-btn').click();
    await page.locator('[data-testid="add-menu-item"]').first().click();
    await expect(page.locator('[data-node-id="1.1"]')).toBeVisible();

    // Title the trigger so it appears by name in the question selector
    const triggerNode = page.locator('[data-node-id="1.1"]');
    await triggerNode.getByTestId('node-title-display').click();
    await triggerNode.getByTestId('node-title-input').fill('Trigger');
    await triggerNode.getByTestId('node-title-input').blur();

    // Add dependent item → id "1.2"
    await group.getByTestId('group-add-btn').click();
    await page.locator('[data-testid="add-menu-item"]').first().click();
    await expect(page.locator('[data-node-id="1.2"]')).toBeVisible();

    // Open Show When modal on dependent item
    await page.locator('[data-node-id="1.2"]').getByTestId('action-vis').click();
    await expect(page.locator('#showWhenModal')).toBeVisible();

    // Add a condition row
    await page.locator('#showWhenModalBody .vis-add-btn').click();

    // Open the question picker dropdown
    await page.locator('#showWhenModalBody .vis-q-sel-trigger').click();
    await page.waitForSelector('.vis-q-sel-drop', { timeout: 3000 });

    // Select "1.1 — Trigger" from the portal dropdown
    await page.locator('.vis-q-sel-opt[data-id="1.1"]').click();

    // Operator defaults to "=" for text type; fill the answer value
    await page.locator('#showWhenModalBody .vis-cond-val-inp').fill('yes');

    // Apply the condition
    await page.locator('#showWhenModalApply').click();

    // Dependent item must now be dimmed in preview (answer "yes" not yet given)
    await expect(page.locator('[data-preview-id="1.2"]')).toHaveClass(/lform-waiting/);

    // Fill "yes" in the trigger's preview textarea; blur triggers the change event
    // → _formTick.value++ → full re-render with enableWhen re-evaluation
    const triggerInput = page.locator('[data-preview-id="1.1"]').locator('textarea').first();
    await triggerInput.fill('yes');
    await triggerInput.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true })));

    // Dependent item must now be visible (condition met)
    await expect(page.locator('[data-preview-id="1.2"]')).not.toHaveClass(/lform-waiting/, { timeout: 3000 });
  });
});
