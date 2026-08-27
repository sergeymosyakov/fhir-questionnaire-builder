// ── E2E: CQL execution ────────────────────────────────────────────────────────
// Tests that a self-contained cqf-library (a #contained Library resource with
// embedded precompiled ELM) is resolved and actually executed client-side, and
// that the computed value drives a downstream enableWhenExpression — the WHO
// SMART Guidelines EmCare/IMCI pattern (FHIRPath enableWhen reading an answer
// only CQL populates), reproduced fully offline/deterministically.
//
// ── data-testid registry ──────────────────────────────────────────────────────
//   fhir-file-input       — sample/fixture loader
//   patient-preset-btn    — "👤 Patient ▾" preset dropdown button
//   patient-ctx-age       — age field in the Custom Patient Context modal
//   patientCtxModal(Apply)— Custom Patient Context modal + its Apply button
//   preview-readonly-value— the read-only computed value span (item.readOnly, no calculatedExpression)

import { test, expect } from '@playwright/test';
import path from 'node:path';
import { freshStart } from './helpers/builder.js';

const FIXTURE = path.resolve('tests/fixtures/cql-execution.fhir.json');

async function loadFixture(page) {
  await freshStart(page);
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(FIXTURE);
  await page.waitForSelector('[data-testid="tree-container"] [data-node-id]', { timeout: 15_000 });
}

/** Open the Patient Context "Custom…" modal, set %age, and Apply (triggers Re-init). */
async function setPatientAge(page, age) {
  await expect(async () => {
    if (!(await page.locator('[data-preset="custom"]').isVisible())) {
      await page.getByTestId('patient-preset-btn').click();
    }
    await expect(page.locator('[data-preset="custom"]')).toBeVisible();
  }).toPass();
  await page.locator('[data-preset="custom"]').click();
  await expect(page.getByTestId('patientCtxModal')).toBeVisible();
  await page.getByTestId('patient-ctx-age').fill(String(age));
  await page.getByTestId('patientCtxModalApply').click();
}

test.describe('CQL execution — cqf-library + text/cql-identifier', () => {
  test('resolves the CQL define and writes it into the initialExpression field', async ({ page }) => {
    await loadFixture(page);
    await setPatientAge(page, 1);

    const ageValue = page.locator('[data-preview-id="age-in-months"]').getByTestId('preview-readonly-value');
    await expect(ageValue).toHaveText('12', { timeout: 10_000 });
  });

  test('CQL-computed value enables a downstream enableWhenExpression (under 24 months)', async ({ page }) => {
    await loadFixture(page);
    await setPatientAge(page, 1);

    await expect(page.locator('[data-preview-id="age-in-months"]').getByTestId('preview-readonly-value')).toHaveText('12', { timeout: 10_000 });
    await expect(page.locator('[data-preview-id="infant-protocol-alert"]')).not.toHaveClass(/lform-waiting/);
  });

  test('enableWhenExpression stays gated off at 24 months or older', async ({ page }) => {
    await loadFixture(page);
    await setPatientAge(page, 5);

    await expect(page.locator('[data-preview-id="age-in-months"]').getByTestId('preview-readonly-value')).toHaveText('60', { timeout: 10_000 });
    await expect(page.locator('[data-preview-id="infant-protocol-alert"]')).toHaveClass(/lform-waiting/);
  });

  test('recomputes on a second Re-init when the patient age changes', async ({ page }) => {
    await loadFixture(page);
    await setPatientAge(page, 5);
    const ageValue = page.locator('[data-preview-id="age-in-months"]').getByTestId('preview-readonly-value');
    await expect(ageValue).toHaveText('60', { timeout: 10_000 });

    await setPatientAge(page, 1);
    await expect(ageValue).toHaveText('12', { timeout: 10_000 });
  });
});
