// ── E2E: Constraint modal — "Copy to…" feature ───────────────────────────────
// Tests for the Node Picker modal triggered from ConstraintModal.
//
// Run: npx playwright test tests/e2e/constraint-copy-to.spec.js
//
// ── data-testid registry ──────────────────────────────────────────────────────
//   add-root-group-btn        "+Add Root Group"
//   group-add-btn             "+" button on a group
//   add-menu-item             "Item" option in add-child menu
//   node-title-display        read-only title span
//   node-title-input          title textarea
//   action-constraint         "Constraint" action link on an item node
//   constraint-copy-to-btn    "Copy to…" button in ConstraintModal footer
//   constraintModal           ConstraintModal backdrop
//   constraintModalBody       scrollable body
//   constraintModalCancel     Cancel button
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
  await expect(page.locator(`[data-node-id="${nodeId}"]`).getByTestId('action-type')).toBeVisible();
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
  await expect(page.locator(`[data-node-id="${nodeId}"]`).getByTestId('action-type')).toBeVisible();
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

const constraintModal = (page) => page.locator('[data-testid="constraintModal"]');
const nodePickerModal = (page) => page.locator('[data-testid="nodePickerModal"]');
const copyToBtn       = (page) => page.getByTestId('constraint-copy-to-btn');
const pickerSearch    = (page) => page.getByTestId('node-picker-search');
const pickerConfirm   = (page) => page.getByTestId('node-picker-confirm');
const pickerCb        = (page, id) => page.getByTestId(`node-picker-cb-${id}`);
const modalBody       = (page) => page.locator('[data-testid="constraintModalBody"]');

async function openConstraintModal(page, nodeId = '1.1') {
  const link = page.locator(`[data-node-id="${nodeId}"]`).getByTestId('action-constraint');
  await expect(link).toBeVisible();
  await link.click();
  await expect(constraintModal(page)).toBeVisible();
}

async function addConstraint(page, key = 'rule-1', msg = 'Must pass') {
  await modalBody(page).getByText('+ Add constraint').click();
  const keyInp = modalBody(page).locator('input[placeholder*="key"]').first();
  await keyInp.fill(key);
  const msgInp = modalBody(page).locator('input[placeholder*="message"]').first();
  await msgInp.fill(msg);
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test.describe('"Copy to…" button', () => {
  test('button is visible in Constraint modal footer', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');

    await openConstraintModal(page);
    await expect(copyToBtn(page)).toBeVisible();
    await expect(copyToBtn(page)).toHaveText('Copy to\u2026');
  });

  test('clicking "Copy to…" opens Node Picker modal', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');

    await openConstraintModal(page);
    await copyToBtn(page).click();
    await expect(nodePickerModal(page)).toBeVisible();
  });

  test('Node Picker modal is on top of Constraint modal', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');

    await openConstraintModal(page);
    await copyToBtn(page).click();

    const pickerZ = await nodePickerModal(page).evaluate(el => parseInt(getComputedStyle(el).zIndex, 10));
    const baseZ   = await constraintModal(page).evaluate(el => parseInt(getComputedStyle(el).zIndex, 10));
    expect(pickerZ).toBeGreaterThan(baseZ);
  });
});

test.describe('Node Picker modal UI', () => {
  test('current node is excluded from the list', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');
    await addSecondItem(page, '1', 'Target');

    await openConstraintModal(page);
    await copyToBtn(page).click();

    await expect(pickerCb(page, '1.1')).not.toBeVisible();
    await expect(pickerCb(page, '1.2')).toBeVisible();
  });

  test('confirm button is disabled until a node is selected', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');
    await addSecondItem(page, '1', 'Target');

    await openConstraintModal(page);
    await copyToBtn(page).click();

    await expect(pickerConfirm(page)).toBeDisabled();
  });

  test('selecting a node enables confirm button with count', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');
    await addSecondItem(page, '1', 'Target');

    await openConstraintModal(page);
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

    await openConstraintModal(page);
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

    await openConstraintModal(page);
    await addConstraint(page);
    await copyToBtn(page).click();

    await page.getByTestId('nodePickerModalCancel').click();
    await expect(nodePickerModal(page)).not.toBeVisible();
    await expect(constraintModal(page)).toBeVisible();

    const targetLink = page.locator('[data-node-id="1.2"]').getByTestId('action-constraint');
    await expect(targetLink).not.toHaveClass(/action-edit--active/);
  });
});

test.describe('Copy to — apply behaviour', () => {
  test('copies constraint to selected node (action link becomes active)', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');
    await addSecondItem(page, '1', 'Target');

    await openConstraintModal(page);
    await addConstraint(page, 'rule-1', 'Must satisfy rule');
    await copyToBtn(page).click();

    await pickerCb(page, '1.2').check();
    await pickerConfirm(page).click();
    await expect(nodePickerModal(page)).not.toBeVisible();

    const targetLink = page.locator('[data-node-id="1.2"]').getByTestId('action-constraint');
    await expect(targetLink).toHaveClass(/action-edit--active/);
  });

  test('opening target Constraint modal shows copied constraint', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');
    await addSecondItem(page, '1', 'Target');

    await openConstraintModal(page);
    await addConstraint(page, 'rule-1', 'Must satisfy rule');
    await copyToBtn(page).click();
    await pickerCb(page, '1.2').check();
    await pickerConfirm(page).click();
    await expect(nodePickerModal(page)).not.toBeVisible();

    await page.getByTestId('constraintModalCancel').click();

    await openConstraintModal(page, '1.2');
    await expect(modalBody(page).locator('.constraint-card')).toHaveCount(1);
    await expect(modalBody(page).locator('input[placeholder*="key"]').first()).toHaveValue('rule-1');
  });

  test('source node constraints are not affected by Copy to', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');
    await addSecondItem(page, '1', 'Target');

    await openConstraintModal(page);
    await addConstraint(page, 'rule-1', 'Must satisfy rule');
    await copyToBtn(page).click();
    await pickerCb(page, '1.2').check();
    await pickerConfirm(page).click();

    await expect(modalBody(page).locator('.constraint-card')).toHaveCount(1);
  });
});

test.describe('allowedType filtering', () => {
  test('group has no checkbox when source is an item', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');
    await addSecondGroup(page);   // group id='2' — non-selectable

    await openConstraintModal(page);
    await copyToBtn(page).click();
    await expect(nodePickerModal(page)).toBeVisible();

    await expect(page.getByTestId('node-picker-hdr-2')).toBeVisible();
    await expect(page.getByTestId('node-picker-cb-2')).not.toBeVisible();
  });
});
