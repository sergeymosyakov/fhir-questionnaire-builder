// ── E2E: Expression modal — "Copy to…" feature ────────────────────────────────
// Tests for the Node Picker modal triggered from ExpressionModal.
//
// Run: npx playwright test tests/e2e/expression-copy-to.spec.js
//
// ── data-testid registry ──────────────────────────────────────────────────────
//   add-root-group-btn        "+Add Root Group"
//   group-add-btn             "+" button on a group
//   add-menu-item             "Item" option in add-child menu
//   node-title-display        read-only title span
//   node-title-input          title textarea
//   action-expr               "Expression" action link on an item node
//   expr-calc-ta              calc expression textarea in Expression modal
//   expr-init-ta              init expression textarea in Expression modal
//   expression-copy-to-btn    "Copy to…" button in ExpressionModal footer
//   expressionModal           Expression modal backdrop
//   nodePickerModal           Node Picker modal backdrop
//   node-picker-search        search input in Node Picker
//   node-picker-confirm       "Copy to selected (N)" confirm button
//   node-picker-cb-<id>       checkbox for node with given id
//   node-picker-hdr-<id>      non-selectable header row for node with given id
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';

// ── Helpers ────────────────────────────────────────────────────────────────────

async function waitForLoad(page) {
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
}

async function freshStart(page) {
  await page.goto('/');
  await waitForLoad(page);
}

async function addGroup(page) {
  await page.getByTestId('add-root-group-btn').click();
  await expect(page.locator('[data-node-id="1"]')).toBeVisible();
}

async function addItem(page, groupNodeId, title) {
  const group = page.locator(`[data-node-id="${groupNodeId}"]`);
  await group.getByTestId('group-add-btn').click();
  await page.locator('[data-testid="add-menu-item"]').filter({ visible: true }).first().click();
  const nodeId = groupNodeId + '.1';
  await expect(page.locator(`[data-node-id="${nodeId}"]`)).toBeVisible();
  if (title) {
    const item = page.locator(`[data-node-id="${nodeId}"]`);
    await expect(item.getByTestId('node-title-display')).toBeVisible();
    await item.getByTestId('node-title-display').click();
    await expect(item.getByTestId('node-title-input')).toBeVisible();
    await item.getByTestId('node-title-input').fill(title);
    await item.getByTestId('node-title-input').blur();
  }
  return nodeId;
}

async function addSecondItem(page, groupNodeId, title) {
  const group = page.locator(`[data-node-id="${groupNodeId}"]`);
  await group.getByTestId('group-add-btn').click();
  await page.locator('[data-testid="add-menu-item"]').filter({ visible: true }).first().click();
  const nodeId = groupNodeId + '.2';
  await expect(page.locator(`[data-node-id="${nodeId}"]`)).toBeVisible();
  if (title) {
    const item = page.locator(`[data-node-id="${nodeId}"]`);
    await expect(item.getByTestId('node-title-display')).toBeVisible();
    await item.getByTestId('node-title-display').click();
    await expect(item.getByTestId('node-title-input')).toBeVisible();
    await item.getByTestId('node-title-input').fill(title);
    await item.getByTestId('node-title-input').blur();
  }
  return nodeId;
}

async function addSecondGroup(page) {
  await page.getByTestId('add-root-group-btn').click();
  await expect(page.locator('[data-node-id="2"]')).toBeVisible();
}

const exprModal       = (page) => page.locator('[data-testid="expressionModal"]');
const nodePickerModal = (page) => page.locator('[data-testid="nodePickerModal"]');
const calcTa          = (page) => page.getByTestId('expr-calc-ta');
const initTa          = (page) => page.getByTestId('expr-init-ta');
const copyToBtn       = (page) => page.getByTestId('expression-copy-to-btn');
const pickerSearch    = (page) => page.getByTestId('node-picker-search');
const pickerConfirm   = (page) => page.getByTestId('node-picker-confirm');
const pickerCb        = (page, id) => page.getByTestId(`node-picker-cb-${id}`);

async function openExprModal(page, nodeId = '1.1') {
  const link = page.locator(`[data-node-id="${nodeId}"]`).getByTestId('action-expr');
  await expect(link).toBeVisible();
  await link.click();
  await expect(exprModal(page)).toBeVisible();
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test.describe('"Copy to…" button', () => {
  test('button is visible in Expression modal footer', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');

    await openExprModal(page);
    await expect(exprModal(page)).toBeVisible();
    await expect(copyToBtn(page)).toBeVisible();
    await expect(copyToBtn(page)).toHaveText('Copy to\u2026');
  });

  test('clicking "Copy to…" opens Node Picker modal', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');

    await openExprModal(page);
    await copyToBtn(page).click();
    await expect(nodePickerModal(page)).toBeVisible();
  });

  test('Node Picker modal is on top of Expression modal', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');

    await openExprModal(page);
    await copyToBtn(page).click();

    const pickerZ = await nodePickerModal(page).evaluate(el => parseInt(getComputedStyle(el).zIndex, 10));
    const exprZ   = await exprModal(page).evaluate(el => parseInt(getComputedStyle(el).zIndex, 10));
    expect(pickerZ).toBeGreaterThan(exprZ);
  });
});

