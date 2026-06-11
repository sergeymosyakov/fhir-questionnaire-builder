// ── E2E: Builder core — CRUD, bidirectional reactivity, navigation, export ────
// Tests for adding/removing/editing nodes, type changes, builder↔preview
// synchronisation, navigation, FHIR export, and state preservation.
//
// Run: npx playwright test tests/e2e/builder-core.spec.js
//
// ── data-testid registry ──────────────────────────────────────────────────────
// Toolbar
//   add-root-group-btn   "+Add Root Group" button
//   load-fhir-btn        "⬆ Load ▾" dropdown trigger
//   load-library-item    "Library" item in load dropdown
//   clear-form-btn       "×" button that opens the clear-confirm dialog
//   export-btn           "⬇ Export ▾" dropdown trigger
//   export-quest-item     "Questionnaire2026" item in export dropdown (opens saveFormatModal)
//   expand-all-btn       expand-all builder button
//   tools-btn            "🛠️ Tools ▾" dropdown trigger
//   expand-all-item      "Expand all" item in Tools dropdown (expands preview groups)
//   tree-container       <div> wrapping the entire builder node tree
//   status-badge-btn     coloured status badge in the preview header
//   preview-panel        <div> wrapping the entire questionnaire preview
// Clear-confirm dialog
//   clear-confirm-clear-btn   "Clear anyway" option
// Builder nodes
//   node-title-display   read-only title <span>
//   node-title-input     inline <textarea> editor for the node title
//   node-type-label      item type label (click → flash preview)
//   group-add-btn        "+" button on a group
//   group-collapse-btn   "▼/▶" collapse/expand button on a group
//   node-delete-btn      "×" delete button
//   add-menu-item        "Item" option in the add-child menu
//   action-type          "Answer Type" action link
//   action-states        "Required" action link
// Delete-confirm dialog
//   delete-confirm-del-btn    "Delete" button
// Preview rows
//   preview-nav-btn          "↗" icon on preview rows
//   preview-required-star    "*" required indicator
//   preview-optional-badge   "optional" badge
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import { freshStart, addRootGroup, addItemToGroup, waitForLoad } from './helpers/builder.js';
import { openDropdownItem } from './helpers/dropdown.js';

// ── App boot ──────────────────────────────────────────────────────────────────

test.describe('App boot', () => {
  test('loads a sample and renders preview', async ({ page }) => {
    await page.goto('/');
    await waitForLoad(page);

    await openDropdownItem(page, 'load-fhir-btn', 'load-library-item');
    await page.locator('[data-sample="example-bariatric.fhir.json"]').waitFor({ timeout: 10_000 });
    await page.click('[data-sample="example-bariatric.fhir.json"]');

    await expect(page.locator('[data-testid="preview-panel"] [data-preview-id]').first()).toBeVisible();
    await expect(page.locator('[data-testid="tree-container"] [data-node-id]').first()).toBeVisible();
    await expect(page.getByTestId('status-badge-btn')).toBeVisible();
  });
});

// ── Clear form ────────────────────────────────────────────────────────────────

test.describe('Clear form', () => {
  test('clear loaded questionnaire → tree is empty', async ({ page }) => {
    await page.goto('/');
    await waitForLoad(page);

    await openDropdownItem(page, 'load-fhir-btn', 'load-library-item');
    await page.locator('[data-sample="example-bariatric.fhir.json"]').waitFor({ timeout: 10_000 });
    await page.click('[data-sample="example-bariatric.fhir.json"]');
    await expect(page.locator('[data-testid="preview-panel"] [data-preview-id]').first()).toBeVisible();

    await page.getByTestId('clear-form-btn').click();
    await page.waitForSelector('.clear-confirm-backdrop');
    await page.getByTestId('clear-confirm-clear-btn').click();

    await expect(page.locator('[data-testid="tree-container"] [data-node-id]')).toHaveCount(0);
  });
});

// ── Collapse / expand group ───────────────────────────────────────────────────

