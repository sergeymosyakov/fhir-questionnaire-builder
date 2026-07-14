// ── E2E: Item with sub-items (FHIR R4 non-group item.item[]) ─────────────────
// Tests that a non-group item with nested item[] is correctly imported,
// rendered in both builder and preview, and that sub-items can be added
// from the gear menu.
//
// Run: npx playwright test tests/e2e/item-with-subitems.spec.js
//
// ── data-testid used in this suite ───────────────────────────────────────────
//   add-root-group-btn     "+Add Root Group" button
//   group-add-btn          gear button on a group
//   node-gear-btn          gear button on an item
//   add-menu-item          "Add Item" option in the add-child menu
//   add-menu-group         "Add Group" option in the add-child menu
//   group-collapse-btn     ▼/▶ collapse button (shared by groups and items)
//   preview-panel          wrapper for the preview
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { freshStart, waitForLoad } from './helpers/builder.js';
import { openDropdownItem } from './helpers/dropdown.js';

const FIXTURES = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)), '../fixtures'
);

async function loadFixture(page, name) {
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(path.join(FIXTURES, name));
}

// ── Import: item with nested sub-items ───────────────────────────────────────

test.describe('Item with sub-items — import', () => {
  test('non-group item with item[] imports as ItemNode keeping same linkId', async ({ page }) => {
    await freshStart(page);
    await loadFixture(page, 'item-with-subitems.fhir.json');
    await waitForLoad(page);

    // q1 must appear as an item node (not re-typed as group)
    const q1 = page.locator('[data-node-id="q1"]');
    await expect(q1).toBeVisible();
    // ItemNode has node-gear-btn; GroupNode would have group-add-btn instead
    await expect(q1.getByTestId('node-gear-btn').first()).toBeVisible();
  });

  test('sub-items appear as nested builder nodes under parent', async ({ page }) => {
    await freshStart(page);
    await loadFixture(page, 'item-with-subitems.fhir.json');
    await waitForLoad(page);

    await expect(page.locator('[data-node-id="q1.1"]')).toBeVisible();
    await expect(page.locator('[data-node-id="q1.2"]')).toBeVisible();
  });

  test('sub-items appear in preview under parent item', async ({ page }) => {
    await freshStart(page);
    await loadFixture(page, 'item-with-subitems.fhir.json');
    await waitForLoad(page);

    await expect(page.locator('[data-testid="preview-panel"] [data-preview-id="q1.1"]')).toBeVisible();
    await expect(page.locator('[data-testid="preview-panel"] [data-preview-id="q1.2"]')).toBeVisible();
  });
});

// ── Builder: Add Group / Add Item to an item via gear menu ───────────────────

test.describe('Item with sub-items — add children via gear menu', () => {
  test('Add Item in gear menu adds a sub-item to an item node', async ({ page }) => {
    await freshStart(page);
    // Create root group, add an item inside it
    await page.getByTestId('add-root-group-btn').click();
    const group = page.locator('[data-node-id="1"]');
    await expect(group).toBeVisible();
    await group.getByTestId('group-add-btn').click();
    await page.locator('[data-testid="add-menu-item"]').first().click();
    const item = page.locator('[data-node-id="1.1"]');
    await expect(item).toBeVisible();

    // Open gear on item, click "Add Item"
    await item.getByTestId('node-gear-btn').click();
    const addItemBtn = page.locator('[data-testid="add-menu-item"]:visible').first();
    await expect(addItemBtn).toBeVisible();
    await addItemBtn.click();

    // Sub-item appears
    await expect(page.locator('[data-node-id="1.1.1"]')).toBeVisible();
    await expect(page.locator('[data-testid="preview-panel"] [data-preview-id="1.1.1"]')).toBeVisible();
  });

  test('Add Group in gear menu adds a sub-group to an item node', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    const group = page.locator('[data-node-id="1"]');
    await expect(group).toBeVisible();
    await group.getByTestId('group-add-btn').click();
    await page.locator('[data-testid="add-menu-item"]').first().click();
    const item = page.locator('[data-node-id="1.1"]');
    await expect(item).toBeVisible();

    // Open gear on item, click "Add Group"
    await item.getByTestId('node-gear-btn').click();
    const addGroupBtn = page.locator('[data-testid="add-menu-group"]:visible').first();
    await expect(addGroupBtn).toBeVisible();
    await addGroupBtn.click();

    // Sub-group appears
    await expect(page.locator('[data-node-id="1.1.1"]')).toBeVisible();
    await expect(page.locator('[data-node-id="1.1.1"] [data-testid="node-type-label"]')).toContainText('[Info]');
  });
});

// ── Builder collapse / expand ────────────────────────────────────────────────

test.describe('Item with sub-items — builder collapse', () => {
  test('collapse button appears on item with children; hides children when clicked', async ({ page }) => {
    await freshStart(page);
    await loadFixture(page, 'item-with-subitems.fhir.json');
    await waitForLoad(page);

    const collapseBtn = page.locator('[data-node-id="q1"]').getByTestId('group-collapse-btn');
    await expect(collapseBtn).toBeVisible();

    // Children visible before collapse
    await expect(page.locator('[data-node-id="q1.1"]')).toBeVisible();

    // Click collapse
    await collapseBtn.click();
    await expect(page.locator('[data-node-id="q1.1"]')).not.toBeVisible();

    // Click expand
    await collapseBtn.click();
    await expect(page.locator('[data-node-id="q1.1"]')).toBeVisible();
  });
});

// ── Export round-trip ────────────────────────────────────────────────────────

test.describe('Item with sub-items — export round-trip', () => {
  test('exported FHIR preserves item[] on non-group parent', async ({ page }) => {
    await freshStart(page);
    await loadFixture(page, 'item-with-subitems.fhir.json');
    await expect(page.locator('[data-node-id="q1"]')).toBeVisible({ timeout: 8_000 });

    await openDropdownItem(page, 'export-btn', 'export-quest-item');
    await expect(page.locator('[data-testid="saveFormatModal"]')).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('[data-testid="saveFormatModalApply"]').click().then(() =>
        page.getByTestId('prompt-save').click()
      ),
    ]);
    const text = await (await download.createReadStream()).toArray().then(chunks => Buffer.concat(chunks).toString());
    const json = JSON.parse(text);

    const q1 = json.item?.find(i => i.linkId === 'q1');
    expect(q1).toBeTruthy();
    expect(q1.type).toBe('boolean');        // not 'group'
    expect(q1.item).toHaveLength(2);        // sub-items preserved
    expect(q1.item[0].linkId).toBe('q1.1');
    expect(q1.item[1].linkId).toBe('q1.2');
  });
});
