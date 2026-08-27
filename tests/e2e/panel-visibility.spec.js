// ── E2E: Narrow-screen panel visibility toggle (builder ↔ preview) ───────────
// Mobile-only builder/preview switch button (issue #75 Phase 1). Below the
// 768px layout breakpoint the toggle shows one panel at a time; at/above it,
// both panels are always visible and the button is hidden.
//
// data-testid:
//   panel-toggle-btn   mobile-only builder/preview switch button (top-panel)
//
// Run: npx playwright test tests/e2e/panel-visibility.spec.js

import { test, expect } from '@playwright/test';

async function waitForLoad(page) {
  // Attached (not necessarily visible) — the builder's own Add-Root-Group
  // button lives in .left-panel, which is hidden by default on narrow screens.
  await page.waitForSelector('[data-testid="panel-toggle-btn"]', { state: 'attached', timeout: 10_000 });
}

const toggleBtn = page => page.getByTestId('panel-toggle-btn');
const leftPanel = page => page.locator('.left-panel');
const rightPanel = page => page.locator('.right-panel');

test.describe('Panel visibility toggle — narrow screens', () => {
  test.use({ viewport: { width: 480, height: 800 } });

  test('preview shown, builder hidden by default; toggle switches to builder', async ({ page }) => {
    await page.goto('/');
    await waitForLoad(page);

    await expect(toggleBtn(page)).toBeVisible();
    await expect(leftPanel(page)).toBeHidden();
    await expect(rightPanel(page)).toBeVisible();

    await toggleBtn(page).click();

    await expect(leftPanel(page)).toBeVisible();
    await expect(rightPanel(page)).toBeHidden();
  });

  test('toggling twice returns to preview', async ({ page }) => {
    await page.goto('/');
    await waitForLoad(page);

    await toggleBtn(page).click();
    await expect(leftPanel(page)).toBeVisible();

    await toggleBtn(page).click();
    await expect(leftPanel(page)).toBeHidden();
    await expect(rightPanel(page)).toBeVisible();
  });
});

test.describe('Panel visibility toggle — desktop (no-op)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('both panels always visible, toggle button hidden', async ({ page }) => {
    await page.goto('/');
    await waitForLoad(page);

    await expect(toggleBtn(page)).toBeHidden();
    await expect(leftPanel(page)).toBeVisible();
    await expect(rightPanel(page)).toBeVisible();
  });
});
