// ── E2E: Answer Type dropdown labels — FHIR type vs. rendering control ─────────
// Verifies the type-select dropdown (Answer Type modal) and the inline
// answer-type selector show "FHIR type (visualization)" labels instead of the
// raw itemType alias (checkbox/select/radio/checklist), per issue #47.
//
// Run: npx playwright test tests/e2e/answer-type-labels.spec.js
//
// ── data-testid registry ──────────────────────────────────────────────────────
// action-type              "Answer Type" action link (opens answerTypeModal)
// type-select              custom type dropdown inside Answer Type modal
// csel-drop                open dropdown panel (shared custom-select component)
// answerTypeModalApply     "Apply" button in Answer Type modal
// inline-answer-type       inline type dropdown rendered on each builder node
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import { freshStart, addRootGroup, addItemToGroup } from './helpers/builder.js';

async function openTypeModal(page, itemId) {
  const node = page.locator(`[data-node-id="${itemId}"]`);
  await expect(node.getByTestId('action-type')).toBeVisible();
  await node.getByTestId('action-type').click();
  const modal = page.locator('[data-testid="answerTypeModal"]');
  await expect(modal).toBeVisible();
  return modal;
}

test.describe('Answer Type modal — FHIR-aware type labels', () => {
  test('new item defaults to type "text" shown as "String"', async ({ page }) => {
    await freshStart(page);
    const groupId = await addRootGroup(page);
    const itemId  = await addItemToGroup(page, groupId);

    const modal = await openTypeModal(page, itemId);
    await expect(modal.getByTestId('type-select').locator('.sc-trigger-text')).toHaveText('String');
    await page.locator('[data-testid="answerTypeModalApply"]').click();
  });

  test('checkbox option is labelled "Boolean (checkbox)" and applies correctly', async ({ page }) => {
    await freshStart(page);
    const groupId = await addRootGroup(page);
    const itemId  = await addItemToGroup(page, groupId);

    const modal = await openTypeModal(page, itemId);
    await modal.getByTestId('type-select').click();
    const opt = page.locator('[data-testid="csel-drop"] [data-val="checkbox"]');
    await expect(opt).toHaveText('Boolean (checkbox)');
    await opt.click();
    await expect(modal.getByTestId('type-select').locator('.sc-trigger-text')).toHaveText('Boolean (checkbox)');
    await page.locator('[data-testid="answerTypeModalApply"]').click();
  });

  test('select/radio/checklist all show "Choice (…)" — never bare FHIR type', async ({ page }) => {
    await freshStart(page);
    const groupId = await addRootGroup(page);
    const itemId  = await addItemToGroup(page, groupId);

    const modal = await openTypeModal(page, itemId);
    await modal.getByTestId('type-select').click();
    const drop = page.locator('[data-testid="csel-drop"]');
    await expect(drop.locator('[data-val="select"]')).toHaveText('Choice (dropdown)');
    await expect(drop.locator('[data-val="radio"]')).toHaveText('Choice (radio buttons)');
    await expect(drop.locator('[data-val="checklist"]')).toHaveText('Choice (checkboxes)');
    await drop.locator('[data-val="radio"]').click();
    await page.locator('[data-testid="answerTypeModalApply"]').click();
  });

  test('inline answer-type selector on the builder node shows the same label', async ({ page }) => {
    await freshStart(page);
    const groupId = await addRootGroup(page);
    const itemId  = await addItemToGroup(page, groupId);

    const node = page.locator(`[data-node-id="${itemId}"]`);
    const inlineSel = node.getByTestId('inline-answer-type');
    await inlineSel.click();
    await page.locator('[data-testid="csel-drop"] [data-val="checklist"]').click();
    await expect(inlineSel.locator('.sc-trigger-text')).toHaveText('Choice (checkboxes)');
  });
});
