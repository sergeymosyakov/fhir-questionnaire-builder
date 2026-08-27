// ── E2E: Narrow-screen panel visibility toggle (builder ↔ preview) ───────────
// Mobile-only builder/preview switch (issue #75 Phases 1-3). Below the 768px
// layout breakpoint the builder defaults to a collapsed rail (preview full);
// tapping the rail, the top-panel button, or the in-panel minimize button
// toggles between the two, persisted in localStorage. At/above 768px both
// panels are always visible and all three controls are hidden/no-op.
//
// data-testid:
//   panel-toggle-btn          mobile-only builder/preview switch button (top-panel)
//   left-panel-rail-tab       collapsed-state rail — tap to expand the builder
//   left-panel-minimize-btn   expanded-state button (builder header) — collapse back
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
