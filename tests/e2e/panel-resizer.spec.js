// ── E2E: Panel resizer (drag divider between builder and preview) ────────────
// Desktop-only (>=1024px): dragging the divider resizes the left panel, clamps
// to [200px, 70vw] and persists the width (localStorage 'leftPanelWidth').
//
// Run: npx playwright test tests/e2e/panel-resizer.spec.js
//
// ── data-testid registry ─────────────────────────────────────────────────────
//   panel-resizer   draggable divider between the panels (set by PanelResizer)
//   left-panel      builder (left) panel whose width is resized (set by PanelResizer)
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import { freshStart } from './helpers/builder.js';

const STORAGE_KEY = 'leftPanelWidth';

const panelWidth = async page => Math.round((await page.getByTestId('left-panel').boundingBox()).width);

async function dragDivider(page, dx) {
  const box = await page.getByTestId('panel-resizer').boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y, { steps: 5 });
  await page.mouse.up();
}

test.describe('Panel resizer', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('__resizer-init')) {
        localStorage.clear();
        sessionStorage.setItem('__resizer-init', '1');
      }
    });
    await freshStart(page);
  });

  test('dragging the divider right widens the left panel and releases the overlay', async ({ page }) => {
    const before = await panelWidth(page);
    await dragDivider(page, 120);
    await expect.poll(() => panelWidth(page)).toBe(before + 120);
    await expect(page.locator('#resize-overlay')).toHaveCount(0);
  });

  test('dragging the divider left narrows the left panel', async ({ page }) => {
    const before = await panelWidth(page);
    await dragDivider(page, -100);
    await expect.poll(() => panelWidth(page)).toBe(before - 100);
  });

  test('width is clamped to the 200px minimum and the 70vw maximum', async ({ page }) => {
    await dragDivider(page, -2000);
    await expect.poll(() => panelWidth(page)).toBe(200);

    await dragDivider(page, 2000);
    const max = await page.evaluate(() => Math.round(window.innerWidth * 0.7));
    await expect.poll(() => panelWidth(page)).toBe(max);
  });

  test('dragged width is persisted and restored after reload', async ({ page }) => {
    const before = await panelWidth(page);
    await dragDivider(page, 80);
    const target = before + 80;
    await expect.poll(() => page.evaluate(k => localStorage.getItem(k), STORAGE_KEY)).toBe(String(target));

    await page.reload();
    await expect(page.getByTestId('add-root-group-btn')).toBeVisible();
    await expect.poll(() => panelWidth(page)).toBe(target);
  });
});
