// ── E2E: Renumber — prefix assignment and preview reactivity ──────────────────
// Verifies that clicking "Renumber" assigns item.prefix values and the preview
// immediately reflects the new prefixes without any extra action.
//
// data-testid registry:
//   add-root-group-btn     "+Add Root Group" toolbar button
//   renumber-btn           "↺ Renumber" button in the builder toolbar
//   renumber-format        custom-select for prefix format (numbers/roman/letters)
//   node-title-display     read-only title span on a builder node
//   node-title-input       inline textarea editor for node title
//   csel-drop              custom-select dropdown panel

import { test, expect } from '@playwright/test';
import { freshStart, addRootGroup, addItemToGroup } from './helpers/builder.js';

async function addTwoItems(page) {
  await addRootGroup(page);
  await addItemToGroup(page, '1');
  // Add second item
  const group = page.locator('[data-node-id="1"]');
  await group.getByTestId('group-add-btn').click();
  // Wait for the add menu to open before clicking to avoid a click-before-open race.
  await expect(page.locator('[data-testid="add-menu-item"]').first()).toBeVisible();
  await page.locator('[data-testid="add-menu-item"]').first().click();
  await expect(page.locator('[data-node-id="1.2"]')).toBeVisible();
}

test.describe('Renumber — prefix assignment', () => {
  test('renumber assigns numeric prefixes to items', async ({ page }) => {
    await freshStart(page);
    await addTwoItems(page);

    await page.getByTestId('renumber-btn').click();

    // Wait for renumber to complete (button re-enables)
    await expect(page.getByTestId('renumber-btn')).toBeEnabled({ timeout: 8000 });

    // Builder shows prefix in the prefix input
    const item1 = page.locator('[data-node-id="1.1"]');
    const item2 = page.locator('[data-node-id="1.2"]');
    await expect(item1.locator('[data-testid="node-prefix-input"]')).toHaveValue('1.1');
    await expect(item2.locator('[data-testid="node-prefix-input"]')).toHaveValue('1.2');
  });

  test('preview shows updated prefixes after renumber', async ({ page }) => {
    await freshStart(page);
    await addTwoItems(page);

    // Set titles so we can identify items in preview
    await expect(async () => {
      await page.locator('[data-node-id="1.1"]').getByTestId('node-title-display').click();
      await expect(page.locator('[data-node-id="1.1"]').getByTestId('node-title-input')).toBeVisible();
    }).toPass();
    await page.locator('[data-node-id="1.1"]').getByTestId('node-title-input').fill('First');
    await page.locator('[data-node-id="1.1"]').getByTestId('node-title-input').blur();

    await page.getByTestId('renumber-btn').click();
    await expect(page.getByTestId('renumber-btn')).toBeEnabled({ timeout: 8000 });

    // Preview row for item 1.1 should show prefix "1.1"
    const previewRow = page.locator('[data-preview-id="1.1"]');
    await expect(previewRow.locator('.preview-prefix')).toHaveText('1.1');
  });

  test('roman numerals format produces correct prefixes', async ({ page }) => {
    await freshStart(page);
    await addTwoItems(page);

    // Select roman format
    await expect(async () => {
      if (!(await page.locator('[data-testid="csel-drop"]').isVisible())) {
        await page.getByTestId('renumber-format').click();
      }
      await expect(page.locator('[data-testid="csel-drop"]')).toBeVisible();
    }).toPass();
    await page.locator('[data-testid="csel-drop"] [data-val="roman"]').click();

    await page.getByTestId('renumber-btn').click();
    await expect(page.getByTestId('renumber-btn')).toBeEnabled({ timeout: 8000 });

    const item1 = page.locator('[data-node-id="1.1"]');
    await expect(item1.locator('[data-testid="node-prefix-input"]')).toHaveValue('I.I');
  });

  test('letter format produces correct prefix (a.a style)', async ({ page }) => {
    await freshStart(page);
    await addTwoItems(page);

    await expect(async () => {
      if (!(await page.locator('[data-testid="csel-drop"]').isVisible())) {
        await page.getByTestId('renumber-format').click();
      }
      await expect(page.locator('[data-testid="csel-drop"]')).toBeVisible();
    }).toPass();
    await page.locator('[data-testid="csel-drop"] [data-val="letters"]').click();

    await page.getByTestId('renumber-btn').click();
    await expect(page.getByTestId('renumber-btn')).toBeEnabled({ timeout: 8000 });

    const item1 = page.locator('[data-node-id="1.1"]');
    const item2 = page.locator('[data-node-id="1.2"]');
    const p1 = await item1.locator('[data-testid="node-prefix-input"]').inputValue();
    const p2 = await item2.locator('[data-testid="node-prefix-input"]').inputValue();
    // letters format produces letter-based prefixes (A.A, A.B …)
    expect(p1).toMatch(/[a-z]/i);
    expect(p2).toMatch(/[a-z]/i);
    expect(p1).not.toBe(p2);
  });

  test('renumber after deleting middle item produces sequential prefixes', async ({ page }) => {
    await freshStart(page);
    // Add three items: 1.1, 1.2, 1.3
    await addRootGroup(page);
    await addItemToGroup(page, '1');
    const group = page.locator('[data-node-id="1"]');
    await group.getByTestId('group-add-btn').click();
    await expect(page.locator('[data-testid="add-menu-item"]').first()).toBeVisible();
    await page.locator('[data-testid="add-menu-item"]').first().click();
    await expect(page.locator('[data-node-id="1.2"]')).toBeVisible();
    await group.getByTestId('group-add-btn').click();
    await expect(page.locator('[data-testid="add-menu-item"]').first()).toBeVisible();
    await page.locator('[data-testid="add-menu-item"]').first().click();
    await expect(page.locator('[data-node-id="1.3"]')).toBeVisible();

    // Delete middle item 1.2
    await page.keyboard.press('Escape');
    const item2 = page.locator('[data-node-id="1.2"]');
    await item2.getByTestId('node-gear-btn').click();
    await expect(item2.getByTestId('node-delete-btn').first()).toBeVisible();
    await item2.getByTestId('node-delete-btn').first().click();
    await expect(page.getByTestId('delete-confirm-del-btn')).toBeVisible({ timeout: 5_000 });
    await page.getByTestId('delete-confirm-del-btn').click();
    await expect(page.locator('[data-node-id="1.2"]')).toHaveCount(0, { timeout: 5_000 });

    // Renumber — remaining items should get 1.1 and 1.2 prefixes
    await page.getByTestId('renumber-btn').click();
    await expect(page.getByTestId('renumber-btn')).toBeEnabled({ timeout: 8000 });

    // The node that was 1.3 is now at position 2 — its prefix should be 1.2
    const remaining = page.locator('[data-node-id="1.3"]');
    await expect(remaining.locator('[data-testid="node-prefix-input"]')).toHaveValue('1.2');
  });

  test('prefix persists in FHIR export after renumber', async ({ page }) => {
    await freshStart(page);
    await addTwoItems(page);

    await page.getByTestId('renumber-btn').click();
    await expect(page.getByTestId('renumber-btn')).toBeEnabled({ timeout: 8000 });

    const json = await page.evaluate(async () => {
      const { buildFHIRObject } = await import('/js/fhir/export.js');
      return JSON.stringify(buildFHIRObject());
    });
    const q = JSON.parse(json);
    function findItem(items, linkId) {
      for (const it of items ?? []) {
        if (it.linkId === linkId) return it;
        const found = findItem(it.item ?? [], linkId);
        if (found) return found;
      }
    }
    // Both items should have a prefix field in the exported FHIR
    expect(findItem(q.item, '1.1')?.prefix).toBe('1.1');
    expect(findItem(q.item, '1.2')?.prefix).toBe('1.2');
  });

  test('manual prefix edit is preserved without renumber', async ({ page }) => {
    await freshStart(page);
    await addTwoItems(page);

    // Manually set prefix on item 1.1
    const prefixInput = page.locator('[data-node-id="1.1"]').locator('[data-testid="node-prefix-input"]');
    await prefixInput.fill('Q1');
    await prefixInput.blur();

    // Export and verify prefix is in FHIR
    const json = await page.evaluate(async () => {
      const { buildFHIRObject } = await import('/js/fhir/export.js');
      return JSON.stringify(buildFHIRObject());
    });
    const q = JSON.parse(json);
    function findItem(items, linkId) {
      for (const it of items ?? []) {
        if (it.linkId === linkId) return it;
        const found = findItem(it.item ?? [], linkId);
        if (found) return found;
      }
    }
    expect(findItem(q.item, '1.1')?.prefix).toBe('Q1');
  });
});
