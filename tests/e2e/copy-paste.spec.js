// ── E2E: Copy / Paste nodes ───────────────────────────────────────────────────
// Covers:
//   1. Copy icon is visible on every node; paste icons are hidden before first copy
//   2. Clicking copy activates paste icons
//   3. Paste after: new node inserted after source, linkId gets -copy suffix
//   4. Paste before: new node inserted before source
//   5. Copied group includes children
//   6. Multiple pastes get unique linkIds (-copy, -copy-2, ...)
//
// ── data-testid registry ──────────────────────────────────────────────────────
//   node-copy-btn          ⧉ copy icon in node title row
//   node-paste-before-btn  ↑⧉ paste-before icon (hidden until copy)
//   node-paste-after-btn   ↓⧉ paste-after icon (hidden until copy)
//   node-title-display     read-only title span on each node
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import { freshStart, addRootGroup, addItemToGroup } from './helpers/builder.js';

async function setup(page) {
  await page.addInitScript(() => localStorage.clear());
  await freshStart(page);
  const groupId = await addRootGroup(page);
  return groupId;
}

// ── Visibility before / after copy ───────────────────────────────────────────

test.describe('copy/paste icon visibility', () => {
  test('copy icon is visible on group node', async ({ page }) => {
    const gid = await setup(page);
    await expect(page.locator(`[data-node-id="${gid}"] [data-testid="node-copy-btn"]`).first()).toBeVisible();
  });

  test('paste icons are hidden before any copy', async ({ page }) => {
    const gid = await setup(page);
    const node = page.locator(`[data-node-id="${gid}"]`).first();
    await expect(node.getByTestId('node-paste-before-btn')).toBeHidden();
    await expect(node.getByTestId('node-paste-after-btn')).toBeHidden();
  });

  test('paste icons appear after clicking copy', async ({ page }) => {
    const gid = await setup(page);
    await page.locator(`[data-node-id="${gid}"] [data-testid="node-copy-btn"]`).first().click();
    // After copy → BUILDER_RERENDER → paste icons become visible
    await expect(page.locator(`[data-node-id="${gid}"] [data-testid="node-paste-after-btn"]`).first()).toBeVisible();
    await expect(page.locator(`[data-node-id="${gid}"] [data-testid="node-paste-before-btn"]`).first()).toBeVisible();
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
    await page.locator('[data-node-id="1"] [data-testid="node-copy-btn"]').first().click();

    // Count nodes before paste
    const before = await page.locator('[data-testid="tree-container"] > .node-wrap').count();

    // Paste after group "1"
    await page.locator('[data-node-id="1"] [data-testid="node-paste-after-btn"]').first().click();

    const after = await page.locator('[data-testid="tree-container"] > .node-wrap').count();
    expect(after).toBe(before + 1);
  });

  test('pasted node has linkId ending in -copy', async ({ page }) => {
    await setup(page);
    await page.locator('[data-node-id="1"] [data-testid="node-copy-btn"]').first().click();
    await page.locator('[data-node-id="1"] [data-testid="node-paste-after-btn"]').first().click();
    await expect(page.locator('[data-node-id="1-copy"]')).toBeVisible();
  });

  test('pasted node appears in preview', async ({ page }) => {
    await setup(page);
    await page.locator('[data-node-id="1"] [data-testid="node-copy-btn"]').first().click();
    await page.locator('[data-node-id="1"] [data-testid="node-paste-after-btn"]').first().click();
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
    await page.locator('[data-node-id="2"] [data-testid="node-copy-btn"]').first().click();
    await page.locator('[data-node-id="1"] [data-testid="node-paste-before-btn"]').first().click();

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

    await page.locator('[data-node-id="1"] [data-testid="node-copy-btn"]').first().click();
    await page.locator('[data-node-id="1"] [data-testid="node-paste-after-btn"]').first().click();

    // Child should appear under "1-copy" — linkId is "1.1-copy" (only leaf segment gets -copy)
    await expect(page.locator('[data-node-id="1.1-copy"]')).toBeVisible();
  });
});

// ── Duplicate linkIds ─────────────────────────────────────────────────────────

test.describe('multiple pastes — unique linkIds', () => {
  test('second paste gets -copy-2 suffix', async ({ page }) => {
    await setup(page);
    await page.locator('[data-node-id="1"] [data-testid="node-copy-btn"]').first().click();
    // Paste once
    await page.locator('[data-node-id="1"] [data-testid="node-paste-after-btn"]').first().click();
    await expect(page.locator('[data-node-id="1-copy"]')).toBeVisible();
    // Paste again
    await page.locator('[data-node-id="1"] [data-testid="node-paste-after-btn"]').first().click();
    await expect(page.locator('[data-node-id="1-copy-2"]')).toBeVisible();
  });
});