test.describe('Collapse / expand group', () => {
  test('collapse group hides children; expand restores them', async ({ page }) => {
    await freshStart(page);
    const groupId = await addRootGroup(page);
    const itemId  = await addItemToGroup(page, groupId);

    const item = page.locator(`[data-node-id="${itemId}"]`);
    await expect(item).toBeVisible();

    await page.locator(`[data-node-id="${groupId}"]`).getByTestId('group-collapse-btn').click();
    await expect(item).not.toBeVisible();

    await page.locator(`[data-node-id="${groupId}"]`).getByTestId('group-collapse-btn').click();
    await expect(item).toBeVisible();
  });
});

// ── FHIR export ───────────────────────────────────────────────────────────────

test.describe('FHIR export', () => {
  test('export triggers file download with .json filename', async ({ page }) => {
    await freshStart(page);
    const groupId = await addRootGroup(page);
    const itemId  = await addItemToGroup(page, groupId);

    const group = page.locator(`[data-node-id="${groupId}"]`);
    await group.getByTestId('node-title-display').first().click();
    await expect(group.getByTestId('node-title-input').first()).toBeVisible({ timeout: 10_000 });
    await group.getByTestId('node-title-input').first().fill('My Group');
    await group.getByTestId('node-title-input').first().blur();

    const node = page.locator(`[data-node-id="${itemId}"]`);
    await expect(node.getByTestId('node-title-display')).toBeVisible();
    await node.getByTestId('node-title-display').click();
    await expect(node.getByTestId('node-title-input')).toBeVisible({ timeout: 10_000 });
    await node.getByTestId('node-title-input').fill('My Question');
    await node.getByTestId('node-title-input').blur();

    await openDropdownItem(page, 'export-btn', 'export-quest-item');
    await expect(page.getByTestId('saveFormatModal')).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('saveFormatModalApply').click().then(() =>
        page.getByTestId('prompt-save').click()
      ),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.json$/);
  });
});

// ── Bidirectional builder ↔ preview ───────────────────────────────────────────

test.describe('Builder → preview: group title edit', () => {
  test('edit group title → preview group header updates', async ({ page }) => {
    await freshStart(page);
    const groupId = await addRootGroup(page);

    const group = page.locator(`[data-node-id="${groupId}"]`);
    await group.getByTestId('node-title-display').first().click();
    await expect(group.getByTestId('node-title-input').first()).toBeVisible({ timeout: 10_000 });
    await group.getByTestId('node-title-input').first().fill('My Section');
    await group.getByTestId('node-title-input').first().blur();

    await expect(page.locator(`[data-preview-id="${groupId}"]`)).toContainText('My Section');
  });
});

test.describe('Builder → preview: delete item', () => {
  test('delete item → builder node and preview row both disappear', async ({ page }) => {
    await freshStart(page);
    const groupId = await addRootGroup(page);
    const itemId  = await addItemToGroup(page, groupId);

    await expect(page.locator(`[data-node-id="${itemId}"]`)).toBeVisible();
    await expect(page.locator(`[data-preview-id="${itemId}"]`)).toBeVisible();

    await page.locator(`[data-node-id="${itemId}"]`).getByTestId('node-delete-btn').click();
    await page.getByTestId('delete-confirm-del-btn').click();

    await expect(page.locator(`[data-node-id="${itemId}"]`)).toHaveCount(0);
    await expect(page.locator(`[data-preview-id="${itemId}"]`)).toHaveCount(0);
  });
});

test.describe('Builder → preview: delete group with children', () => {
  test('delete group removes group + all children from both panels', async ({ page }) => {
    await freshStart(page);
    const groupId = await addRootGroup(page);
    const itemId  = await addItemToGroup(page, groupId);

    await expect(page.locator(`[data-preview-id="${groupId}"]`)).toBeVisible();
    await expect(page.locator(`[data-preview-id="${itemId}"]`)).toBeVisible();

    await page.locator(`[data-node-id="${groupId}"]`).getByTestId('node-delete-btn').first().click();
    await page.getByTestId('delete-confirm-del-btn').click();

    await expect(page.locator(`[data-node-id="${groupId}"]`)).toHaveCount(0);
    await expect(page.locator(`[data-preview-id="${groupId}"]`)).toHaveCount(0);
    await expect(page.locator(`[data-preview-id="${itemId}"]`)).toHaveCount(0);
  });
});

