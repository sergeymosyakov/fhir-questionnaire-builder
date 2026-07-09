// ── E2E: questionnaire-itemControl group codes = header / footer ──────────────
// Tests that cover the group-level display bands:
//   1. Import render — a header group gets .lform-group-header + a "header" badge.
//   2. Import render — a footer group gets .lform-group-footer.
//   3. A plain group has neither class.
//   4. Round-trip — header/footer itemControl survives import → export.
//   5. Builder UI — the Group display select in the Appearance modal turns a
//      plain group into a header (preview class + Appearance link highlight).
//
// Fixture: tests/fixtures/group-layout.fhir.json
//
// Run: npx playwright test tests/e2e/group-layout.spec.js
//
// ── data-testid registry ─────────────────────────────────────────────────────
//   fhir-file-input        hidden file <input> for Open → FHIR JSON
//   action-style           "Appearance" action link on a group node
//   appearanceModal        Appearance modal backdrop
//   group-layout-select    the Group display custom-select (groups only)
//   csel-drop              open custom-select dropdown panel
//   appearanceModalApply   Apply button
//   export-btn / export-quest-item / saveFormatModalApply / prompt-save — export flow
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openDropdownItem } from './helpers/dropdown.js';

const FIXTURE = path.resolve('tests/fixtures/group-layout.fhir.json');

// ── Helpers ───────────────────────────────────────────────────────────────────

async function loadFixture(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(FIXTURE);
  await expect(page.locator('[data-preview-id="hdr"]')).toBeVisible({ timeout: 8_000 });
}

async function exportFHIR(page) {
  await openDropdownItem(page, 'export-btn', 'export-quest-item');
  await expect(page.locator('[data-testid="saveFormatModal"]')).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('saveFormatModalApply').click().then(() => page.getByTestId('prompt-save').click()),
  ]);
  return JSON.parse(readFileSync(await download.path(), 'utf8'));
}

// ── 1-3. Import render ────────────────────────────────────────────────────────

test.describe('group header/footer — import render', () => {
  test('header group gets the header class and a badge', async ({ page }) => {
    await loadFixture(page);
    const hdr = page.locator('[data-preview-id="hdr"]');
    await expect(hdr).toHaveClass(/lform-group-header/);
    await expect(hdr.locator('.preview-group-ctrl-badge')).toHaveText('header');
  });

  test('footer group gets the footer class', async ({ page }) => {
    await loadFixture(page);
    await expect(page.locator('[data-preview-id="ftr"]')).toHaveClass(/lform-group-footer/);
  });

  test('plain group has neither header nor footer class', async ({ page }) => {
    await loadFixture(page);
    const plain = page.locator('[data-preview-id="plain"]');
    await expect(plain).not.toHaveClass(/lform-group-header/);
    await expect(plain).not.toHaveClass(/lform-group-footer/);
  });
});

// ── 4. Round-trip ───────────────────────────────────────────────────────────

test.describe('group header/footer — round-trip', () => {
  test('header and footer itemControl survive import → export', async ({ page }) => {
    await loadFixture(page);
    const q = await exportFHIR(page);
    const codeOf = (linkId) => {
      const item = q.item.find(i => i.linkId === linkId);
      return (item.extension || []).find(e => e.url.includes('questionnaire-itemControl'))
        ?.valueCodeableConcept.coding[0].code;
    };
    expect(codeOf('hdr')).toBe('header');
    expect(codeOf('ftr')).toBe('footer');
  });
});

// ── 5. Builder UI — Appearance modal Group display select ─────────────────────

test.describe('group header/footer — Appearance modal', () => {
  test('setting Group display to Header updates preview and highlights Appearance', async ({ page }) => {
    await loadFixture(page);

    const plainPreview = page.locator('[data-preview-id="plain"]');
    await expect(plainPreview).not.toHaveClass(/lform-group-header/);

    const link = page.locator('[data-node-id="plain"]').getByTestId('action-style');
    await expect(link).toBeVisible();
    await link.click();
    await expect(page.locator('[data-testid="appearanceModal"]')).toBeVisible();

    await page.getByTestId('group-layout-select').click();
    await page.locator('[data-testid="csel-drop"] [data-val="header"]').click();
    await page.getByTestId('appearanceModalApply').click();
    await expect(page.locator('[data-testid="appearanceModal"]')).not.toBeVisible();

    await expect(plainPreview).toHaveClass(/lform-group-header/);
    await expect(link).toHaveClass(/action-edit--active/);
  });
});
