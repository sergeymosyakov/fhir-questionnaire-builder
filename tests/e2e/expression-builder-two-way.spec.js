// ── E2E: Expression Builder — two-way coverage ────────────────────────────────
// Proves every supported shape round-trips through the UI: build with blocks →
// Insert → reopen → the same blocks appear (and edits apply). The pure parse/emit
// round-trips live in tests/expr-builder-*.test.js; this asserts the UI wiring.
//
// Run: npx playwright test tests/e2e/expression-builder-two-way.spec.js
//
// ── data-testid used ──────────────────────────────────────────────────────────
//   add-root-group-btn / group-add-btn / add-menu-item / node-title-*   builder
//   action-vis / enablewhen-build-btn / enablewhen-expr-input           condition host
//   action-expr / expr-calc-ta / expr-calc-ta-build-btn                 value host
//   action-type / answerTypeModal / type-select / answerTypeModalApply  item type
//   expressionBuilderModal(+Apply)                                       builder modal
//   eb-leaf / eb-leaf-item / eb-leaf-op / eb-leaf-value-input           condition leaf
//   eb-group-type / eb-add-condition                                    condition group
//   eb-operand-kind / eb-operand-num / eb-arith-op / eb-add-operand     value operands
//   eb-agg-fn / eb-agg-item                                             value aggregate
//   eb-preview-str                                                      live preview
//   csel-drop [data-val]                                               custom-select option
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';

async function freshStart(page) {
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
}