test.describe('Builder → preview: item type changes', () => {
  async function changeType(page, itemId, typeValue) {
    const node = page.locator(`[data-node-id="${itemId}"]`);
    await expect(node.getByTestId('action-type')).toBeVisible();
    await node.getByTestId('action-type').click();
    const modal = page.locator('[data-testid="answerTypeModal"]');
    await expect(modal).toBeVisible();
    await modal.getByTestId('type-select').click();
    await page.locator(`[data-testid="csel-drop"] [data-val="${typeValue}"]`).click();
    await page.locator('[data-testid="answerTypeModalApply"]').click();
    await expect(modal).not.toBeVisible();
  }

  test('type = checkbox → preview renders a checkbox input', async ({ page }) => {
    await freshStart(page);
    const groupId = await addRootGroup(page);
    const itemId  = await addItemToGroup(page, groupId);

    await changeType(page, itemId, 'checkbox');

    await expect(
      page.locator(`[data-preview-id="${itemId}"] input[type="checkbox"]`)
    ).toBeVisible();
  });

  test('type = display → preview has no interactive input', async ({ page }) => {
    await freshStart(page);
    const groupId = await addRootGroup(page);
    const itemId  = await addItemToGroup(page, groupId);

    await changeType(page, itemId, 'display');

    await expect(
      page.locator(`[data-preview-id="${itemId}"] input, [data-preview-id="${itemId}"] textarea`)
    ).toHaveCount(0);
  });
});

// ── Navigation ────────────────────────────────────────────────────────────────

test.describe('Navigation', () => {
  test('clicking title area in builder flashes the corresponding preview row', async ({ page }) => {
    await freshStart(page);
    const groupId = await addRootGroup(page);
    const itemId  = await addItemToGroup(page, groupId);

    await expect(page.locator(`[data-preview-id="${itemId}"]`)).toBeVisible();

    await page.locator(`[data-node-id="${itemId}"]`).getByTestId('node-type-label').click();

    await expect(page.locator(`[data-preview-id="${itemId}"]`))
      .toHaveClass(/preview-flash/, { timeout: 1500 });
  });

  test('click preview row flashes the corresponding builder node', async ({ page }) => {
    await freshStart(page);
    const groupId = await addRootGroup(page);
    const itemId  = await addItemToGroup(page, groupId);

    await page.locator(`[data-preview-id="${itemId}"] [data-testid="preview-nav-btn"]`).click();

    await expect(page.locator(`[data-node-id="${itemId}"]`))
      .toHaveClass(/node-flash/, { timeout: 1500 });
  });
});

// ── Load FHIR → both panels ───────────────────────────────────────────────────

test.describe('Load FHIR → both panels', () => {
  // TODO: builder renders children of collapsed groups in DOM (data-node-id present)
  // while preview skips them — counts diverge for default-closed groups.
  test('both panels render after sample load', { timeout: 60_000 }, async ({ page }) => {
    await page.goto('/');
    await waitForLoad(page);

    await openDropdownItem(page, 'load-fhir-btn', 'load-library-item');
    await page.locator('[data-sample="example-bariatric.fhir.json"]').waitFor({ timeout: 10_000 });
    await page.click('[data-sample="example-bariatric.fhir.json"]');

    await page.getByTestId('expand-all-btn').click();
    await openDropdownItem(page, 'tools-btn', 'expand-all-item');

    await page.waitForFunction(() => {
      const nodes = document.querySelectorAll('[data-testid="tree-container"] [data-node-id]').length;
      const rows  = document.querySelectorAll('[data-testid="preview-panel"] [data-preview-id]').length;
      return nodes > 0 && nodes === rows;
    }, { timeout: 15000 });

    const nodeCount    = await page.locator('[data-testid="tree-container"] [data-node-id]').count();
    const previewCount = await page.locator('[data-testid="preview-panel"] [data-preview-id]').count();

    expect(nodeCount).toBeGreaterThan(0);
    expect(nodeCount).toBe(previewCount);
  });
});

// ── Preview answers → state ───────────────────────────────────────────────────

