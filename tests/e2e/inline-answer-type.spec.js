// ── E2E: inline answer-type selector (Simple mode) ────────────────────────────
// In Simple mode each item card shows an inline answer-type dropdown plus a
// config button (⚙ / ⚠) that opens the full Answer Type dialog. In Advanced
// mode the inline row is CSS-hidden and the "Answer Type" action link is used
// instead. The inline dropdown reuses the shared changeNodeType core.
//
// Run: npx playwright test tests/e2e/inline-answer-type.spec.js
//
// data-testid registry:
//   more-btn             More ▾ menu toggle
//   view-simple-item     "Simple" menu item
//   inline-answer-type   inline type custom-select trigger (data-value = current type)
//   inline-answer-config config button (⚙ / ⚠); --warn class when setup is needed
//   action-type          "Answer Type" action link (advanced-ctrl, hidden in Simple)
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

async function toSimple(page) {
  await openDropdownItem(page, 'more-btn', 'view-simple-item');
}

async function setInlineType(page, nodeId, type) {
  const node = page.locator(`[data-node-id="${nodeId}"]`).first();
  await node.getByTestId('inline-answer-type').click();
  await page.locator(`[data-testid="csel-drop"] [data-val="${type}"]`).click();
}

test.describe('inline answer-type selector', () => {
  test('is visible in Simple mode and hidden in Advanced', async ({ page }) => {
    const id = await seed(page);
    const node = page.locator(`[data-node-id="${id}"]`).first();
    // Advanced (default): inline row hidden, action link visible.
    await expect(node.getByTestId('inline-answer-type')).toBeHidden();
    await expect(node.getByTestId('action-type')).toBeVisible();

    await toSimple(page);
    // Simple: inline row visible, action link hidden.
    await expect(node.getByTestId('inline-answer-type')).toBeVisible();
    await expect(node.getByTestId('action-type')).toBeHidden();
  });

  test('changing the inline type updates the item type', async ({ page }) => {
    const id = await seed(page);
    await toSimple(page);
    await setInlineType(page, id, 'integer');
    await expect(page.locator(`[data-node-id="${id}"]`).first().getByTestId('inline-answer-type'))
      .toHaveAttribute('data-value', 'integer');
  });

  test('config button is highlighted for choice types', async ({ page }) => {
    const id = await seed(page);
    await toSimple(page);
    // text → no highlight (modal config is optional)
    await expect(page.locator(`[data-node-id="${id}"]`).first().getByTestId('inline-answer-config'))
      .not.toHaveClass(/node-inline-type-config--attn/);
    // choice type → highlighted (options are configured in the dialog)
    await setInlineType(page, id, 'select');
    await expect(page.locator(`[data-node-id="${id}"]`).first().getByTestId('inline-answer-config'))
      .toHaveClass(/node-inline-type-config--attn/);
  });

  test('config button stays highlighted for choice types after options are added', async ({ page }) => {
    const id = await seed(page);
    await toSimple(page);
    await setInlineType(page, id, 'select');
    const cfg = page.locator(`[data-node-id="${id}"]`).first().getByTestId('inline-answer-config');
    await expect(cfg).toHaveClass(/node-inline-type-config--attn/);
    // open the dialog via the config button, add an option, apply
    await cfg.click();
    await expect(page.getByTestId('answerTypeModal')).toBeVisible();
    await page.getByTestId('opt-add-btn').click();
    await page.getByTestId('opt-label-0').fill('Alpha');
    await page.getByTestId('answerTypeModalApply').click();
    await expect(page.getByTestId('answerTypeModal')).toBeHidden();
    // still highlighted — the highlight marks "configured in the dialog", not "missing"
    await expect(page.locator(`[data-node-id="${id}"]`).first().getByTestId('inline-answer-config'))
      .toHaveClass(/node-inline-type-config--attn/);
  });

  test('config button opens the Answer Type dialog', async ({ page }) => {
    const id = await seed(page);
    await toSimple(page);
    await page.locator(`[data-node-id="${id}"]`).first().getByTestId('inline-answer-config').click();
    await expect(page.getByTestId('type-select')).toBeVisible();
  });
});
