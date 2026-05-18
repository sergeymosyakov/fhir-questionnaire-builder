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
//   add-root-group-btn        "+Add Root Group" button in the builder toolbar
//   load-fhir-btn             "⬆ Load ▾" dropdown trigger button
//   clear-form-btn            "×" button that opens the clear-confirm dialog
//   export-fhir-btn           "⬇ Export" button; triggers filename prompt then download
//   validate-btn              "Validate" button in the builder toolbar
//   tree-container            <div> wrapping the entire builder node tree
//   status-badge-btn          coloured status badge button in the preview header
//   preview-panel             <div> wrapping the entire questionnaire preview
//   patient-preset-btn        "👤 Patient ▾" preset dropdown button
//   variables-reinit-btn      "↺ Re-init" button in the Variables panel
//
// Clear-confirm dialog  (js/app.js — dynamically created)
//   clear-confirm-export-btn  "⬇ Export first" option in the clear dialog
//   clear-confirm-clear-btn   "Clear anyway"  option in the clear dialog
//   clear-confirm-cancel-btn  "Cancel"        option in the clear dialog
//
// Builder nodes  (js/builder/node-group.js, node-item.js)
//   node-title-display   read-only title <span> (click → opens textarea editor)
//   node-title-input     inline <textarea> editor for the node title
//   group-add-btn        "+" button that opens the add-child menu on a group
//   group-collapse-btn   "▼/▶" button that collapses or expands the group body
//   node-delete-btn      "×" delete button on a group or item node
//   node-nav-btn         "↗" button that scrolls+flashes the matching preview row
//   add-menu-group       "Group" option in the add-child dropdown menu
//   add-menu-item        "Item"  option in the add-child dropdown menu
//   action-type          "Answer Type" action link on an item node
//   action-mand          "Required"    action link on a group or item node
//   action-vis           "Show When"   action link on an item node
//
// Delete-confirm dialog  (js/builder/_shared.js — dynamically created)
//   delete-confirm-del-btn     "Delete" button in the delete-confirm dialog
//   delete-confirm-cancel-btn  "Cancel" button in the delete-confirm dialog
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
import { fileURLToPath } from 'url';
import path from 'path';

// Frozen fixture copies of test-critical samples.
// Tests that depend on specific FHIR content load from here, not from sampledata/,
// so editing sampledata/ files cannot silently break the test suite.
const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fixtures');

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

test.describe('Clear form', () => {
  test('clear loaded questionnaire → tree is empty', async ({ page }) => {
    await page.goto('/');
    await waitForLoad(page);

    // Load a sample so there is content to clear.
    await page.getByTestId('load-fhir-btn').click();
    await page.click('[data-sample="example-bariatric.fhir.json"]');
    await expect(page.locator('[data-testid="preview-panel"] [data-preview-id]').first()).toBeVisible();

    // Click the × button (visible only when a questionnaire is loaded).
    await page.getByTestId('clear-form-btn').click();

    // Custom confirm dialog must appear.
    await page.waitForSelector('.clear-confirm-backdrop');
    await page.getByTestId('clear-confirm-clear-btn').click();

    // Builder tree must now be empty.
    await expect(page.locator('[data-testid="tree-container"] [data-node-id]')).toHaveCount(0);
  });
});

test.describe('Collapse / expand group', () => {
  test('collapse group hides children; expand restores them', async ({ page }) => {
    await freshStart(page);
    const groupId = await addRootGroup(page);
    const itemId  = await addItemToGroup(page, groupId);

    const item = page.locator(`[data-node-id="${itemId}"]`);
    await expect(item).toBeVisible();

    // Collapse the group — child item must disappear.
    await page.locator(`[data-node-id="${groupId}"]`).getByTestId('group-collapse-btn').click();
    await expect(item).not.toBeVisible();

    // Expand again — child item must reappear.
    await page.locator(`[data-node-id="${groupId}"]`).getByTestId('group-collapse-btn').click();
    await expect(item).toBeVisible();
  });
});

test.describe('FHIR export', () => {
  test('export triggers file download with .json filename', async ({ page }) => {
    await freshStart(page);
    const groupId = await addRootGroup(page);
    const itemId  = await addItemToGroup(page, groupId);

    // Give both group and item a title so validation has no warnings.
    // Use .first() because the group container also wraps the child item,
    // so both share data-testid="node-title-display".
    const group = page.locator(`[data-node-id="${groupId}"]`);
    await group.getByTestId('node-title-display').first().click();
    await group.getByTestId('node-title-input').first().fill('My Group');
    await group.getByTestId('node-title-input').first().blur();

    const node = page.locator(`[data-node-id="${itemId}"]`);
    await node.getByTestId('node-title-display').click();
    await node.getByTestId('node-title-input').fill('My Question');
    await node.getByTestId('node-title-input').blur();

    // Accept the filename prompt with the default value.
    page.once('dialog', d => d.accept());

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-fhir-btn').click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.json$/);
  });
});