test.describe('Preview answers → state', () => {
  test('fill text answer persists after tree re-render', async ({ page }) => {
    await freshStart(page);
    const groupId = await addRootGroup(page);
    const itemId  = await addItemToGroup(page, groupId);

    const previewInput = page.locator(`[data-preview-id="${itemId}"]`).locator('input, textarea').first();
    await previewInput.fill('hello world');

    const group = page.locator(`[data-node-id="${groupId}"]`);
    await group.getByTestId('node-title-display').first().click();
    await expect(group.getByTestId('node-title-input').first()).toBeVisible({ timeout: 10_000 });
    await group.getByTestId('node-title-input').first().fill('Updated Title');
    await group.getByTestId('node-title-input').first().blur();

    await expect(previewInput).toHaveValue('hello world');
  });
});

// ── Builder creates items → preview reacts ────────────────────────────────────

test.describe('Builder creates items → preview reacts', () => {
  test('add root group → group appears in builder and preview', async ({ page }) => {
    await freshStart(page);
    const groupId = await addRootGroup(page);

    await expect(page.locator(`[data-node-id="${groupId}"]`)).toBeVisible();
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

    // Wait for preview to render the item before interacting with the builder title
    await expect(page.locator(`[data-preview-id="${itemId}"]`)).toBeVisible();

    const node = page.locator(`[data-node-id="${itemId}"]`);
    await expect(node.getByTestId('node-title-display')).toBeVisible();
    await node.getByTestId('node-title-display').click();
    const titleInput = node.getByTestId('node-title-input');
    await expect(titleInput).toBeVisible();
    await titleInput.fill('My Test Question');
    await titleInput.blur();

    await expect(page.locator(`[data-preview-id="${itemId}"]`))
      .toContainText('My Test Question');
  });

  test('change item type to decimal → preview renders number input', async ({ page }) => {
    await freshStart(page);
    const groupId = await addRootGroup(page);
    const itemId  = await addItemToGroup(page, groupId);

    const node = page.locator(`[data-node-id="${itemId}"]`);
    await expect(node.getByTestId('action-type')).toBeVisible();
    await node.getByTestId('action-type').click();
    const atModal = page.locator('[data-testid="answerTypeModal"]');
    await expect(atModal).toBeVisible();
    await atModal.getByTestId('type-select').click();
    await page.locator('[data-testid="csel-drop"] [data-val="decimal"]').click();
    await page.locator('[data-testid="answerTypeModalApply"]').click();
    await expect(atModal).not.toBeVisible();

    await expect(page.locator(`[data-preview-id="${itemId}"] input[type="number"]`))
      .toBeVisible();
  });

  test('mark item optional → preview shows optional badge', async ({ page }) => {
    await freshStart(page);
    const groupId = await addRootGroup(page);
    const itemId  = await addItemToGroup(page, groupId);

    const node       = page.locator(`[data-node-id="${itemId}"]`);
    const previewRow = page.locator(`[data-preview-id="${itemId}"]`);

    // new items default to optional (mandatory: false per FHIR spec)
    await expect(previewRow.getByTestId('preview-optional-badge')).toBeVisible();
    await expect(previewRow.getByTestId('preview-required-star')).not.toBeVisible();

    // mark as required
    await expect(node.getByTestId('action-states')).toBeVisible();
    await node.getByTestId('action-states').click();
    const reqModal = page.locator('[data-testid="statesModal"]');
    await expect(reqModal).toBeVisible();
    await reqModal.locator('[data-testid="states-required-sel"]').click();
    await page.locator('[data-testid="csel-drop"] [data-val="true"]').click();
    await page.locator('[data-testid="statesModalApply"]').click();

    await expect(previewRow.getByTestId('preview-required-star')).toBeVisible();
    await expect(previewRow.getByTestId('preview-optional-badge')).not.toBeVisible();

    // mark back as optional
    await expect(node.getByTestId('action-states')).toBeVisible();
    await node.getByTestId('action-states').click();
    await expect(reqModal).toBeVisible();
    await reqModal.locator('[data-testid="states-required-sel"]').click();
    await page.locator('[data-testid="csel-drop"] [data-val="false"]').click();
    await page.locator('[data-testid="statesModalApply"]').click();

    await expect(previewRow.getByTestId('preview-optional-badge')).toBeVisible();
    await expect(previewRow.getByTestId('preview-required-star')).not.toBeVisible();
  });
});
