// ── E2E: Builder — patient presets and variable re-init ──────────────────────
// Tests that patient presets populate variables correctly via initialExpression
// and that the Re-init button re-evaluates all fields.
//
// Run: npx playwright test tests/e2e/builder-patient.spec.js
//
// ── data-testid registry ──────────────────────────────────────────────────────
//   add-root-group-btn     "+Add Root Group" button
//   patient-preset-btn     "👤 Patient ▾" preset dropdown button
//   variables-reinit-btn   "↺ Re-init" button in the Variables panel
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import path from 'path';
import { FIXTURES, waitForLoad } from './helpers/builder.js';

/** Load the Eligibility Scenario fixture and wait for the initial reinit to finish. */
async function loadEligibility(page) {
  await page.goto('/');
  await waitForLoad(page);
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(
    path.join(FIXTURES, 'patient-scenario-eligibility.fhir.json')
  );
  // reinitForm() runs automatically on load; wait until profile-age is populated
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-preview-id="profile-age"] .preview-readonly-value');
      return el && el.textContent.trim() !== '';
    },
    { timeout: 15000 }
  );
}

/** Click the patient preset button and select a preset by its data-preset value. */
async function selectPreset(page, presetId) {
  await page.getByTestId('patient-preset-btn').click();
  await page.locator(`[data-preset="${presetId}"]`).click();
}

// ── Patient preset → variables populate ──────────────────────────────────────

test.describe('Patient preset → variables populate', () => {
  test('default state: adult section visible, pediatric section dimmed (age 30)', async ({ page }) => {
    await loadEligibility(page);

    await expect(page.locator('[data-preview-id="adult-section"]')).not.toHaveClass(/lform-waiting/);
    await expect(page.locator('[data-preview-id="pediatric-section"]')).toHaveClass(/lform-waiting/);
  });

  test('selecting Child preset (age 10) dims adult section and shows pediatric section', async ({ page }) => {
    await loadEligibility(page);

    await selectPreset(page, 'child');

    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-preview-id="profile-age"] .preview-readonly-value');
        return el && el.textContent.trim() === '10';
      },
      { timeout: 10000 }
    );

    await expect(page.locator('[data-preview-id="adult-section"]')).toHaveClass(/lform-waiting/);
    await expect(page.locator('[data-preview-id="pediatric-section"]')).not.toHaveClass(/lform-waiting/);
  });
});

// ── Re-init ───────────────────────────────────────────────────────────────────

test.describe('Re-init', () => {
  test('sample load auto-evaluates initialExpression: profile-age shows default variable value', async ({ page }) => {
    await loadEligibility(page);

    await expect(
      page.locator('[data-preview-id="profile-age"] .preview-readonly-value')
    ).toContainText('30');
  });

  test('selecting Obese Male preset updates profile fields via reinit', async ({ page }) => {
    await loadEligibility(page);

    await selectPreset(page, 'obese-male');

    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-preview-id="profile-age"] .preview-readonly-value');
        return el && el.textContent.trim() === '45';
      },
      { timeout: 10000 }
    );

    await expect(
      page.locator('[data-preview-id="profile-age"] .preview-readonly-value')
    ).toContainText('45');
    await expect(
      page.locator('[data-preview-id="profile-bmi"] .preview-readonly-value')
    ).toContainText('38');

    await expect(page.locator('[data-preview-id="smoker-section"]')).not.toHaveClass(/lform-waiting/);
  });

  test('Re-init button re-evaluates initialExpression fields', async ({ page }) => {
    await loadEligibility(page);

    await selectPreset(page, 'adult-male');
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-preview-id="profile-age"] .preview-readonly-value');
        return el && el.textContent.trim() === '35';
      },
      { timeout: 10000 }
    );

    await page.getByTestId('variables-reinit-btn').click();
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-preview-id="profile-age"] .preview-readonly-value');
        return el && el.textContent.trim() === '35';
      },
      { timeout: 10000 }
    );

    await expect(
      page.locator('[data-preview-id="profile-age"] .preview-readonly-value')
    ).toContainText('35');
    await expect(
      page.locator('[data-preview-id="profile-bmi"] .preview-readonly-value')
    ).toContainText('24');
  });
});