// ── Bidirectional: builder ↔ preview ──────────────────────────────────────────

test.describe('Builder → preview: group title edit', () => {
  test('edit group title → preview group header updates', async ({ page }) => {
    await freshStart(page);
    const groupId = await addRootGroup(page);

    const group = page.locator(`[data-node-id="${groupId}"]`);
    await group.getByTestId('node-title-display').first().click();
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

    // Confirm both panels show the item before deletion.
    await expect(page.locator(`[data-node-id="${itemId}"]`)).toBeVisible();
    await expect(page.locator(`[data-preview-id="${itemId}"]`)).toBeVisible();

    // Delete the item and confirm.
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

    // Both panels must contain the group and its child.
    await expect(page.locator(`[data-preview-id="${groupId}"]`)).toBeVisible();
    await expect(page.locator(`[data-preview-id="${itemId}"]`)).toBeVisible();

    // Delete the root group (use .first() because the group wraps the child
    // which also has a node-delete-btn).
    await page.locator(`[data-node-id="${groupId}"]`).getByTestId('node-delete-btn').first().click();
    await page.getByTestId('delete-confirm-del-btn').click();

    // Group and child must vanish from builder and preview.
    await expect(page.locator(`[data-node-id="${groupId}"]`)).toHaveCount(0);
    await expect(page.locator(`[data-preview-id="${groupId}"]`)).toHaveCount(0);
    await expect(page.locator(`[data-preview-id="${itemId}"]`)).toHaveCount(0);
  });
});

test.describe('Builder → preview: item type changes', () => {
  async function changeType(page, itemId, typeValue) {
    const node = page.locator(`[data-node-id="${itemId}"]`);
    await node.getByTestId('action-type').click();
    const modal = page.locator('#answerTypeModal');
    await expect(modal).toBeVisible();
    await modal.getByTestId('type-select').selectOption(typeValue);
    await page.locator('#answerTypeModalApply').click();
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

    // Display items are purely informational — no input or textarea.
    await expect(
      page.locator(`[data-preview-id="${itemId}"] input, [data-preview-id="${itemId}"] textarea`)
    ).toHaveCount(0);
  });
});

test.describe('Navigation', () => {
  test('clicking title area in builder flashes the corresponding preview row', async ({ page }) => {
    await freshStart(page);
    const groupId = await addRootGroup(page);
    const itemId  = await addItemToGroup(page, groupId);

    // Wait for the preview to finish its async render before navigating.
    await expect(page.locator(`[data-preview-id="${itemId}"]`)).toBeVisible();

    await page.locator(`[data-node-id="${itemId}"]`).getByTestId('node-type-label').click();

    // preview-flash class is added synchronously and held for 1 s.
    await expect(page.locator(`[data-preview-id="${itemId}"]`))
      .toHaveClass(/preview-flash/, { timeout: 1500 });
  });

  test('click preview row flashes the corresponding builder node', async ({ page }) => {
    await freshStart(page);
    const groupId = await addRootGroup(page);
    const itemId  = await addItemToGroup(page, groupId);

    await page.locator(`[data-preview-id="${itemId}"]`).click();

    // node-flash class is added synchronously and held for 1 s.
    await expect(page.locator(`[data-node-id="${itemId}"]`))
      .toHaveClass(/node-flash/, { timeout: 1500 });
  });
});

