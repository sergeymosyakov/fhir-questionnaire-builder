// ── E2E: Visual Expression Builder (enableWhenExpression) ─────────────────────
// Build a FHIRPath condition with blocks, insert it into enableWhenExpression,
// and read it back into blocks (two-way).
//
// Run: npx playwright test tests/e2e/expression-builder.spec.js
//
// ── data-testid used in this suite ───────────────────────────────────────────
//   add-root-group-btn        "+Add Root Group"
//   group-add-btn             "+" button on a group
//   add-menu-item             "Item" option in add-child menu
//   node-title-display/input  inline title editor
//   action-vis                "Show When" action link
//   enablewhen-build-btn       "Build…" launcher next to the expression textarea
//   enablewhen-expr-input      the enableWhenExpression textarea
//   expressionBuilderModal     builder modal backdrop
//   expressionBuilderModalApply/Cancel  footer buttons
//   eb-item-select / eb-op-select / eb-value-input  row controls
//   eb-preview-str             the live FHIRPath preview
//   csel-drop                  custom-select dropdown; options carry data-val
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';

async function freshStart(page) {
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
}

async function addItem(page, groupId, nodeId, title) {
  const group = page.locator(`[data-node-id="${groupId}"]`);
  await group.getByTestId('group-add-btn').click();
  await page.locator('[data-testid="add-menu-item"]').first().click();
  const item = page.locator(`[data-node-id="${nodeId}"]`);
  await expect(item.getByTestId('action-vis')).toBeVisible();
  await expect(item.getByTestId('node-title-display')).toBeVisible();
  await expect(async () => {
    await item.getByTestId('node-title-display').click();
    await expect(item.getByTestId('node-title-input')).toBeVisible();
  }).toPass();
  await item.getByTestId('node-title-input').fill(title);
  await item.getByTestId('node-title-input').blur();
}

async function twoItems(page) {
  await page.getByTestId('add-root-group-btn').click();
  await expect(page.locator('[data-node-id="1"]')).toBeVisible();
  await addItem(page, '1', '1.1', 'First');
  await addItem(page, '1', '1.2', 'Second');
}

async function openBuilder(page, nodeId = '1.1') {
  const link = page.locator(`[data-node-id="${nodeId}"]`).getByTestId('action-vis');
  await expect(link).toBeVisible();
  await link.click();
  await expect(page.locator('[data-testid="showWhenModal"]')).toBeVisible();
  const buildBtn = page.getByTestId('enablewhen-build-btn');
  await expect(buildBtn).toBeVisible();
  await buildBtn.click();
  await expect(page.getByTestId('expressionBuilderModal')).toBeVisible();
}

async function pickOption(page, triggerTestId, value) {
  await page.getByTestId(triggerTestId).click();
  const opt = page.locator('[data-testid="csel-drop"]').locator(`[data-val="${value}"]`);
  await expect(opt).toBeVisible();
  await opt.click();
}

