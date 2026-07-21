// ── E2E: Questionnaire Properties — Launch Context section ───────────────────
// Tests that the Launch Context collapsible section in the Properties modal
// can add, edit, and remove sdc-questionnaire-launchContext entries, and that
// they round-trip correctly through FHIR export/import.
//
// Run: npx playwright test tests/e2e/metadata-launch-context.spec.js
//
// ── data-testid registry ──────────────────────────────────────────────────────
//   meta-launch-ctx-toggle   Launch Context collapsible toggle
//   meta-lc-add-btn          "+ Add context" button
//   meta-lc-row-0            first launch context row
//   meta-lc-name-sel-0       name custom-select trigger (row 0)
//   meta-lc-name-inp-0       custom name text input (row 0)
//   meta-lc-type-0           type input (row 0)
//   meta-lc-desc-0           description input (row 0)
//   meta-lc-remove-0         × remove button (row 0)
//   metadataModalApply       Apply button
//   metadataModalCancel      Cancel button

import { test, expect } from '@playwright/test';
import { FHIR } from '../../js/fhir/urls/fhir.js';
import { freshStart, openModal, exportFHIR } from './helpers/metadata.js';
import path from 'node:path';

const FIXTURE_LC = path.resolve('sampledata/answer-expression-demo.fhir.json');

async function openFromFixture(page) {
  await freshStart(page);
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(
    path.resolve('tests/fixtures/meta-test.fhir.json')
  );
  await expect(page.getByTestId('quest-meta-card')).toBeVisible({ timeout: 8_000 });
  await openModal(page);
}

async function expandLaunchCtx(page) {
  const toggle = page.getByTestId('meta-launch-ctx-toggle');
  if (!(await page.getByTestId('meta-lc-add-btn').isVisible())) {
    await toggle.click();
  }
  await expect(page.getByTestId('meta-lc-add-btn')).toBeVisible();
}

// ── Adding and saving a launch context ────────────────────────────────────────

test.describe('Launch Context — add / save', () => {
  test('section is present in Properties modal', async ({ page }) => {
    await openFromFixture(page);
    await expect(page.getByTestId('meta-launch-ctx-toggle')).toBeVisible();
  });

  test('can add a context by selecting a preset name', async ({ page }) => {
    await openFromFixture(page);
    await expandLaunchCtx(page);
    await page.getByTestId('meta-lc-add-btn').click();
    await expect(page.getByTestId('meta-lc-row-0')).toBeVisible();

    // Select 'patient' preset from the name custom-select
    await page.getByTestId('meta-lc-name-sel-0').click();
    await page.locator('[data-testid="csel-drop"] [data-val="patient"]').click();

    // Type should be auto-filled
    await expect(page.getByTestId('meta-lc-type-0')).toHaveValue('Patient');
    await page.getByTestId('meta-lc-desc-0').fill('The patient completing the form');
    await page.locator('[data-testid="metadataModalApply"]').click();
    await expect(page.locator('[data-testid="metadataModal"]')).toBeHidden();

    // Reopen → row persists
    await openModal(page);
    await expandLaunchCtx(page);
    await expect(page.getByTestId('meta-lc-row-0')).toBeVisible();
    await expect(page.getByTestId('meta-lc-type-0')).toHaveValue('Patient');
    await expect(page.getByTestId('meta-lc-desc-0')).toHaveValue('The patient completing the form');
  });

  test('can add a context with a custom name', async ({ page }) => {
    await openFromFixture(page);
    await expandLaunchCtx(page);
    await page.getByTestId('meta-lc-add-btn').click();
    await page.getByTestId('meta-lc-name-inp-0').fill('myCtx');
    await page.getByTestId('meta-lc-type-0').fill('Organization');
    await page.locator('[data-testid="metadataModalApply"]').click();

    // Reopen → row persists with custom name
    await openModal(page);
    await expandLaunchCtx(page);
    await expect(page.getByTestId('meta-lc-name-inp-0')).toHaveValue('myCtx');
    await expect(page.getByTestId('meta-lc-type-0')).toHaveValue('Organization');
  });

  test('removing a context removes it from the modal', async ({ page }) => {
    await openFromFixture(page);
    await expandLaunchCtx(page);
    await page.getByTestId('meta-lc-add-btn').click();
    await page.getByTestId('meta-lc-name-inp-0').fill('patient');
    await page.getByTestId('meta-lc-type-0').fill('Patient');
    await page.getByTestId('meta-lc-remove-0').click();
    await expect(page.getByTestId('meta-lc-row-0')).toBeHidden();
    await page.locator('[data-testid="metadataModalApply"]').click();

    // Reopen → empty
    await openModal(page);
    await expandLaunchCtx(page);
    await expect(page.getByTestId('meta-lc-row-0')).toBeHidden();
  });
});

// ── Round-trip: import a file with launchContext, verify it loads ──────────────

test.describe('Launch Context — round-trip import', () => {
  test('imports launchContext from answer-expression-demo sample and shows it in the modal', async ({ page }) => {
    await freshStart(page);
    // Load the sample that has a launchContext declared
    await page.locator('[data-testid="fhir-file-input"]').setInputFiles(FIXTURE_LC);
    await expect(page.getByTestId('quest-meta-card')).toBeVisible({ timeout: 8_000 });
    await openModal(page);
    await expandLaunchCtx(page);
    // The fixture declares a 'patient' context
    await expect(page.getByTestId('meta-lc-row-0')).toBeVisible();
    await expect(page.getByTestId('meta-lc-type-0')).toHaveValue('Patient');
  });

  test('exports launchContext back to FHIR JSON', async ({ page }) => {
    await freshStart(page);
    await page.locator('[data-testid="fhir-file-input"]').setInputFiles(FIXTURE_LC);
    await expect(page.getByTestId('quest-meta-card')).toBeVisible({ timeout: 8_000 });

    const q = await exportFHIR(page);
    const LC_URL = FHIR.launchContext;
    const lcExts = (q.extension || []).filter(e => e.url === LC_URL);
    expect(lcExts.length).toBeGreaterThanOrEqual(1);
    const nameSub = lcExts[0].extension?.find(s => s.url === 'name');
    expect(nameSub?.valueCoding?.code).toBe('patient');
  });
});
