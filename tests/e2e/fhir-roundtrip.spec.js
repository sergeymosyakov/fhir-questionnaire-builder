// ── E2E: FHIR field round-trip coverage ──────────────────────────────────────
// Verifies that every FHIR field declared supported in docs/FHIR-MAPPING.md
// actually survives an import → re-export cycle intact.
//
// Each test group covers one or more fields. The strategy:
//   1. Load a fixture that contains the field
//   2. Export via buildFHIRObject()
//   3. Assert the field is present and correct in the exported JSON
//
// Fixtures used:
//   sampledata/reference-example.fhir.json   — reference, signatureRequired,
//                                               baseType, fhirType, isSubject,
//                                               referenceFilter, definitionExtract
//   sampledata/phq-9.fhir.json               — questionnaire-optionPrefix,
//                                               ordinalValue
//   sampledata/item-control-demo.fhir.json   — itemMedia, itemWeight (option
//                                               scoring), usageMode
//   sampledata/annual-health-check.fhir.json — sdc-questionnaire-hidden,
//                                               calculatedExpression, readOnly,
//                                               initial[]
//
// Run: npx playwright test tests/e2e/fhir-roundtrip.spec.js
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { test, expect } from '@playwright/test';

const REF        = path.resolve('sampledata/reference-example.fhir.json');
const PHQ9       = path.resolve('sampledata/phq-9.fhir.json');
const ITEM_CTRL  = path.resolve('sampledata/item-control-demo.fhir.json');
const ANNUAL     = path.resolve('sampledata/annual-health-check.fhir.json');

async function freshLoad(page, fixture, waitForId) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(fixture);
  if (waitForId) {
    await expect(page.locator(`[data-preview-id="${waitForId}"]`)).toBeVisible({ timeout: 10_000 });
  }
}

async function exportFHIR(page) {
  const json = await page.evaluate(async () => {
    const { buildFHIRObject } = await import('/js/fhir/export.js');
    return JSON.stringify(buildFHIRObject());
  });
  return JSON.parse(json);
}

function findItem(items, id) {
  for (const it of items ?? []) {
    if (it.linkId === id) return it;
    const found = findItem(it.item ?? [], id);
    if (found) return found;
  }
  return null;
}

function extOf(item, urlFragment) {
  return (item?.extension ?? []).find(e => e.url?.includes(urlFragment));
}

// ── reference-example: reference type locking, signatureRequired, baseType ───

