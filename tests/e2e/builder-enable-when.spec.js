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
//   preview-condition-hint  visibility-condition badge in the preview row
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
    await expect(page.locator('[data-node-id="1.1"]').getByTestId('action-type')).toBeVisible();

    // Title the trigger so it appears by name in the question selector
    const triggerNode = page.locator('[data-node-id="1.1"]');
    await expect(triggerNode.getByTestId('node-title-display')).toBeVisible();
    await triggerNode.getByTestId('node-title-display').click();
    await expect(triggerNode.getByTestId('node-title-input')).toBeVisible({ timeout: 10_000 });
    await triggerNode.getByTestId('node-title-input').fill('Trigger');
    await triggerNode.getByTestId('node-title-input').blur();

    // Add dependent item → id "1.2"
    await group.getByTestId('group-add-btn').click();
    await page.locator('[data-testid="add-menu-item"]').first().click();
    await expect(page.locator('[data-node-id="1.2"]').getByTestId('action-vis')).toBeVisible();

    // Open Show When modal on dependent item
    await page.locator('[data-node-id="1.2"]').getByTestId('action-vis').click();
    await expect(page.locator('[data-testid="showWhenModal"]')).toBeVisible();

    // Add a condition row
    await page.locator('[data-testid="showWhenModalBody"] .vis-add-btn').click();

    // Open the question picker dropdown
    await page.locator('[data-testid="showWhenModalBody"] .vis-q-sel-trigger').click();
    await page.waitForSelector('.vis-q-sel-drop', { timeout: 3000 });

    // Select "1.1 — Trigger" from the portal dropdown
    await page.locator('.vis-q-sel-opt[data-id="1.1"]').click();

    // Operator defaults to "=" for text type; fill the answer value
    await page.locator('[data-testid="showWhenModalBody"] .vis-cond-val-inp').fill('yes');

    // Apply the condition
    await page.locator('[data-testid="showWhenModalApply"]').click();

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

  test('removing the condition clears the stale preview visibility badge', async ({ page }) => {
    await freshStart(page);

    await page.getByTestId('add-root-group-btn').click();
    await expect(page.locator('[data-node-id="1"]')).toBeVisible();
    const group = page.locator('[data-node-id="1"]');

    // Trigger item 1.1
    await group.getByTestId('group-add-btn').click();
    await page.locator('[data-testid="add-menu-item"]').first().click();
    await expect(page.locator('[data-node-id="1.1"]').getByTestId('action-type')).toBeVisible();
    const triggerNode = page.locator('[data-node-id="1.1"]');
    await expect(triggerNode.getByTestId('node-title-display')).toBeVisible();
    await triggerNode.getByTestId('node-title-display').click();
    await expect(triggerNode.getByTestId('node-title-input')).toBeVisible({ timeout: 10_000 });
    await triggerNode.getByTestId('node-title-input').fill('Trigger');
    await triggerNode.getByTestId('node-title-input').blur();

    // Dependent item 1.2
    await group.getByTestId('group-add-btn').click();
    await page.locator('[data-testid="add-menu-item"]').first().click();
    await expect(page.locator('[data-node-id="1.2"]').getByTestId('action-vis')).toBeVisible();

    // Add a condition: 1.1 = yes
    await page.locator('[data-node-id="1.2"]').getByTestId('action-vis').click();
    await expect(page.locator('[data-testid="showWhenModal"]')).toBeVisible();
    await page.locator('[data-testid="showWhenModalBody"] .vis-add-btn').click();
    await page.locator('[data-testid="showWhenModalBody"] .vis-q-sel-trigger').click();
    await page.waitForSelector('.vis-q-sel-drop', { timeout: 3000 });
    await page.locator('.vis-q-sel-opt[data-id="1.1"]').click();
    await page.locator('[data-testid="showWhenModalBody"] .vis-cond-val-inp').fill('yes');
    await page.locator('[data-testid="showWhenModalApply"]').click();
    await expect(page.locator('[data-testid="showWhenModal"]')).not.toBeVisible();

    // Preview shows the visibility badge for 1.2, with the freshly-computed
    // human-readable text (not the placeholder "condition not met").
    const hint = page.locator('[data-preview-id="1.2"]').getByTestId('preview-condition-hint');
    await expect(hint).toBeVisible();
    await expect(hint).toContainText('Trigger');

    // Reopen Show When and remove the condition
    await page.locator('[data-node-id="1.2"]').getByTestId('action-vis').click();
    await expect(page.locator('[data-testid="showWhenModal"]')).toBeVisible();
    await page.locator('[data-testid="showWhenModalBody"] .vis-cond-rm').click();
    await page.locator('[data-testid="showWhenModalApply"]').click();
    await expect(page.locator('[data-testid="showWhenModal"]')).not.toBeVisible();

    // Badge must be gone — not stale
    await expect(page.locator('[data-preview-id="1.2"]').getByTestId('preview-condition-hint')).toHaveCount(0);
  });

  test('condition audit tooltip shows actual value and pass/fail for each enableWhen rule', async ({ page }) => {
    await freshStart(page);

    await page.getByTestId('add-root-group-btn').click();
    const group = page.locator('[data-node-id="1"]');

    // Trigger item 1.1
    await group.getByTestId('group-add-btn').click();
    await page.locator('[data-testid="add-menu-item"]').first().click();
    await expect(page.locator('[data-node-id="1.1"]').getByTestId('action-type')).toBeVisible();

    // Dependent item 1.2 with condition: 1.1 = 'yes'
    await group.getByTestId('group-add-btn').click();
    await page.locator('[data-testid="add-menu-item"]').first().click();
    await page.locator('[data-node-id="1.2"]').getByTestId('action-vis').click();
    await page.locator('[data-testid="showWhenModalBody"] .vis-add-btn').click();
    await page.locator('[data-testid="showWhenModalBody"] .vis-q-sel-trigger').click();
    await page.waitForSelector('.vis-q-sel-drop');
    await page.locator('.vis-q-sel-opt[data-id="1.1"]').click();
    await page.locator('[data-testid="showWhenModalBody"] .vis-cond-val-inp').fill('yes');
    await page.locator('[data-testid="showWhenModalApply"]').click();

    // No answer yet → hint tooltip should contain audit with ✗ and "(no answer)"
    const hint = page.locator('[data-preview-id="1.2"]').getByTestId('preview-condition-hint');
    await expect(hint).toBeVisible();
    const tipBody = await hint.getAttribute('data-tip-body');
    expect(tipBody).toContain('Enable when');
    expect(tipBody).toContain('1.1');
    expect(tipBody).toContain('(no answer)');
    expect(tipBody).toContain('\u2717'); // ✗ — condition failed

    // Fill 'yes' → condition met → item visible (hint gone)
    const triggerInput = page.locator('[data-preview-id="1.1"]').locator('textarea').first();
    await triggerInput.fill('yes');
    await triggerInput.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true })));
    await expect(page.locator('[data-preview-id="1.2"]')).not.toHaveClass(/lform-waiting/, { timeout: 3000 });
  });
});

