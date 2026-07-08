// ── E2E: inline answer-type selector ──────────────────────────────────────────
// Every item card shows an inline answer-type dropdown (in both view modes) plus
// a config button that opens the full Answer Type dialog. The config button
// carries the `action-type` testid (it is the successor of the old "Answer Type"
// action link) and is highlighted for choice-family types, whose answer options
// are configured in the dialog. The inline dropdown reuses the shared
// changeNodeType core.
//
// Run: npx playwright test tests/e2e/inline-answer-type.spec.js
//
// data-testid registry:
//   more-btn             More ▾ menu toggle
//   view-simple-item     "Simple" menu item
//   inline-answer-type   inline type custom-select trigger (data-value = current type)
//   action-type          config button opening the Answer Type dialog (highlighted for choice)
//   csel-drop            shared custom-select dropdown panel
//   type-select          type dropdown inside the Answer Type modal

import { test, expect } from '@playwright/test';
import { freshStart, addRootGroup, addItemToGroup } from './helpers/builder.js';
import { openDropdownItem } from './helpers/dropdown.js';

async function seed(page) {
  await page.addInitScript(() => localStorage.clear());
  await freshStart(page);
  await addRootGroup(page);
  return addItemToGroup(page, '1'); // "1.1", default type text
}

async function setInlineType(page, nodeId, type) {
  const node = page.locator(`[data-node-id="${nodeId}"]`).first();
  await node.getByTestId('inline-answer-type').click();
  await page.locator(`[data-testid="csel-drop"] [data-val="${type}"]`).click();
}

const cfgOf = (page, id) => page.locator(`[data-node-id="${id}"]`).first().getByTestId('action-type');

test.describe('inline answer-type selector', () => {
  test('inline type selector is visible in both view modes', async ({ page }) => {
    const id = await seed(page);
    const trigger = page.locator(`[data-node-id="${id}"]`).first().getByTestId('inline-answer-type');
    // Advanced (default)
    await expect(trigger).toBeVisible();
    // Simple
    await openDropdownItem(page, 'more-btn', 'view-simple-item');
    await expect(trigger).toBeVisible();
  });

  test('changing the inline type updates the item type', async ({ page }) => {
    const id = await seed(page);
    await setInlineType(page, id, 'integer');
    await expect(page.locator(`[data-node-id="${id}"]`).first().getByTestId('inline-answer-type'))
      .toHaveAttribute('data-value', 'integer');
  });

  test('config button is highlighted for choice types', async ({ page }) => {
    const id = await seed(page);
    // text → no highlight (modal config is optional)
    await expect(cfgOf(page, id)).not.toHaveClass(/node-inline-type-config--attn/);
    // choice type → highlighted (options are configured in the dialog)
    await setInlineType(page, id, 'select');
    await expect(cfgOf(page, id)).toHaveClass(/node-inline-type-config--attn/);
  });

  test('config button stays highlighted for choice types after options are added', async ({ page }) => {
    const id = await seed(page);
    await setInlineType(page, id, 'select');
    await expect(cfgOf(page, id)).toHaveClass(/node-inline-type-config--attn/);
    // open the dialog via the config button, add an option, apply
    await cfgOf(page, id).click();
    await expect(page.getByTestId('answerTypeModal')).toBeVisible();
    await page.getByTestId('opt-add-btn').click();
    await page.getByTestId('opt-label-0').fill('Alpha');
    await page.getByTestId('answerTypeModalApply').click();
    await expect(page.getByTestId('answerTypeModal')).toBeHidden();
    // still highlighted — the highlight marks "configured in the dialog", not "missing"
    await expect(cfgOf(page, id)).toHaveClass(/node-inline-type-config--attn/);
  });

  test('config button opens the Answer Type dialog', async ({ page }) => {
    const id = await seed(page);
    await cfgOf(page, id).click();
    await expect(page.getByTestId('type-select')).toBeVisible();
  });
});
