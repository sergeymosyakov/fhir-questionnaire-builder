// ── E2E: questionnaire-unitValueSet feature ───────────────────────────────────
//
// Tests that unitValueSet:
//   1. Is imported and stored on the node (_unitValueSet)
//   2. Round-trips through export (valueCanonical preserved)
//   3. UI: unit-valueset-url textarea in Answer Type modal shows the URL
//   4. Can be edited via Answer Type modal and exported correctly
//   5. Fixed-unit items (questionnaire-unit) still work normally
//
// Fixture: tests/fixtures/unit-valueset.fhir.json
//   q-with-unit-vs    — quantity with unitValueSet → http://hl7.org/fhir/ValueSet/ucum-bodyweight
//   q-with-fixed-unit — quantity with fixed unit Cel
//   q-no-unit         — quantity with no unit config
//
// Run: npx playwright test tests/e2e/unit-valueset.spec.js
//
// ── data-testid registry ──────────────────────────────────────────────────────
//   fhir-file-input            hidden file input for import
//   add-root-group-btn         button to add root group (signals page is ready)
//   answer-type-btn → action-type  "Answer Type" action link on a builder node
//   unit-valueset-url          textarea for unitValueSet canonical URL
//   unit-sel                   custom select for default unit
//   answerTypeModalApply         Apply button in Answer Type modal
//   export-btn                 main Export dropdown button
//   export-quest-item    "Questionnaire2026" item in export dropdown (opens saveFormatModal)
//   prompt-save                confirm button in filename prompt dialog
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { test, expect } from '@playwright/test';

const FIXTURE = path.resolve('tests/fixtures/unit-valueset.fhir.json');
const VS_URL  = 'http://hl7.org/fhir/ValueSet/ucum-bodyweight';

async function freshLoad(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(FIXTURE);
  await expect(page.locator('[data-preview-id="q-with-unit-vs"]')).toBeVisible({ timeout: 8_000 });
}

// ── 1. Import round-trip — unitValueSet preserved in export ───────────────────

test.describe('unit-valueset — export round-trip', () => {
  test('exported JSON contains questionnaire-unitValueSet extension', async ({ page }) => {
    await freshLoad(page);

    // Open export dialog
    await page.locator('[data-testid="export-btn"]').click();
    await page.locator('[data-testid="export-quest-item"]').click();
    await expect(page.locator('[data-testid="saveFormatModal"]')).toBeVisible();
    await page.locator('[data-testid="saveFormatModalApply"]').click();

    page.once('dialog', async dlg => { await dlg.accept('unit-vs-test'); });
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('[data-testid="prompt-save"]').click(),
    ]);
    const buffer = await (await download.createReadStream()).toArray();
    const json = JSON.parse(Buffer.concat(buffer).toString());

    const item = json.item.find(i => i.linkId === 'q-with-unit-vs');
    expect(item).toBeDefined();
    const ext = item.extension?.find(e => e.url === 'http://hl7.org/fhir/StructureDefinition/questionnaire-unitValueSet');
    expect(ext).toBeDefined();
    expect(ext.valueCanonical).toBe(VS_URL);
  });

  test('item without unitValueSet has no questionnaire-unitValueSet extension', async ({ page }) => {
    await freshLoad(page);

    await page.locator('[data-testid="export-btn"]').click();
    await page.locator('[data-testid="export-quest-item"]').click();
    await expect(page.locator('[data-testid="saveFormatModal"]')).toBeVisible();
    await page.locator('[data-testid="saveFormatModalApply"]').click();

    page.once('dialog', async dlg => { await dlg.accept('unit-vs-test'); });
    const [download2] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('[data-testid="prompt-save"]').click(),
    ]);
    const buffer2 = await (await download2.createReadStream()).toArray();
    const json2 = JSON.parse(Buffer.concat(buffer2).toString());

    const item = json2.item.find(i => i.linkId === 'q-no-unit');
    const ext = item?.extension?.find(e => e.url === 'http://hl7.org/fhir/StructureDefinition/questionnaire-unitValueSet');
    expect(ext).toBeUndefined();
  });

  test('fixed-unit item still exports questionnaire-unit (not unitValueSet)', async ({ page }) => {
    await freshLoad(page);

    await page.locator('[data-testid="export-btn"]').click();
    await page.locator('[data-testid="export-quest-item"]').click();
    await expect(page.locator('[data-testid="saveFormatModal"]')).toBeVisible();
    await page.locator('[data-testid="saveFormatModalApply"]').click();

    page.once('dialog', async dlg => { await dlg.accept('unit-vs-test'); });
    const [download3] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('[data-testid="prompt-save"]').click(),
    ]);
    const buffer3 = await (await download3.createReadStream()).toArray();
    const json3 = JSON.parse(Buffer.concat(buffer3).toString());

    const item = json3.item.find(i => i.linkId === 'q-with-fixed-unit');
    // quantity items: questionnaire-unit is auto-converted to questionnaire-unitOption on export (R4 invariant)
    const unitOptExt = item?.extension?.find(e => e.url === 'http://hl7.org/fhir/StructureDefinition/questionnaire-unitOption');
    expect(unitOptExt).toBeDefined();
    expect(unitOptExt.valueCoding.code).toBe('Cel');

    const unitExt = item?.extension?.find(e => e.url === 'http://hl7.org/fhir/StructureDefinition/questionnaire-unit');
    expect(unitExt).toBeUndefined();

    const vsExt = item?.extension?.find(e => e.url === 'http://hl7.org/fhir/StructureDefinition/questionnaire-unitValueSet');
    expect(vsExt).toBeUndefined();
  });
});

