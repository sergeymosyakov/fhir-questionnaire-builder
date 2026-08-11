// ── E2E: Expression Builder — pipeline (Answers → value) ─────────────────────────
// Build a collection expression over a question's coded answers (source → filter
// set → reduce) via the UI, insert it into calculatedExpression, and read it
// back into the same controls (two-way). Pure parse/emit round-trips live in
// tests/expr-builder-pipeline.test.js; this asserts the UI wiring.
//
// Run: npx playwright test tests/e2e/expression-builder-pipeline.spec.js

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

async function pick(page, testid, value) {
  await page.getByTestId(testid).click();
  const opt = page.locator('[data-testid="csel-drop"]').locator(`[data-val="${value}"]`);
  await expect(opt).toBeVisible();
  await opt.click();
}

async function openCalcModal(page, nodeId = '1.1') {
  const link = page.locator(`[data-node-id="${nodeId}"]`).getByTestId('action-expr');
  await expect(link).toBeVisible();
  await link.click();
  await expect(page.getByTestId('expressionModal')).toBeVisible();
  await page.getByTestId('expr-calc-ta-build-btn').click();
  await expect(page.getByTestId('expressionBuilderModal')).toBeVisible();
}

async function reopenCalcModal(page) {
  await page.getByTestId('expr-calc-ta-build-btn').click();
  await expect(page.getByTestId('expressionBuilderModal')).toBeVisible();
}

async function addCode(page, code) {
  const inp = page.getByTestId('eb-pipe-set-input');
  await inp.fill(code);
  await inp.press('Enter');
}

const insert = (page) => page.getByTestId('expressionBuilderModalApply').click();

async function openPipeline(page, nodeId = '1.1') {
  await openCalcModal(page, nodeId);
  await page.getByTestId('eb-choose-codes').click();
}

async function pickScoped(scope, page, testid, value) {
  await scope.getByTestId(testid).click();
  const opt = page.locator('[data-testid="csel-drop"]').locator(`[data-val="${value}"]`);
  await expect(opt).toBeVisible();
  await opt.click();
}

async function openExprCalcRaw(page, expr, nodeId = '1.1') {
  const link = page.locator(`[data-node-id="${nodeId}"]`).getByTestId('action-expr');
  await expect(link).toBeVisible();
  await link.click();
  await expect(page.getByTestId('expressionModal')).toBeVisible();
  await page.getByTestId('expr-calc-ta').fill(expr);
  await page.getByTestId('expr-calc-ta-build-btn').click();
  await expect(page.getByTestId('expressionBuilderModal')).toBeVisible();
}

