// ── E2E: enableWhen answerQuantity ────────────────────────────────────────────
// Tests that a Quantity-type enableWhen condition controls visibility in the
// preview and round-trips through export, plus the Show When editor renders a
// value + unit input for quantity source questions.
//
// Fixture: tests/fixtures/enable-when-quantity.fhir.json
//   weight        quantity (kg)
//   weight-alert  display, disabledDisplay=hidden, enableWhen weight >= 100 kg
//
// Run: npx playwright test tests/e2e/enable-when-quantity.spec.js
//
// ── data-testid registry ─────────────────────────────────────────────────────
//   fhir-file-input        hidden file <input> for Open → FHIR JSON
//   qty-num-input          numeric input of a quantity control in the preview
//   action-vis             "Show When" action link on an item node
//   showWhenModal          Show When modal backdrop
//   export-btn / export-quest-item / saveFormatModalApply / prompt-save — export flow
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openDropdownItem } from './helpers/dropdown.js';

const FIXTURE = path.resolve('tests/fixtures/enable-when-quantity.fhir.json');

async function loadFixture(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(FIXTURE);
  await expect(page.locator('[data-preview-id="weight"]')).toBeVisible({ timeout: 8_000 });
}

async function setWeight(page, value) {
  const inp = page.locator('[data-preview-id="weight"] [data-testid="qty-num-input"]');
  await inp.fill(String(value));
  // enableWhen visibility is re-evaluated on commit (blur), mirroring text inputs.
  await inp.blur();
}

async function enterPatientView(page) {
  await page.getByTestId('preview-mode-btn').click();
  await page.getByTestId('preview-mode-patient').click();
  await expect(page.locator('#lform')).toHaveClass(/patient-view/);
}

// ── Preview visibility ────────────────────────────────────────────────────────
// Builder/design preview always shows the dependent item (dimmed when the
// condition is not met). Patient view removes it — mirroring the real UI.

test.describe('answerQuantity — design preview (dimmed, never removed)', () => {
  test('dependent item is dimmed while weight is empty', async ({ page }) => {
    await loadFixture(page);
    const alert = page.locator('[data-preview-id="weight-alert"]');
    await expect(alert).toBeVisible();
    await expect(alert).toHaveClass(/lform-waiting/);
  });

  test('dependent item becomes active when weight >= threshold', async ({ page }) => {
    await loadFixture(page);
    await setWeight(page, 120);
    const alert = page.locator('[data-preview-id="weight-alert"]');
    await expect(alert).toBeVisible();
    await expect(alert).not.toHaveClass(/lform-waiting/);
  });

  test('dependent item dims again when weight drops below threshold', async ({ page }) => {
    await loadFixture(page);
    await setWeight(page, 120);
    await expect(page.locator('[data-preview-id="weight-alert"]')).not.toHaveClass(/lform-waiting/);
    await setWeight(page, 80);
    await expect(page.locator('[data-preview-id="weight-alert"]')).toHaveClass(/lform-waiting/);
  });
});

test.describe('answerQuantity — patient view (hidden when not met)', () => {
  test('dependent item is removed while weight is below threshold', async ({ page }) => {
    await loadFixture(page);
    await enterPatientView(page);
    await expect(page.locator('[data-preview-id="weight-alert"]')).toHaveCount(0);
  });

  test('dependent item appears once weight reaches the threshold', async ({ page }) => {
    await loadFixture(page);
    await setWeight(page, 120);
    await enterPatientView(page);
    await expect(page.locator('[data-preview-id="weight-alert"]')).toBeVisible();
  });
});

// ── Round-trip ────────────────────────────────────────────────────────────────

test.describe('answerQuantity — round-trip', () => {
  test('answerQuantity survives import → export', async ({ page }) => {
    await loadFixture(page);
    await openDropdownItem(page, 'export-btn', 'export-quest-item');
    await expect(page.locator('[data-testid="saveFormatModal"]')).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('saveFormatModalApply').click().then(() => page.getByTestId('prompt-save').click()),
    ]);
    const q = JSON.parse(readFileSync(await download.path(), 'utf8'));
    const alert = q.item.find(i => i.linkId === 'weight-alert');
    const ew = alert.enableWhen[0];
    expect(ew.operator).toBe('>=');
    expect(ew.answerQuantity.value).toBe(100);
    expect(ew.answerQuantity.code).toBe('kg');
  });
});

// ── Show When editor ──────────────────────────────────────────────────────────

test.describe('answerQuantity — Show When editor', () => {
  test('renders value + unit inputs pre-filled from the condition', async ({ page }) => {
    await loadFixture(page);
    await page.locator('[data-node-id="weight-alert"]').getByTestId('action-vis').click();
    await expect(page.locator('[data-testid="showWhenModal"]')).toBeVisible();
    const body = page.locator('[data-testid="showWhenModalBody"]');
    await expect(body.locator('.vis-cond-qty-num')).toHaveValue('100');
    await expect(body.locator('.vis-cond-qty-unit')).toHaveValue('kg');
  });
});