test.describe('Expression Builder', () => {
  test('builds an "has answer" condition and inserts FHIRPath', async ({ page }) => {
    await freshStart(page);
    await twoItems(page);
    await openBuilder(page, '1.1');

    await pickOption(page, 'eb-leaf-item', '1.2');
    await pickOption(page, 'eb-leaf-op', 'ex|answered');

    await expect(page.getByTestId('eb-preview-str')).toContainText("where(linkId='1.2')");
    await expect(page.getByTestId('eb-preview-str')).toContainText('.answer.exists()');

    await page.getByTestId('expressionBuilderModalApply').click();
    await expect(page.getByTestId('expressionBuilderModal')).toBeHidden();

    await expect(page.getByTestId('enablewhen-expr-input')).toHaveValue(/\.answer\.exists\(\)/); // NOSONAR — literal pattern over controlled builder output
  });

  test('builds a comparison and reads it back into a leaf (two-way)', async ({ page }) => {
    await freshStart(page);
    await twoItems(page);
    await openBuilder(page, '1.1');

    await pickOption(page, 'eb-leaf-item', '1.2');
    await page.getByTestId('eb-leaf-value-input').fill('hello');
    await expect(page.getByTestId('eb-preview-str')).toContainText("= 'hello'");

    await page.getByTestId('expressionBuilderModalApply').click();
    await expect(page.getByTestId('expressionBuilderModal')).toBeHidden();
    await expect(page.getByTestId('enablewhen-expr-input')).toHaveValue(/= 'hello'/); // NOSONAR — literal pattern over controlled builder output

    // Reopen — the text expression should be parsed back into a populated leaf.
    await page.getByTestId('enablewhen-build-btn').click();
    await expect(page.getByTestId('expressionBuilderModal')).toBeVisible();
    await expect(page.getByTestId('eb-leaf-item')).toHaveAttribute('data-value', '1.2');
    await expect(page.getByTestId('eb-leaf-value-input')).toHaveValue('hello');
  });

  test('adds a second condition as an AND/OR tree', async ({ page }) => {
    await freshStart(page);
    await twoItems(page);
    await openBuilder(page, '1.1');

    await pickOption(page, 'eb-leaf-item', '1.2');
    await pickOption(page, 'eb-leaf-op', 'ex|answered');
    // Add a second condition — the group behaviour selector appears.
    await page.getByTestId('eb-add-condition').click();
    await expect(page.getByTestId('eb-group-type')).toBeVisible();
    await expect(page.getByTestId('eb-leaf-item')).toHaveCount(2);
  });

  test('editing a leaf as text re-parses into a subtree on Apply', async ({ page }) => {
    await freshStart(page);
    await twoItems(page);
    await openBuilder(page, '1.1');

    // Switch the leaf to text and type an OR of two conditions.
    await page.getByTestId('eb-leaf-to-text').click();
    const ta = page.getByTestId('eb-leaf-text');
    await ta.fill('%x > 1 or %y > 2');
    // Apply appears next to the changed leaf; click it to commit.
    await expect(page.getByTestId('eb-leaf-apply')).toBeVisible();
    await page.getByTestId('eb-leaf-apply').click();

    // The tree splits into two leaves.
    await expect(page.getByTestId('eb-leaf-text')).toHaveCount(2);
  });

  test('a recognised leaf edited as text returns to friendly controls', async ({ page }) => {
    await freshStart(page);
    await twoItems(page);
    await openBuilder(page, '1.1');

    await pickOption(page, 'eb-leaf-item', '1.2');
    await pickOption(page, 'eb-leaf-op', 'ex|answered');
    // Flip to text; unchanged recognised expression offers "Edit visually".
    await page.getByTestId('eb-leaf-to-text').click();
    await expect(page.getByTestId('eb-leaf-text')).toBeVisible();
    await page.getByTestId('eb-leaf-to-row').click();
    await expect(page.getByTestId('eb-leaf-item')).toBeVisible();
    await expect(page.getByTestId('eb-leaf-item')).toHaveAttribute('data-value', '1.2');
  });

  test('top "Apply changes" appears on edit and applies all', async ({ page }) => {
    await freshStart(page);
    await twoItems(page);
    await openBuilder(page, '1.1');

    await page.getByTestId('eb-leaf-to-text').click();
    await expect(page.getByTestId('eb-apply-all')).toBeHidden();
    await page.getByTestId('eb-leaf-text').fill('%x > 1');
    await expect(page.getByTestId('eb-apply-all')).toBeVisible();
    await page.getByTestId('eb-apply-all').click();
    // After applying, no pending changes remain.
    await expect(page.getByTestId('eb-apply-all')).toBeHidden();
  });

  test('editing a leaf path to a non-existent item keeps the edit as text', async ({ page }) => {
    await freshStart(page);
    await twoItems(page);
    await openBuilder(page, '1.1');

    await pickOption(page, 'eb-leaf-item', '1.2');
    await pickOption(page, 'eb-leaf-op', 'ex|answered');
    await page.getByTestId('eb-leaf-to-text').click();
    await page.getByTestId('eb-leaf-text').fill("%resource.item.where(linkId='9').item.where(linkId='1.2').answer.exists()");
    await page.getByTestId('eb-leaf-apply').click();

    // No such item → stays text with the edit, not silently re-bound to a real item.
    await expect(page.getByTestId('eb-leaf-text')).toHaveValue(/linkId='9'/); // NOSONAR — literal pattern over controlled builder output
    await expect(page.getByTestId('eb-leaf-item')).toHaveCount(0);
  });
});

test.describe('Expression Builder — value / calculatedExpression', () => {
  test('builds an arithmetic value and inserts it into the calc field', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.locator('[data-node-id="1"]')).toBeVisible();
    await addItem(page, '1', '1.1', 'Score');

    // Open the Expression modal (calc + init) and launch the value builder.
    const exprLink = page.locator('[data-node-id="1.1"]').getByTestId('action-expr');
    await expect(exprLink).toBeVisible();
    await exprLink.click();
    await expect(page.getByTestId('expressionModal')).toBeVisible();
    await page.getByTestId('expr-calc-ta-build-btn').click();
    await expect(page.getByTestId('expressionBuilderModal')).toBeVisible();

    // Number * Number (no numeric sibling items exist, so operands default to Number).
    await page.getByTestId('eb-choose-number').click();
    await page.getByTestId('eb-operand-num').fill('10');
    await page.getByTestId('eb-add-operand').click();
    await pickOption(page, 'eb-arith-op', '*');
    await page.getByTestId('eb-operand-num').nth(1).fill('5');

    await expect(page.getByTestId('eb-preview-str')).toContainText('10 * 5');

    await page.getByTestId('expressionBuilderModalApply').click();
    await expect(page.getByTestId('expressionBuilderModal')).toBeHidden();
    await expect(page.getByTestId('expr-calc-ta')).toHaveValue('10 * 5');
  });

  test('builds a count aggregate over another question', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.locator('[data-node-id="1"]')).toBeVisible();
    await addItem(page, '1', '1.1', 'First');
    await addItem(page, '1', '1.2', 'Second');

    const exprLink = page.locator('[data-node-id="1.1"]').getByTestId('action-expr');
    await expect(exprLink).toBeVisible();
    await exprLink.click();
    await expect(page.getByTestId('expressionModal')).toBeVisible();
    await page.getByTestId('expr-calc-ta-build-btn').click();
    await expect(page.getByTestId('expressionBuilderModal')).toBeVisible();

    await page.getByTestId('eb-choose-number').click();
    await pickOption(page, 'eb-operand-kind', 'agg');
    await pickOption(page, 'eb-agg-item', '1.2');

    await expect(page.getByTestId('eb-preview-str')).toContainText("where(linkId='1.2')");
    await expect(page.getByTestId('eb-preview-str')).toContainText('.answer.count()');

    await page.getByTestId('expressionBuilderModalApply').click();
    await expect(page.getByTestId('expressionBuilderModal')).toBeHidden();
    await expect(page.getByTestId('expr-calc-ta')).toHaveValue(/\.answer\.count\(\)/); // NOSONAR — literal pattern over controlled builder output
  });
});
