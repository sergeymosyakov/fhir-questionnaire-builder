// ── E2E: Collapse All hides children of an unavailable (dimmed) group ────────
// Regression: "Collapse all" in the preview toolbar set _previewCollapsed on
// every node, but a group made unavailable by an unmet enableWhen condition is
// rendered via _renderDimmed → _renderDimmedChildren, which ignored the flag
// and kept showing its children. This test proves the dimmed group's children
// are hidden after Collapse All and shown again after Expand All.
//
// Run: npx playwright test tests/e2e/collapse-dimmed-group.spec.js
//
// ── Fixture: tests/fixtures/collapse-dimmed-group.fhir.json ──────────────────
//   trig   — boolean trigger question
//   dgrp   — group with enableWhen (trig = true) → dimmed while trig unanswered
//   dchild — child item inside the dimmed group
//
// ── data-testid registry ─────────────────────────────────────────────────────
//   load-fhir-btn        "Questionnaires ▾" toolbar dropdown
//   load-from-file-item  "From file…" menu item
//   loadFormatModal      load-format chooser modal
//   load-format-select   format custom-select trigger
//   loadFormatModalApply Apply button in the format modal
//   tools-btn            settings/tools dropdown trigger
//   collapse-all-item    "Collapse all" (preview) menu item
//   expand-all-item      "Expand all" (preview) menu item
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { openDropdownItem } from './helpers/dropdown.js';

const FIXTURE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../fixtures/collapse-dimmed-group.fhir.json'
);

async function loadFixture(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });

  await openDropdownItem(page, 'load-fhir-btn', 'load-from-file-item');

  // Confirm if an existing questionnaire is loaded
  const confirm = page.getByTestId('loadConfirmModal');
  await confirm.waitFor({ state: 'visible', timeout: 2_000 }).catch(() => {});
  if (await confirm.isVisible()) await page.getByTestId('load-confirm-proceed-btn').click();

  await expect(page.getByTestId('loadFormatModal')).toBeVisible();
  await page.getByTestId('load-format-select').click();
  await page.locator('[data-testid="csel-drop"] [data-val="fhir"]').click();

  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByTestId('loadFormatModalApply').click(),
  ]);
  await fileChooser.setFiles(FIXTURE);

  // Trigger question is answerable; the conditional group is dimmed.
  await expect(page.locator('[data-preview-id="trig"]')).toBeVisible({ timeout: 10_000 });
}

test.describe('Collapse All — unavailable (dimmed) group', () => {
  test.beforeEach(async ({ page }) => {
    await loadFixture(page);
  });

  test('dimmed group renders its child until Collapse All hides it', async ({ page }) => {
    // The conditional group is dimmed (enableWhen not met) but still shows its child.
    const dgrp   = page.locator('[data-preview-id="dgrp"]');
    const dchild = page.locator('[data-preview-id="dchild"]');
    await expect(dgrp).toBeVisible();
    await expect(dgrp).toHaveClass(/lform-waiting|lform-disabled/);
    await expect(dchild).toBeVisible();

    // Collapse all → the dimmed group must hide its child.
    await page.evaluate(() => { window.__done = false; document.addEventListener('preview:render-done', () => { window.__done = true; }, { once: true }); });
    await openDropdownItem(page, 'tools-btn', 'collapse-all-item');
    await page.waitForFunction(() => window.__done, { timeout: 10_000 });

    await expect(dchild).toHaveCount(0);
    // The dimmed group row itself remains visible.
    await expect(dgrp).toBeVisible();
  });

  test('Expand All restores the dimmed group child after Collapse All', async ({ page }) => {
    const dchild = page.locator('[data-preview-id="dchild"]');
    await expect(dchild).toBeVisible();

    // Collapse all → child hidden
    await page.evaluate(() => { window.__done = false; document.addEventListener('preview:render-done', () => { window.__done = true; }, { once: true }); });
    await openDropdownItem(page, 'tools-btn', 'collapse-all-item');
    await page.waitForFunction(() => window.__done, { timeout: 10_000 });
    await expect(dchild).toHaveCount(0);

    // Expand all → child shown again
    await page.evaluate(() => { window.__done = false; document.addEventListener('preview:render-done', () => { window.__done = true; }, { once: true }); });
    await openDropdownItem(page, 'tools-btn', 'expand-all-item');
    await page.waitForFunction(() => window.__done, { timeout: 10_000 });
    await expect(dchild).toBeVisible();
  });
});