test.describe('Expression Builder — pipeline (Answers → value)', () => {
  test('builds codes → intersect set → join and inserts it', async ({ page }) => {
    await freshStart(page);
    await makeItems(page, 2);
    await setItemType(page, '1.2', 'select');

    await openCalcModal(page, '1.1');
    await page.getByTestId('eb-choose-codes').click();

    await pick(page, 'eb-pipe-source', '1.2');
    await page.getByTestId('eb-pipe-add-filter').click(); // defaults to "keep only codes in set"
    await addCode(page, '43633');
    await addCode(page, '43644');
    await expect(page.getByTestId('eb-pipe-set-chip')).toHaveCount(2);

    await expect(page.getByTestId('eb-preview-str')).toContainText(
      "repeat(item).where(linkId='1.2').answer.valueCoding.code",
    );
    await expect(page.getByTestId('eb-preview-str')).toContainText("intersect(('43633'|'43644'))");
    await expect(page.getByTestId('eb-preview-str')).toContainText("join(', ')");

    await insert(page);
    await expect(page.getByTestId('expressionBuilderModal')).toBeHidden();
    await expect(page.getByTestId('expr-calc-ta')).toHaveValue(
      "%resource.repeat(item).where(linkId='1.2').answer.valueCoding.code.intersect(('43633'|'43644')).join(', ')",
    );
  });

  test('reopening an existing pipeline populates the controls (two-way)', async ({ page }) => {
    await freshStart(page);
    await makeItems(page, 2);
    await setItemType(page, '1.2', 'select');

    await openCalcModal(page, '1.1');
    await page.getByTestId('eb-choose-codes').click();
    await pick(page, 'eb-pipe-source', '1.2');
    await page.getByTestId('eb-pipe-add-filter').click();
    await addCode(page, '43633');
    await addCode(page, '43644');
    await insert(page);
    await expect(page.getByTestId('expressionBuilderModal')).toBeHidden();

    await reopenCalcModal(page);
    // Auto-detected as a pipeline (no chooser); controls reflect the parsed block.
    await expect(page.getByTestId('eb-pipe-source')).toHaveAttribute('data-value', '1.2');
    await expect(page.getByTestId('eb-pipe-filter-op')).toHaveAttribute('data-value', 'intersect');
    await expect(page.getByTestId('eb-pipe-set-chip')).toHaveCount(2);
    await expect(page.getByTestId('eb-pipe-set-chip').first()).toContainText('43633');
    await expect(page.getByTestId('eb-pipe-reduce')).toHaveAttribute('data-value', 'join');
    await expect(page.getByTestId('eb-pipe-join-sep')).toHaveValue(', ');
  });

  test('reduce = any exists yields a boolean .exists() expression', async ({ page }) => {
    await freshStart(page);
    await makeItems(page, 2);
    await setItemType(page, '1.2', 'select');

    await openCalcModal(page, '1.1');
    await page.getByTestId('eb-choose-codes').click();
    await pick(page, 'eb-pipe-source', '1.2');
    await pick(page, 'eb-pipe-reduce', 'exists');

    await expect(page.getByTestId('eb-preview-str')).toContainText(
      "%resource.repeat(item).where(linkId='1.2').answer.valueCoding.code.exists()",
    );
    await insert(page);
    await expect(page.getByTestId('expr-calc-ta')).toHaveValue(/\.exists\(\)$/); // NOSONAR — literal pattern over controlled builder output
  });
});

