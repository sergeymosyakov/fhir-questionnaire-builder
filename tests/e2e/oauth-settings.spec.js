// ── E2E: Settings page — per-server OAuth config fields (issue #63) ──────────
// Tests: fields save to localStorage, persist across reload, independent per
// server (FHIR Base vs SDC Server).
//
// ── data-testid registry ────────────────────────────────────────────────────
//   fhir-oauth-authorize-url / fhir-oauth-token-url / fhir-oauth-client-id / fhir-oauth-scope
//   sdc-oauth-authorize-url  / sdc-oauth-token-url  / sdc-oauth-client-id  / sdc-oauth-scope
//   term-server-input          settings-ready marker
//   settings-save-btn          save button
//   settings-save-status       save status text
// ────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';

const SETTINGS_URL = '/settings.html';

async function gotoSettings(page) {
  await page.goto(SETTINGS_URL);
  await page.getByTestId('term-server-input').waitFor({ timeout: 10_000 });
}

test.describe('Settings page — OAuth config fields', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(SETTINGS_URL);
    await page.evaluate(() => {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('fhirqb.server.')) localStorage.removeItem(key);
      }
    });
  });

  test('OAuth fields are empty by default', async ({ page }) => {
    await gotoSettings(page);
    await expect(page.getByTestId('fhir-oauth-authorize-url')).toHaveValue('');
    await expect(page.getByTestId('sdc-oauth-client-id')).toHaveValue('');
  });

  test('saves FHIR Base OAuth config and persists across reload, independent of SDC Server', async ({ page }) => {
    await gotoSettings(page);
    await page.getByTestId('fhir-oauth-authorize-url').fill('https://idp.example.com/oauth2/authorize');
    await page.getByTestId('fhir-oauth-token-url').fill('https://idp.example.com/oauth2/token');
    await page.getByTestId('fhir-oauth-client-id').fill('fhir-base-client');
    await page.getByTestId('fhir-oauth-scope').fill('openid fhirUser');
    await page.getByTestId('settings-save-btn').click();
    await expect(page.getByTestId('settings-save-status')).toHaveText(/saved/i);

    await page.reload();
    await gotoSettings(page);
    await expect(page.getByTestId('fhir-oauth-authorize-url')).toHaveValue('https://idp.example.com/oauth2/authorize');
    await expect(page.getByTestId('fhir-oauth-client-id')).toHaveValue('fhir-base-client');
    // SDC Server's own OAuth fields must stay untouched.
    await expect(page.getByTestId('sdc-oauth-client-id')).toHaveValue('');
  });

  test('saves SDC Server OAuth config separately from FHIR Base', async ({ page }) => {
    await gotoSettings(page);
    await page.getByTestId('sdc-oauth-authorize-url').fill('https://sdc-idp.example.com/oauth2/authorize');
    await page.getByTestId('sdc-oauth-token-url').fill('https://sdc-idp.example.com/oauth2/token');
    await page.getByTestId('sdc-oauth-client-id').fill('sdc-client');
    await page.getByTestId('settings-save-btn').click();
    await expect(page.getByTestId('settings-save-status')).toHaveText(/saved/i);

    await page.reload();
    await gotoSettings(page);
    await expect(page.getByTestId('sdc-oauth-client-id')).toHaveValue('sdc-client');
    await expect(page.getByTestId('fhir-oauth-client-id')).toHaveValue('');
  });
});
