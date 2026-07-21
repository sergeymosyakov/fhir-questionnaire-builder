// ── E2E: Drag & Drop reorder in the builder tree ─────────────────────────────
// Tests that the ⠿ drag handle reorders nodes and that the new order is
// reflected in both the builder DOM and the exported FHIR JSON.
//
// Run: npx playwright test tests/e2e/dnd.spec.js
//
// data-testid registry:
//   add-root-group-btn   "+Add Root Group" toolbar button
//   group-add-btn        gear/add button on a group
//   add-menu-item        "Add Item" option in the gear dropdown
//
// CSS classes / selectors:
//   .node-drag-handle    ⠿ drag handle element
//   .drop-zone-above     drop zone that accepts 'before' drops
//   .drop-zone-inside    drop zone that accepts 'inside-last' drops (into group)
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import { freshStart, addRootGroup, addItemToGroup } from './helpers/builder.js';

/** Add N items to a group and wait for them to appear. */
async function addItems(page, groupId, count) {
  for (let i = 0; i < count; i++) {
    const group = page.locator(`[data-node-id="${groupId}"]`);
    await group.getByTestId('group-add-btn').click();
    await expect(page.locator('[data-testid="add-menu-item"]').first()).toBeVisible();
    await page.locator('[data-testid="add-menu-item"]').first().click();
    await expect(page.locator(`[data-node-id="${groupId}.${i + 1}"]`)).toBeVisible();
    await page.keyboard.press('Escape');
  }
}

/**
 * Dispatch HTML5 drag events programmatically.
 * handleSelector  — CSS selector for the drag handle element.
 * zone            — plain descriptor resolved in-page to the drop-zone element:
 *                   { sel, index }               → querySelectorAll(sel)[index ?? 0]
 *                   { anchor, closest, within }  → querySelector(anchor).closest(closest).querySelector(within)
 */
async function doDrag(page, handleSelector, zone) {
  await page.evaluate(([hSel, z]) => {
    const handle = document.querySelector(hSel);
    let dropZone = null;
    if (z.sel) {
      dropZone = document.querySelectorAll(z.sel)[z.index ?? 0];
    } else if (z.anchor) {
      dropZone = document.querySelector(z.anchor)?.closest(z.closest)?.querySelector(z.within);
    }
    if (!handle || !dropZone) throw new Error(`Missing: ${hSel} / ${JSON.stringify(z)}`);
    const dt = new DataTransfer();
    handle.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
    dropZone.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: dt }));
    dropZone.dispatchEvent(new DragEvent('dragover',  { bubbles: true, cancelable: true, dataTransfer: dt }));
    dropZone.dispatchEvent(new DragEvent('drop',      { bubbles: true, cancelable: true, dataTransfer: dt }));
    handle.dispatchEvent(new DragEvent('dragend',     { bubbles: true, dataTransfer: dt }));
  }, [handleSelector, zone]);
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}

/** Return the exported FHIR group item's children linkIds in order. */
async function getGroupChildOrder(page, groupLinkId) {
  const json = await page.evaluate(async () => {
    const { buildFHIRObject } = await import('/js/fhir/export.js');
    return JSON.stringify(buildFHIRObject());
  });
  const q = JSON.parse(json);
  function findItem(items, id) {
    for (const it of items ?? []) {
      if (it.linkId === id) return it;
      const found = findItem(it.item ?? [], id);
      if (found) return found;
    }
  }
  const g = findItem(q.item, groupLinkId);
  return (g?.item ?? []).map(i => i.linkId);
}

