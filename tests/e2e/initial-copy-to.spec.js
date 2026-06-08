// ── E2E: Default Value modal — "Copy to…" feature ─────────────────────────────
// Tests for the Node Picker modal triggered from InitialModal.
//
// Run: npx playwright test tests/e2e/initial-copy-to.spec.js
//
// ── data-testid registry ──────────────────────────────────────────────────────
//   add-root-group-btn        "+Add Root Group"
//   group-add-btn             "+" button on a group
//   add-menu-item             "Item" option in add-child menu
//   node-title-display        read-only title span
//   node-title-input          title textarea
//   action-default            "Default" action link on an item node
//   initial-copy-to-btn       "Copy to…" button in InitialModal footer
//   initialModal              Initial modal backdrop
//   initialModalCancel        Cancel button
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
    await expect(item.getByTestId('node-title-display')).not.toBeVisible();
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
    await expect(item.getByTestId('node-title-display')).not.toBeVisible();
    await item.getByTestId('node-title-input').fill(title);
    await item.getByTestId('node-title-input').blur();
  }
  return nodeId;
}

async function addSecondGroup(page) {
  await page.getByTestId('add-root-group-btn').click();
  await expect(page.locator('[data-node-id="2"]')).toBeVisible();
}

const initialModal    = (page) => page.locator('[data-testid="initialModal"]');
const nodePickerModal = (page) => page.locator('[data-testid="nodePickerModal"]');
const copyToBtn       = (page) => page.getByTestId('initial-copy-to-btn');
const pickerSearch    = (page) => page.getByTestId('node-picker-search');
const pickerConfirm   = (page) => page.getByTestId('node-picker-confirm');
const pickerCb        = (page, id) => page.getByTestId(`node-picker-cb-${id}`);

/** Body input or textarea inside the initial modal. */
const valueInput = (page) =>
  page.locator('[data-testid="initialModalBody"] input, [data-testid="initialModalBody"] textarea').first();

async function openInitialModal(page, nodeId = '1.1') {
  const link = page.locator(`[data-node-id="${nodeId}"]`).getByTestId('action-default');
  await expect(link).toBeVisible();
  await link.click();
  await expect(initialModal(page)).toBeVisible();
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test.describe('"Copy to…" button', () => {
  test('button is visible in Initial modal footer', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');

    await openInitialModal(page);
    await expect(copyToBtn(page)).toBeVisible();
    await expect(copyToBtn(page)).toHaveText('Copy to\u2026');
  });

  test('clicking "Copy to…" opens Node Picker modal', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');

    await openInitialModal(page);
    await copyToBtn(page).click();
    await expect(nodePickerModal(page)).toBeVisible();
  });

  test('Node Picker modal is on top of Initial modal', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');

    await openInitialModal(page);
    await copyToBtn(page).click();

    const pickerZ = await nodePickerModal(page).evaluate(el => parseInt(getComputedStyle(el).zIndex, 10));
    const initZ   = await initialModal(page).evaluate(el => parseInt(getComputedStyle(el).zIndex, 10));
    expect(pickerZ).toBeGreaterThan(initZ);
  });
});

test.describe('Node Picker modal UI', () => {
  test('current node is excluded from the list', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');
    await addSecondItem(page, '1', 'Target');

    await openInitialModal(page);
    await copyToBtn(page).click();

    await expect(pickerCb(page, '1.1')).not.toBeVisible();
    await expect(pickerCb(page, '1.2')).toBeVisible();
  });

  test('confirm button is disabled until a node is selected', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');
    await addSecondItem(page, '1', 'Target');

    await openInitialModal(page);
    await copyToBtn(page).click();

    await expect(pickerConfirm(page)).toBeDisabled();
  });

  test('selecting a node enables confirm button with count', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');
    await addSecondItem(page, '1', 'Target');

    await openInitialModal(page);
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

    await openInitialModal(page);
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

    await openInitialModal(page);
    await valueInput(page).fill('draft value');
    await copyToBtn(page).click();

    await page.getByTestId('nodePickerModalCancel').click();
    await expect(nodePickerModal(page)).not.toBeVisible();
    await expect(initialModal(page)).toBeVisible();

    const targetLink = page.locator('[data-node-id="1.2"]').getByTestId('action-default');
    await expect(targetLink).not.toHaveClass(/action-edit--active/);
  });
});

