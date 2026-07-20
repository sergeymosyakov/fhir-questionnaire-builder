// ── E2E: Settings page ────────────────────────────────────────────────────────
// Tests: page loads, displays values from config.json, saves to localStorage,
// reset works, provider list is shown.
//
// Tested elements:
//   settings-page-btn      — gear icon link in builder header
//   termServerInput         — terminology server input
//   corsProxyInput          — CORS proxy input
//   fhirBaseInput           — FHIR base server input
//   nlmApiInput             — NLM API base input
//   testTermServerBtn       — test connection button
//   saveBtn                 — save button

import { test, expect } from '@playwright/test';

const SETTINGS_URL = '/settings.html';

// ── Helpers ───────────────────────────────────────────────────────────────────
async function gotoSettings(page) {
  await page.goto(SETTINGS_URL);
  await page.waitForSelector('#termServerInput', { timeout: 10_000 });
}

// ── Tests ─────────────────────────────────────────────────────────────────────
test.describe('Settings page', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any previous localStorage overrides
    await page.goto(SETTINGS_URL);
    await page.evaluate(() => {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('fhirqb.server.')) localStorage.removeItem(key);
      }
    });
  });

  test('loads and shows default values from config.json', async ({ page }) => {
    await gotoSettings(page);

    // Terminology server should be pre-filled from config.json
    const termVal = await page.locator('#termServerInput').inputValue();
    expect(termVal).toContain('fhir.org');

    // CORS proxy should be pre-filled
    const proxyVal = await page.locator('#corsProxyInput').inputValue();
    expect(proxyVal.length).toBeGreaterThan(0);

    // Reset buttons should be disabled (no overrides)
    const resetBtns = page.locator('[data-reset]');
    const count = await resetBtns.count();
    for (let i = 0; i < count; i++) {
      await expect(resetBtns.nth(i)).toBeDisabled();
    }
  });

  test('shows validators from config.json', async ({ page }) => {
    await gotoSettings(page);

    // At least one validator row should be visible
    const rows = page.locator('.s-validator-row');
    await expect(rows.first()).toBeVisible();
  });

  test('shows active provider list', async ({ page }) => {
    await gotoSettings(page);

    const providers = page.locator('#providersDisplay .s-provider-badge');
    const count = await providers.count();
    expect(count).toBeGreaterThan(0);

    // Default config.json provider should be listed
    const labels = await providers.allTextContents();
    expect(labels.some(l => l.includes('Default') || l.includes('config'))).toBe(true);
  });

  test('saves custom value and marks field as overridden', async ({ page }) => {
    await gotoSettings(page);

    const input = page.locator('#termServerInput');

    await input.fill('https://custom-server.example.com/r4');
    await page.locator('#saveBtn').click();

    // Field should have custom style
    await expect(input).toHaveClass(/is-custom/);

    // Reset button should be enabled
    await expect(page.locator('[data-reset="terminologyServer"]')).toBeEnabled();
  });

  test('persists saved value after page reload', async ({ page }) => {
    await gotoSettings(page);

    await page.locator('#termServerInput').fill('https://persisted.example.com/r4');
    await page.locator('#saveBtn').click();

    // Reload
    await page.reload();
    await page.waitForSelector('#termServerInput');

    const val = await page.locator('#termServerInput').inputValue();
    expect(val).toBe('https://persisted.example.com/r4');
  });

  test('reset restores default value', async ({ page }) => {
    await gotoSettings(page);

    const defaultVal = await page.locator('#termServerInput').inputValue();

    // Save custom value
    await page.locator('#termServerInput').fill('https://custom.example.com/r4');
    await page.locator('#saveBtn').click();
    await expect(page.locator('[data-reset="terminologyServer"]')).toBeEnabled();

    // Reset
    await page.locator('[data-reset="terminologyServer"]').click();

    // Should return to default
    const restoredVal = await page.locator('#termServerInput').inputValue();
    expect(restoredVal).toBe(defaultVal);
    await expect(page.locator('[data-reset="terminologyServer"]')).toBeDisabled();
  });

  test('translation API endpoint persists after reload', async ({ page }) => {
    await gotoSettings(page);

    const input = page.locator('#translateApiInput');
    await expect(input).toBeVisible();

    await input.fill('https://my-translate-proxy.example.com/translate');
    await page.locator('#saveBtn').click();

    await expect(input).toHaveClass(/is-custom/);
    await expect(page.locator('[data-reset="translateApiUrl"]')).toBeEnabled();

    await page.reload();
    await page.waitForSelector('#translateApiInput');
    const val = await page.locator('#translateApiInput').inputValue();
    expect(val).toBe('https://my-translate-proxy.example.com/translate');
  });

  test('settings link opens settings.html from main app via \u22ef menu', async ({ page }) => {    await page.goto('/');
    await page.waitForSelector('[data-testid="add-root-group-btn"]');
    // settings-page-btn is inside the ⋯ More menu
    await page.getByTestId('more-btn').click();
    await expect(page.getByTestId('settings-page-btn')).toBeVisible();

    const [settingsPage] = await Promise.all([
      page.context().waitForEvent('page'),
      page.locator('[data-testid="settings-page-btn"]').click(),
    ]);

    await settingsPage.waitForLoadState('domcontentloaded');
    expect(settingsPage.url()).toContain('settings');
    await settingsPage.close();
  });
});
