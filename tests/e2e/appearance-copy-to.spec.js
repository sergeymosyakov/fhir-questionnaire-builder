// ── E2E: Appearance modal — "Copy to…" feature ────────────────────────────────
// Tests for the Node Picker modal triggered from AppearanceModal.
//
// Run: npx playwright test tests/e2e/appearance-copy-to.spec.js
//
// ── data-testid registry ──────────────────────────────────────────────────────
//   add-root-group-btn        "+Add Root Group"
//   group-add-btn             "+" button on a group
//   add-menu-item             "Item" option in add-child menu
//   node-title-display        read-only title span
//   node-title-input          title textarea
//   action-appearance         "Appearance" action link on an item node
//   action-style              "Appearance" action link on a group node
//   appearance-raw-input      raw CSS textarea
//   appearance-copy-to-btn    "Copy to…" button in AppearanceModal footer
//   nodePickerModal           Node Picker modal backdrop
//   node-picker-search        search input
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
  // Wait for the item to appear — find the last child of the group
  // (simple: just wait for any new node with data-node-id containing groupNodeId.)
  const nodeId = groupNodeId + '.1';
  await expect(page.locator(`[data-node-id="${nodeId}"]`)).toBeVisible();

  if (title) {
    const item = page.locator(`[data-node-id="${nodeId}"]`);
    await expect(item.getByTestId('node-title-display')).toBeVisible();
    await expect(async () => {
      await item.getByTestId('node-title-display').click();
      await expect(item.getByTestId('node-title-input')).toBeVisible();
    }).toPass();
    await item.getByTestId('node-title-input').fill(title);
    await item.getByTestId('node-title-input').blur();
  }
  return nodeId;
}

/** Add a second item to a group; returns its nodeId. */
async function addSecondItem(page, groupNodeId, title) {
  const group = page.locator(`[data-node-id="${groupNodeId}"]`);
  await group.getByTestId('group-add-btn').click();
  await page.locator('[data-testid="add-menu-item"]').filter({ visible: true }).first().click();
  const nodeId = groupNodeId + '.2';
  await expect(page.locator(`[data-node-id="${nodeId}"]`)).toBeVisible();

  if (title) {
    const item = page.locator(`[data-node-id="${nodeId}"]`);
    await expect(item.getByTestId('node-title-display')).toBeVisible();
    await expect(async () => {
      await item.getByTestId('node-title-display').click();
      await expect(item.getByTestId('node-title-input')).toBeVisible();
    }).toPass();
    await item.getByTestId('node-title-input').fill(title);
    await item.getByTestId('node-title-input').blur();
  }
  return nodeId;
}

async function addSecondGroup(page) {
  await page.getByTestId('add-root-group-btn').click();
  await expect(page.locator('[data-node-id="2"]')).toBeVisible();
}

const appearanceModal  = (page) => page.locator('[data-testid="appearanceModal"]');
const nodePickerModal  = (page) => page.locator('[data-testid="nodePickerModal"]');
const rawInput         = (page) => page.getByTestId('appearance-raw-input');
const copyToBtn        = (page) => page.getByTestId('appearance-copy-to-btn');
const pickerSearch     = (page) => page.getByTestId('node-picker-search');
const pickerConfirm    = (page) => page.getByTestId('node-picker-confirm');
const pickerCb         = (page, id) => page.getByTestId(`node-picker-cb-${id}`);


async function openAppearanceModal(page, nodeId = '1.1') {
  const key = nodeId === '1' ? 'action-style' : 'action-appearance';
  const link = page.locator(`[data-node-id="${nodeId}"]`).getByTestId(key);
  await expect(link).toBeVisible();
  await link.click();
  await expect(appearanceModal(page)).toBeVisible();
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test.describe('"Copy to…" button', () => {
  test('button is visible in Appearance modal footer', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');

    await openAppearanceModal(page);
    await expect(copyToBtn(page)).toBeVisible();
    await expect(copyToBtn(page)).toHaveText('Copy to\u2026');
  });

  test('clicking "Copy to…" opens Node Picker modal', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');

    await openAppearanceModal(page);
    await copyToBtn(page).click();
    await expect(nodePickerModal(page)).toBeVisible();
  });

  test('Node Picker modal is on top of Appearance modal', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');

    await openAppearanceModal(page);
    await copyToBtn(page).click();

    const pickerZ = await nodePickerModal(page).evaluate(el => parseInt(getComputedStyle(el).zIndex, 10));
    const appearZ = await appearanceModal(page).evaluate(el => parseInt(getComputedStyle(el).zIndex, 10));
    expect(pickerZ).toBeGreaterThan(appearZ);
  });
});

