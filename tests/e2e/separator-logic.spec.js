// ── E2E: AND/OR separator logic in preview ────────────────────────────────────
// Verifies that AND/OR separators are shown only between answerable items and
// are suppressed adjacent to display/info items and pure-display groups.
//
// Run: npx playwright test tests/e2e/separator-logic.spec.js
//
// ── Fixture: tests/fixtures/separator-logic.fhir.json ─────────────────────
//   g1 — group with answerable (q1, q2, q3) and display (d1, d2) items
//   g2 — group with ONLY display items (da, db)
//   g3 — group with ONLY answerable items (qa, qb, qc)
//
// Separator CSS class: .logic-separator
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { openDropdownItem } from './helpers/dropdown.js';

const FIXTURE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../fixtures/separator-logic.fhir.json'
);

async function loadFixture(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });

  await openDropdownItem(page, 'load-fhir-btn', 'load-from-file-item');

  // Confirm if existing questionnaire is loaded
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

  await expect(page.locator('[data-preview-id="q1"]')).toBeVisible({ timeout: 10_000 });
}

// ── Helper: count visible separators inside a preview section ────────────

test.describe('AND/OR separator logic', () => {
  test.beforeEach(async ({ page }) => {
    await loadFixture(page);
  });

  // ── g1: q1, q2, display d1, q3 ──────────────────────────────────────────

  test('g1: exactly 1 separator — between q1 and q2, none adjacent to display d1', async ({ page }) => {
    // Structure: q1 → q2 → d1 → q3
    // Separator between q1 and q2 (both answerable, adjacent) ✓
    // No separator between q2 and d1 (d1 is display) ✓
    // No separator between d1 and q3 (previous visible was display) ✓
    // → total 1 separator
    const g1Nested = page.locator('[data-preview-id="g1"] + .preview-nested');
    await expect(g1Nested).toBeVisible();
    await expect(g1Nested.locator('.logic-separator')).toHaveCount(1);
  });

  test('g1: display item d1 is visible between q2 and q3', async ({ page }) => {
    await expect(page.locator('[data-preview-id="d1"]')).toBeVisible();
    await expect(page.locator('[data-preview-id="q3"]')).toBeVisible();
  });

  // ── g2: all display items — no separators, no ALL items badge ────────────

  test('g2: no separators when group contains only display items', async ({ page }) => {
    const g2Nested = page.locator('[data-preview-id="g2"] + .preview-nested');
    await expect(g2Nested.locator('.logic-separator')).toHaveCount(0);
  });

  test('g2: no ALL/ANY items badge shown for display-only group', async ({ page }) => {
    const g2Row = page.locator('[data-preview-id="g2"]');
    await expect(g2Row.locator('.preview-logic-badge')).toHaveCount(0);
  });

  // ── g3: all answerable items — separators between every pair ────────────

  test('g3: 2 separators between 3 answerable items with no display items', async ({ page }) => {
    const g3Nested = page.locator('[data-preview-id="g3"] + .preview-nested');
    await expect(g3Nested.locator('.logic-separator')).toHaveCount(2);
  });

  test('g3: ALL items badge shown when group has only answerable children', async ({ page }) => {
    const g3Row = page.locator('[data-preview-id="g3"]');
    await expect(g3Row.locator('.preview-logic-badge')).toBeVisible();
  });
});
