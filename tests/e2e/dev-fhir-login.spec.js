// ── E2E: FHIR debug login page (client_credentials) ──────────────────────────
// Interim local-testing tool, issue #63 — see docs/FHIR-SERVER-AUTH-PLAN.md.
// The network is fully mocked with page.route() — no real IdP is called.
//
// Tested elements:
//   dev-login-token-url         — token URL input
//   dev-login-client-id         — client id input
//   dev-login-client-secret     — client secret input
//   dev-login-get-token-btn     — "Get token" button
//   dev-login-forget-token-btn  — "Forget token" button
//   dev-login-status            — token status line

import { test, expect } from '@playwright/test';

const TOKEN_URL = 'https://mock-idp.example.com/oauth2/token';

async function gotoDevLogin(page) {
  // Note: a one-time clear before navigating, NOT page.addInitScript() — that
  // would persist and wipe localStorage again on every later page.reload()
  // in the same test (e.g. the "remembers fields across a reload" test).
  await page.goto('/dev-fhir-login.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('[data-testid="dev-login-get-token-btn"]');
}

test.describe('FHIR debug login page', () => {
  test('shows "No active token" initially', async ({ page }) => {
    await gotoDevLogin(page);
    await expect(page.getByTestId('dev-login-status')).toHaveText('No active token.');
  });

  test('errors when a required field is missing', async ({ page }) => {
    await gotoDevLogin(page);
    await page.getByTestId('dev-login-token-url').fill(TOKEN_URL);
    // Client ID / Secret left empty
    await page.getByTestId('dev-login-get-token-btn').click();
    await expect(page.locator('.notif-box.notif--error')).toContainText('required');
  });

  test('gets a token and shows the active status, then forgets it', async ({ page }) => {
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
    await page.getByTestId('dev-login-get-token-btn').click();

    await expect(page.getByTestId('dev-login-status')).toContainText('Token active', { timeout: 8000 });
    expect(await page.evaluate(() => localStorage.getItem('fhirqb.server.fhirAccessToken'))).toBe('mock-access-token');

    // Dismiss the "Token acquired" info toast (requires explicit dismissal — no auto-close).
    await page.keyboard.press('Escape');
    await expect(page.locator('.notif-backdrop')).toBeHidden();

    await page.getByTestId('dev-login-forget-token-btn').click();
    await expect(page.getByTestId('dev-login-status')).toHaveText('No active token.');
    expect(await page.evaluate(() => localStorage.getItem('fhirqb.server.fhirAccessToken'))).toBeNull();
  });

  test('remembers the entered fields across a reload', async ({ page }) => {
    await gotoDevLogin(page);
    await page.getByTestId('dev-login-token-url').fill(TOKEN_URL);
    await page.getByTestId('dev-login-client-id').fill('mock-client');
    // Blur/leave the page without clicking Get token — fields persist only after a
    // token request attempt (fields are saved right before the fetch).
    await page.route(url => url.href === TOKEN_URL, route => route.fulfill({ status: 400, body: '{}' }));
    await page.getByTestId('dev-login-client-secret').fill('mock-secret');
    await page.getByTestId('dev-login-get-token-btn').click();
    await expect(page.locator('.notif-box.notif--error')).toBeVisible();

    await page.reload();
    await page.waitForSelector('[data-testid="dev-login-get-token-btn"]');
    await expect(page.getByTestId('dev-login-token-url')).toHaveValue(TOKEN_URL);
    await expect(page.getByTestId('dev-login-client-id')).toHaveValue('mock-client');
  });
});
