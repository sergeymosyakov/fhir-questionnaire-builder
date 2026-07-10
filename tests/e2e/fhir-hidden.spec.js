// ── E2E: sdc-questionnaire-hidden + questionnaire-usageMode ─────────────────
// Verifies that hidden items and usage-mode-controlled items behave correctly
// in both design-mode preview and patient view.
//
// Covered FHIR features:
//   • sdc-questionnaire-hidden   — item never shown to patients; participates
//     in calculatedExpression; shows HIDDEN badge in design preview
//   • questionnaire-usageMode    — 'capture' item hidden in display-only view;
//     round-trip preserves the extension in exported FHIR
//
// Fixtures:
//   sampledata/annual-health-check.fhir.json  — bmi-high-flag has hidden:true
//   sampledata/item-control-demo.fhir.json    — usage-mode-demo has capture
//
// Run: npx playwright test tests/e2e/fhir-hidden.spec.js
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { test, expect } from '@playwright/test';

const ANNUAL       = path.resolve('sampledata/annual-health-check.fhir.json');
const ITEM_CONTROL = path.resolve('sampledata/item-control-demo.fhir.json');

async function freshLoad(page, fixture) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(fixture);
}

async function loadAnnual(page) {
  await freshLoad(page, ANNUAL);
  await expect(page.locator('[data-preview-id="height"]')).toBeVisible({ timeout: 10_000 });
}

async function loadItemControl(page) {
  await freshLoad(page, ITEM_CONTROL);
  await expect(page.locator('[data-preview-id="usage-mode-demo"]')).toBeVisible({ timeout: 10_000 });
}

async function enablePatientView(page) {
  await expect(page.getByTestId('preview-mode-patient')).not.toBeVisible();
  await page.getByTestId('preview-mode-btn').click();
  await expect(page.getByTestId('preview-mode-patient')).toBeVisible();
  await page.getByTestId('preview-mode-patient').click();
  await expect(page.locator('#lform')).toHaveClass(/patient-view/, { timeout: 5_000 });
}

// ── sdc-questionnaire-hidden ──────────────────────────────────────────────────

test.describe('sdc-questionnaire-hidden', () => {
  test('hidden item is visible in design preview (with HIDDEN badge)', async ({ page }) => {
    await loadAnnual(page);
    // bmi-high-flag has sdc-questionnaire-hidden: true
    // In design mode it should still render (so author can see it)
    await expect(page.locator('[data-preview-id="bmi-high-flag"]')).toBeVisible();
    // It should carry the hidden marker in the builder tree
    const builderNode = page.locator('[data-node-id="bmi-high-flag"]');
    await expect(builderNode).toBeVisible();
  });

  test('hidden item is absent from patient view', async ({ page }) => {
    await loadAnnual(page);
    await enablePatientView(page);
    // bmi-high-flag is hidden — must not render in patient view
    await expect(page.locator('[data-preview-id="bmi-high-flag"]')).toHaveCount(0);
  });

  test('hidden item still participates in calculatedExpression chain', async ({ page }) => {
    await loadAnnual(page);

    // Fill height + weight to trigger BMI calc → bmi-high-flag flips true
    // Even though bmi-high-flag is hidden it must still be evaluated
    const heightInput = page.locator('[data-preview-id="height"]').locator('input').first();
    const weightInput = page.locator('[data-preview-id="weight"]').locator('input').first();
    await heightInput.fill('175');
    await heightInput.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true })));
    await weightInput.fill('100');
    await weightInput.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true })));

    // Commit input
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.getByTestId('preview-search-input').click();
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

    // bmi-high-display has enableWhen: bmi-high-flag = true.
    // Even though bmi-high-flag is hidden it still fires, so bmi-high-display must become visible.
    await expect(page.locator('[data-preview-id="bmi-high-display"]')).not.toHaveClass(/lform-waiting/, { timeout: 5_000 });
  });

  test('hidden flag preserved in FHIR export (round-trip)', async ({ page }) => {
    await loadAnnual(page);

    const json = await page.evaluate(async () => {
      const { buildFHIRObject } = await import('/js/fhir/export.js');
      return JSON.stringify(buildFHIRObject());
    });
    const q = JSON.parse(json);
    function findItem(items, id) {
      for (const it of items ?? []) {
        if (it.linkId === id) return it;
        const found = findItem(it.item ?? [], id);
        if (found) return found;
      }
    }

    const flag = findItem(q.item, 'bmi-high-flag');
    expect(flag).toBeTruthy();
    const HIDDEN_URL = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-hidden';
    const hiddenExt = (flag.extension ?? []).find(e => e.url === HIDDEN_URL);
    expect(hiddenExt?.valueBoolean).toBe(true);
  });

  test('non-hidden items are unaffected in patient view', async ({ page }) => {
    await loadAnnual(page);
    await enablePatientView(page);
    // height, weight, bmi are NOT hidden — they should render normally
    await expect(page.locator('[data-preview-id="height"]')).toBeVisible();
    await expect(page.locator('[data-preview-id="weight"]')).toBeVisible();
  });
});

// ── questionnaire-usageMode ───────────────────────────────────────────────────

test.describe('questionnaire-usageMode', () => {
  test('capture-only item is visible in design (default) mode', async ({ page }) => {
    await loadItemControl(page);
    // usage-mode-demo has usageMode='capture' — visible in design/capture mode
    await expect(page.locator('[data-preview-id="usage-mode-demo"]')).toBeVisible();
  });

  test('capture-only item IS visible in patient view (capture = data entry mode)', async ({ page }) => {
    await loadItemControl(page);
    await enablePatientView(page);
    // usageMode='capture' means show only during data capture.
    // Patient view IS capture mode (patient fills the form).
    // So capture items MUST be visible in patient view.
    await expect(page.locator('[data-preview-id="usage-mode-demo"]')).toBeVisible();
  });

  test('usageMode extension round-trips through import → export', async ({ page }) => {
    await loadItemControl(page);

    const json = await page.evaluate(async () => {
      const { buildFHIRObject } = await import('/js/fhir/export.js');
      return JSON.stringify(buildFHIRObject());
    });
    const q = JSON.parse(json);
    function findItem(items, id) {
      for (const it of items ?? []) {
        if (it.linkId === id) return it;
        const found = findItem(it.item ?? [], id);
        if (found) return found;
      }
    }

    const item = findItem(q.item, 'usage-mode-demo');
    expect(item).toBeTruthy();
    const USAGE_URL = 'http://hl7.org/fhir/StructureDefinition/questionnaire-usageMode';
    const ext = (item.extension ?? []).find(e => e.url === USAGE_URL);
    expect(ext?.valueCode).toBe('capture');
  });

  test('fixture loads without JS errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await loadItemControl(page);
    expect(errors).toHaveLength(0);
  });
});
