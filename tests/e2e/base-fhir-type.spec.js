// ── E2E: questionnaire-baseType / questionnaire-fhirType extensions ───────────
//
// Tests that baseType and fhirType extensions are:
//   1. Preserved on import and shown in the Props modal (Definition section)
//   2. Editable — changes persist after Apply
//   3. Round-trip safe — exported back into FHIR JSON
//
// Fixture: tests/fixtures/base-fhir-type.fhir.json
//   name-group   — group with definition, baseType=HumanName, fhirType=HumanName
//   family-name  — nested item with definition, baseType=string
//
// Run: npx playwright test tests/e2e/base-fhir-type.spec.js
//
// ── data-testid registry ──────────────────────────────────────────────────────
//   item-props-definition    — Definition URL input in Props modal (definition.js)
//   item-props-base-type     — Base Type input in Props modal (definition.js)
//   item-props-fhir-type     — FHIR Type input in Props modal (definition.js)
//   action-codes             — Props button on item/group node card
//   codesModal               — Props modal wrapper
//   codesModalApply          — Apply button in Props modal
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { test, expect } from '@playwright/test';

const FIXTURE = path.resolve('tests/fixtures/base-fhir-type.fhir.json');
const BASE_TYPE_URL = 'http://hl7.org/fhir/StructureDefinition/questionnaire-baseType';
const FHIR_TYPE_URL = 'http://hl7.org/fhir/StructureDefinition/questionnaire-fhirType';

async function waitForLoad(page) {
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
}

async function loadFixture(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await waitForLoad(page);
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(FIXTURE);
  await expect(page.locator('[data-preview-id="name-group"]')).toBeVisible({ timeout: 8_000 });
}

async function openPropsModal(page, nodeId) {
  const link = page.locator(`[data-node-id="${nodeId}"] [data-testid="action-codes"]`).first();
  await expect(link).toBeVisible();
  await link.click();
  await expect(page.locator('[data-testid="codesModal"]')).toBeVisible({ timeout: 3000 });
}

async function exportFHIR(page) {
  await page.getByTestId('export-btn').click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-fhir-item').click().then(() => page.getByTestId('prompt-save').click()),
  ]);
  const fp = await download.path();
  const { readFileSync } = await import('node:fs');
  return JSON.parse(readFileSync(fp, 'utf8'));
}

// ── import: fields pre-filled ─────────────────────────────────────────────────

test.describe('baseType / fhirType — import pre-fill', () => {
  test('Definition field is pre-filled from fixture', async ({ page }) => {
    await loadFixture(page);
    await openPropsModal(page, 'name-group');
    await expect(page.getByTestId('item-props-definition'))
      .toHaveValue('http://hl7.org/fhir/StructureDefinition/Patient#Patient.name');
  });

  test('Base Type field shows HumanName from fixture', async ({ page }) => {
    await loadFixture(page);
    await openPropsModal(page, 'name-group');
    await expect(page.getByTestId('item-props-base-type')).toHaveValue('HumanName');
  });

  test('FHIR Type field shows HumanName from fixture', async ({ page }) => {
    await loadFixture(page);
    await openPropsModal(page, 'name-group');
    await expect(page.getByTestId('item-props-fhir-type')).toHaveValue('HumanName');
  });

  test('nested item: Base Type field shows string', async ({ page }) => {
    await loadFixture(page);
    await openPropsModal(page, 'family-name');
    await expect(page.getByTestId('item-props-base-type')).toHaveValue('string');
  });

  test('nested item: FHIR Type field is empty when not set in fixture', async ({ page }) => {
    await loadFixture(page);
    await openPropsModal(page, 'family-name');
    await expect(page.getByTestId('item-props-fhir-type')).toHaveValue('');
  });
});

// ── edit and apply ────────────────────────────────────────────────────────────

test.describe('baseType / fhirType — edit and apply', () => {
  test('editing Base Type and applying keeps new value on re-open', async ({ page }) => {
    await loadFixture(page);
    await openPropsModal(page, 'family-name');
    const btInput = page.getByTestId('item-props-base-type');
    await btInput.fill('dateTime');
    await page.locator('[data-testid="codesModalApply"]').click();
    // Re-open and verify
    await openPropsModal(page, 'family-name');
    await expect(page.getByTestId('item-props-base-type')).toHaveValue('dateTime');
  });

  test('clearing Base Type and applying removes the field on re-open', async ({ page }) => {
    await loadFixture(page);
    await openPropsModal(page, 'family-name');
    await page.getByTestId('item-props-base-type').fill('');
    await page.locator('[data-testid="codesModalApply"]').click();
    await openPropsModal(page, 'family-name');
    await expect(page.getByTestId('item-props-base-type')).toHaveValue('');
  });
});

// ── round-trip export ─────────────────────────────────────────────────────────

test.describe('baseType / fhirType — export round-trip', () => {
  test('exported JSON contains questionnaire-baseType extension for group', async ({ page }) => {
    await loadFixture(page);
    const json = await exportFHIR(page);
    const group = json.item.find(i => i.linkId === 'name-group');
    const ext = (group.extension || []).find(e => e.url === BASE_TYPE_URL);
    expect(ext?.valueCode).toBe('HumanName');
  });

  test('exported JSON contains questionnaire-fhirType extension for group', async ({ page }) => {
    await loadFixture(page);
    const json = await exportFHIR(page);
    const group = json.item.find(i => i.linkId === 'name-group');
    const ext = (group.extension || []).find(e => e.url === FHIR_TYPE_URL);
    expect(ext?.valueString).toBe('HumanName');
  });

  test('exported JSON contains questionnaire-baseType for nested item', async ({ page }) => {
    await loadFixture(page);
    const json = await exportFHIR(page);
    const group = json.item.find(i => i.linkId === 'name-group');
    const nested = group.item.find(i => i.linkId === 'family-name');
    const ext = (nested.extension || []).find(e => e.url === BASE_TYPE_URL);
    expect(ext?.valueCode).toBe('string');
  });
});
