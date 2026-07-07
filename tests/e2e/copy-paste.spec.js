// ── E2E: Copy / Paste nodes ───────────────────────────────────────────────────
// Covers:
//   1. Copy item is present in every node's gear menu
//   2. Paste items are disabled before first copy, enabled after
//   3. Paste after: new node inserted after source, linkId gets -copy suffix
//   4. Paste before: new node inserted before source
//   5. Copied group includes children
//   6. Multiple pastes get unique linkIds (-copy, -copy-2, ...)
//
// Copy / Paste before / Paste after now live inside the ⚙ gear menu
// (opened via the node's gear button) instead of standalone title-row icons.
// Paste items are always shown but disabled (node-gear-menu-item--disabled)
// until something has been copied.
//
// ── data-testid registry ──────────────────────────────────────────────────────
//   group-add-btn          ⚙ gear button on a group node
//   node-gear-btn          ⚙ gear button on an item node
//   node-copy-btn          "Copy" gear-menu item
//   node-paste-before-btn  "Paste before" gear-menu item (disabled until copy)
//   node-paste-after-btn   "Paste after" gear-menu item (disabled until copy)
//   node-title-display     read-only title span on each node
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import { freshStart, addRootGroup, addItemToGroup } from './helpers/builder.js';

const DISABLED_RE = /node-gear-menu-item--disabled/;

async function setup(page) {
  await page.addInitScript(() => localStorage.clear());
  await freshStart(page);
  const groupId = await addRootGroup(page);
  return groupId;
}

// Open a node's gear menu retry-safely (the toggle button may miss the first
// click), then click the requested menu-item action. Reopens the menu on each
// call because clicking an item closes it.
async function gearAction(page, nodeSel, gearTestid, actionTestid) {
  const node = page.locator(nodeSel).first();
  await expect(async () => {
    if (!(await node.getByTestId(actionTestid).first().isVisible())) {
      await node.getByTestId(gearTestid).first().click();
    }
    await expect(node.getByTestId(actionTestid).first()).toBeVisible();
  }).toPass();
  await node.getByTestId(actionTestid).first().click();
}

// Open a node's gear menu (without clicking any item) and return the node locator.
async function openGear(page, nodeSel, gearTestid, probeTestid) {
  const node = page.locator(nodeSel).first();
  await expect(async () => {
    if (!(await node.getByTestId(probeTestid).first().isVisible())) {
      await node.getByTestId(gearTestid).first().click();
    }
    await expect(node.getByTestId(probeTestid).first()).toBeVisible();
  }).toPass();
  return node;
}

// ── Menu presence + paste enabled/disabled state ─────────────────────────────

test.describe('copy/paste gear-menu state', () => {
  test('copy item is present in group gear menu', async ({ page }) => {
    const gid = await setup(page);
    const node = await openGear(page, `[data-node-id="${gid}"]`, 'group-add-btn', 'node-copy-btn');
    await expect(node.getByTestId('node-copy-btn')).toBeVisible();
  });

  test('paste items are disabled before any copy', async ({ page }) => {
    const gid = await setup(page);
    const node = await openGear(page, `[data-node-id="${gid}"]`, 'group-add-btn', 'node-paste-after-btn');
    await expect(node.getByTestId('node-paste-before-btn')).toHaveClass(DISABLED_RE);
    await expect(node.getByTestId('node-paste-after-btn')).toHaveClass(DISABLED_RE);
  });

  test('paste items become enabled after clicking copy', async ({ page }) => {
    const gid = await setup(page);
    await gearAction(page, `[data-node-id="${gid}"]`, 'group-add-btn', 'node-copy-btn');
    // After copy → BUILDER_RERENDER + CLIPBOARD_CHANGED → paste items enabled
    const node = await openGear(page, `[data-node-id="${gid}"]`, 'group-add-btn', 'node-paste-after-btn');
    await expect(node.getByTestId('node-paste-after-btn')).not.toHaveClass(DISABLED_RE);
    await expect(node.getByTestId('node-paste-before-btn')).not.toHaveClass(DISABLED_RE);
  });
});

// ── Paste after ───────────────────────────────────────────────────────────────