test.describe('Expression Builder — pipeline filters & reduce', () => {
  test('exclude filter round-trips', async ({ page }) => {
    await freshStart(page);
    await makeItems(page, 2);
    await setItemType(page, '1.2', 'select');

    await openPipeline(page);
    await pick(page, 'eb-pipe-source', '1.2');
    await page.getByTestId('eb-pipe-add-filter').click();
    await pick(page, 'eb-pipe-filter-op', 'exclude');
    await addCode(page, '99999');
    await expect(page.getByTestId('eb-preview-str')).toContainText("exclude(('99999'))");
    await insert(page);

    await reopenCalcModal(page);
    await expect(page.getByTestId('eb-pipe-filter-op')).toHaveAttribute('data-value', 'exclude');
    await expect(page.getByTestId('eb-pipe-set-chip')).toHaveCount(1);
    await expect(page.getByTestId('eb-pipe-set-chip').first()).toContainText('99999');
  });

  test('distinct filter (no set) round-trips', async ({ page }) => {
    await freshStart(page);
    await makeItems(page, 2);
    await setItemType(page, '1.2', 'select');

    await openPipeline(page);
    await pick(page, 'eb-pipe-source', '1.2');
    await page.getByTestId('eb-pipe-add-filter').click();
    await pick(page, 'eb-pipe-filter-op', 'distinct');
    await expect(page.getByTestId('eb-pipe-set-input')).toHaveCount(0);
    await expect(page.getByTestId('eb-preview-str')).toContainText('.distinct().join(');
    await insert(page);

    await reopenCalcModal(page);
    await expect(page.getByTestId('eb-pipe-filter-op')).toHaveAttribute('data-value', 'distinct');
    await expect(page.getByTestId('eb-pipe-set-input')).toHaveCount(0);
  });

  test('two filters combine (intersect then distinct)', async ({ page }) => {
    await freshStart(page);
    await makeItems(page, 2);
    await setItemType(page, '1.2', 'select');

    await openPipeline(page);
    await pick(page, 'eb-pipe-source', '1.2');
    await page.getByTestId('eb-pipe-add-filter').click();
    await addCode(page, '43633');
    await page.getByTestId('eb-pipe-add-filter').click();
    await pickScoped(page.getByTestId('eb-pipe-filter').nth(1), page, 'eb-pipe-filter-op', 'distinct');

    await expect(page.getByTestId('eb-pipe-filter')).toHaveCount(2);
    await expect(page.getByTestId('eb-preview-str')).toContainText("intersect(('43633')).distinct()");
  });

  test('removing a filter drops it', async ({ page }) => {
    await freshStart(page);
    await makeItems(page, 2);
    await setItemType(page, '1.2', 'select');

    await openPipeline(page);
    await pick(page, 'eb-pipe-source', '1.2');
    await page.getByTestId('eb-pipe-add-filter').click();
    await page.getByTestId('eb-pipe-add-filter').click();
    await expect(page.getByTestId('eb-pipe-filter')).toHaveCount(2);
    await page.getByTestId('eb-pipe-remove-filter').first().click();
    await expect(page.getByTestId('eb-pipe-filter')).toHaveCount(1);
  });

  test('removing a code chip updates the set', async ({ page }) => {
    await freshStart(page);
    await makeItems(page, 2);
    await setItemType(page, '1.2', 'select');

    await openPipeline(page);
    await pick(page, 'eb-pipe-source', '1.2');
    await page.getByTestId('eb-pipe-add-filter').click();
    await addCode(page, '43633');
    await addCode(page, '43644');
    await expect(page.getByTestId('eb-pipe-set-chip')).toHaveCount(2);
    await page.getByTestId('eb-pipe-set-chip-rm').first().click();
    await expect(page.getByTestId('eb-pipe-set-chip')).toHaveCount(1);
    await expect(page.getByTestId('eb-preview-str')).toContainText("intersect(('43644'))");
  });

  test('reduce = count produces a numeric .count()', async ({ page }) => {
    await freshStart(page);
    await makeItems(page, 2);
    await setItemType(page, '1.2', 'select');

    await openPipeline(page);
    await pick(page, 'eb-pipe-source', '1.2');
    await pick(page, 'eb-pipe-reduce', 'count');
    await expect(page.getByTestId('eb-pipe-join-sep')).toHaveCount(0);
    await expect(page.getByTestId('eb-preview-str')).toContainText('.valueCoding.code.count()');
    await insert(page);
    await expect(page.getByTestId('expr-calc-ta')).toHaveValue(/\.count\(\)$/); // NOSONAR — literal pattern over controlled builder output
  });

  test('reduce = first produces .first()', async ({ page }) => {
    await freshStart(page);
    await makeItems(page, 2);
    await setItemType(page, '1.2', 'select');

    await openPipeline(page);
    await pick(page, 'eb-pipe-source', '1.2');
    await pick(page, 'eb-pipe-reduce', 'first');
    await expect(page.getByTestId('eb-preview-str')).toContainText('.valueCoding.code.first()');
    await insert(page);
    await expect(page.getByTestId('expr-calc-ta')).toHaveValue(/\.first\(\)$/); // NOSONAR — literal pattern over controlled builder output
  });

  test('reduce = leave as list emits the bare collection', async ({ page }) => {
    await freshStart(page);
    await makeItems(page, 2);
    await setItemType(page, '1.2', 'select');

    await openPipeline(page);
    await pick(page, 'eb-pipe-source', '1.2');
    await pick(page, 'eb-pipe-reduce', '');
    await insert(page);
    await expect(page.getByTestId('expr-calc-ta')).toHaveValue(
      "%resource.repeat(item).where(linkId='1.2').answer.valueCoding.code",
    );
  });

  test('source accessor follows the question type (text → valueString)', async ({ page }) => {
    await freshStart(page);
    await makeItems(page, 2);
    await setItemType(page, '1.2', 'text');

    await openPipeline(page);
    await pick(page, 'eb-pipe-source', '1.2');
    await expect(page.getByTestId('eb-preview-str')).toContainText('.answer.valueString.join(');
    await expect(page.getByTestId('eb-preview-str')).not.toContainText('valueCoding');
  });

  test('value comparison filter on a numeric source round-trips', async ({ page }) => {
    await freshStart(page);
    await makeItems(page, 2);
    await setItemType(page, '1.2', 'integer');

    await openPipeline(page);
    await pick(page, 'eb-pipe-source', '1.2');
    await page.getByTestId('eb-pipe-add-filter').click();
    await pick(page, 'eb-pipe-filter-op', 'cmp:>');
    await page.getByTestId('eb-pipe-cmp-value').fill('5');
    await pick(page, 'eb-pipe-reduce', 'count');
    await expect(page.getByTestId('eb-preview-str')).toContainText('.answer.valueInteger.where($this > 5).count()');
    await insert(page);
    await expect(page.getByTestId('expr-calc-ta')).toHaveValue(/valueInteger\.where\(\$this > 5\)\.count\(\)$/); // NOSONAR — literal pattern over controlled builder output

    await reopenCalcModal(page);
    await expect(page.getByTestId('eb-pipe-filter-op')).toHaveAttribute('data-value', 'cmp:>');
    await expect(page.getByTestId('eb-pipe-cmp-value')).toHaveValue('5');
  });

  test('ordering comparators only appear for ordered sources', async ({ page }) => {
    await freshStart(page);
    await makeItems(page, 3);
    await setItemType(page, '1.2', 'text');
    await setItemType(page, '1.3', 'integer');

    await openPipeline(page);
    await pick(page, 'eb-pipe-source', '1.2');
    await page.getByTestId('eb-pipe-add-filter').click();

    // String source: only = / != offered, no ordering ops.
    await page.getByTestId('eb-pipe-filter-op').click();
    const drop = page.locator('[data-testid="csel-drop"]');
    await expect(drop.locator('[data-val="cmp:="]')).toBeVisible();
    await expect(drop.locator('[data-val="cmp:>"]')).toHaveCount(0);
    await drop.locator('[data-val="cmp:="]').click(); // close dropdown without Escape (closes modal)

    // Numeric source: ordering ops become available.
    await pick(page, 'eb-pipe-source', '1.3');
    await page.getByTestId('eb-pipe-filter-op').click();
    await expect(page.locator('[data-testid="csel-drop"] [data-val="cmp:>"]')).toBeVisible();
  });

  test('switching to an equality-only source downgrades an ordering comparator', async ({ page }) => {
    await freshStart(page);
    await makeItems(page, 3);
    await setItemType(page, '1.3', 'integer');
    await setItemType(page, '1.2', 'text');

    await openPipeline(page);
    await pick(page, 'eb-pipe-source', '1.3');
    await page.getByTestId('eb-pipe-add-filter').click();
    await pick(page, 'eb-pipe-filter-op', 'cmp:>');
    await expect(page.getByTestId('eb-pipe-filter-op')).toHaveAttribute('data-value', 'cmp:>');

    await pick(page, 'eb-pipe-source', '1.2');
    await expect(page.getByTestId('eb-pipe-filter-op')).toHaveAttribute('data-value', 'cmp:=');
  });

  test('clearing the source yields an empty expression', async ({ page }) => {
    await freshStart(page);
    await makeItems(page, 2);
    await setItemType(page, '1.2', 'select');

    await openPipeline(page);
    await pick(page, 'eb-pipe-source', '');
    await expect(page.getByTestId('eb-preview-str')).toHaveText('\u2014');
  });
});

