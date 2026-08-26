// ── E2E: FHIR debug login page (client_credentials, fresh token per request) ─
// Interim local-testing tool, issue #63 — see docs/FHIR-SERVER-AUTH-PLAN.md.
// The network is fully mocked with page.route() — no real IdP is called.
//
// Tested elements:
//   dev-login-token-url     — token URL input
//   dev-login-client-id     — client id input
//   dev-login-client-secret — client secret input
//   dev-login-save-btn      — "Save" button (persists creds, no network call)
//   dev-login-test-btn      — "Test" button (one-off verify fetch, not stored)
//   dev-login-reset-btn     — "Reset" button
//   dev-login-status        — saved/not-configured status line

import { test, expect } from '@playwright/test';

const TOKEN_URL = 'https://mock-idp.example.com/oauth2/token';

async function gotoDevLogin(page) {
  // Note: a one-time clear before navigating, NOT page.addInitScript() — that
  // would persist and wipe sessionStorage again on every later page.reload()
  // in the same test (e.g. the "remembers fields across a reload" test).
  await page.goto('/dev-fhir-login.html');
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await page.waitForSelector('[data-testid="dev-login-save-btn"]');
}

test.describe('FHIR debug login page', () => {
  test('shows "Not configured" initially', async ({ page }) => {
    await gotoDevLogin(page);
    await expect(page.getByTestId('dev-login-status')).toHaveText('Not configured.');
  });

  test('Save errors when a required field is missing', async ({ page }) => {
    await gotoDevLogin(page);
    await page.getByTestId('dev-login-token-url').fill(TOKEN_URL);
    // Client ID / Secret left empty
    await page.getByTestId('dev-login-save-btn').click();
    await expect(page.locator('.notif-box.notif--error')).toContainText('required');
  });

  test('Save persists credentials without any network call', async ({ page }) => {
    let fetchCalled = false;
    await page.route(url => url.href === TOKEN_URL, route => {
      fetchCalled = true;
      return route.fulfill({ status: 200, body: '{}' });
    });

    await gotoDevLogin(page);
    await page.getByTestId('dev-login-token-url').fill(TOKEN_URL);
    await page.getByTestId('dev-login-client-id').fill('mock-client');
    await page.getByTestId('dev-login-client-secret').fill('mock-secret');
    await page.getByTestId('dev-login-save-btn').click();

    await expect(page.getByTestId('dev-login-status')).toContainText('Saved', { timeout: 8000 });
    expect(fetchCalled).toBe(false);
    expect(await page.evaluate(() => sessionStorage.getItem('fhirqb.debugLogin.tokenUrl'))).toBe(TOKEN_URL);
  });

  test('Test verifies credentials via one fetch and does not persist anything', async ({ page }) => {
    await page.route(url => url.href === TOKEN_URL, async route => {
      expect(route.request().method()).toBe('POST');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ access_token: 'mock-access-token', expires_in: 3600 }),
      });
    });

    await gotoDevLogin(page);
    await page.getByTestId('dev-login-token-url').fill(TOKEN_URL);
    await page.getByTestId('dev-login-client-id').fill('mock-client');
    await page.getByTestId('dev-login-client-secret').fill('mock-secret');
    await page.getByTestId('dev-login-test-btn').click();

    await expect(page.locator('.notif-box.notif--info')).toContainText('Credentials work', { timeout: 8000 });
    // Test never saved the fields (only Save does) — nothing in session storage.
    expect(await page.evaluate(() => sessionStorage.getItem('fhirqb.debugLogin.tokenUrl'))).toBeNull();
  });

  test('Reset clears saved credentials and fields', async ({ page }) => {
    await gotoDevLogin(page);
    await page.getByTestId('dev-login-token-url').fill(TOKEN_URL);
    await page.getByTestId('dev-login-client-id').fill('mock-client');
    await page.getByTestId('dev-login-client-secret').fill('mock-secret');
    await page.getByTestId('dev-login-save-btn').click();
    await expect(page.getByTestId('dev-login-status')).toContainText('Saved', { timeout: 8000 });
    await page.keyboard.press('Escape'); // dismiss the "Saved." toast

    await page.getByTestId('dev-login-reset-btn').click();
    await expect(page.getByTestId('dev-login-status')).toHaveText('Not configured.');
    await expect(page.getByTestId('dev-login-token-url')).toHaveValue('');
    expect(await page.evaluate(() => sessionStorage.getItem('fhirqb.debugLogin.tokenUrl'))).toBeNull();
  });

  test('remembers saved fields across a reload (same tab / sessionStorage)', async ({ page }) => {
    await gotoDevLogin(page);
    await page.getByTestId('dev-login-token-url').fill(TOKEN_URL);
    await page.getByTestId('dev-login-client-id').fill('mock-client');
    await page.getByTestId('dev-login-client-secret').fill('mock-secret');
    await page.getByTestId('dev-login-save-btn').click();
    await expect(page.getByTestId('dev-login-status')).toContainText('Saved', { timeout: 8000 });
    await page.keyboard.press('Escape');

    await page.reload();
    await page.waitForSelector('[data-testid="dev-login-save-btn"]');
    await expect(page.getByTestId('dev-login-token-url')).toHaveValue(TOKEN_URL);
    await expect(page.getByTestId('dev-login-client-id')).toHaveValue('mock-client');
    await expect(page.getByTestId('dev-login-status')).toContainText('Saved');
  });
});

