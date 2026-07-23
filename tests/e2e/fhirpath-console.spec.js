// ── E2E: FHIRPath console ─────────────────────────────────────────────────────
// A dev-console block above the preview, opened from ⚙ Settings ▾ → 🧪 FHIRPath
// tester…. Evaluates FHIRPath against the live QuestionnaireResponse. Because it
// sits above the still-visible form, answers can be edited with it open.
//
// data-testid registry:
//   tools-btn             ⚙ Settings ▾ menu button
//   fhirpath-tester-item  menu item that shows the console
//   fhirpath-console      the console block
//   fhirpath-close        ✕ hide button
//   fhirpath-input        expression textarea
//   fhirpath-result       result / error <pre>
//   fhir-file-input       hidden file input (load a sample)

import { test, expect } from '@playwright/test';
import path from 'node:path';

const ANNUAL = path.resolve('sampledata/annual-health-check.fhir.json');

async function fresh(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
}

async function loadAnnual(page) {
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(ANNUAL);
  await expect(page.locator('[data-preview-id="bmi"]')).toBeVisible({ timeout: 10_000 });
}

async function openConsole(page) {
  await page.getByTestId('tools-btn').click();
  await page.getByTestId('fhirpath-tester-item').click();
  await expect(page.getByTestId('fhirpath-console')).toBeVisible();
}

async function evaluate(page, expr) {
  const inp = page.getByTestId('fhirpath-input');
  await inp.fill(expr);
  await page.waitForTimeout(400); // debounce 250ms
  return page.getByTestId('fhirpath-result').textContent();
}

test.describe('FHIRPath console', () => {
  test('opens above the preview from the Settings menu and the ✕ hides it', async ({ page }) => {
    await fresh(page);
    await loadAnnual(page);
    await openConsole(page);
    await expect(page.getByTestId('fhirpath-input')).toBeVisible();
    // Still sits above the preview, which remains visible.
    await expect(page.getByTestId('preview-panel')).toBeVisible();
    await page.getByTestId('fhirpath-close').click();
    await expect(page.getByTestId('fhirpath-console')).toBeHidden();
  });

  test('evaluates a constant expression', async ({ page }) => {
    await fresh(page);
    await loadAnnual(page);
    await openConsole(page);
    expect(await evaluate(page, '1 + 1')).toContain('2');
  });

  test('evaluates against the live QuestionnaireResponse', async ({ page }) => {
    await fresh(page);
    await loadAnnual(page);
    await openConsole(page);
    const out = await evaluate(page, '%resource.descendants().count()');
    expect(Number(out.trim().replace(/[^\d.-]/g, ''))).toBeGreaterThan(0);
  });

  test('invalid expression shows an error without crashing', async ({ page }) => {
    await fresh(page);
    await loadAnnual(page);
    await openConsole(page);
    await evaluate(page, 'foo(((');
    await expect(page.getByTestId('fhirpath-result')).toHaveClass(/fhirpath-result--error/);
    expect(await evaluate(page, '2 * 3')).toContain('6');
  });

  test('reflects a value entered in the form live (console stays open)', async ({ page }) => {
    await fresh(page);
    await loadAnnual(page);
    await openConsole(page);
    await page.getByTestId('fhirpath-input')
      .fill("%resource.descendants().where(linkId='height').answer.valueDecimal.first()");
    // The form is still interactive below the console.
    const heightInput = page.locator('[data-preview-id="height"]').locator('input').first();
    await heightInput.fill('180');
    await heightInput.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true })));
    await heightInput.blur();
    await expect.poll(
      async () => page.getByTestId('fhirpath-result').textContent(),
      { timeout: 5000 }
    ).toContain('180');
  });
});
