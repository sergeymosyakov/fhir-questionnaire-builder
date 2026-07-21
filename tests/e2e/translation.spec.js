// ── E2E: Questionnaire translation feature ────────────────────────────────────
// Tests the full translation workflow:
//   1. "Translate questionnaire…" appears in the Settings menu
//   2. Translate modal opens with a language picker
//   3. Loading a questionnaire with existing translations shows the language
//      switcher in the preview toolbar
//   4. Switching language updates item labels in the preview
//   5. Export preserves translation extensions in the FHIR JSON
//
// Fixture: sampledata/phq-9.fhir.json (has Spanish translations on first 3 items)
//
// Run: npx playwright test tests/e2e/translation.spec.js
//
// ── data-testid registry ──────────────────────────────────────────────────────
//   tools-btn             Settings ▾ dropdown trigger
//   translate-item        "🌐 Translate questionnaire…" menu item
//   translateModal        modal backdrop
//   translate-lang-select language custom-select trigger
//   translate-btn         "Translate" button
//   translate-apply-btn   "Apply translations" button
//   translate-cancel-btn  "Discard" button
//   translate-progress    progress bar wrap
//   translate-table       review table
//   lang-switcher-wrap    language switcher container in preview toolbar
//   lang-menu-item-original     "Original" language button
//   lang-menu-item-es           "Spanish" language button
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { test, expect } from '@playwright/test';
import { FHIR } from '../../js/fhir/urls/fhir.js';

const PHQ9 = path.resolve('sampledata/phq-9.fhir.json');

async function freshStart(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
}

async function loadPHQ9(page) {
  await freshStart(page);
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(PHQ9);
  await expect(page.locator('[data-preview-id="/44250-9"]')).toBeVisible({ timeout: 10_000 });
}

// ── Settings menu entry ───────────────────────────────────────────────────────

test.describe('translation — Settings menu', () => {
  test('"Translate questionnaire…" item exists in Settings menu', async ({ page }) => {
    await loadPHQ9(page); // need a loaded questionnaire so toolbar is visible
    await page.getByTestId('tools-btn').click();
    await expect(page.getByTestId('translate-item')).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');
  });
});

// ── Translate modal ───────────────────────────────────────────────────────────

test.describe('translation — modal', () => {
  test('clicking "Translate questionnaire…" opens the translate modal', async ({ page }) => {
    await loadPHQ9(page);
    await page.getByTestId('tools-btn').click();
    await expect(page.getByTestId('translate-item')).toBeVisible();
    await page.getByTestId('translate-item').click();
    await expect(page.locator('[data-testid="translateModal"]')).toBeVisible({ timeout: 5_000 });
  });

  test('modal has a language select and translate button', async ({ page }) => {
    await loadPHQ9(page);
    await page.getByTestId('tools-btn').click();
    await page.getByTestId('translate-item').click();
    await expect(page.locator('[data-testid="translateModal"]')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('translate-lang-select')).toBeVisible();
    await expect(page.getByTestId('translate-btn')).toBeVisible();
    // Translate button disabled until language selected
    await expect(page.getByTestId('translate-btn')).toBeDisabled();
  });

  test('selecting a language enables the Translate button', async ({ page }) => {
    await loadPHQ9(page);
    await page.getByTestId('tools-btn').click();
    await page.getByTestId('translate-item').click();
    await expect(page.locator('[data-testid="translateModal"]')).toBeVisible({ timeout: 5_000 });

    // Pick French from the language select
    await page.getByTestId('translate-lang-select').click();
    await page.locator('[data-testid="csel-drop"] [data-val="fr"]').click();
    await expect(page.getByTestId('translate-btn')).not.toBeDisabled();
  });

  test('modal closes on Escape key', async ({ page }) => {
    await loadPHQ9(page);
    await page.getByTestId('tools-btn').click();
    await page.getByTestId('translate-item').click();
    await expect(page.locator('[data-testid="translateModal"]')).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="translateModal"]')).not.toBeVisible();
  });
});

// ── Language switcher (existing translations on PHQ-9) ────────────────────────

