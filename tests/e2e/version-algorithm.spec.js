// ── E2E: versionAlgorithm[x] + copyrightLabel (R5 native root fields) ─────────
// Tests that cover:
//   1. Properties → Advanced pre-populates both fields from an imported R5 form.
//   2. R5 export preserves the native fields.
//   3. R4 export downgrades them to the official artifact-* extensions.
//   4. Editing: switching versionAlgorithm to a custom FHIRPath expression and
//      changing copyrightLabel round-trips on R5 export.
//
// Fixture: tests/fixtures/version-algorithm.fhir.json (loads as R5)
//
// Run: npx playwright test tests/e2e/version-algorithm.spec.js
//
// ── data-testid registry ─────────────────────────────────────────────────────
//   fhir-file-input          hidden file <input> for Open → FHIR JSON
//   fhir-version-select      version custom-select trigger
//   properties-btn           "Edit" button opening the Properties modal
//   metadataModal            Properties modal backdrop
//   meta-advanced-toggle     Advanced collapsible toggle
//   meta-version-algorithm   Version Algorithm custom-select (data-value holds code)
//   meta-version-algorithm-expr  custom FHIRPath text input (visible when Custom)
//   meta-copyright-label     Copyright Label text input
//   metadataModalApply       Apply button
//   export-btn / export-quest-item / saveFormatModalApply / prompt-save — export flow
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openDropdownItem } from './helpers/dropdown.js';

const FIXTURE = path.resolve('tests/fixtures/version-algorithm.fhir.json');

async function loadFixture(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(FIXTURE);
  await expect(page.locator('[data-preview-id="q1"]')).toBeVisible({ timeout: 8_000 });
  await expect(page.getByTestId('fhir-version-select')).toHaveAttribute('data-value', 'R5');
}

async function openAdvanced(page) {
  await page.getByTestId('properties-btn').click();
  await expect(page.locator('[data-testid="metadataModal"]')).toBeVisible();
  await page.getByTestId('meta-advanced-toggle').click();
}

async function selectVersion(page, versionId) {
  await page.getByTestId('fhir-version-select').click();
  await page.locator(`[data-testid="csel-drop"] [data-val="${versionId}"]`).click();
}

async function exportFHIR(page) {
  await openDropdownItem(page, 'export-btn', 'export-quest-item');
  await expect(page.locator('[data-testid="saveFormatModal"]')).toBeVisible();
  await page.getByTestId('saveFormatModalApply').click();
  const modal = page.locator('[data-testid="validateModal"]');
  await modal.waitFor({ state: 'visible', timeout: 3_000 }).catch(() => {});
  if (await modal.isVisible()) await modal.locator('.btn-fhir-export').click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('prompt-save').click(),
  ]);
  return JSON.parse(readFileSync(await download.path(), 'utf8'));
}

// ── 1. Properties pre-population ──────────────────────────────────────────────

test.describe('versionAlgorithm / copyrightLabel — Properties', () => {
  test('Advanced section pre-fills both fields from the imported R5 form', async ({ page }) => {
    await loadFixture(page);
    await openAdvanced(page);
    await expect(page.getByTestId('meta-version-algorithm')).toHaveAttribute('data-value', 'semver');
    await expect(page.getByTestId('meta-copyright-label')).toHaveValue('All rights reserved');
  });
});

// ── 2. R5 native round-trip ───────────────────────────────────────────────────

test.describe('versionAlgorithm / copyrightLabel — R5 export', () => {
  test('native fields are preserved on R5 export', async ({ page }) => {
    await loadFixture(page);
    const q = await exportFHIR(page);
    expect(q.versionAlgorithmCoding.code).toBe('semver');
    expect(q.copyrightLabel).toBe('All rights reserved');
  });
});

// ── 3. R4 downgrade to official extensions ────────────────────────────────────

test.describe('versionAlgorithm / copyrightLabel — R4 downgrade', () => {
  test('exported as artifact-* extensions on R4', async ({ page }) => {
    await loadFixture(page);
    await selectVersion(page, 'R4');
    const q = await exportFHIR(page);
    expect(q.versionAlgorithmCoding).toBeUndefined();
    expect(q.copyrightLabel).toBeUndefined();
    const va = (q.extension || []).find(e => e.url === 'http://hl7.org/fhir/StructureDefinition/artifact-versionAlgorithm');
    const cl = (q.extension || []).find(e => e.url === 'http://hl7.org/fhir/StructureDefinition/artifact-copyrightLabel');
    expect(va?.valueCoding?.code).toBe('semver');
    expect(cl?.valueString).toBe('All rights reserved');
  });
});

// ── 4. Editing → custom FHIRPath expression ───────────────────────────────────

test.describe('versionAlgorithm — custom expression editing', () => {
  test('switching to Custom expression round-trips as versionAlgorithmString', async ({ page }) => {
    await loadFixture(page);
    await openAdvanced(page);
    await page.getByTestId('meta-version-algorithm').click();
    await page.locator('[data-testid="csel-drop"] [data-val="__custom__"]').click();
    const expr = page.getByTestId('meta-version-algorithm-expr');
    await expect(expr).toBeVisible();
    await expr.fill('%version1 > %version2');
    await page.getByTestId('meta-copyright-label').fill('Some rights reserved');
    await page.getByTestId('metadataModalApply').click();
    await expect(page.locator('[data-testid="metadataModal"]')).not.toBeVisible();

    const q = await exportFHIR(page);
    expect(q.versionAlgorithmString).toBe('%version1 > %version2');
    expect(q.versionAlgorithmCoding).toBeUndefined();
    expect(q.copyrightLabel).toBe('Some rights reserved');
  });
});
