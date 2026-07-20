// ── E2E: reference profile / type validation ─────────────────────────────────
//
// Covers feature #2 (client-side reference type validation):
//  1. A reference answer whose resource type differs from the item's allowed
//     type shows an inline "Expected {Type}" error in the preview control.
//  2. A matching-type reference shows no error.
//  3. "Resolve from profile" on a reference item derives the allowed target type
//     (from the element's Reference targetProfile) and sets it on the item.
//
// Fixtures:
//   tests/fixtures/reference-profile.fhir.json — q-org-bad (Organization item
//     prefilled with Patient/1), q-org-ok (prefilled Organization/2), q-def
//     (definition → Patient.managingOrganization)
//   tests/fixtures/patient-profile.sd.json — Patient.managingOrganization is a
//     Reference with targetProfile Organization
//
// data-testid registry:
//   fhir-file-input            — questionnaire file input
//   ref-type-error             — inline reference type-mismatch error (control)
//   action-codes               — "Props" button on the item card
//   codesModal / codesModalApply
//   item-props-profile-file    — hidden StructureDefinition file input
//   item-props-resolve-status  — resolve summary text
// Preview control classes (sanctioned non-testid exception): .ref-type-sel, .ref-id-input
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { test, expect } from '@playwright/test';

const FIXTURE = path.resolve('tests/fixtures/reference-profile.fhir.json');
const PROFILE = path.resolve('tests/fixtures/patient-profile.sd.json');

async function loadFixture(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(FIXTURE);
  await expect(page.locator('[data-preview-id="q-org-bad"]')).toBeVisible({ timeout: 8_000 });
}

test.describe('reference type validation', () => {
  test('wrong-type reference shows an inline "Expected" error', async ({ page }) => {
    await loadFixture(page);
    const err = page.locator('[data-preview-id="q-org-bad"]').getByTestId('ref-type-error');
    await expect(err).toBeVisible();
    await expect(err).toContainText('Expected Organization');
  });

  test('matching-type reference shows no error', async ({ page }) => {
    await loadFixture(page);
    const err = page.locator('[data-preview-id="q-org-ok"]').getByTestId('ref-type-error');
    await expect(err).toHaveCount(1);
    await expect(err).toBeHidden();
  });

  test('Resolve from profile derives the allowed target type', async ({ page }) => {
    await loadFixture(page);
    const link = page.locator('[data-node-id="q-def"] [data-testid="action-codes"]');
    await expect(link).toBeVisible();
    await link.click();
    await expect(page.locator('[data-testid="codesModal"]')).toBeVisible({ timeout: 3000 });

    await page.getByTestId('item-props-profile-file').setInputFiles(PROFILE);
    const status = page.getByTestId('item-props-resolve-status');
    await expect(status).toBeVisible();
    await expect(status).toContainText('Organization');
  });
});
