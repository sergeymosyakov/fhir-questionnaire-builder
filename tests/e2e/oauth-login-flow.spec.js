// ── E2E: OAuth2 Authorization Code + PKCE login flow (issue #63) ─────────────
// Full flow exercised against a MOCKED IdP (page.context().route()) — no real
// OAuth server is reachable in CI/sandbox, so the authorize/token endpoints
// are intercepted; the real oauth-callback.html + js/fhir/oauth-client.js +
// js/fhir/oauth-scheduler.js run for real. See docs/FHIR-SERVER-AUTH-PLAN.md.
//
// Tested elements:
//   testFhirBaseBtn / testFhirBaseResult — Test Connection (FHIR Base Server)

import { test, expect } from '@playwright/test';

const FHIR_BASE_URL = 'https://mock-fhir.example.com/baseR4';
const AUTHORIZE_URL = 'https://mock-idp.example.com/oauth2/authorize';
const TOKEN_URL      = 'https://mock-idp.example.com/oauth2/token';
const CLIENT_ID      = 'mock-client-id';

async function setFhirBaseOauthConfig(page) {
  await page.addInitScript(({ base, authorize, token, clientId }) => {
    localStorage.clear();
    localStorage.setItem('fhirqb.server.fhirBaseUrl', base);
    localStorage.setItem('fhirqb.server.fhirBaseOauthAuthorizeUrl', authorize);
    localStorage.setItem('fhirqb.server.fhirBaseOauthTokenUrl', token);
    localStorage.setItem('fhirqb.server.fhirBaseOauthClientId', clientId);
    // Disable the default CORS proxy — it's a real Cloudflare Worker and
    // would try to fetch the mock FHIR host server-side, where Playwright's
    // network interception can't reach it.
    localStorage.setItem('fhirqb.server.corsProxyUrl', '');
  }, { base: FHIR_BASE_URL, authorize: AUTHORIZE_URL, token: TOKEN_URL, clientId: CLIENT_ID });
}

/** Mock the authorize endpoint: redirect straight to our real callback page,
 *  echoing back the `state` the app generated (PKCE state round-trip). */
async function mockAuthorizeRedirect(context, { code = 'mock-auth-code' } = {}) {
  await context.route(url => url.href.startsWith(AUTHORIZE_URL), async route => {
    const reqUrl = new URL(route.request().url());
    const state = reqUrl.searchParams.get('state');
    const redirect = new URL('/oauth-callback', 'http://localhost:3000');
    redirect.searchParams.set('code', code);
    redirect.searchParams.set('state', state);
    await route.fulfill({ status: 302, headers: { Location: redirect.toString() } });
  });
}

async function mockTokenExchange(context, body = { access_token: 'mock-access-token', refresh_token: 'mock-refresh-token', expires_in: 3600 }) {
  await context.route(url => url.href === TOKEN_URL, async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

async function mockFhirMetadata(context) {
  await context.route(url => url.href === FHIR_BASE_URL + '/metadata', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/fhir+json',
      body: JSON.stringify({ resourceType: 'CapabilityStatement', software: { name: 'MockFHIR' } }),
    });
  });
}

async function gotoSettings(page) {
  await page.goto('/settings.html');
  await page.waitForSelector('#testFhirBaseBtn');
}

test.describe('OAuth login flow (mocked IdP)', () => {
  test('Test Connection logs in via popup, exchanges the code, and succeeds', async ({ page }) => {
    const context = page.context();
    await mockAuthorizeRedirect(context);
    await mockTokenExchange(context);
    await mockFhirMetadata(context);
    await setFhirBaseOauthConfig(page);
    await gotoSettings(page);

    const popupPromise = page.waitForEvent('popup');
    await page.click('#testFhirBaseBtn');
    const popup = await popupPromise;
    await popup.waitForEvent('close', { timeout: 8000 });

    await expect(page.locator('#testFhirBaseResult')).toContainText('MockFHIR', { timeout: 8000 });
    expect(await page.evaluate(() => localStorage.getItem('fhirqb.oauthToken.FHIR_BASE.accessToken')))
      .toBe('mock-access-token');
  });

  test('a second Test Connection reuses the stored token without opening a new popup', async ({ page }) => {
    const context = page.context();
    await mockAuthorizeRedirect(context);
    await mockTokenExchange(context);
    await mockFhirMetadata(context);
    await setFhirBaseOauthConfig(page);
    await gotoSettings(page);

    const popupPromise = page.waitForEvent('popup');
    await page.click('#testFhirBaseBtn');
    const popup = await popupPromise;
    await popup.waitForEvent('close', { timeout: 8000 });
    await expect(page.locator('#testFhirBaseResult')).toContainText('MockFHIR', { timeout: 8000 });

    // Clicking again must NOT open a popup — the stored access token is still valid.
    let secondPopupOpened = false;
    page.once('popup', () => { secondPopupOpened = true; });
    await page.click('#testFhirBaseBtn');
    await expect(page.locator('#testFhirBaseResult')).toContainText('MockFHIR', { timeout: 8000 });
    expect(secondPopupOpened).toBe(false);
  });

  test('closing the login popup without completing shows a cancelled message, and retrying opens a fresh popup', async ({ page }) => {
    const context = page.context();
    await setFhirBaseOauthConfig(page);
    await gotoSettings(page);

    const popupPromise = page.waitForEvent('popup');
    await page.click('#testFhirBaseBtn');
    const popup = await popupPromise;
    await popup.close(); // user closes it without logging in

    await expect(page.locator('#testFhirBaseResult')).toContainText(/cancel/i, { timeout: 8000 });

    // Retry — a fresh popup must open (nothing stuck/stale from the cancelled attempt).
    await mockAuthorizeRedirect(context);
    await mockTokenExchange(context);
    await mockFhirMetadata(context);
    const popupPromise2 = page.waitForEvent('popup');
    await page.click('#testFhirBaseBtn');
    const popup2 = await popupPromise2;
    await popup2.waitForEvent('close', { timeout: 8000 });
    await expect(page.locator('#testFhirBaseResult')).toContainText('MockFHIR', { timeout: 8000 });
  });

  test('a blocked popup surfaces a clear error instead of hanging', async ({ page }) => {
    await setFhirBaseOauthConfig(page);
    await gotoSettings(page);
    // Simulate the browser's popup blocker: window.open() returns null.
    await page.evaluate(() => { window.open = () => null; });

    await page.click('#testFhirBaseBtn');
    await expect(page.locator('#testFhirBaseResult')).toContainText(/popup/i, { timeout: 8000 });
  });
});