test.describe('Load FHIR → both panels', () => {
  test('both panels render after sample load', async ({ page }) => {
    await page.goto('/');
    await waitForLoad(page);

    await page.getByTestId('load-fhir-btn').click();
    await page.click('[data-sample="example-bariatric.fhir.json"]');

    // Wait until both async renders finish and counts are equal.
    // Every builder node must have a corresponding preview row.
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

test.describe('Preview answers → state', () => {
  test('fill text answer persists after tree re-render', async ({ page }) => {
    await freshStart(page);
    const groupId = await addRootGroup(page);
    const itemId  = await addItemToGroup(page, groupId);

    // Default item type is text — find the input/textarea in the preview row.
    const previewInput = page.locator(`[data-preview-id="${itemId}"]`).locator('input, textarea').first();
    await previewInput.fill('hello world');

    // Editing the group title is a reactive tree mutation that triggers a preview re-render.
    const group = page.locator(`[data-node-id="${groupId}"]`);
    await group.getByTestId('node-title-display').first().click();
    await group.getByTestId('node-title-input').first().fill('Updated Title');
    await group.getByTestId('node-title-input').first().blur();

    // The answer must survive the re-render (stored in values, restored on control rebuild).
    await expect(previewInput).toHaveValue('hello world');
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

    // Open the Answer Type modal.
    await node.getByTestId('action-type').click();
    const atModal = page.locator('#answerTypeModal');
    await expect(atModal).toBeVisible();
    // The type-select is inside the modal.
    await atModal.getByTestId('type-select').selectOption('decimal');
    await page.locator('#answerTypeModalApply').click();
    await expect(atModal).not.toBeVisible();

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

    // Open the Required modal.
    await node.getByTestId('action-mand').click();
    const reqModal = page.locator('#requiredModal');
    await expect(reqModal).toBeVisible();

    // Select "No — optional" and apply.
    await reqModal.locator('.required-modal-sel').selectOption('false');
    await page.locator('#requiredModalApply').click();

    // Preview must now show "optional" badge instead of the star.
    await expect(previewRow.getByTestId('preview-optional-badge')).toBeVisible();
    await expect(previewRow.getByTestId('preview-required-star')).not.toBeVisible();
  });
});


// ── enableWhen ────────────────────────────────────────────────────────────────

test.describe('enableWhen (standard)', () => {
  test('set condition on item → preview shows dimmed; fill trigger answer → item becomes visible', async ({ page }) => {
    await freshStart(page);

    // Add group "1" with two text items: trigger "1.1" and dependent "1.2"
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.locator('[data-node-id="1"]')).toBeVisible();

    const group = page.locator('[data-node-id="1"]');

    // Add trigger item → id "1.1"
    await group.getByTestId('group-add-btn').click();
    await page.locator('[data-testid="add-menu-item"]').first().click();
    await expect(page.locator('[data-node-id="1.1"]')).toBeVisible();

    // Title the trigger so it appears by name in the question selector
    const triggerNode = page.locator('[data-node-id="1.1"]');
    await triggerNode.getByTestId('node-title-display').click();
    await triggerNode.getByTestId('node-title-input').fill('Trigger');
    await triggerNode.getByTestId('node-title-input').blur();

    // Add dependent item → id "1.2"
    await group.getByTestId('group-add-btn').click();
    await page.locator('[data-testid="add-menu-item"]').first().click();
    await expect(page.locator('[data-node-id="1.2"]')).toBeVisible();

    // Open Show When modal on dependent item
    await page.locator('[data-node-id="1.2"]').getByTestId('action-vis').click();
    await expect(page.locator('#showWhenModal')).toBeVisible();

    // Add a condition row
    await page.locator('#showWhenModalBody .vis-add-btn').click();

    // Open the question picker dropdown
    await page.locator('#showWhenModalBody .vis-q-sel-trigger').click();
    await page.waitForSelector('.vis-q-sel-drop', { timeout: 3000 });

    // Select "1.1 — Trigger" from the portal dropdown
    await page.locator('.vis-q-sel-opt[data-id="1.1"]').click();

    // Operator defaults to "=" for text type; fill the answer value
    await page.locator('#showWhenModalBody .vis-cond-val-inp').fill('yes');

    // Apply the condition
    await page.locator('#showWhenModalApply').click();

    // Dependent item must now be dimmed in preview (answer "yes" not yet given)
    await expect(page.locator('[data-preview-id="1.2"]')).toHaveClass(/lform-waiting/);

    // Fill "yes" in the trigger's preview textarea; blur triggers the change event
    // → _formTick.value++ → full re-render with enableWhen re-evaluation
    const triggerInput = page.locator('[data-preview-id="1.1"]').locator('textarea').first();
    await triggerInput.fill('yes');
    await triggerInput.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true })));

    // Dependent item must now be visible (condition met)
    await expect(page.locator('[data-preview-id="1.2"]')).not.toHaveClass(/lform-waiting/, { timeout: 3000 });
  });
});


// ── Patient preset → variables populate ──────────────────────────────────────

/** Load the Eligibility Scenario fixture and wait for the initial reinit to finish.
 *  Loads from tests/fixtures/ so editing sampledata/ cannot break these tests. */
