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
//   load-fhir-btn              "Questionnaires ▾" toolbar dropdown trigger
//   load-menu                  "Questionnaires ▾" dropdown panel
//   load-menu-close            × dismiss button inside a dropdown panel (mobile only)
//   load-menu-header           title + close-button row inside a dropdown panel (mobile only)
//   load-menu-title            menu-name text inside load-menu-header
//   patient-preset-btn         "Patient ▾" toolbar dropdown trigger
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

test.describe('Expanded panel never overflows the viewport', () => {
  test.use({ viewport: { width: 480, height: 800 } });

  // Regression test: .layout--left-expanded .left-panel used to be width:100%
  // while the right rail added another 44px alongside it in the same flex row,
  // pushing the right rail fully off-screen (it was still display:flex — just
  // not visible on screen — so a plain toBeVisible() assertion never caught it).
  test('left expanded: both panels stay within the horizontal viewport bounds', async ({ page }) => {
    await page.goto('/');
    await waitForLoad(page);
    await leftRailTab(page).click();
    await expect(rightRailTab(page)).toBeVisible();

    const leftBox  = await leftPanel(page).boundingBox();
    const rightBox = await rightPanel(page).boundingBox();
    expect(leftBox.x).toBeGreaterThanOrEqual(0);
    expect(leftBox.x + leftBox.width).toBeLessThanOrEqual(480);
    expect(rightBox.x).toBeGreaterThanOrEqual(0);
    expect(rightBox.x + rightBox.width).toBeLessThanOrEqual(480);
  });

  test('right expanded (default): both panels stay within the horizontal viewport bounds', async ({ page }) => {
    await page.goto('/');
    await waitForLoad(page);

    const leftBox  = await leftPanel(page).boundingBox();
    const rightBox = await rightPanel(page).boundingBox();
    expect(leftBox.x + leftBox.width).toBeLessThanOrEqual(480);
    expect(rightBox.x + rightBox.width).toBeLessThanOrEqual(480);
  });
});

test.describe('Toolbar dropdowns — mobile toggle-button behavior', () => {
  test.use({ viewport: { width: 480, height: 800 } });

  test('trigger gets an active/expanded state while its menu is open, clears on repeat click', async ({ page }) => {
    await page.goto('/');
    await waitForLoad(page);

    const trigger = page.getByTestId('load-fhir-btn');
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await trigger.click();
    await expect(trigger).toHaveClass(/load-btn--active/);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    await trigger.click();
    await expect(trigger).not.toHaveClass(/load-btn--active/);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  test('opening a different menu deactivates the previously-open trigger', async ({ page }) => {
    await page.goto('/');
    await waitForLoad(page);

    const questionnairesBtn = page.getByTestId('load-fhir-btn');
    const patientBtn        = page.getByTestId('patient-preset-btn');

    await questionnairesBtn.click();
    await expect(questionnairesBtn).toHaveClass(/load-btn--active/);

    await patientBtn.click();
    await expect(questionnairesBtn).not.toHaveClass(/load-btn--active/);
    await expect(patientBtn).toHaveClass(/load-btn--active/);
  });

  test('open menu panel is a full-width bottom sheet reaching the bottom of the viewport', async ({ page }) => {
    await page.goto('/');
    await waitForLoad(page);

    await page.getByTestId('load-fhir-btn').click();
    const menu = page.getByTestId('load-menu');
    // Wait out the slide-up entrance animation — measuring mid-transform
    // catches the panel still partway off-screen below the viewport.
    await menu.evaluate(el => new Promise(r => {
      if (getComputedStyle(el).animationName === 'none') return r();
      el.addEventListener('animationend', r, { once: true });
    }));
    const box = await menu.boundingBox();
    expect(box.x).toBeCloseTo(0, 0);
    expect(box.width).toBeCloseTo(480, 0);
    expect(box.y + box.height).toBeCloseTo(800, 0);
  });

  test('menu has a close button that dismisses it', async ({ page }) => {
    await page.goto('/');
    await waitForLoad(page);

    await page.getByTestId('load-fhir-btn').click();
    const menu = page.getByTestId('load-menu');
    await expect(menu).toBeVisible();
    await menu.getByTestId('load-menu-close').click();
    await expect(menu).toBeHidden();
  });

  test('menu shows a header row with the menu name next to the close button', async ({ page }) => {
    await page.goto('/');
    await waitForLoad(page);

    await page.getByTestId('load-fhir-btn').click();
    const menu = page.getByTestId('load-menu');
    await expect(menu).toBeVisible();

    const header = menu.getByTestId('load-menu-header');
    await expect(header).toBeVisible();
    await expect(header.getByTestId('load-menu-title')).toHaveText('Questionnaires');
    await expect(header.getByTestId('load-menu-close')).toBeVisible();
  });
});
