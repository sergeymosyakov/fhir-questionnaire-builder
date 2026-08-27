// ── E2E: Narrow-screen panel visibility toggle (builder ↔ preview) ───────────
// Mobile-only builder/preview switch (issue #75 Phases 1-3). Below the 1024px
// layout breakpoint the builder defaults to a collapsed rail (preview full);
// tapping the rail, the top-panel button, or the in-panel minimize button
// toggles between the two, persisted in localStorage. At/above 1024px both
// panels are always visible and all three controls are hidden/no-op.
//
// data-testid:
//   panel-toggle-btn          mobile-only builder/preview switch button (top-panel)
//   left-panel-rail-tab       collapsed-state rail — tap to expand the builder
//   left-panel-minimize-btn   expanded-state button (builder header) — collapse back
//   sign-in-btn               top-panel auth button — must stay pinned to the right edge
//
// Run: npx playwright test tests/e2e/panel-visibility.spec.js

import { test, expect } from '@playwright/test';

async function waitForLoad(page) {
  // Attached (not necessarily visible) — the builder's own Add-Root-Group
  // button lives in .left-panel-content, hidden while the rail is collapsed.
  await page.waitForSelector('[data-testid="panel-toggle-btn"]', { state: 'attached', timeout: 10_000 });
}

const toggleBtn = page => page.getByTestId('panel-toggle-btn');
const railTab = page => page.getByTestId('left-panel-rail-tab');
const minimizeBtn = page => page.getByTestId('left-panel-minimize-btn');
const leftPanel = page => page.locator('.left-panel');
const rightPanel = page => page.locator('.right-panel');

test.describe('Panel visibility toggle — narrow screens', () => {
  test.use({ viewport: { width: 480, height: 800 } });

  test('collapsed rail shown, preview full by default; toggle button expands builder', async ({ page }) => {
    await page.goto('/');
    await waitForLoad(page);

    await expect(toggleBtn(page)).toBeVisible();
    await expect(railTab(page)).toBeVisible();
    await expect(minimizeBtn(page)).toBeHidden();
    await expect(rightPanel(page)).toBeVisible();

    await toggleBtn(page).click();

    await expect(railTab(page)).toBeHidden();
    await expect(minimizeBtn(page)).toBeVisible();
    await expect(rightPanel(page)).toBeHidden();
  });

  test('tapping the rail expands the builder; minimize button collapses it back', async ({ page }) => {
    await page.goto('/');
    await waitForLoad(page);

    await railTab(page).click();
    await expect(rightPanel(page)).toBeHidden();
    await expect(minimizeBtn(page)).toBeVisible();

    await minimizeBtn(page).click();
    await expect(rightPanel(page)).toBeVisible();
    await expect(railTab(page)).toBeVisible();
  });

  test('toggling twice via top-panel button returns to collapsed rail', async ({ page }) => {
    await page.goto('/');
    await waitForLoad(page);

    await toggleBtn(page).click();
    await expect(rightPanel(page)).toBeHidden();

    await toggleBtn(page).click();
    await expect(rightPanel(page)).toBeVisible();
    await expect(railTab(page)).toBeVisible();
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

    await railTab(page).click();
    await expect(rightPanel(page)).toBeHidden();

    await page.reload();
    await waitForLoad(page);
    await expect(rightPanel(page)).toBeHidden();
    await expect(minimizeBtn(page)).toBeVisible();
  });

  test('collapsed state (default) survives reload after expanding then minimizing', async ({ page }) => {
    await page.goto('/');
    await waitForLoad(page);
    await page.evaluate(() => localStorage.clear());

    await railTab(page).click();
    await minimizeBtn(page).click();
    await expect(rightPanel(page)).toBeVisible();

    await page.reload();
    await waitForLoad(page);
    await expect(rightPanel(page)).toBeVisible();
    await expect(railTab(page)).toBeVisible();
  });
});

test.describe('Panel visibility toggle — desktop (no-op)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('both panels always visible, rail/toggle/minimize controls hidden', async ({ page }) => {
    await page.goto('/');
    await waitForLoad(page);

    await expect(toggleBtn(page)).toBeHidden();
    await expect(railTab(page)).toBeHidden();
    await expect(minimizeBtn(page)).toBeHidden();
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