test.describe('Copy to — apply behaviour', () => {
  test('copies default value to selected node (action link becomes active)', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');
    await addSecondItem(page, '1', 'Target');

    await openInitialModal(page);
    await valueInput(page).fill('hello world');
    await copyToBtn(page).click();

    await pickerCb(page, '1.2').check();
    await pickerConfirm(page).click();
    await expect(nodePickerModal(page)).not.toBeVisible();

    const targetLink = page.locator('[data-node-id="1.2"]').getByTestId('action-default');
    await expect(targetLink).toHaveClass(/action-edit--active/);
  });

  test('opening target Default modal shows copied value', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');
    await addSecondItem(page, '1', 'Target');

    await openInitialModal(page);
    await valueInput(page).fill('copied text');
    await copyToBtn(page).click();
    await pickerCb(page, '1.2').check();
    await pickerConfirm(page).click();
    await expect(nodePickerModal(page)).not.toBeVisible();

    await page.getByTestId('initialModalCancel').click();

    await openInitialModal(page, '1.2');
    await expect(valueInput(page)).toHaveValue('copied text');
  });

  test('source node default value is not affected by Copy to', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');
    await addSecondItem(page, '1', 'Target');

    await openInitialModal(page);
    await valueInput(page).fill('source value');
    await copyToBtn(page).click();
    await pickerCb(page, '1.2').check();
    await pickerConfirm(page).click();

    await expect(valueInput(page)).toHaveValue('source value');
  });

  test('clearing value and copying removes default value from target', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');
    await addSecondItem(page, '1', 'Target');

    // First: copy a value to target
    await openInitialModal(page);
    await valueInput(page).fill('initial value');
    await copyToBtn(page).click();
    await pickerCb(page, '1.2').check();
    await pickerConfirm(page).click();
    const targetLink = page.locator('[data-node-id="1.2"]').getByTestId('action-default');
    await expect(targetLink).toHaveClass(/action-edit--active/);

    // Then: clear source value and copy again
    await valueInput(page).fill('');
    await copyToBtn(page).click();
    await pickerCb(page, '1.2').check();
    await pickerConfirm(page).click();

    await expect(targetLink).not.toHaveClass(/action-edit--active/);
  });

  test('copies to multiple nodes at once', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');
    await addSecondItem(page, '1', 'Target A');

    // Add a third item
    const group = page.locator('[data-node-id="1"]');
    await group.getByTestId('group-add-btn').click();
    await page.locator('[data-testid="add-menu-item"]').filter({ visible: true }).first().click();
    await expect(page.locator('[data-node-id="1.3"]').getByTestId('action-type')).toBeVisible();

    await openInitialModal(page);
    await valueInput(page).fill('multi copy');
    await copyToBtn(page).click();

    await pickerCb(page, '1.2').check();
    await pickerCb(page, '1.3').check();
    await expect(pickerConfirm(page)).toContainText('(2)');
    await pickerConfirm(page).click();
    await expect(nodePickerModal(page)).not.toBeVisible();

    await expect(page.locator('[data-node-id="1.2"]').getByTestId('action-default')).toHaveClass(/action-edit--active/);
    await expect(page.locator('[data-node-id="1.3"]').getByTestId('action-default')).toHaveClass(/action-edit--active/);
  });
});

test.describe('allowedType filtering', () => {
  test('group has no checkbox when source is an item', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');
    await addSecondGroup(page);   // group id='2' — non-selectable

    await openInitialModal(page);
    await copyToBtn(page).click();
    await expect(nodePickerModal(page)).toBeVisible();

    await expect(page.getByTestId('node-picker-hdr-2')).toBeVisible();
    await expect(page.getByTestId('node-picker-cb-2')).not.toBeVisible();
  });
});
