// ── E2E: SDC StructureMap-based Extraction ───────────────────────────────────
// Tests: Save menu has the StructureMap Extract item, modal opens, the contained
// StructureMap actually executes via fhir-structuremap-js, and the Properties
// modal exposes the targetStructureMap field.
//
// Tested elements:
//   export-structuremap-extract-item — menu item in Save ▾
//   structureMapExtract               — modal testid
//   meta-target-structure-map         — Properties modal field

import { test, expect } from '@playwright/test';
import path from 'node:path';
import { openDropdownItem } from './helpers/dropdown.js';
import { freshStart, openModal } from './helpers/metadata.js';

const FIXTURE = path.resolve('tests/fixtures/structuremap-extract.fhir.json');

async function loadFixture(page) {
  await freshStart(page);
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(FIXTURE);
  await page.waitForSelector('[data-testid="tree-container"] [data-node-id]', { timeout: 15_000 });
}

test.describe('SDC StructureMap Extract', () => {
  test('StructureMap Extract item is visible in Save menu', async ({ page }) => {
    await loadFixture(page);
    await expect(async () => {
      if (!(await page.getByTestId('export-structuremap-extract-item').isVisible())) {
        await page.getByTestId('export-btn').click();
      }
      await expect(page.getByTestId('export-structuremap-extract-item')).toBeVisible();
    }).toPass();
    await page.keyboard.press('Escape');
  });

  test('clicking StructureMap Extract opens the modal', async ({ page }) => {
    await loadFixture(page);
    await openDropdownItem(page, 'export-btn', 'export-structuremap-extract-item');
    await expect(page.locator('[data-testid="structureMapExtract"]').first()).toBeVisible();
  });

  test('modal reports one extracted resource from the contained StructureMap', async ({ page }) => {
    await loadFixture(page);
    await openDropdownItem(page, 'export-btn', 'export-structuremap-extract-item');
    const modal = page.locator('[data-testid="structureMapExtract"]').first();
    await expect(modal).toBeVisible();
    await expect(modal.locator('.def-extract-summary')).toContainText('Extracted 1 resource');
  });

  test('modal closes on × button', async ({ page }) => {
    await loadFixture(page);
    await openDropdownItem(page, 'export-btn', 'export-structuremap-extract-item');
    const modal = page.locator('[data-testid="structureMapExtract"]').first();
    await expect(modal).toBeVisible();
    await modal.locator('.modal-close').click();
    await expect(modal).not.toBeVisible();
  });

  test('downloaded bundle contains a Patient populated by the StructureMap', async ({ page }) => {
    await loadFixture(page);
    await openDropdownItem(page, 'export-btn', 'export-structuremap-extract-item');
    const modal = page.locator('[data-testid="structureMapExtract"]').first();
    await expect(modal).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('structureMapExtractApply').click(),
    ]);
    const fp = await download.path();
    const { readFileSync } = await import('node:fs');
    const bundle = JSON.parse(readFileSync(fp, 'utf8'));

    expect(bundle.resourceType).toBe('Bundle');
    const patient = bundle.entry[0].resource;
    expect(patient.resourceType).toBe('Patient');
    expect(patient.name.family).toBe('Doe');
    expect(patient.name.given).toBe('John');
    expect(patient.birthDate).toBe('1990-05-15');
  });

  test('Properties modal shows the imported targetStructureMap canonical reference', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-target-structure-map')).toHaveValue('#qr-to-patient-demo');
    await page.getByTestId('metadataModalCancel').click();
  });

  test('a blank questionnaire (no targetStructureMap) shows a warning instead of a bundle', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.locator('[data-node-id="1"]')).toBeVisible();
    await openDropdownItem(page, 'export-btn', 'export-structuremap-extract-item');
    const modal = page.locator('[data-testid="structureMapExtract"]').first();
    await expect(modal).toBeVisible();
    await expect(modal.locator('.def-extract-warn')).toContainText('targetStructureMap');
    await expect(page.getByTestId('structureMapExtractApply')).toBeDisabled();
  });
});
