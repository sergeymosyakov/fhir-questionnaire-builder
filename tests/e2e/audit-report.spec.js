// ── E2E: Quality audit report ──────────────────────────────────────────────────
//
// Tests the advisory "Quality audit" validator (js/fhir/audit.js): a Settings ▾
// toggle, its own section in the Validate modal (mode: 'validate' only), and
// that it never appears during export/import (advisory-only, non-blocking).
//
// Fixture: tests/fixtures/audit-issues.fhir.json — one group with:
//   q-broken-ref  — enableWhenExpression references a nonexistent linkId "ghost"
//   q-external-vs — choice item with an external (non-#contained) answerValueSet
//
// data-testid registry:
//   settings-validate-audit-check   "Quality audit" checkbox row in Settings ▾
//   tools-btn / validate-item       Settings ▾ dropdown trigger / "Validate" item
//   validateModal / validateModalBody / validateModalClose
//   validate-section-audit         the audit validator's section in the modal
//   export-btn / export-quest-item Export ▾ dropdown trigger / "Questionnaire" item
//   saveFormatModal / saveFormatModalApply
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { test, expect } from '@playwright/test';
import { openDropdownItem } from './helpers/dropdown.js';
import { freshStart, addRootGroup, waitForLoad } from './helpers/builder.js';

const FIXTURE = path.resolve('tests/fixtures/audit-issues.fhir.json');

async function loadFixture(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(FIXTURE);
  await expect(page.locator('[data-preview-id="q-external-vs"]')).toBeVisible({ timeout: 8_000 });
}

async function openValidateModal(page) {
  await openDropdownItem(page, 'tools-btn', 'validate-item');
  await expect(page.locator('[data-testid="validateModal"]')).toBeVisible();
}

test.describe('Settings \u25be \u2014 Quality audit toggle', () => {
  test('is present and checked by default', async ({ page }) => {
    await loadFixture(page);
    await page.getByTestId('tools-btn').click();
    await expect(page.getByTestId('settings-validate-audit-check')).toBeVisible();
    await expect(page.getByTestId('settings-validate-audit-check').locator('input')).toBeChecked();
  });

  test('persists across reload when turned off', async ({ page }) => {
    await freshStart(page);
    await addRootGroup(page);

    await page.getByTestId('tools-btn').click();
    await page.getByTestId('settings-validate-audit-check').locator('input').uncheck();
    await page.keyboard.press('Escape');

    // Tree doesn't persist across a plain reload (no fixture/autosave here) \u2014
    // re-add a group so the Settings button is visible again; the pref itself
    // lives in localStorage and must survive the reload untouched.
    await page.reload();
    await waitForLoad(page);
    await addRootGroup(page);

    await page.getByTestId('tools-btn').click();
    await expect(page.getByTestId('settings-validate-audit-check').locator('input')).not.toBeChecked();
  });
});

test.describe('Validate modal \u2014 Quality audit section', () => {
  test('shows the broken-linkId and external-answerValueSet findings', async ({ page }) => {
    await loadFixture(page);
    await openValidateModal(page);

    const section = page.locator('[data-testid="validate-section-audit"]');
    await expect(section).toBeVisible();
    await expect(section).toContainText('ghost');
    await expect(section).toContainText('external terminology server');
  });

  test('does not appear when the Quality audit toggle is off', async ({ page }) => {
    await loadFixture(page);
    await page.getByTestId('tools-btn').click();
    await page.getByTestId('settings-validate-audit-check').locator('input').uncheck();
    await page.keyboard.press('Escape');

    await openValidateModal(page);
    await expect(page.locator('[data-testid="validate-section-audit"]')).not.toBeVisible();
  });
});

test.describe('Export \u2014 Quality audit never blocks', () => {
  test('export proceeds without the validate modal opening (audit findings only)', async ({ page }) => {
    await loadFixture(page);

    await openDropdownItem(page, 'export-btn', 'export-quest-item');
    await expect(page.locator('[data-testid="saveFormatModal"]')).toBeVisible();
    await page.getByTestId('saveFormatModalApply').click();

    // No FHIR-conformance issues in this fixture — the validate modal must
    // never appear, even though the audit validator has 2 findings for it.
    await expect(page.locator('[data-testid="validateModal"]')).not.toBeVisible({ timeout: 2_000 });
    await expect(page.getByTestId('prompt-save')).toBeVisible({ timeout: 5_000 });
  });
});
