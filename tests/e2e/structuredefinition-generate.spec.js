// ── E2E: Generate draft Questionnaire from StructureDefinition (issue #94) ────
// Tests the "FHIR StructureDefinition (.json) — generate draft" format in the
// Load from file → format picker modal.
//
// Run: npx playwright test tests/e2e/structuredefinition-generate.spec.js
//
// ── data-testid registry ─────────────────────────────────────────────────────
//   load-fhir-btn                     "Questionnaires ▾" dropdown trigger
//   load-from-file-item               "From file…" menu item
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

  test('shows a warnings modal for a collapsed slice and a multi-type element', async ({ page }) => {
    await freshStart(page);
    await loadStructureDefinition(page, FIXTURE);

    const modal = page.getByTestId('validateModal');
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('validateModalTitle')).toContainText('StructureDefinition Generation');
    const body = page.getByTestId('validateModalBody');
    await expect(body).toContainText('Patient.identifier:mrn');
    await expect(body).toContainText('Patient.deceased[x]');
    await page.getByTestId('validateModalClose').click();
    await expect(modal).not.toBeVisible();

    // The collapsed slice still produced its base (unsliced) item, once.
    await expect(page.locator('[data-node-id="Patient.identifier"]')).toHaveCount(1);
  });
});
