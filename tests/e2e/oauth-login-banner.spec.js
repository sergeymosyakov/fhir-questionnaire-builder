// ── E2E: OAuth re-login banner (issue #63) ────────────────────────────────────
// Simulates the background scheduler detecting expiry by dispatching
// AppEvents.OAUTH_LOGIN_REQUIRED directly — real 5-minute timing is covered
// by tests/oauth-scheduler.test.js (fake timers), not e2e.
//
// Tested elements:
//   oauth-login-banner-FHIR_BASE        — the banner itself
//   oauth-login-banner-login-FHIR_BASE  — its "Log in" button

import { test, expect } from '@playwright/test';
import { freshStart } from './helpers/builder.js';

const AUTHORIZE_URL = 'https://mock-idp.example.com/oauth2/authorize';
const TOKEN_URL      = 'https://mock-idp.example.com/oauth2/token';

async function dispatchLoginRequired(page, serverKey = 'FHIR_BASE') {
  await page.evaluate((key) => {
    document.dispatchEvent(new CustomEvent('oauth:login-required', { detail: { serverKey: key } }));
  }, serverKey);
}

async function setFhirBaseOauthConfig(page) {
  await page.evaluate(({ authorize, token }) => {
    localStorage.setItem('fhirqb.server.fhirBaseOauthAuthorizeUrl', authorize);
    localStorage.setItem('fhirqb.server.fhirBaseOauthTokenUrl', token);
    localStorage.setItem('fhirqb.server.fhirBaseOauthClientId', 'mock-client-id');
  }, { authorize: AUTHORIZE_URL, token: TOKEN_URL });
}

test.describe('OAuth re-login banner', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await freshStart(page);
  });

  test('appears with the server name when a login is required, and dismiss removes it', async ({ page }) => {
    await dispatchLoginRequired(page);
    const banner = page.getByTestId('oauth-login-banner-FHIR_BASE');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(/FHIR server/i);
    await expect(banner).toContainText(/expired/i);

    await page.locator('[data-testid="oauth-login-banner-FHIR_BASE"] .oauth-login-banner-dismiss').click();
    await expect(banner).toBeHidden();
  });

  test('does not show a second banner for the same server while one is already visible', async ({ page }) => {
    await dispatchLoginRequired(page);
    await dispatchLoginRequired(page);
    await expect(page.getByTestId('oauth-login-banner-FHIR_BASE')).toHaveCount(1);
  });

  test('clicking "Log in" opens a popup and removes the banner on success', async ({ page }) => {
    const context = page.context();
    await context.route(url => url.href.startsWith(AUTHORIZE_URL), async route => {
      const state = new URL(route.request().url()).searchParams.get('state');
      const redirect = new URL('/oauth-callback', 'http://localhost:3000');
      redirect.searchParams.set('code', 'mock-code');
      redirect.searchParams.set('state', state);
      await route.fulfill({ status: 302, headers: { Location: redirect.toString() } });
    });
    await context.route(url => url.href === TOKEN_URL, route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ access_token: 'tok', refresh_token: 'rtok', expires_in: 3600 }),
    }));

    await setFhirBaseOauthConfig(page);
    await dispatchLoginRequired(page);

    const popupPromise = page.waitForEvent('popup');
    await page.getByTestId('oauth-login-banner-login-FHIR_BASE').click();
    const popup = await popupPromise;
    await popup.waitForEvent('close', { timeout: 8000 });

    await expect(page.getByTestId('oauth-login-banner-FHIR_BASE')).toBeHidden({ timeout: 8000 });
    expect(await page.evaluate(() => localStorage.getItem('fhirqb.oauthToken.FHIR_BASE.accessToken'))).toBe('tok');
  });
});
