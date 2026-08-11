// ── E2E: WHO EmCare form revived via a companion QuestionnaireResponse ────────
// The WHO form hides everything because its inputs (AgeInMonths, load-* danger
// signs) are CQL-populated and we don't run CQL. Loading a QR that supplies
// those input values makes the FHIRPath enableWhen fire → treatment sections
// appear. Proves the form's real logic runs in-browser without a CQL engine.
//
// Run: npx playwright test tests/e2e/who-response-load.spec.js

import path from 'node:path';
import { test, expect } from '@playwright/test';

const FORM = path.resolve('sampledata/who-emcare-treatment.fhir.json');
const QR   = path.resolve('sampledata/who-emcare-treatment-response.qr.json');

async function freshStart(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 15_000 });
}

async function loadFile(page, filePath) {
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(filePath);
}

// The WHO form gates everything on polymorphic `.value` (value[x]), which only
// resolves when the FHIR R4 model is passed to fhirpath.evaluate(). This proves
// the model is loaded and wired: the same expression is empty without the model
// and true with it.
test('FHIR R4 model resolves polymorphic .value in enableWhen expressions', async ({ page }) => {
  await freshStart(page);
  const out = await page.evaluate(() => {
    const fp = window.fhirpath;
    const model = window.fhirpath_r4_model;
    const qr = {
      resourceType: 'QuestionnaireResponse',
      item: [{ linkId: 'AgeInMonths', answer: [{ valueInteger: 24 }] }],
    };
    const expr = "%resource.repeat(item).where(linkId='AgeInMonths').answer.first().value>=2";
    return {
      modelLoaded: !!model,
      without: fp.evaluate(qr, expr, { resource: qr }),
      with:    fp.evaluate(qr, expr, { resource: qr }, model),
    };
  });
  expect(out.modelLoaded).toBe(true);
  expect(out.without).toEqual([]);   // .value unresolved → empty (the old bug)
  expect(out.with).toEqual([true]);  // model resolves value[x] → condition true
});

test('loading the response QR enables the WHO treatment section', async ({ page }) => {
  await freshStart(page);
  await loadFile(page, FORM);
  await expect(page.locator('[data-node-id]').first()).toBeVisible({ timeout: 10_000 });
  await loadFile(page, QR);
  // The DE02 treatment display is present and enabled after answers arrive.
  await expect(page.locator('[data-preview-id="EmCare.C10.IT.DE02"]')).toBeVisible({ timeout: 10_000 });
});
