// ── E2E: Modal sizing on mobile vs desktop (issue #76) ────────────────────────
// Below 1024px every Modal-based dialog fills the full viewport width+height
// (css/modals.css + js/ui/modals/modal-base.js); at/above 1024px it reverts to
// a centered, capped dialog. Regression coverage for:
//   • Modal.maxWidth being a stale inline style that used to block full-width
//   • libraryModal/nodePickerModal .modal-body max-height (65vh/60vh) being a
//     bottom-sheet-era leftover that capped the body short of the new
//     full-height box, leaving the footer floating above the viewport bottom
//   • Same footer-floats-above-the-bottom bug recurring for the maximize
//     toggle (issue #99): a per-modal .modal-body max-height cap (libraryModal)
//     must be neutralized when .modal-box--maximized, not just the box itself
//
// data-testid:
//   load-fhir-btn            "Questionnaires ▾" toolbar dropdown trigger
//   load-from-file-item      "From file…" menu item — opens loadFormatModal
//   load-library-item        "From Library…" menu item — opens libraryModal
//   loadFormatModal          format-picker modal backdrop
//   libraryModal             library-browse modal backdrop
//   loadFormatModalMaximize  maximize/restore toggle (Modal base class, desktop-only)
//   libraryModalMaximize     same toggle, on the modal with a per-modal body max-height cap
//
// Run: npx playwright test tests/e2e/modal-responsive.spec.js

import { test, expect } from '@playwright/test';

async function waitForLoad(page) {
  await page.waitForSelector('[data-testid="left-panel-rail-tab"]', { state: 'attached', timeout: 10_000 });
}

async function openModal(page, itemTestId, modalTestId) {
  await page.getByTestId('load-fhir-btn').click();
  await page.getByTestId(itemTestId).click();
  await expect(page.getByTestId(modalTestId)).toBeVisible();
}

test.describe('Modal sizing — mobile (<1024px) fills the viewport', () => {
  test.use({ viewport: { width: 480, height: 800 } });

  test('loadFormatModal box spans the full width and height', async ({ page }) => {
    await page.goto('/');
    await waitForLoad(page);
    await openModal(page, 'load-from-file-item', 'loadFormatModal');

    const box = await page.locator('[data-testid="loadFormatModal"] .modal-box').boundingBox();
    expect(box.x).toBeCloseTo(0, 0);
    expect(box.width).toBeCloseTo(480, 0);
    expect(box.y + box.height).toBeCloseTo(800, 0);
  });

  test('libraryModal footer (Close button) reaches the bottom of the viewport', async ({ page }) => {
    await page.goto('/');
    await waitForLoad(page);
    await openModal(page, 'load-library-item', 'libraryModal');

    const boxRect    = await page.locator('[data-testid="libraryModal"] .modal-box').boundingBox();
    const footerRect = await page.locator('[data-testid="libraryModal"] .modal-footer').boundingBox();
    expect(boxRect.width).toBeCloseTo(480, 0);
    expect(footerRect.y + footerRect.height).toBeCloseTo(boxRect.y + boxRect.height, 0);
  });

  test('maximize toggle is not shown (modal already fills the viewport)', async ({ page }) => {
    await page.goto('/');
    await waitForLoad(page);
    await openModal(page, 'load-from-file-item', 'loadFormatModal');

    await expect(page.getByTestId('loadFormatModalMaximize')).not.toBeVisible();
  });
});

test.describe('Modal sizing — desktop (\u22651024px) stays centered/capped', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('loadFormatModal box does not fill the full viewport', async ({ page }) => {
    await page.goto('/');
    await waitForLoad(page);
    await openModal(page, 'load-from-file-item', 'loadFormatModal');

    const box = await page.locator('[data-testid="loadFormatModal"] .modal-box').boundingBox();
    expect(box.width).toBeLessThan(1280);
    expect(box.height).toBeLessThan(800);
  });

  test('maximize toggle expands the box to fill the viewport, restore reverts it', async ({ page }) => {
    await page.goto('/');
    await waitForLoad(page);
    await openModal(page, 'load-from-file-item', 'loadFormatModal');

    const boxLocator = page.locator('[data-testid="loadFormatModal"] .modal-box');
    const original = await boxLocator.boundingBox();
    expect(original.width).toBeLessThan(1280);

    const maximizeBtn = page.getByTestId('loadFormatModalMaximize');
    await expect(maximizeBtn).toBeVisible();
    await maximizeBtn.click();

    const maximized = await boxLocator.boundingBox();
    expect(maximized.width).toBeCloseTo(1280, 0);
    expect(maximized.height).toBeCloseTo(800, 0);

    await maximizeBtn.click();
    const restored = await boxLocator.boundingBox();
    expect(restored.width).toBeCloseTo(original.width, 0);
  });

  test('maximized libraryModal footer still reaches the bottom despite its .modal-body max-height cap', async ({ page }) => {
    await page.goto('/');
    await waitForLoad(page);
    await openModal(page, 'load-library-item', 'libraryModal');

    await page.getByTestId('libraryModalMaximize').click();

    const boxRect    = await page.locator('[data-testid="libraryModal"] .modal-box').boundingBox();
    const footerRect = await page.locator('[data-testid="libraryModal"] .modal-footer').boundingBox();
    expect(boxRect.height).toBeCloseTo(800, 0);
    expect(footerRect.y + footerRect.height).toBeCloseTo(boxRect.y + boxRect.height, -1);
  });
});
