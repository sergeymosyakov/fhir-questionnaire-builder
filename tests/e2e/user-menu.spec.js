// ── E2E: User menu (js/ui/menus/user-menu.js) ────────────────────────────────
// Signed-out: only "Sign in" shows. Signed-in (Supabase fully mocked: a stored
// unexpired session + page.route on the auth API, no real network): the avatar
// menu shows the user name, opens a dropdown with "Sign out", and signing out
// restores the signed-out state (with a confirm when unsaved work exists).
//
// Run: npx playwright test tests/e2e/user-menu.spec.js
//
// ── data-testid registry ─────────────────────────────────────────────────────
//   add-root-group-btn      app-ready marker
//   sign-in-btn             "Sign in" button (signed-out state)
//   user-menu-btn           avatar + name dropdown trigger (signed-in state)
//   sign-out-btn            "Sign out" menu item
//   confirmModal / confirmModalApply / confirmModalCancel   unsaved-work confirm dialog
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import { freshStart, addRootGroup } from './helpers/builder.js';
import { openDropdownItem } from './helpers/dropdown.js';

const SESSION_KEY = 'sb-rdwmpbqadytdbshavvrl-auth-token';
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');

function fakeSession() {
  const exp = Math.floor(Date.now() / 1000) + 3600 * 24;
  const user = {
    id: 'user-1', aud: 'authenticated', role: 'authenticated', email: 'e2e@example.com',
    app_metadata: { provider: 'github' }, user_metadata: { user_name: 'octo-e2e' },
    created_at: '2026-01-01T00:00:00Z',
  };
  const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user.id, role: 'authenticated', exp })}.sig`;
  return { access_token: token, refresh_token: 'rt', token_type: 'bearer', expires_in: 86400, expires_at: exp, user };
}

async function mockSupabase(page, session) {
  await page.route('**/*.supabase.co/**', route => {
    const url = route.request().url();
    if (url.includes('/auth/v1/user')) return route.fulfill({ json: session.user });
    if (url.includes('/auth/v1/logout')) return route.fulfill({ status: 204, body: '' });
    return route.fulfill({ status: 404, json: { message: 'not mocked' } });
  });
}

async function bootSignedIn(page) {
  const session = fakeSession();
  await page.addInitScript(([k, s]) => {
    localStorage.clear();
    localStorage.setItem(k, JSON.stringify(s));
  }, [SESSION_KEY, session]);
  await mockSupabase(page, session);
  await freshStart(page);
}

test.describe('User menu', () => {
  test('signed out: shows "Sign in" and hides the user menu', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await mockSupabase(page, fakeSession());
    await freshStart(page);
    await expect(page.getByTestId('sign-in-btn')).toBeVisible();
    await expect(page.getByTestId('user-menu-btn')).toBeHidden();
  });

  test('signed in: shows the user name instead of "Sign in"', async ({ page }) => {
    await bootSignedIn(page);
    await expect(page.getByTestId('user-menu-btn')).toBeVisible();
    await expect(page.getByTestId('user-menu-btn')).toContainText('octo-e2e');
    await expect(page.getByTestId('sign-in-btn')).toBeHidden();
  });

  test('the user button opens a menu with "Sign out"', async ({ page }) => {
    await bootSignedIn(page);
    await expect(page.getByTestId('user-menu-btn')).toBeVisible();
    await expect(page.getByTestId('sign-out-btn')).toBeHidden();
    await page.getByTestId('user-menu-btn').click();
    await expect(page.getByTestId('sign-out-btn')).toBeVisible();
    await expect(page.getByTestId('sign-out-btn')).toContainText('Sign out');
  });

  test('Sign out returns to the signed-out state', async ({ page }) => {
    await bootSignedIn(page);
    await expect(page.getByTestId('user-menu-btn')).toBeVisible();
    await openDropdownItem(page, 'user-menu-btn', 'sign-out-btn');
    await expect(page.getByTestId('sign-in-btn')).toBeVisible();
    await expect(page.getByTestId('user-menu-btn')).toBeHidden();
  });

  test('Sign out with unsaved work asks first; Cancel keeps the user signed in', async ({ page }) => {
    await bootSignedIn(page);
    await addRootGroup(page);
    await openDropdownItem(page, 'user-menu-btn', 'sign-out-btn');
    await expect(page.getByTestId('confirmModal')).toBeVisible();
    await page.getByTestId('confirmModalCancel').click();
    await expect(page.getByTestId('confirmModal')).toBeHidden();
    await expect(page.getByTestId('user-menu-btn')).toBeVisible();
    await expect(page.getByTestId('sign-in-btn')).toBeHidden();
  });
});
