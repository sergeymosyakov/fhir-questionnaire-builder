// ── E2E: sdc-questionnaire-shortText feature ──────────────────────────────────
//
// Tests that shortText is:
//   1. Imported and shown as a small badge in the builder preview row
//   2. Not shown for items without shortText
//   3. Not shown in patient view
//   4. Round-trips correctly through export → re-import
//
// Fixture: tests/fixtures/short-text.fhir.json
//   q-with-short    — integer item with shortText "Pain level"
//   q-no-short      — string item with NO shortText
//   grp-with-short  — group with shortText "CV Risk"
//   q-nested        — nested item inside the group (no shortText)
//
// Run: npx playwright test tests/e2e/short-text.spec.js
//
// ── data-testid registry ─────────────────────────────────────────────────────
//   (no custom testids — badge identified by CSS class .preview-short-text-badge)
//   export-btn           main Export dropdown button
//   export-quest-item    "Questionnaire2026" item in export dropdown (opens saveFormatModal)
//   prompt-save          confirm button in filename prompt dialog
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { test, expect } from '@playwright/test';

const FIXTURE = path.resolve('tests/fixtures/short-text.fhir.json');

async function loadFixture(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(FIXTURE);
  await expect(page.locator('[data-preview-id="q-with-short"]')).toBeVisible({ timeout: 8_000 });
}

// ── 1. Badge visible for items with shortText ─────────────────────────────────

test.describe('short-text — badge visibility', () => {
  test('shows shortText badge for item with shortText set', async ({ page }) => {
    await loadFixture(page);
    const row = page.locator('[data-preview-id="q-with-short"]');
    const badge = row.locator('.preview-short-text-badge').first();
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText('Pain level');
  });

  test('shows shortText badge for group with shortText set', async ({ page }) => {
    await loadFixture(page);
    const row = page.locator('[data-preview-id="grp-with-short"]');
    const badge = row.locator('.preview-short-text-badge').first();
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText('CV Risk');
  });

  test('no badge for item without shortText', async ({ page }) => {
    await loadFixture(page);
    const row = page.locator('[data-preview-id="q-no-short"]');
    await expect(row.locator('.preview-short-text-badge')).toHaveCount(0);
  });

  test('no badge for nested item without shortText', async ({ page }) => {
    await loadFixture(page);
    const row = page.locator('[data-preview-id="q-nested"]');
    await expect(row.locator('.preview-short-text-badge')).toHaveCount(0);
  });
});

// ── 2. Badge hidden in patient view ──────────────────────────────────────────

test.describe('short-text — patient view', () => {
  test('badge is not shown in patient view', async ({ page }) => {
    await loadFixture(page);
    // Switch to patient view
    await page.getByTestId('preview-mode-btn').click();
    await page.getByTestId('preview-mode-patient').click();
    await expect(page.locator('#lform')).toHaveClass(/patient-view/, { timeout: 5_000 });
    await expect(page.locator('.preview-short-text-badge')).toHaveCount(0);
  });
});

// ── 3. Export round-trip ──────────────────────────────────────────────────────

test.describe('short-text — export round-trip', () => {
  test('sdc-questionnaire-shortText extension preserved in exported FHIR JSON', async ({ page }) => {
    await loadFixture(page);
    await page.locator('[data-testid="export-btn"]').click();
    await page.locator('[data-testid="export-quest-item"]').click();
    await expect(page.locator('[data-testid="saveFormatModal"]')).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('[data-testid="saveFormatModalApply"]').click().then(() => page.getByTestId('prompt-save').click()),
    ]);
    const filePath = await download.path();
    const { readFileSync } = await import('node:fs');
    const q = JSON.parse(readFileSync(filePath, 'utf8'));

    const item = q.item.find(i => i.linkId === 'q-with-short');
    expect(item).toBeTruthy();
    const ext = (item.extension || []).find(
      e => e.url === 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-shortText'
    );
    expect(ext).toBeTruthy();
    expect(ext.valueString).toBe('Pain level');
  });

  test('item without shortText has no shortText extension in export', async ({ page }) => {
    await loadFixture(page);
    await page.locator('[data-testid="export-btn"]').click();
    await page.locator('[data-testid="export-quest-item"]').click();
    await expect(page.locator('[data-testid="saveFormatModal"]')).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('[data-testid="saveFormatModalApply"]').click().then(() => page.getByTestId('prompt-save').click()),
    ]);
    const filePath = await download.path();
    const { readFileSync } = await import('node:fs');
    const q = JSON.parse(readFileSync(filePath, 'utf8'));

    const item = q.item.find(i => i.linkId === 'q-no-short');
    expect(item).toBeTruthy();
    const ext = (item.extension || []).find(
      e => e.url === 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-shortText'
    );
    expect(ext).toBeUndefined();
  });
});
