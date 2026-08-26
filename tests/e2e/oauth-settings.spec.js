// ── E2E: Settings page — per-server OAuth config fields (issue #63) ──────────
// Tests: fields save to localStorage, persist across reload, independent per
// server (FHIR Base vs SDC Server).
//
// Tested elements (plain ids, matching the rest of settings.html/settings.spec.js):
//   fhirBaseOauthAuthorizeInput / fhirBaseOauthTokenInput /
//   fhirBaseOauthClientIdInput / fhirBaseOauthScopeInput
//   sdcServerOauthAuthorizeInput / sdcServerOauthTokenInput /
//   sdcServerOauthClientIdInput / sdcServerOauthScopeInput
//   saveBtn

import { test, expect } from '@playwright/test';

const SETTINGS_URL = '/settings.html';

async function gotoSettings(page) {
  await page.goto(SETTINGS_URL);
  await page.waitForSelector('#termServerInput', { timeout: 10_000 });
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
    await expect(page.locator('#fhirBaseOauthAuthorizeInput')).toHaveValue('');
    await expect(page.locator('#sdcServerOauthClientIdInput')).toHaveValue('');
  });

  test('saves FHIR Base OAuth config and persists across reload, independent of SDC Server', async ({ page }) => {
    await gotoSettings(page);
    await page.locator('#fhirBaseOauthAuthorizeInput').fill('https://idp.example.com/oauth2/authorize');
    await page.locator('#fhirBaseOauthTokenInput').fill('https://idp.example.com/oauth2/token');
    await page.locator('#fhirBaseOauthClientIdInput').fill('fhir-base-client');
    await page.locator('#fhirBaseOauthScopeInput').fill('openid fhirUser');
    await page.locator('#saveBtn').click();
    await expect(page.locator('#saveStatus')).toHaveText(/saved/i);

    await page.reload();
    await gotoSettings(page);
    await expect(page.locator('#fhirBaseOauthAuthorizeInput')).toHaveValue('https://idp.example.com/oauth2/authorize');
    await expect(page.locator('#fhirBaseOauthClientIdInput')).toHaveValue('fhir-base-client');
    // SDC Server's own OAuth fields must stay untouched.
    await expect(page.locator('#sdcServerOauthClientIdInput')).toHaveValue('');
  });

  test('saves SDC Server OAuth config separately from FHIR Base', async ({ page }) => {
    await gotoSettings(page);
    await page.locator('#sdcServerOauthAuthorizeInput').fill('https://sdc-idp.example.com/oauth2/authorize');
    await page.locator('#sdcServerOauthTokenInput').fill('https://sdc-idp.example.com/oauth2/token');
    await page.locator('#sdcServerOauthClientIdInput').fill('sdc-client');
    await page.locator('#saveBtn').click();
    await expect(page.locator('#saveStatus')).toHaveText(/saved/i);

    await page.reload();
    await gotoSettings(page);
    await expect(page.locator('#sdcServerOauthClientIdInput')).toHaveValue('sdc-client');
    await expect(page.locator('#fhirBaseOauthClientIdInput')).toHaveValue('');
  });
});