test.describe('Node Picker modal UI', () => {
  test('current node is excluded from the list', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');
    await addSecondItem(page, '1', 'Target');

    await openExprModal(page);
    await copyToBtn(page).click();

    await expect(pickerCb(page, '1.1')).not.toBeVisible();
    await expect(pickerCb(page, '1.2')).toBeVisible();
  });

  test('confirm button is disabled until a node is selected', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');
    await addSecondItem(page, '1', 'Target');

    await openExprModal(page);
    await copyToBtn(page).click();

    await expect(pickerConfirm(page)).toBeDisabled();
  });

  test('selecting a node enables confirm button with count', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');
    await addSecondItem(page, '1', 'Target');

    await openExprModal(page);
    await copyToBtn(page).click();

    await pickerCb(page, '1.2').check();
    await expect(pickerConfirm(page)).toBeEnabled();
    await expect(pickerConfirm(page)).toContainText('(1)');
  });

  test('search filters the node list', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Alpha');
    await addSecondItem(page, '1', 'Beta');

    await openExprModal(page);
    await copyToBtn(page).click();

    await pickerSearch(page).fill('beta');
    await expect(pickerCb(page, '1.2')).toBeVisible();
    await expect(pickerCb(page, '1.1')).not.toBeVisible();
  });

  test('Cancel closes Node Picker without applying', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');
    await addSecondItem(page, '1', 'Target');

    await openExprModal(page);
    await calcTa(page).fill("%resource.item.where(linkId='q1').answer.value");
    await copyToBtn(page).click();

    await page.getByTestId('nodePickerModalCancel').click();
    await expect(nodePickerModal(page)).not.toBeVisible();
    await expect(exprModal(page)).toBeVisible();

    const targetLink = page.locator('[data-node-id="1.2"]').getByTestId('action-expr');
    await expect(targetLink).not.toHaveClass(/action-edit--active/);
  });
});

test.describe('Copy to — apply behaviour', () => {
  test('copies calc expression to selected node', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');
    await addSecondItem(page, '1', 'Target');

    await openExprModal(page);
    await calcTa(page).fill("%resource.item.where(linkId='q1').answer.value");
    await copyToBtn(page).click();

    await pickerCb(page, '1.2').check();
    await pickerConfirm(page).click();
    await expect(nodePickerModal(page)).not.toBeVisible();

    const targetLink = page.locator('[data-node-id="1.2"]').getByTestId('action-expr');
    await expect(targetLink).toHaveClass(/action-edit--active/);
  });

  test('opening target Expression modal shows copied calc expression', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');
    await addSecondItem(page, '1', 'Target');

    const expr = "%resource.item.where(linkId='score').answer.value";
    await openExprModal(page);
    await calcTa(page).fill(expr);
    await copyToBtn(page).click();
    await pickerCb(page, '1.2').check();
    await pickerConfirm(page).click();
    await expect(nodePickerModal(page)).not.toBeVisible();

    await page.getByTestId('expressionModalCancel').click();

    await openExprModal(page, '1.2');
    await expect(calcTa(page)).toHaveValue(expr);
  });

  test('source node expression is not affected by Copy to', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');
    await addSecondItem(page, '1', 'Target');

    const expr = "%resource.item.where(linkId='q2').answer.value";
    await openExprModal(page);
    await calcTa(page).fill(expr);
    await copyToBtn(page).click();
    await pickerCb(page, '1.2').check();
    await pickerConfirm(page).click();

    await expect(calcTa(page)).toHaveValue(expr);
  });

  test('clearing expression on source and copying removes expression on target', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');
    await addSecondItem(page, '1', 'Target');

    const expr = "%resource.item.where(linkId='q3').answer.value";

    // First copy expression to target
    await openExprModal(page);
    await calcTa(page).fill(expr);
    await copyToBtn(page).click();
    await pickerCb(page, '1.2').check();
    await pickerConfirm(page).click();
    const targetLink = page.locator('[data-node-id="1.2"]').getByTestId('action-expr');
    await expect(targetLink).toHaveClass(/action-edit--active/);

    // Now clear source and copy again
    await calcTa(page).fill('');
    await copyToBtn(page).click();
    await pickerCb(page, '1.2').check();
    await pickerConfirm(page).click();

    await expect(targetLink).not.toHaveClass(/action-edit--active/);
  });

test.describe('allowedType filtering', () => {
  test('group has no checkbox when source is item', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);             // group id='1'
    await addItem(page, '1', 'Source'); // item id='1.1'
    await addSecondGroup(page);       // group id='2' — should be non-selectable

    await openExprModal(page);
    await copyToBtn(page).click();
    await expect(nodePickerModal(page)).toBeVisible();

    // Group '2' must appear as a non-selectable header, not a checkbox
    await expect(page.getByTestId('node-picker-hdr-2')).toBeVisible();
    await expect(page.getByTestId('node-picker-cb-2')).not.toBeVisible();
  });
});

  test('copies both calc and init expressions together', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');
    await addSecondItem(page, '1', 'Target');

    const calc = "%resource.item.where(linkId='q4').answer.value";
    const init = '%age > 18';

    await openExprModal(page);
    await calcTa(page).fill(calc);
    await initTa(page).fill(init);
    await copyToBtn(page).click();
    await pickerCb(page, '1.2').check();
    await pickerConfirm(page).click();
    await expect(nodePickerModal(page)).not.toBeVisible();

    await page.getByTestId('expressionModalCancel').click();

    await openExprModal(page, '1.2');
    await expect(calcTa(page)).toHaveValue(calc);
    await expect(initTa(page)).toHaveValue(init);
  });
});
