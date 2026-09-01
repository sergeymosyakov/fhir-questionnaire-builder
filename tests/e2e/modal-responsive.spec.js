// ── E2E: Modal sizing on mobile vs desktop (issue #76) ────────────────────────
// Below 1024px every Modal-based dialog fills the full viewport width+height
// (css/modals.css + js/ui/modals/modal-base.js); at/above 1024px it reverts to
// a centered, capped dialog. Regression coverage for:
//   • Modal.maxWidth being a stale inline style that used to block full-width
//   • libraryModal/nodePickerModal .modal-body max-height (65vh/60vh) being a
//     bottom-sheet-era leftover that capped the body short of the new
//     full-height box, leaving the footer floating above the viewport bottom
//
// data-testid:
//   load-fhir-btn            "Questionnaires ▾" toolbar dropdown trigger
//   load-from-file-item      "From file…" menu item — opens loadFormatModal
//   load-library-item        "From Library…" menu item — opens libraryModal
//   loadFormatModal          format-picker modal backdrop
//   libraryModal             library-browse modal backdrop
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
});