// ── Import-based enableWhen tests (using annual-health-check fixture) ──────────

import path from 'node:path';
const ANNUAL = path.resolve('sampledata/annual-health-check.fhir.json');

async function loadAnnual(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(ANNUAL);
  await expect(page.locator('[data-preview-id="smoker"]')).toBeVisible({ timeout: 8_000 });
}

async function commitInput(page) {
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.getByTestId('preview-search-input').click();
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}

test.describe('enableWhen — fixture-based (annual-health-check)', () => {
  test('numeric > condition: pain-location shows when pain > 0', async ({ page }) => {
    await loadAnnual(page);
    // pain-location has enableWhen: pain > 0
    // Initially pain is empty → pain-location must be dimmed
    await expect(page.locator('[data-preview-id="pain-location"]')).toHaveClass(/lform-waiting/);

    // Fill pain level > 0 (pain is integer → number input or textarea)
    const painInput = page.locator('[data-preview-id="pain"]').locator('input, textarea').first();
    await painInput.fill('3');
    await painInput.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true })));
    await commitInput(page);

    await expect(page.locator('[data-preview-id="pain-location"]')).not.toHaveClass(/lform-waiting/, { timeout: 5_000 });
  });

  test('condition not met: pain-location hidden in patient view when pain = 0', async ({ page }) => {
    await loadAnnual(page);
    // Switch to patient view without filling pain
    await expect(page.getByTestId('preview-mode-patient')).not.toBeVisible();
    await page.getByTestId('preview-mode-btn').click();
    await expect(page.getByTestId('preview-mode-patient')).toBeVisible();
    await page.getByTestId('preview-mode-patient').click();
    await expect(page.locator('#lform')).toHaveClass(/patient-view/, { timeout: 5_000 });

    // pain-location must not render (enableWhen not met)
    await expect(page.locator('[data-preview-id="pain-location"]')).toHaveCount(0);
  });

  test('boolean condition: smoker = true shows cigs, smoker = false hides cigs', async ({ page }) => {
    await loadAnnual(page);
    // Initially cigs is dimmed
    await expect(page.locator('[data-preview-id="cigs"]')).toHaveClass(/lform-waiting/);

    // Check smoker → cigs visible
    await page.locator('[data-preview-id="smoker"] input[type="checkbox"]').click();
    await commitInput(page);
    await expect(page.locator('[data-preview-id="cigs"]')).not.toHaveClass(/lform-waiting/, { timeout: 5_000 });

    // Uncheck smoker → cigs dimmed again
    await page.locator('[data-preview-id="smoker"] input[type="checkbox"]').click();
    await commitInput(page);
    await expect(page.locator('[data-preview-id="cigs"]')).toHaveClass(/lform-waiting/, { timeout: 5_000 });
  });

  test('condition audit shows current answer and pass/fail in tip-body', async ({ page }) => {
    await loadAnnual(page);
    // cigs is dimmed → hint visible with audit data
    const hint = page.locator('[data-preview-id="cigs"]').getByTestId('preview-condition-hint');
    await expect(hint).toBeVisible();

    // Fill trigger and verify audit shows pass (✓)
    await page.locator('[data-preview-id="smoker"] input[type="checkbox"]').click();
    await commitInput(page);
    await expect(page.locator('[data-preview-id="cigs"]')).not.toHaveClass(/lform-waiting/, { timeout: 5_000 });
  });

  test('enableWhen on group — lifestyle group visible by default (no condition)', async ({ page }) => {
    await loadAnnual(page);
    // Lifestyle group has no enableWhen — must be fully visible (no lform-waiting class)
    await expect(page.locator('[data-preview-id="lifestyle"]')).not.toHaveClass(/lform-waiting/);
  });
});
