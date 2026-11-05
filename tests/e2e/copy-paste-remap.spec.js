// ── E2E: pasted group's calculations follow its own copied inputs ─────────────
// Regression: paste re-mapped linkIds but left `linkId='…'` references inside
// expressions pointing at the ORIGINAL items.
//
// data-testid registry:
//   group-add-btn / node-copy-btn / node-paste-after-btn   gear-menu actions
//   preview-search-input                                   real input used to commit preview inputs
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import path from 'path';
import { freshStart, FIXTURES } from './helpers/builder.js';
import { loadFixtureFile } from './helpers/load-fixture.js';

async function gearAction(page, gearTestid, actionTestid) {
  const node = page.locator('[data-node-id="g"]').first();
  await expect(async () => {
    if (!(await node.getByTestId(actionTestid).first().isVisible())) {
      await node.getByTestId(gearTestid).first().click();
    }
    await expect(node.getByTestId(actionTestid).first()).toBeVisible();
  }).toPass();
  await node.getByTestId(actionTestid).first().click();
}

async function commitInput(page) {
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.getByTestId('preview-search-input').click();
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}

test('pasted group calculates from its own copied input, not the original', async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await freshStart(page);
  await loadFixtureFile(page, path.join(FIXTURES, 'copy-group-calc.fhir.json'));
  await expect(page.locator('[data-preview-id="a"]')).toBeVisible();

  await gearAction(page, 'group-add-btn', 'node-copy-btn');
  await gearAction(page, 'group-add-btn', 'node-paste-after-btn');
  await expect(page.locator('[data-preview-id="a-copy"]')).toBeVisible();

  await page.locator('[data-preview-id="a-copy"] input').fill('5');
  await commitInput(page);

  await expect(page.locator('[data-preview-id="total-copy"]')).toContainText('10');
  await expect(page.locator('[data-preview-id="total"]')).not.toContainText('10');
});
