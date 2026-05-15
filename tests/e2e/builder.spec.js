// ── E2E: Builder → Preview reactivity ─────────────────────────────────────────
// Tests that items created / modified in the builder appear correctly in the
// preview panel. Each test starts from the default loaded example and, where
// needed, clears it to work from an empty questionnaire.
//
// Run: npx playwright test
// Run one: npx playwright test --grep "add item"
//
// ── data-testid registry ──────────────────────────────────────────────────────
// All stable test selectors used in this suite. Set via element.dataset.testid.
//
// Toolbar / shell  (index.html)
//   add-root-group-btn   "+ Add Root Group" button in the builder toolbar
//   load-fhir-btn        "⬆ Load ▾" dropdown trigger button
//   tree-container       <div> wrapping the entire builder node tree
//   status-badge-btn     coloured status badge button in the preview header
//   preview-panel        <div> wrapping the entire questionnaire preview
//
// Builder nodes  (js/builder/node-group.js, node-item.js)
//   node-title-display   read-only title <span> (click → opens textarea editor)
//   node-title-input     inline <textarea> editor for the node title
//   group-add-btn        "+" button that opens the add-child menu on a group
//   add-menu-group       "Group" option in the add-child dropdown menu
//   add-menu-item        "Item"  option in the add-child dropdown menu
//   action-type          "Answer Type" action link on an item node
//   action-mand          "Required"    action link on a group or item node
//
// Builder panels  (js/builder/panels.js)
//   type-select          <select> for choosing the item answer type
//   mand-sel             <select> for choosing the required/optional state
//
// Preview rows  (js/render-preview.js)
//   preview-required-star   "*" span shown when mandatory is null or true
//   preview-optional-badge  "optional" badge shown when mandatory is false
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';

// ── Shared helpers ─────────────────────────────────────────────────────────────

/** Wait until the app has fully initialized (toolbar button is rendered). */
async function waitForLoad(page) {
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
}

/**
 * Start from a clean empty state: navigate and wait for the app to boot.
 * The app starts with no questionnaire loaded, so no clear is needed.
 */
async function freshStart(page) {
  await page.goto('/');
  await waitForLoad(page);
}

/**
 * Add one root group and return its linkId (always "1" on a fresh tree).
 */
async function addRootGroup(page) {
  await page.getByTestId('add-root-group-btn').click();
  await expect(page.locator('[data-node-id="1"]')).toBeVisible();
  return '1';
}

/**
 * Add an item child to the group with the given nodeId.
 * Returns the new item's expected linkId (groupId + ".1" for first child).
 */
async function addItemToGroup(page, groupNodeId) {
  const group = page.locator(`[data-node-id="${groupNodeId}"]`);
  await group.getByTestId('group-add-btn').click();
  // Menu items share data-testid; only the visible menu's item is reachable.
  await page.locator('[data-testid="add-menu-item"]').first().click();
  const itemId = groupNodeId + '.1';
  await expect(page.locator(`[data-node-id="${itemId}"]`)).toBeVisible();
  return itemId;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test.describe('App boot', () => {
  test('loads a sample and renders preview', async ({ page }) => {
    await page.goto('/');
    await waitForLoad(page);

    // Open the Load dropdown.
    await page.getByTestId('load-fhir-btn').click();
    // Click the Bariatric sample entry.
    await page.click('[data-sample="example-bariatric.fhir.json"]');

    // Preview must render at least one item row (each row has data-preview-id).
    await expect(page.locator('[data-testid="preview-panel"] [data-preview-id]').first()).toBeVisible();
    // Builder tree must have at least one node.
    await expect(page.locator('[data-testid="tree-container"] [data-node-id]').first()).toBeVisible();
    // Status badge is shown.
    await expect(page.getByTestId('status-badge-btn')).toBeVisible();
  });
});

test.describe('Builder creates items → preview reacts', () => {
  test('add root group → group appears in builder and preview', async ({ page }) => {
    await freshStart(page);
    const groupId = await addRootGroup(page);

    // Builder node exists.
    await expect(page.locator(`[data-node-id="${groupId}"]`)).toBeVisible();
    // Preview row exists.
    await expect(page.locator(`[data-preview-id="${groupId}"]`)).toBeVisible();
  });

  test('add item to group → item appears in builder and preview', async ({ page }) => {
    await freshStart(page);
    const groupId = await addRootGroup(page);
    const itemId  = await addItemToGroup(page, groupId);

    await expect(page.locator(`[data-node-id="${itemId}"]`)).toBeVisible();
    await expect(page.locator(`[data-preview-id="${itemId}"]`)).toBeVisible();
  });

  test('edit item title → preview reflects the new title', async ({ page }) => {
    await freshStart(page);
    const groupId = await addRootGroup(page);
    const itemId  = await addItemToGroup(page, groupId);

    const node = page.locator(`[data-node-id="${itemId}"]`);

    // Click the display span to open the inline textarea editor.
    await node.getByTestId('node-title-display').click();
    const titleInput = node.getByTestId('node-title-input');
    await expect(titleInput).toBeVisible();

    await titleInput.fill('My Test Question');
    await titleInput.blur();

    // Preview row should now contain the typed title.
    await expect(page.locator(`[data-preview-id="${itemId}"]`))
      .toContainText('My Test Question');
  });

  test('change item type to decimal → preview renders number input', async ({ page }) => {
    await freshStart(page);
    const groupId = await addRootGroup(page);
    const itemId  = await addItemToGroup(page, groupId);

    const node = page.locator(`[data-node-id="${itemId}"]`);

    // Open the Answer Type panel.
    await node.getByTestId('action-type').click();

    // The type-select is inside the same node's panel.
    await node.getByTestId('type-select').selectOption('decimal');

    // Preview must now render a number <input>.
    await expect(page.locator(`[data-preview-id="${itemId}"] input[type="number"]`))
      .toBeVisible();
  });

  test('mark item optional → preview shows optional badge', async ({ page }) => {
    await freshStart(page);
    const groupId = await addRootGroup(page);
    const itemId  = await addItemToGroup(page, groupId);

    const node       = page.locator(`[data-node-id="${itemId}"]`);
    const previewRow = page.locator(`[data-preview-id="${itemId}"]`);

    // By default (null) the preview shows a required star *.
    await expect(previewRow.getByTestId('preview-required-star')).toBeVisible();

    // Open the Required panel.
    await node.getByTestId('action-mand').click();

    // The mandatory panel select.
    await node.getByTestId('mand-sel').selectOption('false');

    // Preview must now show "optional" badge instead of the star.
    await expect(previewRow.getByTestId('preview-optional-badge')).toBeVisible();
    await expect(previewRow.getByTestId('preview-required-star')).not.toBeVisible();
  });
});
