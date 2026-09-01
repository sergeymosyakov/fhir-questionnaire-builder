// ── E2E: Narrow-screen panel visibility toggle (builder ↔ preview) ───────────
// Mobile-only, fully symmetric builder/preview rail (issue #75). Below the
// 1024px layout breakpoint exactly one panel is expanded at a time; the other
// collapses to a narrow rail tab. Default: left (builder) = rail, right
// (preview) = full. Each side's rail-tab is the only control — tapping the
// visible (collapsed) side's rail expands it and collapses the other. At/above
// 1024px both panels are always visible and both rail-tabs are hidden/no-op.
//
// data-testid:
//   left-panel-rail-tab        collapsed-builder rail — tap to expand it (collapses preview)
//   right-panel-rail-tab       collapsed-preview rail — tap to expand it (collapses builder)
//   sign-in-btn                top-panel auth button — must stay pinned to the right edge
//
// Run: npx playwright test tests/e2e/panel-visibility.spec.js

import { test, expect } from '@playwright/test';

async function waitForLoad(page) {
  // Attached (not necessarily visible) — always in the DOM regardless of
  // which side is currently the rail.
  await page.waitForSelector('[data-testid="left-panel-rail-tab"]', { state: 'attached', timeout: 10_000 });
}

const leftRailTab  = page => page.getByTestId('left-panel-rail-tab');
const rightRailTab = page => page.getByTestId('right-panel-rail-tab');
const leftPanel    = page => page.locator('.left-panel');
const rightPanel   = page => page.locator('.right-panel');

test.describe('Panel visibility toggle — narrow screens', () => {
  test.use({ viewport: { width: 480, height: 800 } });

  test('collapsed rail shown, preview full by default; right rail is hidden until builder expands', async ({ page }) => {
    await page.goto('/');
    await waitForLoad(page);

    await expect(leftRailTab(page)).toBeVisible();
    await expect(rightRailTab(page)).toBeHidden();

    await leftRailTab(page).click();

    await expect(leftRailTab(page)).toBeHidden();
    await expect(rightRailTab(page)).toBeVisible();
  });

  test('tapping the left rail expands the builder; tapping the right rail collapses it back', async ({ page }) => {
    await page.goto('/');
    await waitForLoad(page);

    await leftRailTab(page).click();
    await expect(rightRailTab(page)).toBeVisible();

    await rightRailTab(page).click();
    await expect(leftRailTab(page)).toBeVisible();
    await expect(rightRailTab(page)).toBeHidden();
  });

  test('toggling twice via the rail tabs returns to the default state', async ({ page }) => {
    await page.goto('/');
    await waitForLoad(page);

    await leftRailTab(page).click();
    await expect(rightRailTab(page)).toBeVisible();

    await rightRailTab(page).click();
    await expect(leftRailTab(page)).toBeVisible();
  });
});

test.describe('Panel visibility persistence', () => {
  test.use({ viewport: { width: 480, height: 800 } });

  test('expanded state survives reload', async ({ page }) => {
    await page.goto('/');
    await waitForLoad(page);
    // One-time clear (not addInitScript — that would also fire on the reload
    // below, wiping the very value we're persisting).
    await page.evaluate(() => localStorage.clear());

    await leftRailTab(page).click();
    await expect(rightRailTab(page)).toBeVisible();

    await page.reload();
    await waitForLoad(page);
    await expect(rightRailTab(page)).toBeVisible();
    await expect(leftRailTab(page)).toBeHidden();
  });

  test('collapsed state (default) survives reload after expanding then collapsing', async ({ page }) => {
    await page.goto('/');
    await waitForLoad(page);
    await page.evaluate(() => localStorage.clear());

    await leftRailTab(page).click();
    await rightRailTab(page).click();
    await expect(leftRailTab(page)).toBeVisible();

    await page.reload();
    await waitForLoad(page);
    await expect(leftRailTab(page)).toBeVisible();
    await expect(rightRailTab(page)).toBeHidden();
  });
});

test.describe('Panel visibility toggle — desktop (no-op)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('both panels always visible, both rail tabs hidden', async ({ page }) => {
    await page.goto('/');
    await waitForLoad(page);

    await expect(leftRailTab(page)).toBeHidden();
    await expect(rightRailTab(page)).toBeHidden();
    await expect(leftPanel(page)).toBeVisible();
    await expect(rightPanel(page)).toBeVisible();
  });
});

test.describe('Top-panel narrow-screen cleanup', () => {
  test('GitHub link + copyright are hidden below 1024px, visible at/above it', async ({ page }) => {
    await page.setViewportSize({ width: 480, height: 800 });
    await page.goto('/');
    await waitForLoad(page);
    await expect(page.locator('.top-panel-copyright')).toBeHidden();

    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.locator('.top-panel-copyright')).toBeVisible();
  });
});

test.describe('Top-panel — no horizontal overflow at narrow widths', () => {
  test('sign-in button always stays fully within the viewport, no scroll needed', async ({ page }) => {
    await page.goto('/');
    await waitForLoad(page);

    for (const width of [320, 360, 400, 480]) {
      await page.setViewportSize({ width, height: 800 });

      await expect(async () => {
        const overflow = await page.evaluate(() => {
          const tp = document.querySelector('.top-panel');
          return tp.scrollWidth - tp.clientWidth;
        });
        expect(overflow).toBeLessThanOrEqual(0);
      }).toPass();

      const signInBox = await page.getByTestId('sign-in-btn').boundingBox();
      expect(signInBox.x + signInBox.width).toBeLessThanOrEqual(width);
    }
  });
});

test.describe('Dropdown menus stay within the viewport', () => {
  test.use({ viewport: { width: 400, height: 800 } });

  test('Questionnaires menu never grows past the screen width even with a very long item label', async ({ page }) => {
    await page.goto('/');
    await waitForLoad(page);

    // Regression test for issue #75 follow-up: .load-menu used to size itself
    // to its widest child (e.g. a long "Recent draft: <title> (<timestamp>)"
    // label) with no upper bound, pushing it off-screen to the left.
    const box = await page.evaluate(() => {
      const menu = document.querySelector('#loadFhirBtn').closest('.load-wrap').querySelector('.load-menu');
      const longItem = document.createElement('div');
      longItem.className = 'load-menu-item';
      longItem.textContent = 'Recent draft: ' + 'X'.repeat(120) + ' (8/27/2026 11:46 PM)';
      menu.insertBefore(longItem, menu.firstChild);
      menu.style.display = 'block';
      const r = menu.getBoundingClientRect();
      menu.style.display = 'none';
      longItem.remove();
      return { x: r.x, right: r.x + r.width };
    });

    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(400);
  });
});
