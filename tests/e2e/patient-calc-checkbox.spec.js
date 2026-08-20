// ── E2E: Patient view — calculated checkbox badge ────────────────────────────
//
// Regression for a bug where a read-only calculatedExpression *checkbox* field,
// which renders as a plain patient value on load, flipped to the design-preview
// ✓/✗ `calc-badge` after a recompute (REFRESH_CALC_BADGES) because
// ItemNode._refreshCalcBadge ignored the preview mode.
//
// Fixture: tests/fixtures/patient-calc-checkbox.fhir.json
//   trigger — boolean, interactive
//   calc    — boolean, readOnly, calculatedExpression = trigger's boolean
//
// Run: npx playwright test tests/e2e/patient-calc-checkbox.spec.js
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { test, expect } from '@playwright/test';
import { clickBoolOption } from './helpers/builder.js';

const FIXTURE = path.resolve('tests/fixtures/patient-calc-checkbox.fhir.json');

const modeBtn = page => page.getByTestId('preview-mode-btn');

async function loadFixture(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(FIXTURE);
  await expect(page.locator('[data-preview-id="trigger"]')).toBeVisible({ timeout: 8_000 });
}

test('patient view: calc checkbox keeps preview-calc-value after recompute', async ({ page }) => {
  await loadFixture(page);

  // Switch to patient view.
  await modeBtn(page).click();
  await page.getByTestId('preview-mode-patient').click();
  await expect(page.locator('#lform')).toHaveClass(/patient-view/);

  const calcRow = page.locator('[data-preview-id="calc"]');

  // On load the computed field shows a plain patient value — not the design badge.
  await expect(calcRow.locator('.preview-calc-value')).toHaveCount(1);
  await expect(calcRow.locator('.calc-badge')).toHaveCount(0);

  // Toggle the trigger → the calculatedExpression recomputes (REFRESH_CALC_BADGES).
  await clickBoolOption(page, 'trigger', 'Yes');

  // It must STILL be a plain patient value, never the design ✓/✗ calc-badge.
  await expect(calcRow.locator('.calc-badge')).toHaveCount(0);
  await expect(calcRow.locator('.preview-calc-value')).toHaveCount(1);
});
