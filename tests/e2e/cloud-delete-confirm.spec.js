// ── E2E: Cloud questionnaire delete uses the in-app confirm modal ─────────────
// Deleting a row in "My Cloud Questionnaires" must open the app's confirm modal
// (not a native confirm()): Cancel keeps the row, Delete removes it.
// Supabase is mocked: a stored unexpired session + page.route on the REST API.
//
// Run: npx playwright test tests/e2e/cloud-delete-confirm.spec.js
//
// ── data-testid registry ─────────────────────────────────────────────────────
//   add-root-group-btn      "+Add Root Group" (app-ready marker)
//   load-fhir-btn / load-cloud-item   Questionnaires menu toggle / "From Cloud…" item
//   cloudModal / cloudModalBody  Cloud questionnaires modal backdrop / body
//   cloud-item-<id>         cloud list row
//   cloud-delete-<id>       row delete (×) button
//   confirmModal / confirmModalTitle / confirmModalBody / confirmModalApply / confirmModalCancel
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import { freshStart } from './helpers/builder.js';
import { openDropdownItem } from './helpers/dropdown.js';

const SESSION_KEY = 'sb-rdwmpbqadytdbshavvrl-auth-token';
const ROWS = [
  { id: 'row-a', title: 'Alpha form', url: null, updated_at: '2026-01-01T00:00:00Z' },
  { id: 'row-b', title: 'Beta form',  url: null, updated_at: '2026-01-02T00:00:00Z' },
];

const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');

function fakeSession() {
  const exp = Math.floor(Date.now() / 1000) + 3600 * 24;
  const user = {
    id: 'user-1', aud: 'authenticated', role: 'authenticated', email: 'e2e@example.com',
    app_metadata: { provider: 'github' }, user_metadata: { user_name: 'e2e' },
    created_at: '2026-01-01T00:00:00Z',
  };
  const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user.id, role: 'authenticated', exp })}.sig`;
  return { access_token: token, refresh_token: 'rt', token_type: 'bearer', expires_in: 86400, expires_at: exp, user };
}

/** Boot signed in with a mocked Supabase; returns the DELETE requests seen. */
async function bootSignedIn(page) {
  const session = fakeSession();
  await page.addInitScript(([k, s]) => {
    localStorage.clear();
    localStorage.setItem(k, JSON.stringify(s));
  }, [SESSION_KEY, session]);
  const deletes = [];
  const rows = [...ROWS];
  await page.route('**/*.supabase.co/**', route => {
    const req = route.request();
    const url = req.url();
    if (url.includes('/auth/v1/user')) {
      return route.fulfill({ json: session.user });
    }
    if (url.includes('/rest/v1/questionnaires')) {
      if (req.method() === 'DELETE') {
        deletes.push(url);
        const id = new URL(url).searchParams.get('id')?.replace('eq.', '');
        const i = rows.findIndex(r => r.id === id);
        if (i >= 0) rows.splice(i, 1);
        return route.fulfill({ status: 204, body: '' });
      }
      return route.fulfill({ json: rows });
    }
    return route.fulfill({ status: 404, json: { message: 'not mocked' } });
  });
  await freshStart(page);
  return deletes;
}

async function openCloudModal(page) {
  await openDropdownItem(page, 'load-fhir-btn', 'load-cloud-item');
  await expect(page.getByTestId('cloudModal')).toBeVisible();
  await expect(page.getByTestId('cloud-item-row-a')).toBeVisible();
}

test.describe('Cloud delete confirmation', () => {
  test('delete opens the app confirm modal, not a native dialog', async ({ page }) => {
    let nativeDialogs = 0;
    page.on('dialog', d => { nativeDialogs++; d.dismiss(); });
    await bootSignedIn(page);
    await openCloudModal(page);
    await page.getByTestId('cloud-delete-row-a').click();
    await expect(page.getByTestId('confirmModal')).toBeVisible();
    await expect(page.getByTestId('confirmModalBody')).toContainText('Alpha form');
    expect(nativeDialogs).toBe(0);
  });

  test('Cancel keeps the row and sends no DELETE', async ({ page }) => {
    const deletes = await bootSignedIn(page);
    await openCloudModal(page);
    await page.getByTestId('cloud-delete-row-a').click();
    await page.getByTestId('confirmModalCancel').click();
    await expect(page.getByTestId('confirmModal')).not.toBeVisible();
    await expect(page.getByTestId('cloud-item-row-a')).toBeVisible();
    expect(deletes).toHaveLength(0);
  });

  test('Confirm deletes only that row', async ({ page }) => {
    const deletes = await bootSignedIn(page);
    await openCloudModal(page);
    await page.getByTestId('cloud-delete-row-a').click();
    await page.getByTestId('confirmModalApply').click();
    await expect(page.getByTestId('cloud-item-row-a')).toHaveCount(0);
    await expect(page.getByTestId('cloud-item-row-b')).toBeVisible();
    expect(deletes).toHaveLength(1);
    expect(deletes[0]).toContain('id=eq.row-a');
  });
});
