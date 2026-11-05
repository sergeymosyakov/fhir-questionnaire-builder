// ── E2E: insert a library template from a node's gear menu ────────────────────
// Library + template files are served from tests/fixtures/templates via page.route.
//
// data-testid registry:
//   group-add-btn / node-gear-btn   ⚙ gear button on a group / item node
//   add-menu-template               "Insert template…" gear-menu item
//   templatesModal(Apply|Cancel)    modal buttons (Insert / Cancel)
//   tpl-search, tpl-list, tpl-row-<id>, tpl-empty, tpl-detail   modal content
//   preview-search-input            real input used to commit preview inputs
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import { freshStart, addRootGroup, addItemToGroup } from './helpers/builder.js';
import { serveTemplates } from './helpers/templates.js';

async function setup(page, opts) {
  await page.addInitScript(() => localStorage.clear());
  await serveTemplates(page, opts);
  await freshStart(page);
  await addRootGroup(page);
}

async function openTemplates(page, nodeId, gearTestid = 'group-add-btn') {
  const node = page.locator(`[data-node-id="${nodeId}"]`).first();
  await expect(async () => {
    if (!(await node.getByTestId('add-menu-template').first().isVisible())) {
      await node.getByTestId(gearTestid).first().click();
    }
    await expect(node.getByTestId('add-menu-template').first()).toBeVisible();
  }).toPass();
  await node.getByTestId('add-menu-template').first().click();
  await expect(page.getByTestId('templatesModal')).toBeVisible();
}

async function insertTestScale(page, nodeId, gearTestid) {
  await openTemplates(page, nodeId, gearTestid);
  await page.getByTestId('tpl-row-test-scale').click();
  await page.getByTestId('templatesModalApply').click();
  await expect(page.getByTestId('templatesModal')).toBeHidden();
}

async function commitInput(page) {
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.getByTestId('preview-search-input').click();
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}

async function fillPreview(page, previewId, value) {
  await page.locator(`[data-preview-id="${previewId}"] input`).fill(value);
  await commitInput(page);
}

test.describe('template modal', () => {
  test('lists templates, filters by search, shows source and license on selection', async ({ page }) => {
    await setup(page);
    await openTemplates(page, '1');
    await expect(page.getByTestId('tpl-row-test-scale')).toBeVisible();
    await expect(page.getByTestId('tpl-row-other-form')).toBeVisible();
    await expect(page.getByTestId('templatesModalApply')).toBeDisabled();

    await page.getByTestId('tpl-search').fill('score');
    await expect(page.getByTestId('tpl-row-other-form')).toBeHidden();
    await page.getByTestId('tpl-search').fill('zzz');
    await expect(page.getByTestId('tpl-empty')).toBeVisible();
    await page.getByTestId('tpl-search').fill('');

    await page.getByTestId('tpl-row-test-scale').click();
    await expect(page.getByTestId('templatesModalApply')).toBeEnabled();
    await expect(page.getByTestId('tpl-detail')).toContainText('Test authors 2026');
    await expect(page.getByTestId('tpl-detail')).toContainText('Public domain');
  });

  test('cancel inserts nothing', async ({ page }) => {
    await setup(page);
    await openTemplates(page, '1');
    await page.getByTestId('tpl-row-test-scale').click();
    await page.getByTestId('templatesModalCancel').click();
    await expect(page.getByTestId('templatesModal')).toBeHidden();
    await expect(page.locator('[data-node-id="ts"]')).toHaveCount(0);
  });

  test('shows an error when the library cannot be loaded', async ({ page }) => {
    await setup(page, { failLibrary: true });
    await openTemplates(page, '1');
    await expect(page.getByTestId('templatesModalBody')).toContainText('Could not load templates');
  });
});

test.describe('template insertion', () => {
  test('inserts the wrapper group inside a group and its calculation works', async ({ page }) => {
    await setup(page);
    await insertTestScale(page, '1');
    await expect(page.locator('[data-node-id="ts"]')).toBeVisible();
    await expect(page.locator('[data-preview-id="ts-total"]')).toBeVisible();

    await fillPreview(page, 'ts-q1', '3');
    await fillPreview(page, 'ts-q2', '4');
    await expect(page.locator('[data-preview-id="ts-total"]')).toContainText('7');
  });

  test('is available from an item node and inserts inside it', async ({ page }) => {
    await setup(page);
    const itemId = await addItemToGroup(page, '1');
    await insertTestScale(page, itemId, 'node-gear-btn');
    await expect(page.locator(`[data-node-id="${itemId}"] [data-node-id="ts"]`)).toBeVisible();
  });

  test('a second insert gets fresh ids and calculates independently', async ({ page }) => {
    await setup(page);
    await insertTestScale(page, '1');
    await insertTestScale(page, '1');

    const q1s = page.locator('[data-preview-id^="ts-q1"]');
    await expect(q1s).toHaveCount(2);
    const ids = await q1s.evaluateAll(els => els.map(e => e.dataset.previewId));
    const second = ids.find(id => id !== 'ts-q1');
    const suffix = second.slice('ts-q1'.length);

    await fillPreview(page, 'ts-q1', '1');
    await fillPreview(page, 'ts-q2', '2');
    await fillPreview(page, second, '10');
    await fillPreview(page, 'ts-q2' + suffix, '20');

    await expect(page.locator('[data-preview-id="ts-total"]')).toContainText('3');
    await expect(page.locator(`[data-preview-id="ts-total${suffix}"]`)).toContainText('30');
  });
});