test.describe('Drag & Drop — node reorder', () => {
  test('drag handle is visible on items', async ({ page }) => {
    await freshStart(page);
    await addRootGroup(page);
    await addItemToGroup(page, '1');
    await expect(page.locator('[data-node-id="1.1"] .node-drag-handle')).toBeVisible();
  });

  test('drag handle is visible on groups', async ({ page }) => {
    await freshStart(page);
    await addRootGroup(page);
    await expect(page.locator('[data-node-id="1"] .node-drag-handle')).toBeVisible();
  });

  test('dragging item 1.2 before item 1.1 reverses order in FHIR export', async ({ page }) => {
    await freshStart(page);
    await addRootGroup(page);
    await addItems(page, '1', 2); // creates 1.1 and 1.2

    // Before drag: order is [1.1, 1.2]
    const orderBefore = await getGroupChildOrder(page, '1');
    expect(orderBefore).toEqual(['1.1', '1.2']);

    // Drag 1.2's handle to the drop zone above 1.1 (first .drop-zone-above inside group 1)
    await doDrag(
      page,
      '[data-node-id="1.2"] .node-drag-handle',
      { sel: "[data-node-id='1'] .drop-zone-above", index: 0 }
    );

    // After drag: order should be [1.2, 1.1]
    const orderAfter = await getGroupChildOrder(page, '1');
    expect(orderAfter).toEqual(['1.2', '1.1']);
  });

  test('dragging item 1.1 to inside-last of group reverses order', async ({ page }) => {
    await freshStart(page);
    await addRootGroup(page);
    await addItems(page, '1', 2);

    // Drag 1.1 to the .drop-zone-inside (inside-last) of group 1
    await doDrag(
      page,
      '[data-node-id="1.1"] .node-drag-handle',
      { sel: "[data-node-id='1'] .drop-zone-inside" }
    );

    const order = await getGroupChildOrder(page, '1');
    expect(order).toEqual(['1.2', '1.1']);
  });

  test('dragging a root group changes its position in the tree', async ({ page }) => {
    await freshStart(page);
    // Add two root groups
    await addRootGroup(page);
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.locator('[data-node-id="2"]')).toBeVisible();

    // Drag group 2 to the drop zone above group 1
    // The drop-zone-above for group 1 is inside group 1's .node-wrap (as preceding sibling)
    await doDrag(
      page,
      '[data-node-id="2"] .node-drag-handle',
      { anchor: "[data-node-id='1']", closest: '.node-wrap', within: '.drop-zone-above' }
    );

    // After drag: exported FHIR item[0] should be '2'
    const json = await page.evaluate(async () => {
      const { buildFHIRObject } = await import('/js/fhir/export.js');
      return JSON.stringify(buildFHIRObject());
    });
    const q = JSON.parse(json);
    expect(q.item[0].linkId).toBe('2');
    expect(q.item[1].linkId).toBe('1');
  });

  test('dragging item into another group makes it a child of that group', async ({ page }) => {
    await freshStart(page);
    // Two root groups
    await addRootGroup(page);
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.locator('[data-node-id="2"]')).toBeVisible();

    // Add item to group 1
    await addItemToGroup(page, '1');

    // Drag 1.1 into group 2 (drop-zone-inside)
    await doDrag(
      page,
      '[data-node-id="1.1"] .node-drag-handle',
      { sel: "[data-node-id='2'] .drop-zone-inside" }
    );

    const json = await page.evaluate(async () => {
      const { buildFHIRObject } = await import('/js/fhir/export.js');
      return JSON.stringify(buildFHIRObject());
    });
    const q = JSON.parse(json);
    const g1 = q.item.find(i => i.linkId === '1');
    const g2 = q.item.find(i => i.linkId === '2');
    expect(g1?.item ?? []).toHaveLength(0);
    expect(g2?.item ?? []).toHaveLength(1);
    expect(g2.item[0].linkId).toBe('1.1');
  });

  test('drag with 3 items: move middle item to first position', async ({ page }) => {
    await freshStart(page);
    await addRootGroup(page);
    await addItems(page, '1', 3); // 1.1, 1.2, 1.3

    // Drag 1.2 to before 1.1
    await doDrag(
      page,
      '[data-node-id="1.2"] .node-drag-handle',
      { sel: "[data-node-id='1'] .drop-zone-above", index: 0 }
    );

    const order = await getGroupChildOrder(page, '1');
    expect(order[0]).toBe('1.2');
  });

  test('after drag, preview re-renders without JS errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));

    await freshStart(page);
    await addRootGroup(page);
    await addItems(page, '1', 2);

    await doDrag(
      page,
      '[data-node-id="1.2"] .node-drag-handle',
      { sel: "[data-node-id='1'] .drop-zone-above", index: 0 }
    );

    // Both preview items should still be visible after re-render
    await expect(page.locator('[data-preview-id="1.1"]')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('[data-preview-id="1.2"]')).toBeVisible({ timeout: 5_000 });
    expect(errors).toHaveLength(0);
  });
});