async function addItem(page, groupId, nodeId, title) {
  await page.locator(`[data-node-id="${groupId}"]`).getByTestId('group-add-btn').click();
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

// A root group with n items: 1.1 is the edited node, 1.2… are referenceable.
async function makeItems(page, n) {
  await page.getByTestId('add-root-group-btn').click();
  await expect(page.locator('[data-node-id="1"]')).toBeVisible();
  for (let i = 1; i <= n; i++) await addItem(page, '1', `1.${i}`, `Item ${i}`);
}

async function setItemType(page, nodeId, typeValue) {
  await page.locator(`[data-node-id="${nodeId}"]`).getByTestId('action-type').click();
  await expect(page.getByTestId('answerTypeModal')).toBeVisible();
  await page.getByTestId('type-select').click();
  await page.locator(`[data-testid="csel-drop"] [data-val="${typeValue}"]`).click();
  await page.getByTestId('answerTypeModalApply').click();
  await expect(page.getByTestId('answerTypeModal')).toBeHidden();
}

async function pick(scope, page, testid, value) {
  await scope.getByTestId(testid).click();
  const opt = page.locator('[data-testid="csel-drop"]').locator(`[data-val="${value}"]`);
  await expect(opt).toBeVisible();
  await opt.click();
}

async function openCondition(page, nodeId = '1.1') {
  const link = page.locator(`[data-node-id="${nodeId}"]`).getByTestId('action-vis');
  await expect(link).toBeVisible();
  await link.click();
  await expect(page.getByTestId('showWhenModal')).toBeVisible();
  await page.getByTestId('enablewhen-build-btn').click();
  await expect(page.getByTestId('expressionBuilderModal')).toBeVisible();
}

async function reopenCondition(page) {
  await page.getByTestId('enablewhen-build-btn').click();
  await expect(page.getByTestId('expressionBuilderModal')).toBeVisible();
}

async function openCalc(page, nodeId = '1.1') {
  const link = page.locator(`[data-node-id="${nodeId}"]`).getByTestId('action-expr');
  await expect(link).toBeVisible();
  await link.click();
  await expect(page.getByTestId('expressionModal')).toBeVisible();
  await page.getByTestId('expr-calc-ta-build-btn').click();
  await expect(page.getByTestId('expressionBuilderModal')).toBeVisible();
  // Empty value field shows the type chooser first; pick Number for arithmetic.
  await page.getByTestId('eb-choose-number').click();
}

async function reopenCalc(page) {
  await page.getByTestId('expr-calc-ta-build-btn').click();
  await expect(page.getByTestId('expressionBuilderModal')).toBeVisible();
}

const insert = (page) => page.getByTestId('expressionBuilderModalApply').click();

// ── Conditions (enableWhenExpression) ─────────────────────────────────────────

test.describe('Two-way — conditions', () => {
  test('has-answer round-trips to a friendly leaf', async ({ page }) => {
    await freshStart(page);
    await makeItems(page, 2);
    await openCondition(page);

    const leaf = page.getByTestId('eb-leaf').first();
    await pick(leaf, page, 'eb-leaf-item', '1.2');
    await pick(leaf, page, 'eb-leaf-op', 'ex|answered');
    await expect(page.getByTestId('eb-preview-str')).toContainText('.answer.exists()');
    await insert(page);
    await expect(page.getByTestId('enablewhen-expr-input')).toHaveValue(/\.answer\.exists\(\)/); // NOSONAR — literal pattern over controlled builder output

    await reopenCondition(page);
    await expect(page.getByTestId('eb-leaf-item')).toHaveAttribute('data-value', '1.2');
    await expect(page.getByTestId('eb-leaf-op')).toHaveAttribute('data-value', 'ex|answered');
  });

  test('numeric comparison round-trips (operator + value)', async ({ page }) => {
    await freshStart(page);
    await makeItems(page, 2);
    await setItemType(page, '1.2', 'decimal');
    await openCondition(page);

    const leaf = page.getByTestId('eb-leaf').first();
    await pick(leaf, page, 'eb-leaf-item', '1.2');
    await pick(leaf, page, 'eb-leaf-op', 'cmp|>=');
    await leaf.getByTestId('eb-leaf-value-input').fill('30');
    await expect(page.getByTestId('eb-preview-str')).toContainText('valueDecimal >= 30');
    await insert(page);
    await expect(page.getByTestId('enablewhen-expr-input')).toHaveValue(/>= 30/); // NOSONAR — literal pattern over controlled builder output

    await reopenCondition(page);
    await expect(page.getByTestId('eb-leaf-op')).toHaveAttribute('data-value', 'cmp|>=');
    await expect(page.getByTestId('eb-leaf-value-input')).toHaveValue('30');
  });

  test('ALL (AND) of two conditions round-trips', async ({ page }) => {
    await freshStart(page);
    await makeItems(page, 3);
    await openCondition(page);

    await pick(page.getByTestId('eb-leaf').first(), page, 'eb-leaf-item', '1.2');
    await pick(page.getByTestId('eb-leaf').first(), page, 'eb-leaf-op', 'ex|answered');
    await page.getByTestId('eb-add-condition').click();
    const leaf2 = page.getByTestId('eb-leaf').nth(1);
    await pick(leaf2, page, 'eb-leaf-item', '1.3');
    await pick(leaf2, page, 'eb-leaf-op', 'ex|answered');
    await expect(page.getByTestId('eb-preview-str')).toContainText(' and ');
    await insert(page);
    await expect(page.getByTestId('enablewhen-expr-input')).toHaveValue(/ and /); // NOSONAR — literal pattern over controlled builder output

    await reopenCondition(page);
    await expect(page.getByTestId('eb-leaf-item')).toHaveCount(2);
    await expect(page.getByTestId('eb-group-type')).toHaveAttribute('data-value', 'AND');
    await expect(page.getByTestId('eb-leaf-item').nth(0)).toHaveAttribute('data-value', '1.2');
    await expect(page.getByTestId('eb-leaf-item').nth(1)).toHaveAttribute('data-value', '1.3');
  });

  test('ANY (OR) behaviour round-trips', async ({ page }) => {
    await freshStart(page);
    await makeItems(page, 3);
    await openCondition(page);

    await pick(page.getByTestId('eb-leaf').first(), page, 'eb-leaf-item', '1.2');
    await pick(page.getByTestId('eb-leaf').first(), page, 'eb-leaf-op', 'ex|answered');
    await page.getByTestId('eb-add-condition').click();
    const leaf2 = page.getByTestId('eb-leaf').nth(1);
    await pick(leaf2, page, 'eb-leaf-item', '1.3');
    await pick(leaf2, page, 'eb-leaf-op', 'ex|answered');
    await pick(page.getByTestId('eb-tree'), page, 'eb-group-type', 'OR');
    await expect(page.getByTestId('eb-preview-str')).toContainText(' or ');
    await insert(page);
    await expect(page.getByTestId('enablewhen-expr-input')).toHaveValue(/ or /); // NOSONAR — literal pattern over controlled builder output

    await reopenCondition(page);
    await expect(page.getByTestId('eb-group-type')).toHaveAttribute('data-value', 'OR');
  });

  test('checkbox (boolean) comparison round-trips', async ({ page }) => {
    await freshStart(page);
    await makeItems(page, 2);
    await setItemType(page, '1.2', 'checkbox');
    await openCondition(page);

    const leaf = page.getByTestId('eb-leaf').first();
    await pick(leaf, page, 'eb-leaf-item', '1.2');
    await pick(leaf, page, 'eb-leaf-value-select', 'false');
    await expect(page.getByTestId('eb-preview-str')).toContainText('valueBoolean = false');
    await insert(page);

    await reopenCondition(page);
    await expect(page.getByTestId('eb-leaf-value-select')).toHaveAttribute('data-value', 'false');
  });

  test('has-no-answer (empty) round-trips', async ({ page }) => {
    await freshStart(page);
    await makeItems(page, 2);
    await openCondition(page);

    const leaf = page.getByTestId('eb-leaf').first();
    await pick(leaf, page, 'eb-leaf-item', '1.2');
    await pick(leaf, page, 'eb-leaf-op', 'ex|empty');
    await expect(page.getByTestId('eb-preview-str')).toContainText('.answer.empty()');
    await insert(page);

    await reopenCondition(page);
    await expect(page.getByTestId('eb-leaf-op')).toHaveAttribute('data-value', 'ex|empty');
  });

  test('not-equal operator round-trips', async ({ page }) => {
    await freshStart(page);
    await makeItems(page, 2);
    await openCondition(page);

    const leaf = page.getByTestId('eb-leaf').first();
    await pick(leaf, page, 'eb-leaf-item', '1.2');
    await pick(leaf, page, 'eb-leaf-op', 'cmp|!=');
    await leaf.getByTestId('eb-leaf-value-input').fill('x');
    await expect(page.getByTestId('eb-preview-str')).toContainText("!= 'x'");
    await insert(page);

    await reopenCondition(page);
    await expect(page.getByTestId('eb-leaf-op')).toHaveAttribute('data-value', 'cmp|!=');
    await expect(page.getByTestId('eb-leaf-value-input')).toHaveValue('x');
  });

  test('removing a condition leaves the other', async ({ page }) => {
    await freshStart(page);
    await makeItems(page, 3);
    await openCondition(page);

    await pick(page.getByTestId('eb-leaf').first(), page, 'eb-leaf-item', '1.2');
    await pick(page.getByTestId('eb-leaf').first(), page, 'eb-leaf-op', 'ex|answered');
    await page.getByTestId('eb-add-condition').click();
    const leaf2 = page.getByTestId('eb-leaf').nth(1);
    await pick(leaf2, page, 'eb-leaf-item', '1.3');
    await pick(leaf2, page, 'eb-leaf-op', 'ex|answered');
    await expect(page.getByTestId('eb-leaf-item')).toHaveCount(2);
    // Remove the second condition.
    await page.getByTestId('eb-remove-node').nth(1).click();
    await expect(page.getByTestId('eb-leaf-item')).toHaveCount(1);
    await expect(page.getByTestId('eb-leaf-item')).toHaveAttribute('data-value', '1.2');
  });

  test('nested group (AND of leaf and OR-group) round-trips', async ({ page }) => {
    await freshStart(page);
    await makeItems(page, 4);
    await openCondition(page);

    await pick(page.getByTestId('eb-leaf').first(), page, 'eb-leaf-item', '1.2');
    await pick(page.getByTestId('eb-leaf').first(), page, 'eb-leaf-op', 'ex|answered');
    // Add a nested group, then two conditions inside it.
    await page.getByTestId('eb-add-group').click();
    const inner = page.getByTestId('eb-group').nth(1);
    await pick(inner.getByTestId('eb-leaf').first(), page, 'eb-leaf-item', '1.3');
    await pick(inner.getByTestId('eb-leaf').first(), page, 'eb-leaf-op', 'ex|answered');
    await inner.getByTestId('eb-add-condition').click();
    const innerLeaf2 = inner.getByTestId('eb-leaf').nth(1);
    await pick(innerLeaf2, page, 'eb-leaf-item', '1.4');
    await pick(innerLeaf2, page, 'eb-leaf-op', 'ex|answered');

    await expect(page.getByTestId('eb-group')).toHaveCount(2);
    await expect(page.getByTestId('eb-preview-str')).toContainText(' and (');
    await insert(page);

    await reopenCondition(page);
    await expect(page.getByTestId('eb-group')).toHaveCount(2);
    await expect(page.getByTestId('eb-leaf-item')).toHaveCount(3);
  });
});

// ── Values (calculatedExpression) ─────────────────────────────────────────────

test.describe('Two-way — values', () => {
  test('arithmetic operands round-trip', async ({ page }) => {
    await freshStart(page);
    await makeItems(page, 1);
    await openCalc(page);

    await page.getByTestId('eb-operand-num').fill('10');
    await page.getByTestId('eb-add-operand').click();
    await pick(page.getByTestId('eb-chain'), page, 'eb-arith-op', '*');
    await page.getByTestId('eb-operand-num').nth(1).fill('5');
    await expect(page.getByTestId('eb-preview-str')).toContainText('10 * 5');
    await insert(page);
    await expect(page.getByTestId('expr-calc-ta')).toHaveValue('10 * 5');

    await reopenCalc(page);
    await expect(page.getByTestId('eb-operand-num').nth(0)).toHaveValue('10');
    await expect(page.getByTestId('eb-operand-num').nth(1)).toHaveValue('5');
    await expect(page.getByTestId('eb-arith-op')).toHaveAttribute('data-value', '*');
  });

  test('count aggregate round-trips (fn + item)', async ({ page }) => {
    await freshStart(page);
    await makeItems(page, 2);
    await openCalc(page);

    await pick(page.getByTestId('eb-operand').first(), page, 'eb-operand-kind', 'agg');
    await pick(page.getByTestId('eb-operand').first(), page, 'eb-agg-item', '1.2');
    await expect(page.getByTestId('eb-preview-str')).toContainText('.answer.count()');
    await insert(page);
    await expect(page.getByTestId('expr-calc-ta')).toHaveValue(/\.answer\.count\(\)/); // NOSONAR — literal pattern over controlled builder output

    await reopenCalc(page);
    await expect(page.getByTestId('eb-operand-kind')).toHaveAttribute('data-value', 'agg');
    await expect(page.getByTestId('eb-agg-fn')).toHaveAttribute('data-value', 'count');
    await expect(page.getByTestId('eb-agg-item')).toHaveAttribute('data-value', '1.2');
  });

  test('sum aggregate over a numeric item round-trips', async ({ page }) => {
    await freshStart(page);
    await makeItems(page, 2);
    await setItemType(page, '1.2', 'decimal');
    await openCalc(page);

    const operand = page.getByTestId('eb-operand').first();
    await pick(operand, page, 'eb-operand-kind', 'agg');
    await pick(operand, page, 'eb-agg-fn', 'sum');
    await pick(operand, page, 'eb-agg-item', '1.2');
    await expect(page.getByTestId('eb-preview-str')).toContainText('.answer.valueDecimal.sum()');
    await insert(page);

    await reopenCalc(page);
    await expect(page.getByTestId('eb-agg-fn')).toHaveAttribute('data-value', 'sum');
    await expect(page.getByTestId('eb-agg-item')).toHaveAttribute('data-value', '1.2');
  });

  test('division operator round-trips', async ({ page }) => {
    await freshStart(page);
    await makeItems(page, 1);
    await openCalc(page);

    await page.getByTestId('eb-operand-num').fill('12');
    await page.getByTestId('eb-add-operand').click();
    await pick(page.getByTestId('eb-chain'), page, 'eb-arith-op', '/');
    await page.getByTestId('eb-operand-num').nth(1).fill('4');
    await expect(page.getByTestId('eb-preview-str')).toContainText('12 / 4');
    await insert(page);
    await expect(page.getByTestId('expr-calc-ta')).toHaveValue('12 / 4');

    await reopenCalc(page);
    await expect(page.getByTestId('eb-arith-op')).toHaveAttribute('data-value', '/');
  });
});
