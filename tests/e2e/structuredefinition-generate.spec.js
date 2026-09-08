// ── E2E: Generate draft Questionnaire from StructureDefinition (issue #94) ────
// Tests the "FHIR StructureDefinition (.json) — generate draft" format in the
// Load from file → format picker modal.
//
// Run: npx playwright test tests/e2e/structuredefinition-generate.spec.js
//
// ── data-testid registry ─────────────────────────────────────────────────────
//   load-fhir-btn                     "Questionnaires ▾" dropdown trigger
//   load-from-file-item               "From file…" menu item
//   load-library-item                 "From Library…" menu item
//   loadFormatModal                   format picker modal backdrop
//   loadFormatModalApply              "Choose file…" button
//   load-format-select                custom select trigger inside load modal
//   structuredefinition-file-input    hidden <input type=file> for SD JSON files
//   validateModal / validateModalTitle / validateModalBody / validateModalClose
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import path from 'node:path';
import { openDropdownItem } from './helpers/dropdown.js';
import { freshStart } from './helpers/builder.js';

const FIXTURE = path.resolve('tests/fixtures/sd-demo-patient.json');

async function loadStructureDefinition(page, filePath) {
  await openDropdownItem(page, 'load-fhir-btn', 'load-from-file-item');
  await expect(page.getByTestId('loadFormatModal')).toBeVisible();

  await page.getByTestId('load-format-select').click();
  await page.locator('[data-testid="csel-drop"] [data-val="sd"]').click();

  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByTestId('loadFormatModalApply').click(),
  ]);
  await fileChooser.setFiles(filePath);
}

test.describe('StructureDefinition → generate draft Questionnaire', () => {
  test('generates a group for a BackboneElement with its leaf children nested inside', async ({ page }) => {
    await freshStart(page);
    await loadStructureDefinition(page, FIXTURE);

    const nameGroup = page.locator('[data-node-id="Patient.name"]');
    await expect(nameGroup).toBeVisible({ timeout: 15_000 });
    await expect(nameGroup.locator('[data-node-id="Patient.name.family"]')).toBeVisible();
    await expect(nameGroup.locator('[data-node-id="Patient.name.given"]')).toBeVisible();
  });

  test('generates a top-level leaf item outside any group', async ({ page }) => {
    await freshStart(page);
    await loadStructureDefinition(page, FIXTURE);
    await expect(page.locator('[data-node-id="Patient.active"]')).toBeVisible({ timeout: 15_000 });
  });

  test('skips a profile-excluded (max:"0") element', async ({ page }) => {
    await freshStart(page);
    await loadStructureDefinition(page, FIXTURE);
    await expect(page.locator('[data-node-id="Patient.active"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-node-id="Patient.maritalStatus"]')).toHaveCount(0);
  });

  test('generates a separate item for a slice, alongside the base element', async ({ page }) => {
    await freshStart(page);
    await loadStructureDefinition(page, FIXTURE);
    await expect(page.locator('[data-node-id="Patient.identifier"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-node-id="Patient.identifier:mrn"]')).toBeVisible();
  });

  test('explodes a multi-type element into one item per type', async ({ page }) => {
    await freshStart(page);
    await loadStructureDefinition(page, FIXTURE);
    await expect(page.locator('[data-node-id="Patient.deceasedBoolean"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-node-id="Patient.deceasedDateTime"]')).toBeVisible();
  });

  test('renders a boolean leaf as a Yes/No control, not a text box', async ({ page }) => {
    await freshStart(page);
    await loadStructureDefinition(page, FIXTURE);
    const row = page.locator('[data-preview-id="Patient.active"]');
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row.locator('.bool-seg')).toBeVisible();
    await expect(row.locator('textarea')).toHaveCount(0);
  });

  test('renders a coded leaf as a select control, not a text box', async ({ page }) => {
    await freshStart(page);
    await loadStructureDefinition(page, FIXTURE);
    const row = page.locator('[data-preview-id="Patient.gender"]');
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row.locator('.sc-trigger')).toBeVisible();
    await expect(row.locator('textarea')).toHaveCount(0);
  });

  test('renders each exploded multi-type variant with its own correct control', async ({ page }) => {
    await freshStart(page);
    await loadStructureDefinition(page, FIXTURE);
    const boolRow = page.locator('[data-preview-id="Patient.deceasedBoolean"]');
    const dateRow = page.locator('[data-preview-id="Patient.deceasedDateTime"]');
    await expect(boolRow).toBeVisible({ timeout: 15_000 });
    await expect(boolRow.locator('.bool-seg')).toBeVisible();
    await expect(dateRow.locator('.ctrl-input--date')).toBeVisible();
  });

  test('shows an informational warnings modal for the multi-type explosion', async ({ page }) => {
    await freshStart(page);
    await loadStructureDefinition(page, FIXTURE);

    const modal = page.getByTestId('validateModal');
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('validateModalTitle')).toContainText('StructureDefinition Generation');
    const body = page.getByTestId('validateModalBody');
    await expect(body).toContainText('Patient.deceased[x]');
    await expect(body).toContainText('separate optional questions');
    await expect(body).not.toContainText('collapsed');
    await page.getByTestId('validateModalClose').click();
    await expect(modal).not.toBeVisible();
  });

  test('loads the sample StructureDefinition from the Library and generates a draft', async ({ page }) => {
    await freshStart(page);
    await openDropdownItem(page, 'load-fhir-btn', 'load-library-item');
    await page.getByTestId('lib-group-hdr-structuredefinition').click();
    await page.locator('[data-sample="sd-demo-patient.json"]').waitFor({ timeout: 10_000 });
    await page.click('[data-sample="sd-demo-patient.json"]');

    const modal = page.getByTestId('validateModal');
    await expect(modal).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('validateModalClose').click();

    await expect(page.locator('[data-node-id="Patient.active"]')).toBeVisible();
    await expect(page.locator('[data-node-id="Patient.identifier:mrn"]')).toBeVisible();
  });
});