// ── 2. Answer Type modal shows unitValueSet URL ────────────────────────────────

test.describe('unit-valueset — Answer Type modal UI', () => {
  test('Answer Type modal shows unitValueSet URL for item with unitValueSet', async ({ page }) => {
    await freshLoad(page);

    // Open Answer Type modal for q-with-unit-vs
    const row = page.locator('[data-node-id="q-with-unit-vs"]');
    await row.locator('[data-testid="action-type"]').click();
    await expect(page.locator('[data-testid="unit-valueset-url"]')).toBeVisible({ timeout: 5_000 });
    const val = await page.locator('[data-testid="unit-valueset-url"]').inputValue();
    expect(val).toBe(VS_URL);
  });

  test('Answer Type modal shows empty unitValueSet URL for item without it', async ({ page }) => {
    await freshLoad(page);

    const row = page.locator('[data-node-id="q-no-unit"]');
    await row.locator('[data-testid="action-type"]').click();
    await expect(page.locator('[data-testid="unit-valueset-url"]')).toBeVisible({ timeout: 5_000 });
    const val = await page.locator('[data-testid="unit-valueset-url"]').inputValue();
    expect(val).toBe('');
  });

  test('editing unitValueSet URL and applying exports new value', async ({ page }) => {
    await freshLoad(page);

    // Open and edit
    const row = page.locator('[data-node-id="q-no-unit"]');
    await row.locator('[data-testid="action-type"]').click();
    const inp = page.locator('[data-testid="unit-valueset-url"]');
    await expect(inp).toBeVisible({ timeout: 5_000 });
    await inp.fill('http://example.com/vs/custom-units');
    await page.locator('[data-testid="answerTypeModalApply"]').click();

    // Export and verify
    await page.locator('[data-testid="export-btn"]').click();
    await page.locator('[data-testid="export-quest-item"]').click();
    await expect(page.locator('[data-testid="saveFormatModal"]')).toBeVisible();
    await page.locator('[data-testid="saveFormatModalApply"]').click();

    page.once('dialog', async dlg => { await dlg.accept('unit-vs-edit-test'); });
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('[data-testid="prompt-save"]').click(),
    ]);
    const buffer = await (await download.createReadStream()).toArray();
    const json = JSON.parse(Buffer.concat(buffer).toString());

    const item = json.item.find(i => i.linkId === 'q-no-unit');
    const ext = item?.extension?.find(e => e.url === 'http://hl7.org/fhir/StructureDefinition/questionnaire-unitValueSet');
    expect(ext?.valueCanonical).toBe('http://example.com/vs/custom-units');
  });

  test('clearing unitValueSet URL removes extension on export', async ({ page }) => {
    await freshLoad(page);

    const row = page.locator('[data-node-id="q-with-unit-vs"]');
    await row.locator('[data-testid="action-type"]').click();
    const inp = page.locator('[data-testid="unit-valueset-url"]');
    await expect(inp).toBeVisible({ timeout: 5_000 });
    await inp.fill('');
    await page.locator('[data-testid="answerTypeModalApply"]').click();

    await page.locator('[data-testid="export-btn"]').click();
    await page.locator('[data-testid="export-quest-item"]').click();
    await expect(page.locator('[data-testid="saveFormatModal"]')).toBeVisible();
    await page.locator('[data-testid="saveFormatModalApply"]').click();

    page.once('dialog', async dlg => { await dlg.accept('unit-vs-clear-test'); });
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('[data-testid="prompt-save"]').click(),
    ]);
    const buffer = await (await download.createReadStream()).toArray();
    const json = JSON.parse(Buffer.concat(buffer).toString());

    const item = json.item.find(i => i.linkId === 'q-with-unit-vs');
    const ext = item?.extension?.find(e => e.url === 'http://hl7.org/fhir/StructureDefinition/questionnaire-unitValueSet');
    expect(ext).toBeUndefined();
  });
});
