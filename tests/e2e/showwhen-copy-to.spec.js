// ── E2E: Show When modal — "Copy to…" feature ────────────────────────────────
// Tests for the Node Picker modal triggered from ShowWhenModal.
//
// Run: npx playwright test tests/e2e/showwhen-copy-to.spec.js
//
// ── data-testid registry ──────────────────────────────────────────────────────
//   add-root-group-btn        "+Add Root Group"
//   group-add-btn             "+" button on a group
//   add-menu-item             "Item" option in add-child menu
//   node-title-display        read-only title span
//   node-title-input          title textarea
//   action-vis                "Show When" action link on item or group node
//   showwhen-copy-to-btn      "Copy to…" button in ShowWhenModal footer
//   showWhenModal             ShowWhenModal backdrop
//   showWhenModalBody         scrollable body
//   showWhenModalCancel       Cancel button
//   nodePickerModal           Node Picker modal backdrop
//   node-picker-search        search input in Node Picker
//   node-picker-confirm       "Copy to selected (N)" confirm button
//   node-picker-cb-<id>       checkbox for node with given id
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

const showWhenModal   = (page) => page.locator('[data-testid="showWhenModal"]');
const nodePickerModal = (page) => page.locator('[data-testid="nodePickerModal"]');
const copyToBtn       = (page) => page.getByTestId('showwhen-copy-to-btn');
const pickerSearch    = (page) => page.getByTestId('node-picker-search');
const pickerConfirm   = (page) => page.getByTestId('node-picker-confirm');
const pickerCb        = (page, id) => page.getByTestId(`node-picker-cb-${id}`);
const modalBody       = (page) => page.locator('[data-testid="showWhenModalBody"]');

async function openShowWhenModal(page, nodeId = '1.1') {
  const link = page.locator(`[data-node-id="${nodeId}"]`).getByTestId('action-vis');
  await expect(link).toBeVisible();
  await link.click();
  await expect(showWhenModal(page)).toBeVisible();
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test.describe('"Copy to…" button', () => {
  test('button is visible in Show When modal footer', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');

    await openShowWhenModal(page);
    await expect(copyToBtn(page)).toBeVisible();
    await expect(copyToBtn(page)).toHaveText('Copy to\u2026');
  });

  test('clicking "Copy to…" opens Node Picker modal', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');

    await openShowWhenModal(page);
    await copyToBtn(page).click();
    await expect(nodePickerModal(page)).toBeVisible();
  });

  test('Node Picker modal is on top of Show When modal', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');

    await openShowWhenModal(page);
    await copyToBtn(page).click();

    const pickerZ = await nodePickerModal(page).evaluate(el => parseInt(getComputedStyle(el).zIndex, 10));
    const baseZ   = await showWhenModal(page).evaluate(el => parseInt(getComputedStyle(el).zIndex, 10));
    expect(pickerZ).toBeGreaterThan(baseZ);
  });
});

test.describe('Node Picker modal UI', () => {
  test('current node is excluded from the list', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');
    await addSecondItem(page, '1', 'Target');

    await openShowWhenModal(page);
    await copyToBtn(page).click();

    await expect(pickerCb(page, '1.1')).not.toBeVisible();
    await expect(pickerCb(page, '1.2')).toBeVisible();
  });

  test('confirm button is disabled until a node is selected', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');
    await addSecondItem(page, '1', 'Target');

    await openShowWhenModal(page);
    await copyToBtn(page).click();

    await expect(pickerConfirm(page)).toBeDisabled();
  });

  test('selecting a node enables confirm button with count', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');
    await addSecondItem(page, '1', 'Target');

    await openShowWhenModal(page);
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

    await openShowWhenModal(page);
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

    await openShowWhenModal(page);
    await modalBody(page).getByText('+ Add condition').click();
    await copyToBtn(page).click();

    await page.getByTestId('nodePickerModalCancel').click();
    await expect(nodePickerModal(page)).not.toBeVisible();
    await expect(showWhenModal(page)).toBeVisible();

    const targetLink = page.locator('[data-node-id="1.2"]').getByTestId('action-vis');
    await expect(targetLink).not.toHaveClass(/action-edit--active/);
  });
});

test.describe('Copy to — apply behaviour', () => {
  test('copies enableWhen condition to selected node (action link becomes active)', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');
    await addSecondItem(page, '1', 'Target');

    await openShowWhenModal(page);
    await modalBody(page).getByText('+ Add condition').click();
    await copyToBtn(page).click();

    await pickerCb(page, '1.2').check();
    await pickerConfirm(page).click();
    await expect(nodePickerModal(page)).not.toBeVisible();

    const targetLink = page.locator('[data-node-id="1.2"]').getByTestId('action-vis');
    await expect(targetLink).toHaveClass(/action-edit--active/);
  });

  test('opening target Show When modal shows copied condition', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');
    await addSecondItem(page, '1', 'Target');

    await openShowWhenModal(page);
    await modalBody(page).getByText('+ Add condition').click();
    await copyToBtn(page).click();
    await pickerCb(page, '1.2').check();
    await pickerConfirm(page).click();
    await expect(nodePickerModal(page)).not.toBeVisible();

    await page.getByTestId('showWhenModalCancel').click();

    await openShowWhenModal(page, '1.2');
    await expect(modalBody(page).locator('.vis-cond-card, .vis-cond-row').first()).toBeVisible();
  });

  test('source node conditions are not affected by Copy to', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');
    await addSecondItem(page, '1', 'Target');

    await openShowWhenModal(page);
    await modalBody(page).getByText('+ Add condition').click();
    await copyToBtn(page).click();
    await pickerCb(page, '1.2').check();
    await pickerConfirm(page).click();

    // Source modal still shows the condition
    await expect(modalBody(page).locator('.vis-cond-card, .vis-cond-row').first()).toBeVisible();
  });
});

test.describe('allowedType filtering', () => {
  test('group IS selectable (allowedType=null — enableWhen applies to groups too)', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');
    await addSecondGroup(page);   // group id='2' — should be selectable

    await openShowWhenModal(page);
    await copyToBtn(page).click();
    await expect(nodePickerModal(page)).toBeVisible();

    // Group should have a checkbox, not just a header row
    await expect(pickerCb(page, '2')).toBeVisible();
  });
});
