// ── E2E: answer option labels follow the active preview language (#49) ──────
// Fixture: tests/fixtures/option-translations.fhir.json (Spanish option designations on select/radio/checklist/open-choice/atable)
// Preview controls are located by data-preview-id (runtime form output — exempt from the data-testid rule).
// ── data-testid registry ─────────────────────────────────────────────────────
//   lang-menu-btn         language switcher trigger
//   lang-menu-item-es     "Spanish" entry
//   lang-menu-item-original  "Original" entry
// ─────────────────────────────────────────────────────────────────────────────
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { loadFixtureFile } from './helpers/load-fixture.js';

const FIXTURE = path.resolve('tests/fixtures/option-translations.fhir.json');

async function load(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-menu-btn"]', { timeout: 10_000 });
  await loadFixtureFile(page, FIXTURE);
  await expect(page.locator('[data-preview-id="rad"]')).toBeVisible({ timeout: 10_000 });
}

async function pickLang(page, code) {
  await page.getByTestId('lang-menu-btn').click();
  await page.getByTestId(`lang-menu-item-${code}`).click();
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}

for (const id of ['rad', 'chk', 'atb']) {
  test(`${id}: option labels are translated and restored`, async ({ page }) => {
    await load(page);
    const el = page.locator(`[data-preview-id="${id}"]`);
    await expect(el).toContainText('Yes');
    await pickLang(page, 'es');
    await expect(el).toContainText('Sí');
    await expect(el).toContainText('No hay');
    await expect(el).not.toContainText('Yes');
    await pickLang(page, 'original');
    await expect(el).toContainText('Yes');
    await expect(el).not.toContainText('Sí');
  });
}

test('select: dropdown options are translated', async ({ page }) => {
  await load(page);
  await pickLang(page, 'es');
  const el = page.locator('[data-preview-id="sel"]');
  await el.locator('.sc-trigger').click();
  await expect(page.locator('.oc-opt', { hasText: 'Sí' })).toBeVisible();
  await expect(page.locator('.oc-opt', { hasText: 'Yes' })).toHaveCount(0);
});

test('open-choice: suggestions are translated', async ({ page }) => {
  await load(page);
  await pickLang(page, 'es');
  const el = page.locator('[data-preview-id="oc"]');
  await el.locator('input[type="text"]').first().click();
  await expect(page.locator('.oc-opt', { hasText: 'Sí' })).toBeVisible();
});

test('open-choice: a picked answer follows the language and keeps its code', async ({ page }) => {
  await load(page);
  await pickLang(page, 'es');
  const el = page.locator('[data-preview-id="oc"]');
  await el.locator('input[type="text"]').first().click();
  await page.locator('.oc-opt', { hasText: 'Sí' }).dispatchEvent('mousedown');
  await expect(el.locator('input[type="text"]').first()).toHaveValue('Sí');
  await pickLang(page, 'original');
  await expect(el.locator('input[type="text"]').first()).toHaveValue('Yes');
  await expect(el.getByTestId('oc-coded-badge')).toBeVisible();
});