test.describe('Node Picker modal UI', () => {
  test('current node is excluded from the list', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');
    await addSecondItem(page, '1', 'Target');

    await openAppearanceModal(page);
    await copyToBtn(page).click();
    await expect(nodePickerModal(page)).toBeVisible();

    // Source node (1.1) must NOT have a checkbox
    await expect(pickerCb(page, '1.1')).not.toBeVisible();
    // Target node (1.2) MUST have a checkbox
    await expect(pickerCb(page, '1.2')).toBeVisible();
  });

  test('confirm button is disabled until a node is selected', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');
    await addSecondItem(page, '1', 'Target');

    await openAppearanceModal(page);
    await copyToBtn(page).click();

    await expect(pickerConfirm(page)).toBeDisabled();
  });

  test('selecting a node enables confirm button with count', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');
    await addSecondItem(page, '1', 'Target');

    await openAppearanceModal(page);
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

    await openAppearanceModal(page);
    await copyToBtn(page).click();

    await pickerSearch(page).fill('beta');
    // Beta checkbox visible, Alpha checkbox gone
    await expect(pickerCb(page, '1.2')).toBeVisible();
    await expect(pickerCb(page, '1.1')).not.toBeVisible();
  });

  test('Cancel closes Node Picker without applying', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');
    await addSecondItem(page, '1', 'Target');

    const sourceLink = page.locator('[data-node-id="1.1"]').getByTestId('action-appearance');
    await expect(sourceLink).toBeVisible();
    await sourceLink.click();
    await expect(appearanceModal(page)).toBeVisible();
    await rawInput(page).fill('font-weight: bold');
    await copyToBtn(page).click();

    await page.getByTestId('nodePickerModalCancel').click();
    await expect(nodePickerModal(page)).not.toBeVisible();
    // Appearance modal still open
    await expect(appearanceModal(page)).toBeVisible();
    // Target node action link must NOT be active
    const targetLink = page.locator('[data-node-id="1.2"]').getByTestId('action-appearance');
    await expect(targetLink).not.toHaveClass(/action-edit--active/);
  });
});

test.describe('Copy to — apply behaviour', () => {
  test('copies CSS style to selected node', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');
    await addSecondItem(page, '1', 'Target');

    const sourceLink = page.locator('[data-node-id="1.1"]').getByTestId('action-appearance');
    await expect(sourceLink).toBeVisible();
    await sourceLink.click();
    await expect(appearanceModal(page)).toBeVisible();
    await rawInput(page).fill('font-weight: bold');
    await copyToBtn(page).click();

    await pickerCb(page, '1.2').check();
    await pickerConfirm(page).click();
    await expect(nodePickerModal(page)).not.toBeVisible();

    // Target action link must now be active
    const targetLink = page.locator('[data-node-id="1.2"]').getByTestId('action-appearance');
    await expect(targetLink).toHaveClass(/action-edit--active/);
  });

  test('opening target Appearance modal shows copied style', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');
    await addSecondItem(page, '1', 'Target');

    // Apply style to source, then copy to target
    await openAppearanceModal(page);
    await rawInput(page).fill('font-style: italic');
    await copyToBtn(page).click();
    await pickerCb(page, '1.2').check();
    await pickerConfirm(page).click();
    await expect(nodePickerModal(page)).not.toBeVisible();

    // Close appearance modal (or it's still open — just cancel)
    await page.getByTestId('appearanceModalCancel').click();

    // Open target appearance modal and verify
    await openAppearanceModal(page, '1.2');
    await expect(rawInput(page)).toHaveValue(/italic/);
  });

  test('source node style is not affected by Copy to', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');
    await addSecondItem(page, '1', 'Target');

    await openAppearanceModal(page);
    await rawInput(page).fill('font-weight: bold');
    await copyToBtn(page).click();
    await pickerCb(page, '1.2').check();
    await pickerConfirm(page).click();

    // Source modal still open — raw input unchanged
    await expect(rawInput(page)).toHaveValue('font-weight: bold');
  });

test.describe('allowedType filtering', () => {
  test('group has no checkbox when source is item', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);        // group id='1'
    await addItem(page, '1', 'Source');  // item id='1.1'
    await addSecondGroup(page);  // group id='2' — should be non-selectable

    await openAppearanceModal(page);
    await copyToBtn(page).click();
    await expect(nodePickerModal(page)).toBeVisible();

    // Group '2' must appear as a non-selectable header, not a checkbox
    await expect(page.getByTestId('node-picker-hdr-2')).toBeVisible();
    await expect(page.getByTestId('node-picker-cb-2')).not.toBeVisible();
  });

  test('item has no checkbox when source is group', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);              // group id='1' — source
    await addSecondGroup(page);        // group id='2'
    await addItem(page, '2', 'Other'); // item id='2.1' — should be non-selectable

    // Open Appearance modal on the group
    await openAppearanceModal(page, '1');
    await copyToBtn(page).click();
    await expect(nodePickerModal(page)).toBeVisible();

    // Item '2.1' must appear as non-selectable header, not a checkbox
    await expect(page.getByTestId('node-picker-hdr-2.1')).toBeVisible();
    await expect(page.getByTestId('node-picker-cb-2.1')).not.toBeVisible();
    // Group '2' must have a checkbox (same type as source)
    await expect(page.getByTestId('node-picker-cb-2')).toBeVisible();
  });
});

  test('clearing style on source and copying removes style on target', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');
    await addSecondItem(page, '1', 'Target');

    // First copy a style to target
    await openAppearanceModal(page);
    await rawInput(page).fill('font-weight: bold');
    await copyToBtn(page).click();
    await pickerCb(page, '1.2').check();
    await pickerConfirm(page).click();
    const targetLink = page.locator('[data-node-id="1.2"]').getByTestId('action-appearance');
    await expect(targetLink).toHaveClass(/action-edit--active/);

    // Now clear source style and copy again
    await rawInput(page).fill('');
    await copyToBtn(page).click();
    await pickerCb(page, '1.2').check();
    await pickerConfirm(page).click();

    // Target action link must be inactive again
    await expect(targetLink).not.toHaveClass(/action-edit--active/);
  });
});
