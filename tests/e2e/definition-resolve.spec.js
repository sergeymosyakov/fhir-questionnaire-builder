// ── E2E: item.definition → StructureDefinition resolution ────────────────────
//
// Tests the "Resolve from profile" action in the Item Properties (Props) modal:
// loading a StructureDefinition auto-fills the item text, type, and constraints
// for the element referenced by the item.definition URL. Runs client-side only.
//
// Fixtures:
//   tests/fixtures/definition-resolve.fhir.json — one string item `q-name`
//     with definition = '...DemoPatient#Patient.name.family'
//   tests/fixtures/patient-profile.sd.json — StructureDefinition whose
//     Patient.name.family element is short 'Family name', required, maxLength 60
//
// data-testid registry:
//   action-codes               — "Props" button on the item card
//   codesModal                 — Item Properties modal
//   item-props-definition      — definition URL input
//   item-props-base-type       — Base Type input
//   item-props-resolve-btn     — "Resolve from profile…" button
//   item-props-profile-file    — hidden file input for the StructureDefinition
//   item-props-resolve-status  — resolve summary text
//   node-title-display         — inline node title span in the builder tree
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { test, expect } from '@playwright/test';

const FIXTURE = path.resolve('tests/fixtures/definition-resolve.fhir.json');
const PROFILE = path.resolve('tests/fixtures/patient-profile.sd.json');

async function loadFixture(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(FIXTURE);
  await expect(page.locator('[data-preview-id="q-name"]')).toBeVisible({ timeout: 8_000 });
}

async function openProps(page, nodeId) {
  const link = page.locator(`[data-node-id="${nodeId}"] [data-testid="action-codes"]`);
  await expect(link).toBeVisible();
  await link.click();
  await expect(page.locator('[data-testid="codesModal"]')).toBeVisible({ timeout: 3000 });
}

test.describe('item.definition resolution', () => {
  test('definition URL is shown in the Props modal', async ({ page }) => {
    await loadFixture(page);
    await openProps(page, 'q-name');
    await expect(page.getByTestId('item-props-definition'))
      .toHaveValue(/#Patient\.name\.family$/);
  });

  test('resolving from a profile fills base type and shows a summary', async ({ page }) => {
    await loadFixture(page);
    await openProps(page, 'q-name');

    await page.getByTestId('item-props-profile-file').setInputFiles(PROFILE);

    const status = page.getByTestId('item-props-resolve-status');
    await expect(status).toBeVisible();
    await expect(status).toContainText('Patient.name.family');
    await expect(status).toContainText('required');

    await expect(page.getByTestId('item-props-base-type')).toHaveValue('string');
  });

  test('resolved element short text becomes the item title', async ({ page }) => {
    await loadFixture(page);
    await openProps(page, 'q-name');
    await page.getByTestId('item-props-profile-file').setInputFiles(PROFILE);
    await expect(page.getByTestId('item-props-resolve-status')).toBeVisible();

    // Apply and confirm the tree reflects the resolved title.
    await page.locator('[data-testid="codesModalApply"]').click();
    await expect(
      page.locator('[data-node-id="q-name"] [data-testid="node-title-display"]').first(),
    ).toContainText('Family name');
  });
});