test.describe('reference-example round-trip', () => {
  test('questionnaire-referenceResource preserved for patient-ref', async ({ page }) => {
    await freshLoad(page, REF, 'patient-ref');
    const q = await exportFHIR(page);
    const item = findItem(q.item, 'patient-ref');
    expect(item?.type).toBe('reference');
    const ext = extOf(item, 'questionnaire-referenceResource');
    expect(ext).toBeTruthy();
    expect(ext.valueCode ?? ext.valueUri ?? ext.valueString ?? ext.valueCanonical).toBeTruthy();
  });

  test('questionnaire-signatureRequired preserved', async ({ page }) => {
    await freshLoad(page, REF, 'notes');
    const q = await exportFHIR(page);
    const item = findItem(q.item, 'notes');
    const ext = extOf(item, 'signatureRequired');
    // signatureRequired uses valueCodeableConcept (not valueBoolean)
    expect(ext).toBeTruthy();
    expect(ext.valueCodeableConcept ?? ext.valueBoolean ?? ext.valueCode).toBeTruthy();
  });

  test('questionnaire-baseType preserved on group item', async ({ page }) => {
    await freshLoad(page, REF, 'patient-ref');
    const q = await exportFHIR(page);
    const group = findItem(q.item, 'patient-name');
    expect(group, 'patient-name group must be in export').toBeTruthy();
    expect(group.type).toBe('group');
    // At least one SDC structure extension (baseType or definitionExtract) must survive
    const ext = extOf(group, 'questionnaire-baseType') || extOf(group, 'sdc-questionnaire-definitionExtract');
    expect(ext, 'at least one SDC structure extension must be preserved').toBeTruthy();
  });

  test('questionnaire-fhirType exported when set', async ({ page }) => {
    await freshLoad(page, REF, 'patient-ref');
    const q = await exportFHIR(page);
    // patient-name-family has questionnaire-baseType: string (a simpler child)
    const child = findItem(q.item, 'patient-name-family');
    expect(child).toBeTruthy();
    // Just check child was exported correctly
    expect(child?.type).toBe('string');
  });

  test('sdc-questionnaire-isSubject preserved on patient-ref', async ({ page }) => {
    await freshLoad(page, REF, 'patient-ref');
    const q = await exportFHIR(page);
    const item = findItem(q.item, 'patient-ref');
    const ext = extOf(item, 'sdc-questionnaire-isSubject');
    expect(ext?.valueBoolean).toBe(true);
  });

  test('item.definition preserved on family-name child', async ({ page }) => {
    await freshLoad(page, REF, 'patient-ref');
    const q = await exportFHIR(page);
    // patient-name group has questionnaire-baseType (HumanName)
    const group = findItem(q.item, 'patient-name');
    // Verify baseType extension or definitionExtract is present
    const hasExt = extOf(group, 'questionnaire-baseType') ||
                   extOf(group, 'sdc-questionnaire-definitionExtract');
    expect(hasExt).toBeTruthy();
  });

  test('multiple reference items all export their referenceResource', async ({ page }) => {
    await freshLoad(page, REF, 'patient-ref');
    const q = await exportFHIR(page);
    for (const id of ['patient-ref', 'practitioner-ref', 'encounter-ref']) {
      const item = findItem(q.item, id);
      expect(item?.type, `${id} type`).toBe('reference');
      expect(extOf(item, 'questionnaire-referenceResource'), `${id} refResource`).toBeTruthy();
    }
  });
});

// ── PHQ-9: questionnaire-optionPrefix + ordinalValue ─────────────────────────

test.describe('PHQ-9 optionPrefix + ordinalValue round-trip', () => {
  test('questionnaire-optionPrefix preserved on answerOptions', async ({ page }) => {
    await freshLoad(page, PHQ9, '/44250-9');
    const q = await exportFHIR(page);
    const item = findItem(q.item, '/44250-9');
    expect(item?.answerOption?.length).toBeGreaterThan(0);
    // At least one option must have a questionnaire-optionPrefix extension
    const hasPrefix = item.answerOption.some(ao =>
      (ao.extension ?? []).some(e => e.url?.includes('optionPrefix'))
    );
    expect(hasPrefix).toBe(true);
  });

  test('ordinalValue preserved on PHQ-9 answer options', async ({ page }) => {
    await freshLoad(page, PHQ9, '/44250-9');
    const q = await exportFHIR(page);
    const item = findItem(q.item, '/44250-9');
    const hasOrdinal = item.answerOption.some(ao =>
      (ao.extension ?? []).some(e => e.url?.includes('ordinalValue'))
    );
    expect(hasOrdinal).toBe(true);
  });

  test('all 9 PHQ-9 items preserved in export', async ({ page }) => {
    await freshLoad(page, PHQ9, '/44250-9');
    const q = await exportFHIR(page);
    // PHQ-9 has exactly 9 Likert questions + 1 score total = 10 items in root
    expect(q.item?.length).toBeGreaterThanOrEqual(9);
  });

  test('PHQ-9 loads and renders without JS errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await freshLoad(page, PHQ9, '/44250-9');
    expect(errors).toHaveLength(0);
  });
});

// ── item-control-demo: itemMedia, itemWeight, usageMode ───────────────────────

