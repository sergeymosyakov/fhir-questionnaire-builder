// ── E2E: Design Note modal — "Copy to…" feature ───────────────────────────────
// Tests for the Node Picker modal triggered from NoteModal.
//
// Run: npx playwright test tests/e2e/note-copy-to.spec.js
//
// ── data-testid registry ──────────────────────────────────────────────────────
//   add-root-group-btn        "+Add Root Group"
//   group-add-btn             "+" button on a group
//   add-menu-item             "Item" option in add-child menu
//   node-title-display        read-only title span
//   node-title-input          title textarea
//   action-note               "Note" action link on an item or group node
//   note-copy-to-btn          "Copy to…" button in NoteModal footer
//   design-note-input         textarea inside NoteModal body
//   designNoteModal           Note modal backdrop
//   designNoteModalCancel     Cancel button
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

const noteModal       = (page) => page.locator('[data-testid="designNoteModal"]');
const nodePickerModal = (page) => page.locator('[data-testid="nodePickerModal"]');
const copyToBtn       = (page) => page.getByTestId('note-copy-to-btn');
const pickerSearch    = (page) => page.getByTestId('node-picker-search');
const pickerConfirm   = (page) => page.getByTestId('node-picker-confirm');
const pickerCb        = (page, id) => page.getByTestId(`node-picker-cb-${id}`);
const noteInput       = (page) => page.getByTestId('design-note-input');

async function openNoteModal(page, nodeId = '1.1') {
  const link = page.locator(`[data-node-id="${nodeId}"]`).getByTestId('action-note');
  await expect(link).toBeVisible();
  await link.click();
  await expect(noteModal(page)).toBeVisible();
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test.describe('"Copy to…" button', () => {
  test('button is visible in Design Note modal footer', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');

    await openNoteModal(page);
    await expect(copyToBtn(page)).toBeVisible();
    await expect(copyToBtn(page)).toHaveText('Copy to\u2026');
  });

  test('clicking "Copy to…" opens Node Picker modal', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');

    await openNoteModal(page);
    await copyToBtn(page).click();
    await expect(nodePickerModal(page)).toBeVisible();
  });

  test('Node Picker modal is on top of Note modal', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');

    await openNoteModal(page);
    await copyToBtn(page).click();

    const pickerZ = await nodePickerModal(page).evaluate(el => parseInt(getComputedStyle(el).zIndex, 10));
    const noteZ   = await noteModal(page).evaluate(el => parseInt(getComputedStyle(el).zIndex, 10));
    expect(pickerZ).toBeGreaterThan(noteZ);
  });
});

test.describe('Node Picker modal UI', () => {
  test('current node is excluded from the list', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');
    await addSecondItem(page, '1', 'Target');

    await openNoteModal(page);
    await copyToBtn(page).click();

    await expect(pickerCb(page, '1.1')).not.toBeVisible();
    await expect(pickerCb(page, '1.2')).toBeVisible();
  });

  test('confirm button is disabled until a node is selected', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');
    await addSecondItem(page, '1', 'Target');

    await openNoteModal(page);
    await copyToBtn(page).click();

    await expect(pickerConfirm(page)).toBeDisabled();
  });

  test('selecting a node enables confirm button with count', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');
    await addSecondItem(page, '1', 'Target');

    await openNoteModal(page);
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

    await openNoteModal(page);
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

    await openNoteModal(page);
    await noteInput(page).fill('draft note');
    await copyToBtn(page).click();

    await page.getByTestId('nodePickerModalCancel').click();
    await expect(nodePickerModal(page)).not.toBeVisible();
    await expect(noteModal(page)).toBeVisible();

    const targetLink = page.locator('[data-node-id="1.2"]').getByTestId('action-note');
    await expect(targetLink).not.toHaveClass(/action-edit--active/);
  });
});

test.describe('Copy to — apply behaviour', () => {
  test('copies design note to selected node (action link becomes active)', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');
    await addSecondItem(page, '1', 'Target');

    await openNoteModal(page);
    await noteInput(page).fill('review this');
    await copyToBtn(page).click();

    await pickerCb(page, '1.2').check();
    await pickerConfirm(page).click();
    await expect(nodePickerModal(page)).not.toBeVisible();

    const targetLink = page.locator('[data-node-id="1.2"]').getByTestId('action-note');
    await expect(targetLink).toHaveClass(/action-edit--active/);
  });

  test('opening target Note modal shows copied note text', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');
    await addSecondItem(page, '1', 'Target');

    await openNoteModal(page);
    await noteInput(page).fill('copied note text');
    await copyToBtn(page).click();
    await pickerCb(page, '1.2').check();
    await pickerConfirm(page).click();
    await expect(nodePickerModal(page)).not.toBeVisible();

    await page.getByTestId('designNoteModalCancel').click();

    await openNoteModal(page, '1.2');
    await expect(noteInput(page)).toHaveValue('copied note text');
  });

  test('source note is not affected by Copy to', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');
    await addSecondItem(page, '1', 'Target');

    await openNoteModal(page);
    await noteInput(page).fill('source note');
    await copyToBtn(page).click();
    await pickerCb(page, '1.2').check();
    await pickerConfirm(page).click();

    await expect(noteInput(page)).toHaveValue('source note');
  });

  test('clearing note and copying removes it from target', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);
    await addItem(page, '1', 'Source');
    await addSecondItem(page, '1', 'Target');

    // First copy
    await openNoteModal(page);
    await noteInput(page).fill('initial note');
    await copyToBtn(page).click();
    await pickerCb(page, '1.2').check();
    await pickerConfirm(page).click();
    const targetLink = page.locator('[data-node-id="1.2"]').getByTestId('action-note');
    await expect(targetLink).toHaveClass(/action-edit--active/);

    // Clear and copy again
    await noteInput(page).fill('');
    await copyToBtn(page).click();
    await pickerCb(page, '1.2').check();
    await pickerConfirm(page).click();

    await expect(targetLink).not.toHaveClass(/action-edit--active/);
  });

  test('note is shared across item and group nodes (no type restriction)', async ({ page }) => {
    await freshStart(page);
    await addGroup(page);      // group id='1'
    await addItem(page, '1', 'Source Item');  // item id='1.1'
    await addSecondGroup(page); // group id='2'

    // Note modal on item — group '2' should be selectable (no type filter)
    await openNoteModal(page, '1.1');
    await noteInput(page).fill('cross-type note');
    await copyToBtn(page).click();

    await expect(nodePickerModal(page)).toBeVisible();
    // Group node '2' must have a checkbox (items and groups both support notes)
    await expect(pickerCb(page, '2')).toBeVisible();
    await pickerCb(page, '2').check();
    await pickerConfirm(page).click();
    await expect(nodePickerModal(page)).not.toBeVisible();

    const groupLink = page.locator('[data-node-id="2"]').getByTestId('action-note');
    await expect(groupLink).toHaveClass(/action-edit--active/);
  });
});