test.describe('Expression Builder — type chooser & raw fallback', () => {
  test('chooser: Number opens the value operand chain', async ({ page }) => {
    await freshStart(page);
    await makeItems(page, 1);
    await openCalcModal(page);
    await page.getByTestId('eb-choose-number').click();
    await expect(page.getByTestId('eb-chain')).toBeVisible();
  });

  test('chooser: Yes / No opens the condition tree', async ({ page }) => {
    await freshStart(page);
    await makeItems(page, 1);
    await openCalcModal(page);
    await page.getByTestId('eb-choose-condition').click();
    await expect(page.getByTestId('eb-tree')).toBeVisible();
  });

  test('chooser: Answers → value opens the pipeline builder', async ({ page }) => {
    await freshStart(page);
    await makeItems(page, 2);
    await setItemType(page, '1.2', 'select');
    await openCalcModal(page);
    await page.getByTestId('eb-choose-codes').click();
    await expect(page.getByTestId('eb-pipe-source')).toBeVisible();
  });

  test('non-modeled calc opens as raw; Switch to visual keeps the text', async ({ page }) => {
    await freshStart(page);
    await makeItems(page, 1);
    await openExprCalcRaw(page, "'hello'.upper()");
    await expect(page.getByTestId('eb-raw-input')).toHaveValue("'hello'.upper()");
    await page.getByTestId('eb-switch-visual').click();
    // Cannot be visualized → stays raw with the text preserved (never blanked).
    await expect(page.getByTestId('eb-raw-input')).toHaveValue("'hello'.upper()");
  });
});