test.describe('paste after', () => {
  test('inserts a new group after the source', async ({ page }) => {
    await setup(page);
    // Add a second root group so we can verify ordering
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.locator('[data-node-id="2"]')).toBeVisible();

    // Copy group "1"
    await gearAction(page, '[data-node-id="1"]', 'group-add-btn', 'node-copy-btn');

    // Count nodes before paste
    const before = await page.locator('[data-testid="tree-container"] > .node-wrap').count();

    // Paste after group "1"
    await gearAction(page, '[data-node-id="1"]', 'group-add-btn', 'node-paste-after-btn');

    const after = await page.locator('[data-testid="tree-container"] > .node-wrap').count();
    expect(after).toBe(before + 1);
  });

  test('pasted node has linkId ending in -copy', async ({ page }) => {
    await setup(page);
    await gearAction(page, '[data-node-id="1"]', 'group-add-btn', 'node-copy-btn');
    await gearAction(page, '[data-node-id="1"]', 'group-add-btn', 'node-paste-after-btn');
    await expect(page.locator('[data-node-id="1-copy"]')).toBeVisible();
  });

  test('pasted node appears in preview', async ({ page }) => {
    await setup(page);
    await gearAction(page, '[data-node-id="1"]', 'group-add-btn', 'node-copy-btn');
    await gearAction(page, '[data-node-id="1"]', 'group-add-btn', 'node-paste-after-btn');
    await expect(page.locator('[data-preview-id="1-copy"]')).toBeVisible();
  });
});

// ── Paste before ─────────────────────────────────────────────────────────────

test.describe('paste before', () => {
  test('inserts a new node before the target', async ({ page }) => {
    await setup(page);
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.locator('[data-node-id="2"]')).toBeVisible();

    // Copy group "2", paste before group "1"
    await gearAction(page, '[data-node-id="2"]', 'group-add-btn', 'node-copy-btn');
    await gearAction(page, '[data-node-id="1"]', 'group-add-btn', 'node-paste-before-btn');

    // "2-copy" should exist
    await expect(page.locator('[data-node-id="2-copy"]')).toBeVisible();

    // "2-copy" must appear before "1" in the DOM
    const { copyIdx, origIdx } = await page.evaluate(() => {
      const container = document.querySelector('[data-testid="tree-container"]');
      const wrappers = Array.from(container.children);
      return {
        copyIdx: wrappers.findIndex(w => w.querySelector('[data-node-id="2-copy"]')),
        origIdx: wrappers.findIndex(w => w.querySelector('[data-node-id="1"]')),
      };
    });
    expect(copyIdx).toBeGreaterThanOrEqual(0);
    expect(copyIdx).toBeLessThan(origIdx);
  });
});

// ── Group with children ───────────────────────────────────────────────────────

test.describe('copy group with children', () => {
  test('pasted group contains the child item', async ({ page }) => {
    const gid = await setup(page);
    await addItemToGroup(page, gid);  // creates "1.1"

    await gearAction(page, '[data-node-id="1"]', 'group-add-btn', 'node-copy-btn');
    await gearAction(page, '[data-node-id="1"]', 'group-add-btn', 'node-paste-after-btn');

    // Child should appear under "1-copy" — linkId is "1.1-copy" (only leaf segment gets -copy)
    await expect(page.locator('[data-node-id="1.1-copy"]')).toBeVisible();
  });
});

// ── Duplicate linkIds ─────────────────────────────────────────────────────────

test.describe('multiple pastes — unique linkIds', () => {
  test('second paste gets -copy-2 suffix', async ({ page }) => {
    await setup(page);
    await gearAction(page, '[data-node-id="1"]', 'group-add-btn', 'node-copy-btn');
    // Paste once
    await gearAction(page, '[data-node-id="1"]', 'group-add-btn', 'node-paste-after-btn');
    await expect(page.locator('[data-node-id="1-copy"]')).toBeVisible();
    // Paste again
    await gearAction(page, '[data-node-id="1"]', 'group-add-btn', 'node-paste-after-btn');
    await expect(page.locator('[data-node-id="1-copy-2"]')).toBeVisible();
  });
});
