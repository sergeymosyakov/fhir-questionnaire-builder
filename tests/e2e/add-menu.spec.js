// ── E2E: toolbar Add menu (root group / from template) ────────────────────────
//
// data-testid registry:
//   add-menu-btn          "+ Add" toolbar menu trigger
//   add-root-group-btn    "Root group" menu item
//   add-template-btn      "From template…" menu item
//   templatesModal*, tpl-row-<id>   templates modal (see template-insert.spec.js)
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import { freshStart } from './helpers/builder.js';
import { openDropdownItem } from './helpers/dropdown.js';
import { serveTemplates } from './helpers/templates.js';

async function setup(page) {
  await page.addInitScript(() => localStorage.clear());
  await serveTemplates(page);
  await freshStart(page);
}

test.describe('Add menu', () => {
  test('lists "Root group" and "From template…"', async ({ page }) => {
    await setup(page);
    await page.getByTestId('add-menu-btn').click();
    await expect(page.getByTestId('add-root-group-btn')).toBeVisible();
    await expect(page.getByTestId('add-template-btn')).toBeVisible();
  });

  test('"Root group" adds an empty group and closes the menu', async ({ page }) => {
    await setup(page);
    await openDropdownItem(page, 'add-menu-btn', 'add-root-group-btn');
    await expect(page.locator('[data-node-id="1"]')).toBeVisible();
    await expect(page.getByTestId('add-root-group-btn')).toBeHidden();
  });

  test('"From template…" on an empty questionnaire inserts the template at root', async ({ page }) => {
    await setup(page);
    await openDropdownItem(page, 'add-menu-btn', 'add-template-btn');
    await expect(page.getByTestId('templatesModal')).toBeVisible();
    await page.getByTestId('tpl-row-test-scale').click();
    await page.getByTestId('templatesModalApply').click();
    await expect(page.locator('[data-node-id="ts"]')).toBeVisible();
    await expect(page.locator('[data-preview-id="ts-total"]')).toBeVisible();
  });

  test('"From template…" appends after existing root groups', async ({ page }) => {
    await setup(page);
    await openDropdownItem(page, 'add-menu-btn', 'add-root-group-btn');
    await expect(page.locator('[data-node-id="1"]')).toBeVisible();
    await openDropdownItem(page, 'add-menu-btn', 'add-template-btn');
    await page.getByTestId('tpl-row-test-scale').click();
    await page.getByTestId('templatesModalApply').click();
    await expect(page.locator('[data-testid="tree-container"] > [data-testid="node-wrap"]')).toHaveCount(2);
  });
});