async function loadEligibility(page) {
  await page.goto('/');
  await waitForLoad(page);
  // Upload the frozen fixture directly via the hidden file input — bypasses the
  // sample dropdown so sampledata/ edits have no effect on this test.
  await page.locator('#fhirFileInput').setInputFiles(
    path.join(FIXTURES, 'patient-scenario-eligibility.fhir.json')
  );
  // reinitForm() runs automatically on load; wait until profile-age is populated
  // (default %age = 30 in the fixture's questionnaire-level variable)
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-preview-id="profile-age"] .preview-readonly-value');
      return el && el.textContent.trim() !== '';
    },
    { timeout: 15000 }
  );
}

/** Click the patient preset button and select a preset by its data-preset value. */
async function selectPreset(page, presetId) {
  await page.getByTestId('patient-preset-btn').click();
  await page.locator(`[data-preset="${presetId}"]`).click();
}

test.describe('Patient preset → variables populate', () => {
  test('default state: adult section visible, pediatric section dimmed (age 30)', async ({ page }) => {
    await loadEligibility(page);

    // Default %age = 30: "adult-section" (age >= 18) must be visible
    await expect(page.locator('[data-preview-id="adult-section"]')).not.toHaveClass(/lform-waiting/);
    // "pediatric-section" (age < 18) must be dimmed
    await expect(page.locator('[data-preview-id="pediatric-section"]')).toHaveClass(/lform-waiting/);
  });

  test('selecting Child preset (age 10) dims adult section and shows pediatric section', async ({ page }) => {
    await loadEligibility(page);

    // Select Child preset → %age = 10 → reinitForm() triggered automatically
    await selectPreset(page, 'child');

    // Wait for profile-age to update to 10
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-preview-id="profile-age"] .preview-readonly-value');
        return el && el.textContent.trim() === '10';
      },
      { timeout: 10000 }
    );

    // Adult section (age >= 18): age=10 → condition false → must be dimmed
    await expect(page.locator('[data-preview-id="adult-section"]')).toHaveClass(/lform-waiting/);
    // Pediatric section (age < 18): age=10 → condition true → must be visible
    await expect(page.locator('[data-preview-id="pediatric-section"]')).not.toHaveClass(/lform-waiting/);
  });
});


// ── Re-init ───────────────────────────────────────────────────────────────────

test.describe('Re-init', () => {
  test('sample load auto-evaluates initialExpression: profile-age shows default variable value', async ({ page }) => {
    await loadEligibility(page);

    // Default %age = 30 in the sample; reinitForm() runs on load and writes values['profile-age']
    await expect(
      page.locator('[data-preview-id="profile-age"] .preview-readonly-value')
    ).toContainText('30');
  });

  test('selecting Obese Male preset updates profile fields via reinit', async ({ page }) => {
    await loadEligibility(page);

    // Obese Male: age=45, bmi=38, smoker=true — preset click triggers reinitForm()
    await selectPreset(page, 'obese-male');

    // Wait for profile-age to reflect the new %age = 45
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-preview-id="profile-age"] .preview-readonly-value');
        return el && el.textContent.trim() === '45';
      },
      { timeout: 10000 }
    );

    await expect(
      page.locator('[data-preview-id="profile-age"] .preview-readonly-value')
    ).toContainText('45');
    await expect(
      page.locator('[data-preview-id="profile-bmi"] .preview-readonly-value')
    ).toContainText('38');

    // Smoker section (%smoker = true) must now be visible
    await expect(page.locator('[data-preview-id="smoker-section"]')).not.toHaveClass(/lform-waiting/);
  });

  test('Re-init button re-evaluates initialExpression fields', async ({ page }) => {
    await loadEligibility(page);

    // Select Adult Male preset (age=35, bmi=24) — preset click triggers reinitForm()
    await selectPreset(page, 'adult-male');
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-preview-id="profile-age"] .preview-readonly-value');
        return el && el.textContent.trim() === '35';
      },
      { timeout: 10000 }
    );

    // Click Re-init button — runs reinitForm() again with the same variables
    await page.getByTestId('variables-reinit-btn').click();
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-preview-id="profile-age"] .preview-readonly-value');
        return el && el.textContent.trim() === '35';
      },
      { timeout: 10000 }
    );

    // Profile fields must still show the preset values after Re-init
    await expect(
      page.locator('[data-preview-id="profile-age"] .preview-readonly-value')
    ).toContainText('35');
    await expect(
      page.locator('[data-preview-id="profile-bmi"] .preview-readonly-value')
    ).toContainText('24');
  });
});