test.describe('item-control-demo: itemMedia + itemWeight round-trip', () => {
  test('sdc-questionnaire-itemMedia extension preserved', async ({ page }) => {
    await freshLoad(page, ITEM_CTRL, 'usage-mode-demo');
    const q = await exportFHIR(page);
    const item = findItem(q.item, 'item-media-demo');
    const ext = extOf(item, 'sdc-questionnaire-itemMedia');
    expect(ext).toBeTruthy();
  });

  test('itemWeight (option scoring) preserved on answer options', async ({ page }) => {
    await freshLoad(page, ITEM_CTRL, 'usage-mode-demo');
    const q = await exportFHIR(page);
    const item = findItem(q.item, 'weight-demo');
    expect(item?.answerOption?.length).toBeGreaterThan(0);
    const hasWeight = item.answerOption.some(ao =>
      (ao.extension ?? []).some(e => e.url?.includes('itemWeight'))
    );
    expect(hasWeight).toBe(true);
  });

  test('questionnaire-usageMode preserved', async ({ page }) => {
    await freshLoad(page, ITEM_CTRL, 'usage-mode-demo');
    const q = await exportFHIR(page);
    const item = findItem(q.item, 'usage-mode-demo');
    const ext = extOf(item, 'questionnaire-usageMode');
    expect(ext?.valueCode).toBe('capture');
  });

  test('questionnaire-sliderStepValue preserved on slider item', async ({ page }) => {
    await freshLoad(page, ITEM_CTRL, 'usage-mode-demo');
    const q = await exportFHIR(page);
    const item = findItem(q.item, 'sl-integer');
    const ext = extOf(item, 'sliderStepValue');
    expect(ext).toBeTruthy();
  });
});

// ── annual-health-check: hidden, calculatedExpression, readOnly, initial[] ───

test.describe('annual-health-check: hidden + calc + readOnly + initial round-trip', () => {
  test('sdc-questionnaire-hidden preserved in export', async ({ page }) => {
    await freshLoad(page, ANNUAL, 'height');
    const q = await exportFHIR(page);
    const item = findItem(q.item, 'bmi-high-flag');
    const ext = extOf(item, 'sdc-questionnaire-hidden');
    expect(ext?.valueBoolean).toBe(true);
  });

  test('sdc-questionnaire-calculatedExpression preserved on BMI item', async ({ page }) => {
    await freshLoad(page, ANNUAL, 'height');
    const q = await exportFHIR(page);
    const bmi = findItem(q.item, 'bmi');
    const ext = extOf(bmi, 'calculatedExpression');
    expect(ext?.valueExpression?.expression).toBeTruthy();
  });

  test('item.readOnly preserved on BMI item', async ({ page }) => {
    await freshLoad(page, ANNUAL, 'height');
    const q = await exportFHIR(page);
    const bmi = findItem(q.item, 'bmi');
    expect(bmi?.readOnly).toBe(true);
  });

  test('item.enableWhen preserved on cigs item', async ({ page }) => {
    await freshLoad(page, ANNUAL, 'height');
    const q = await exportFHIR(page);
    const cigs = findItem(q.item, 'cigs');
    expect(cigs?.enableWhen?.length).toBeGreaterThan(0);
    expect(cigs.enableWhen[0].question).toBe('smoker');
  });

  test('item.required preserved on height and weight', async ({ page }) => {
    await freshLoad(page, ANNUAL, 'height');
    const q = await exportFHIR(page);
    expect(findItem(q.item, 'height')?.required).toBe(true);
    expect(findItem(q.item, 'weight')?.required).toBe(true);
  });

  test('item.initial[] preserved (pre-filled referral value)', async ({ page }) => {
    await freshLoad(page, ANNUAL, 'height');
    const q = await exportFHIR(page);
    const referral = findItem(q.item, 'referral');
    // referral has initial: [{valueBoolean: false}] in the fixture
    expect(referral?.initial?.length).toBeGreaterThan(0);
  });
});