test.describe('translation — language switcher', () => {
  test('loading PHQ-9 (which has Spanish translations) shows language switcher', async ({ page }) => {
    await loadPHQ9(page);
    // PHQ-9 has Spanish translations → lang-menu-btn should be visible
    await expect(page.getByTestId('lang-menu-btn')).toBeVisible({ timeout: 5_000 });
  });

  test('language switcher has Original and Spanish items in dropdown', async ({ page }) => {
    await loadPHQ9(page);
    // Open the language menu dropdown first
    await page.getByTestId('lang-menu-btn').click();
    await expect(page.getByTestId('lang-menu-item-original')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('lang-menu-item-es')).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');
  });

  test('clicking Spanish shows translated item labels', async ({ page }) => {
    await loadPHQ9(page);
    // Original label for first item
    const firstItem = page.locator('[data-preview-id="/44250-9"]');
    await expect(firstItem).toContainText('Little interest', { timeout: 5_000 });

    // Open menu and select Spanish
    await page.getByTestId('lang-menu-btn').click();
    await page.getByTestId('lang-menu-item-es').click();
    // Wait for re-render
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

    // Spanish translation
    await expect(firstItem).toContainText('Poco interés', { timeout: 5_000 });
  });

  test('switching back to Original restores English labels', async ({ page }) => {
    await loadPHQ9(page);
    await page.getByTestId('lang-menu-btn').click();
    await page.getByTestId('lang-menu-item-es').click();
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await expect(page.locator('[data-preview-id="/44250-9"]')).toContainText('Poco', { timeout: 5_000 });

    // Switch back via menu
    await page.getByTestId('lang-menu-btn').click();
    await page.getByTestId('lang-menu-item-original').click();
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await expect(page.locator('[data-preview-id="/44250-9"]')).toContainText('Little interest', { timeout: 5_000 });
  });

  test('non-translated questionnaire does not show language switcher', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.locator('[data-node-id="1"]')).toBeVisible();
    // No translations → lang-menu-btn hidden
    await expect(page.getByTestId('lang-menu-btn')).not.toBeVisible();
  });
});

// ── Round-trip: export preserves translations ─────────────────────────────────

test.describe('translation — FHIR round-trip', () => {
  test('exported FHIR preserves _text.extension[translation] on translated items', async ({ page }) => {
    await loadPHQ9(page);

    const json = await page.evaluate(async () => {
      const { buildFHIRObject } = await import('/js/fhir/export.js');
      return JSON.stringify(buildFHIRObject());
    });
    const q = JSON.parse(json);

    const TRANS_URL = FHIR.translation;
    function find(items, id) {
      for (const it of items ?? []) {
        if (it.linkId === id) return it;
        const f = find(it.item ?? [], id);
        if (f) return f;
      }
    }

    const item = find(q.item, '/44250-9');
    const transExts = (item?._text?.extension ?? []).filter(e => e.url === TRANS_URL);
    expect(transExts.length).toBeGreaterThan(0);
    const esExt = transExts.find(e =>
      (e.extension ?? []).some(s => s.url === 'lang' && s.valueCode === 'es')
    );
    expect(esExt).toBeTruthy();
    const content = esExt.extension.find(s => s.url === 'content')?.valueString;
    expect(content).toContain('Poco interés');
  });

  test('exported FHIR preserves _title.extension[translation]', async ({ page }) => {
    await loadPHQ9(page);

    const json = await page.evaluate(async () => {
      const { buildFHIRObject } = await import('/js/fhir/export.js');
      return JSON.stringify(buildFHIRObject());
    });
    const q = JSON.parse(json);
    const TRANS_URL = FHIR.translation;
    const titleTrans = (q._title?.extension ?? []).filter(e => e.url === TRANS_URL);
    expect(titleTrans.length).toBeGreaterThan(0);
    const esTitle = titleTrans.find(e =>
      (e.extension ?? []).some(s => s.url === 'lang' && s.valueCode === 'es')
    );
    expect(esTitle).toBeTruthy();
  });
});
